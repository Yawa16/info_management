const path = require("node:path");
const { createClient, migrationFiles, repoRoot } = require("./lib");

const seedsDirectory = path.join(repoRoot, "db", "seeds");

async function main() {
  const files = migrationFiles(seedsDirectory);
  if (files.length === 0) {
    console.log("No seed files found. Add idempotent SQL seeds when the schema is ready.");
    return;
  }

  const client = createClient();
  await client.connect();
  try {
    for (const file of files) {
      await client.query("BEGIN");
      try {
        console.log(`Running seed: ${file.filename}`);
        await client.query(file.contents);
        await client.query("COMMIT");
        console.log(`Seed complete: ${file.filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Seed ${file.filename} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Seed command failed: ${error.message}`);
  process.exitCode = 1;
});
