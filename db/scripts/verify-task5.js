const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  createClient,
  databaseUrl,
  hostIsAllowedForReset,
  repoRoot,
} = require("./lib");
const {
  createSupabaseAdmin,
  insertTeamAppUser,
} = require("./team-seed-lib");

function assertDevelopmentTarget() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_TASK5_TEST !== "true") {
    throw new Error(
      "Refusing Task 5 verification: set ALLOW_TASK5_TEST=true only for a development database.",
    );
  }

  const database = databaseUrl();
  if (!process.env.DEV_DATABASE_NAME || database.database !== process.env.DEV_DATABASE_NAME) {
    throw new Error("Refusing Task 5 verification: database must match DEV_DATABASE_NAME.");
  }
  if (!hostIsAllowedForReset(database.host)) {
    throw new Error("Refusing Task 5 verification: database host is not allowlisted for development.");
  }

  const projectUrl = new URL(process.env.DEV_SUPABASE_URL || "");
  const projectRef = projectUrl.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const databaseUrlParsed = new URL(database.value);
  const directRef = databaseUrlParsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const poolerRef = decodeURIComponent(databaseUrlParsed.username)
    .match(/(?:^|\.)([a-z0-9-]{15,})$/i)?.[1];
  if (!projectRef || (directRef || poolerRef) !== projectRef) {
    throw new Error("Refusing Task 5 verification: database and Auth projects do not match.");
  }
}

function readSql(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

async function runCatalogueChecks(client) {
  const seed = readSql("db/seeds/002_seed_user_management_catalogue.sql");
  for (let run = 1; run <= 2; run += 1) {
    await client.query("BEGIN");
    try {
      await client.query(seed);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`PASS: user-management catalogue seed run ${run}`);
  }

  await client.query(readSql("db/verification/verify_task5_seeds.sql"));
  console.log("PASS: Task 5 role, module, and permission counts");

  const tokenResults = await client.query(
    readSql("db/verification/verify_password_reset_tokens.sql"),
  );
  const tokenCases = tokenResults.flatMap((result) => result.rows || [])
    .filter((row) => row.case_name);
  if (tokenCases.length !== 4 || tokenCases.some((row) => row.passed !== true)) {
    throw new Error("Valid/expired/used/blocked password-reset token verification failed.");
  }
  for (const testCase of tokenCases) {
    console.log(`PASS: password-reset token ${testCase.case_name}`);
  }

  client.on("notice", (notice) => {
    if (notice.message.startsWith("PASS:")) {
      console.log(notice.message);
    } else if (notice.message.startsWith("FAIL:")) {
      console.error(notice.message);
    }
  });
  await client.query(readSql("db/verification/verify_task5_setup_links.sql"));
  console.log("PASS: setup-link rotation, single-use, expiry, and rollback verification");
}

async function verifyProvisioningIsRepeatable() {
  const supabase = createSupabaseAdmin(
    "DEV_SUPABASE_URL",
    "DEV_SUPABASE_SERVICE_ROLE_KEY",
  );
  const email = `task5-verify-${crypto.randomUUID()}@example.test`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { first_name: "Task5", last_name: "Verification" },
  });
  if (error) {
    throw new Error(`Could not create disposable development Auth fixture: ${error.message}`);
  }

  const client = createClient();
  let transactionOpen = false;
  let failure;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;

    const role = await client.query(
      `SELECT id
       FROM public.role
       WHERE name = 'Superadmin' AND status = 'Active'`,
    );
    if (role.rowCount !== 1) {
      throw new Error("An active Superadmin role is required for the account provisioning check.");
    }

    const member = {
      firstName: "Task5",
      lastName: "Verification",
      email,
    };
    const first = await insertTeamAppUser(client, data.user, member, "Superadmin", false);
    const second = await insertTeamAppUser(client, data.user, member, "Superadmin", false);
    const fixture = await client.query(
      `SELECT app_user.id, app_user.password_hash IS NULL AS local_hash_missing,
              app_user.must_set_password, app_user.status, app_user.is_blocked,
              app_user.approval_status, role.name AS role_name
       FROM public.app_user AS app_user
       JOIN public.role AS role ON role.id = app_user.role_id
       WHERE app_user.auth_user_id = $1`,
      [data.user.id],
    );
    if (!first.created
      || second.created
      || first.id !== second.id
      || fixture.rowCount !== 1
      || fixture.rows[0].id !== first.id
      || !fixture.rows[0].local_hash_missing
      || !fixture.rows[0].must_set_password
      || fixture.rows[0].status !== "Active"
      || fixture.rows[0].is_blocked
      || fixture.rows[0].approval_status !== "approved"
      || fixture.rows[0].role_name !== "Superadmin") {
      throw new Error("Disposable account provisioning or repeatability checks failed.");
    }
  } catch (error) {
    failure = error;
  } finally {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (error) {
        failure ||= error;
      }
    }
    try {
      await client.end();
    } catch (error) {
      failure ||= error;
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      failure ||= new Error(
        `Could not remove disposable development Auth fixture: ${deleteError.message}`,
      );
    }
  }

  if (failure) {
    throw failure;
  }
  console.log("PASS: disposable Auth account provisioned once, re-seed was a no-op, fixture cleaned up");
}

async function main() {
  assertDevelopmentTarget();
  const client = createClient();
  try {
    await client.connect();
    await runCatalogueChecks(client);
  } finally {
    await client.end();
  }
  await verifyProvisioningIsRepeatable();
  console.log("All Task 5 development acceptance checks passed.");
}

main().catch((error) => {
  console.error(`Task 5 verification failed: ${error.message}`);
  process.exitCode = 1;
});
