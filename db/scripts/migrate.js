const path = require("node:path");
const readline = require("node:readline/promises");
const {
  createClient,
  databaseUrl,
  ensureMigrationTable,
  hostIsAllowedForReset,
  migrationFiles,
  quoteIdentifier,
  repoRoot,
} = require("./lib");

const migrationsDirectory = path.join(repoRoot, "db", "migrations");
const advisoryLockKey = 684219;

function recordsByFilename(result) {
  return new Map(result.rows.map((row) => [row.filename, row]));
}

async function migrationState(client, files) {
  await ensureMigrationTable(client);
  const appliedResult = await client.query(
    "SELECT filename, checksum, applied_at FROM public.schema_migrations ORDER BY filename",
  );
  const applied = recordsByFilename(appliedResult);
  const localNames = new Set(files.map((file) => file.filename));
  const missing = [...applied.keys()].filter((filename) => !localNames.has(filename));
  const mismatched = files.filter((file) => {
    const record = applied.get(file.filename);
    return record && record.checksum !== file.checksum;
  });

  return { applied, missing, mismatched };
}

function assertChecksumsUnchanged(state) {
  if (state.mismatched.length || state.missing.length) {
    const details = [
      ...state.mismatched.map((file) => `${file.filename}: checksum differs from the applied version`),
      ...state.missing.map((filename) => `${filename}: applied migration is missing from db/migrations`),
    ];
    throw new Error(
      `Migration history does not match the repository:\n- ${details.join("\n- ")}\nRestore the original migration; never edit or remove an applied migration.`,
    );
  }
}

async function showStatus(client, files) {
  const { applied, missing, mismatched } = await migrationState(client, files);
  const connection = databaseUrl();
  console.log(`Database: ${connection.database} (${connection.host})`);
  console.log("Migrations:");
  if (files.length === 0 && missing.length === 0) {
    console.log("  No migration files found.");
  }
  for (const file of files) {
    const record = applied.get(file.filename);
    if (!record) {
      console.log(`  [pending] ${file.filename}`);
    } else if (record.checksum !== file.checksum) {
      console.log(`  [checksum mismatch] ${file.filename}`);
    } else {
      console.log(`  [applied] ${file.filename} (${record.applied_at.toISOString()})`);
    }
  }
  for (const filename of missing) {
    console.log(`  [missing locally] ${filename}`);
  }
  assertChecksumsUnchanged({ missing, mismatched });
}

async function applyMigrations(client, files) {
  const state = await migrationState(client, files);
  assertChecksumsUnchanged(state);
  if (files.length === 0) {
    console.log("No migration files found. schema_migrations is ready.");
    return;
  }

  for (const file of files) {
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock($1)", [advisoryLockKey]);
      const existing = await client.query(
        "SELECT checksum FROM public.schema_migrations WHERE filename = $1",
        [file.filename],
      );
      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum !== file.checksum) {
          throw new Error(
            `${file.filename} was applied with a different checksum. Restore the original migration; do not edit applied migrations.`,
          );
        }
        await client.query("COMMIT");
        console.log(`Already applied: ${file.filename}`);
        continue;
      }

      console.log(`Applying: ${file.filename}`);
      await client.query(file.contents);
      await client.query(
        "INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)",
        [file.filename, file.checksum],
      );
      await client.query("COMMIT");
      console.log(`Applied: ${file.filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file.filename} failed: ${error.message}`, { cause: error });
    }
  }
}

async function resetDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Reset refused: NODE_ENV=production.");
  }
  if (process.env.ALLOW_DATABASE_RESET !== "true") {
    throw new Error("Reset refused: set ALLOW_DATABASE_RESET=true only for a development database.");
  }

  const target = databaseUrl();
  const expectedName = process.env.DEV_DATABASE_NAME;
  if (!expectedName || target.database !== expectedName) {
    throw new Error(
      `Reset refused: target database "${target.database}" must exactly match DEV_DATABASE_NAME.`,
    );
  }
  if (!hostIsAllowedForReset(target.host)) {
    throw new Error(
      `Reset refused: host "${target.host}" is not localhost or an exact entry in DEV_ALLOWED_HOSTS.`,
    );
  }

  const admin = databaseUrl("DATABASE_ADMIN_URL");
  if (admin.host !== target.host || admin.port !== target.port) {
    throw new Error("Reset refused: DATABASE_ADMIN_URL must use the same host and port as DATABASE_URL.");
  }
  if (admin.database === target.database) {
    throw new Error("Reset refused: DATABASE_ADMIN_URL must connect to a maintenance database, not the target.");
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Reset requires an interactive terminal so the database name can be confirmed.");
  }
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      `This permanently drops all data in "${target.database}". Type RESET ${target.database} to continue: `,
    );
    if (answer !== `RESET ${target.database}`) {
      throw new Error("Reset cancelled: confirmation did not match.");
    }
  } finally {
    prompt.close();
  }

  const client = createClient("DATABASE_ADMIN_URL");
  await client.connect();
  try {
    const owner = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [target.username]);
    if (owner.rowCount === 0) {
      throw new Error(
        `Reset refused: database owner "${target.username}" does not exist on the target PostgreSQL server.`,
      );
    }
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [target.database]);
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(target.database)} WITH (FORCE)`);
    await client.query(
      `CREATE DATABASE ${quoteIdentifier(target.database)} OWNER ${quoteIdentifier(target.username)}`,
    );
    console.log(`Recreated development database "${target.database}" owned by "${target.username}".`);
  } finally {
    await client.end();
  }
}

async function withDatabase(action) {
  const client = createClient();
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

async function main() {
  const command = process.argv[2];
  if (command === "reset") {
    await resetDatabase();
    return;
  }

  if (!["migrate", "status"].includes(command)) {
    throw new Error("Usage: npm run db:migrate | npm run db:status | npm run db:reset");
  }

  const files = migrationFiles(migrationsDirectory);
  await withDatabase(async (client) => {
    if (command === "status") {
      await showStatus(client, files);
    } else {
      await applyMigrations(client, files);
    }
  });
}

main().catch((error) => {
  console.error(`Database command failed: ${error.message}`);
  process.exitCode = 1;
});
