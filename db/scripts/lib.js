const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and set it.`);
  }
  return value;
}

function databaseUrl(name = "DATABASE_URL") {
  const value = requiredEnv(name);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use the postgres:// or postgresql:// scheme.`);
  }
  if (!parsed.hostname || !parsed.username || !parsed.pathname || parsed.pathname === "/") {
    throw new Error(`${name} must include a host, database name, and username.`);
  }

  return {
    value,
    host: parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, ""),
    port: parsed.port || "5432",
    database: decodeURIComponent(parsed.pathname.slice(1)),
    username: decodeURIComponent(parsed.username),
  };
}

function createClient(urlName = "DATABASE_URL") {
  return new Client({
    connectionString: databaseUrl(urlName).value,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 10000,
    application_name: "hope-erp-db-tools",
  });
}

function migrationFiles(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`SQL directory does not exist: ${directory}`);
  }

  const filenames = fs.readdirSync(directory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/^\d+/)?.[0]);
      const rightNumber = Number(right.match(/^\d+/)?.[0]);
      return leftNumber - rightNumber || (left < right ? -1 : left > right ? 1 : 0);
    });
  const seenNumbers = new Set();

  for (const filename of filenames) {
    if (!/^\d{3,}_[a-z0-9][a-z0-9_-]*\.sql$/.test(filename)) {
      throw new Error(
        `Invalid SQL filename "${filename}". Use a zero-padded number and snake_case, e.g. 001_create_users.sql.`,
      );
    }
    const number = Number(filename.match(/^\d+/)[0]);
    if (!Number.isSafeInteger(number)) {
      throw new Error(`SQL file number in "${filename}" is too large.`);
    }
    if (seenNumbers.has(number)) {
      throw new Error(`Duplicate SQL file number "${number}". Choose a new unused number.`);
    }
    seenNumbers.add(number);
  }

  return filenames.map((filename) => {
    const filePath = path.join(directory, filename);
    const contents = fs.readFileSync(filePath, "utf8");
    return {
      filename,
      contents,
      checksum: crypto.createHash("sha256").update(contents, "utf8").digest("hex"),
    };
  });
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query("ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY");
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function localHosts() {
  return new Set(["localhost", "127.0.0.1", "::1"]);
}

function hostIsAllowedForReset(host) {
  const allowedHosts = (process.env.DEV_ALLOWED_HOSTS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  return localHosts().has(host) || allowedHosts.includes(host);
}

module.exports = {
  createClient,
  databaseUrl,
  ensureMigrationTable,
  hostIsAllowedForReset,
  migrationFiles,
  quoteIdentifier,
  repoRoot,
};
