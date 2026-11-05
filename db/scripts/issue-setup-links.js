const crypto = require("node:crypto");
const { createClient } = require("./lib");

const setupLinkLifetimeMs = 24 * 60 * 60 * 1000;

function setupPageUrl() {
  const value = process.env.APP_BASE_URL;
  if (!value) {
    throw new Error("APP_BASE_URL is required to build setup links.");
  }

  let base;
  try {
    base = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL must be a valid http(s) origin.");
  }
  if (!["http:", "https:"].includes(base.protocol)
    || base.username || base.password || base.pathname !== "/" || base.search || base.hash
    || (base.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(base.hostname))) {
    throw new Error("APP_BASE_URL must be an HTTPS origin, or an HTTP localhost origin.");
  }
  return new URL("/set-password", base);
}

async function main() {
  const baseUrl = setupPageUrl();
  const client = createClient();
  await client.connect();
  const links = [];
  try {
    await client.query("BEGIN");
    const users = await client.query(
      `SELECT id, email
       FROM public.app_user
       WHERE password_hash IS NULL
         AND must_set_password = TRUE
         AND status = 'Active'
         AND is_blocked = FALSE
       ORDER BY id
       FOR UPDATE`,
    );

    for (const user of users.rows) {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
      const expiresAt = new Date(Date.now() + setupLinkLifetimeMs);

      await client.query(
        `UPDATE public.password_reset_token
         SET used_at = CURRENT_TIMESTAMP,
             status = 'Inactive',
             stamp = 'EDITED token-rotation ' ||
               to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')
         WHERE user_id = $1
           AND purpose = 'set_password'
           AND used_at IS NULL
           AND status = 'Active'`,
        [user.id],
      );
      await client.query(
        `INSERT INTO public.password_reset_token (user_id, token_hash, purpose, expires_at)
         VALUES ($1, $2, 'set_password', $3)`,
        [user.id, tokenHash, expiresAt],
      );

      const url = new URL(baseUrl);
      url.searchParams.set("token", rawToken);
      links.push({ email: user.email, url: url.toString(), expiresAt });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  if (links.length === 0) {
    console.log("No active accounts require first-time password setup.");
    return;
  }
  for (const link of links) {
    console.log(`${link.email} (expires ${link.expiresAt.toISOString()}): ${link.url}`);
  }
  console.log("These one-time links are shown only here. Do not copy them into logs, tickets, or source files.");
}

main().catch((error) => {
  console.error(`Setup-link issuance failed: ${error.message}`);
  process.exitCode = 1;
});
