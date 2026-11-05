import "server-only";

import { createHash } from "node:crypto";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const setupTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function tokenDigest(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for password setup.");
  }

  return new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 10000,
    application_name: "hope-erp-password-setup",
  });
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is required for password setup.");
  }

  let projectUrl: URL;
  try {
    projectUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
  if (!["https:", "http:"].includes(projectUrl.protocol)
    || projectUrl.pathname !== "/"
    || projectUrl.search
    || projectUrl.hash
    || projectUrl.username
    || projectUrl.password
    || (projectUrl.protocol === "http:"
      && !["localhost", "127.0.0.1", "::1"].includes(projectUrl.hostname))) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a Supabase project origin.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function isSetupTokenValid(token: string) {
  if (!setupTokenPattern.test(token)) {
    return false;
  }

  const client = createDatabaseClient();
  await client.connect();
  try {
    const result = await client.query(
      `SELECT 1
       FROM public.password_reset_token AS token
       JOIN public.app_user AS app_user ON app_user.id = token.user_id
       WHERE token.token_hash = $1
         AND token.purpose = 'set_password'
         AND token.used_at IS NULL
         AND token.expires_at > CURRENT_TIMESTAMP
         AND token.status = 'Active'
         AND app_user.password_hash IS NULL
         AND app_user.must_set_password = TRUE
         AND app_user.approval_status = 'approved'
         AND app_user.status = 'Active'
         AND app_user.is_blocked = FALSE
       LIMIT 1`,
      [tokenDigest(token)],
    );
    return result.rowCount === 1;
  } finally {
    await client.end();
  }
}

export async function setInitialPassword(token: string, password: string) {
  if (!setupTokenPattern.test(token)) {
    return false;
  }

  const client = createDatabaseClient();
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const result = await client.query(
      `SELECT token.id AS token_id,
              app_user.id AS app_user_id,
              app_user.email,
              app_user.auth_user_id
       FROM public.password_reset_token AS token
       JOIN public.app_user AS app_user ON app_user.id = token.user_id
       WHERE token.token_hash = $1
         AND token.purpose = 'set_password'
         AND token.used_at IS NULL
         AND token.expires_at > CURRENT_TIMESTAMP
         AND token.status = 'Active'
         AND app_user.password_hash IS NULL
         AND app_user.must_set_password = TRUE
         AND app_user.approval_status = 'approved'
         AND app_user.status = 'Active'
         AND app_user.is_blocked = FALSE
       FOR UPDATE OF token, app_user`,
      [tokenDigest(token)],
    );
    if (result.rowCount !== 1) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return false;
    }

    const account = result.rows[0] as {
      token_id: string;
      app_user_id: string;
      email: string;
      auth_user_id: string;
    };
    await client.query(
      "SELECT set_config('app.current_user', $1, TRUE)",
      [account.email],
    );

    const supabase = createSupabaseAdmin();
    const { error } = await supabase.auth.admin.updateUserById(
      account.auth_user_id,
      { password },
    );
    if (error) {
      throw new Error(`Supabase could not update the account password: ${error.message}`);
    }

    const consumed = await client.query(
      `UPDATE public.password_reset_token
       SET used_at = CURRENT_TIMESTAMP,
           status = 'Inactive',
           stamp = 'EDITED password-setup ' ||
             to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')
       WHERE id = $1
         AND used_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
         AND status = 'Active'
       RETURNING id`,
      [account.token_id],
    );
    if (consumed.rowCount !== 1) {
      throw new Error("Setup token expired or was consumed during password update.");
    }

    const updated = await client.query(
      `UPDATE public.app_user
       SET must_set_password = FALSE,
           stamp = 'EDITED password-setup ' ||
             to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')
       WHERE id = $1
         AND password_hash IS NULL
         AND must_set_password = TRUE
         AND status = 'Active'
         AND is_blocked = FALSE
       RETURNING id`,
      [account.app_user_id],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Account is no longer eligible for password setup.");
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return true;
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    await client.end();
  }
}
