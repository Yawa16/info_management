const fs = require("node:fs");
const path = require("node:path");
const {
  createClient,
  databaseUrl,
  hostIsAllowedForReset,
  migrationFiles,
  repoRoot,
} = require("./lib");

const migrationFilename = "007_customer_product_access.sql";

function assertDevelopmentTarget() {
  if (
    process.env.NODE_ENV === "production"
    || process.env.ALLOW_SPRINT2_TEST !== "true"
  ) {
    throw new Error(
      "Refusing Sprint 2 verification: set ALLOW_SPRINT2_TEST=true only for a development database.",
    );
  }

  const target = databaseUrl();
  if (!process.env.DEV_DATABASE_NAME || target.database !== process.env.DEV_DATABASE_NAME) {
    throw new Error(
      "Refusing Sprint 2 verification: database must match DEV_DATABASE_NAME.",
    );
  }
  if (!hostIsAllowedForReset(target.host)) {
    throw new Error(
      "Refusing Sprint 2 verification: database host is not allowlisted for development.",
    );
  }

  if (!process.env.DEV_SUPABASE_URL) {
    throw new Error(
      "Refusing Sprint 2 verification: DEV_SUPABASE_URL is required for target matching.",
    );
  }
  const projectUrl = new URL(process.env.DEV_SUPABASE_URL);
  const projectRef = projectUrl.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const databaseUrlParsed = new URL(target.value);
  const directRef = databaseUrlParsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const poolerRef = decodeURIComponent(databaseUrlParsed.username)
    .match(/(?:^|\.)([a-z0-9-]{15,})$/i)?.[1];
  if (!projectRef || (directRef || poolerRef) !== projectRef) {
    throw new Error(
      "Refusing Sprint 2 verification: database and development project do not match.",
    );
  }
}

async function main() {
  assertDevelopmentTarget();

  const migrations = migrationFiles(path.join(repoRoot, "db", "migrations"));
  const migration = migrations.find((file) => file.filename === migrationFilename);
  if (!migration) {
    throw new Error(`Required migration is missing: ${migrationFilename}`);
  }

  const verificationSql = fs.readFileSync(
    path.join(repoRoot, "db", "verification", "verify_customer_product_access.sql"),
    "utf8",
  )
    .replace(/^\\set[^\r\n]*\r?\n/, "")
    .replace(/(^|\r?\n)BEGIN;\s*/i, "$1")
    .replace(/(^|\r?\n)ROLLBACK;\s*$/i, "$1");
  const client = createClient();
  let transactionOpen = false;

  client.on("notice", (notice) => {
    console.log(notice.message);
  });

  try {
    await client.connect();
    const migrationTable = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS table_name",
    );
    if (!migrationTable.rows[0].table_name) {
      throw new Error(
        "Migration history is missing; apply the existing migrations before Sprint 2 verification.",
      );
    }

    const appliedResult = await client.query(
      "SELECT checksum FROM public.schema_migrations WHERE filename = $1",
      [migrationFilename],
    );
    if (
      appliedResult.rowCount > 0
      && appliedResult.rows[0].checksum !== migration.checksum
    ) {
      throw new Error(
        `${migrationFilename} is recorded with a different checksum; do not alter an applied migration.`,
      );
    }

    await client.query("BEGIN");
    transactionOpen = true;
    if (appliedResult.rowCount === 0) {
      await client.query(migration.contents);
    }
    await client.query(verificationSql);
    await client.query("ROLLBACK");
    transactionOpen = false;
    console.log(
      `PASS: Sprint 2 verification completed; ${migrationFilename} and all test writes were rolled back.`,
    );
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Sprint 2 verification failed: ${error.message}`);
  process.exitCode = 1;
});
