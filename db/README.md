# Hope, Inc. ERP database setup

The source `HopeDB_audit.sql` uses PostgreSQL-specific syntax, so the project database engine is PostgreSQL. The recommended team database is a **non-production Supabase project**, which hosts PostgreSQL for you. Students do not need to install or run a local database server, and Docker is not used. The migration and seed runner uses Node.js 20+ and works on Windows, macOS, and Linux.

## Repository layout

```text
.
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── db/
    ├── README.md
    ├── migrations/       # numbered, forward-only PostgreSQL SQL files
    ├── seeds/            # repeatable, idempotent SQL seed files
    └── scripts/
        ├── lib.js
        ├── migrate.js
        └── seed.js
```

The runner creates only `public.schema_migrations` for bookkeeping. **There are no HOPE application-table migrations or seeds yet**, by request. A temporary empty migration was used to smoke-test the runner and removed afterward.

## Team database approach

| Approach | Advantages | Tradeoffs |
| --- | --- | --- |
| (a) Each student installs PostgreSQL locally | Private database; can work offline | Everyone installs and maintains a database server |
| (b) One shared hosted Supabase development project | No local database server; simple onboarding; shared integration target | Needs internet and team coordination; data is shared |
| (c) Local PostgreSQL for daily work plus shared Supabase integration | Isolated local work and common integration target | Requires local PostgreSQL as well as a shared project |

**Recommendation: (b), a free-tier, non-production Supabase project.** Supabase provides the PostgreSQL engine; there is no separate engine installation for this default. Keep production in a separate project. Every environment uses the same numbered migration files and runner, so migrations produce the same schema wherever they are applied. Do not run destructive reset commands on a shared or production project.

The DB admin should privately give migration access only to teammates responsible for applying reviewed migrations. Never put a database password, connection URL, Supabase service-role key, or other credential in Git, a pull request, browser code, or chat. Supabase Auth's public client key is not a database password.

## Student setup (Windows, macOS, and Linux)

### 1. Provision the PostgreSQL database

Create a free-tier Supabase project for development or ask the team admin for access to the team's non-production project. Supabase provisions PostgreSQL and a database (normally named `postgres`); students do not issue `CREATE DATABASE` on the hosted service.

In the project dashboard:

1. In **Project Settings → API**, copy the project URL and public anon/publishable key.
2. In **Connect**, copy the PostgreSQL connection URI and note its host, port, and database name.
3. Keep the existing project database owner password private. The DB admin should distribute a dedicated migration connection privately to approved maintainers rather than sharing the project owner's credentials.

There are no application tables in this task, so no runtime application database login or table grants are needed yet. When tables are introduced, the team will add least-privilege app access in a reviewed migration; do not use the migration credential from application code. For a local-only alternative, an administrator creates a `hope_erp_dev` database owned by a dedicated migration role and creates a separate `hope_app` login with only `CONNECT` and schema `USAGE`; grant table/sequence access later, only as needed. Never use a PostgreSQL superuser as the application login.

Expected result: the team admin can connect to the non-production PostgreSQL database using the private migration URL. No local PostgreSQL server installation is needed for the recommended hosted workflow. Optional local PostgreSQL server packages are available from the official [PostgreSQL downloads](https://www.postgresql.org/download/); use PostgreSQL 15 or newer if choosing the local alternative.

For local development only, after installing PostgreSQL, connect as the local administrator and create separate migration and application logins and a disposable database:

```text
psql -U postgres -h localhost -d postgres
```

At the `psql` prompt, set passwords interactively with `\password` (they are not echoed):

```sql
CREATE ROLE hope_migrator LOGIN CREATEDB;
\password hope_migrator
CREATE ROLE hope_app LOGIN;
\password hope_app
CREATE DATABASE hope_erp_dev OWNER hope_migrator;
GRANT CONNECT ON DATABASE hope_erp_dev TO hope_app;
\connect hope_erp_dev
GRANT USAGE ON SCHEMA public TO hope_app;
\q
```

Expected output includes `CREATE ROLE`, `CREATE DATABASE`, and `GRANT`; password prompts do not echo secrets. Use `hope_migrator` only for `DATABASE_URL` and local migrations. `hope_app` has only database-connect and schema-usage permissions until reviewed migrations create tables and explicitly grant the minimal required table privileges.

### 2. Install Node.js

Install Node.js 20 LTS or newer from the official [Node.js downloads](https://nodejs.org/en/download).

```text
node --version
npm --version
```

Expected output resembles `v20.x.x` (or newer) and an npm version number.

### 3. Clone the repository

Clone the team's Git repository using Git or your IDE, then open a terminal at the repository root.

```text
git status --short --branch
```

Expected output shows the current branch and no unexpected changes.

### 4. Create your private `.env`

Copy the committed template without overwriting an existing file:

```text
node -e "require('node:fs').copyFileSync('.env.example','.env',{flag:'wx'})"
```

If `.env` already exists, keep it and edit the needed values locally; do not overwrite or share it. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Step 1, and set `DATABASE_URL` to the private PostgreSQL migration connection URL provided by the DB admin. URL-encode special characters in the password. Example placeholders only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
DATABASE_URL=postgresql://hope_migrator:encoded-password@your-db-host:5432/postgres
DATABASE_SSL=true
ALLOW_DATABASE_RESET=false
DEV_DATABASE_NAME=hope_erp_dev
DEV_ALLOWED_HOSTS=
DATABASE_ADMIN_URL=
NODE_ENV=development
```

The runner reads `.env.local` first, then `.env`; if a legacy `.env.local` exists, it takes precedence. The shell's existing environment variables take precedence over both files. Both `.env` and `.env.local` are Git-ignored. Check without revealing their contents:

```text
git status --short
```

Expected output does not list either environment file.

### 5. Install dependencies

Run in the repository root:

```text
npm ci
```

Expected output completes successfully and installs locked dependencies into `node_modules/`.

On Windows PowerShell, if `npm` is blocked because the PowerShell execution policy prevents running `npm.ps1`, use the Windows command shim instead:

```powershell
npm.cmd ci
```

This avoids changing the machine's execution policy. The same applies to the npm commands in the next steps: use `npm.cmd` in PowerShell, or use `npm` in Command Prompt, macOS Terminal, or Linux shells.

### 6. Check and apply migrations

Run:

```text
npm run db:status
npm run db:migrate
npm run db:status
```

Expected first status output resembles:

```text
Database: postgres (your-db-host)
Migrations:
  No migration files found.
```

Expected migrate output:

```text
No migration files found. schema_migrations is ready.
```

Expected final status output again says no migration files found. The runner creates `public.schema_migrations` if missing. It applies future numbered SQL files in filename order, each in a transaction, and records the filename and SHA-256 checksum in the same transaction. It fails if an applied migration's file is changed or missing.

### 7. Run seeds

```text
npm run db:seed
```

Expected output:

```text
No seed files found. Add idempotent SQL seeds when the schema is ready.
```

There are no seed files yet. When added, seed files must be idempotent (for example, use `INSERT ... ON CONFLICT DO NOTHING`) and the seed runner executes each in its own transaction.

### 8. Verify the database

In the Supabase dashboard, open **SQL Editor** and run:

```sql
SELECT current_database();
SELECT filename, checksum, applied_at
FROM public.schema_migrations
ORDER BY filename;
```

Expected: `current_database()` returns `postgres` (or the configured project database name). The second query returns **zero rows** because no application migrations exist yet; the tracking table itself exists.

## Commands

| Command | Effect |
| --- | --- |
| `npm run db:status` | Shows applied and pending migration files; fails if applied checksums differ or files are missing |
| `npm run db:migrate` | Creates the tracking table and applies pending migrations in filename order |
| `npm run db:seed` | Runs each idempotent seed SQL file in its own transaction |
| `npm run db:reset` | Drops and recreates a development database only after safety checks and interactive confirmation |

### Reset a local development database

Reset permanently deletes all data. It requires `ALLOW_DATABASE_RESET=true`, an exact `DEV_DATABASE_NAME` match, a target host of localhost or an exact hostname in `DEV_ALLOWED_HOSTS`, a separate maintenance `DATABASE_ADMIN_URL` on the same host and port, and an interactive terminal. The runner refuses production mode and non-interactive use.

**Never enable reset for a shared Supabase or production database.** The default `.env.example` disables reset and leaves the allowlist empty. For a local disposable database only, set the reset variables in `.env`, run `npm run db:reset`, and type the exact `RESET hope_erp_dev` confirmation. Apply migrations and seeds again afterward, then set `ALLOW_DATABASE_RESET=false`. For a disposable hosted Supabase test database, create a fresh project through the dashboard instead.

Rollback for this setup is by recreating a disposable development database/project. Migrations are forward-only; never manually delete migration history from a shared database.

## Team migration rules

- Never edit an applied migration; add a new numbered migration instead.
- Keep one migration per pull request.
- Pull the latest branch before choosing a migration number.
- Use zero-padded increasing numbers and snake_case, such as `001_create_customer.sql`.
- If two people choose the same number, the author whose migration is still unapplied pulls the latest branch, renames their file to the next unused number, and updates their pull request. Never rename an applied migration.
- Do not add `BEGIN` or `COMMIT`; the runner wraps each migration and its tracking insert in one transaction.
- Keep seeds idempotent. Seeds are not recorded in `schema_migrations`, so the runner may execute them again.
- Never commit `.env`, `.env.local`, passwords, connection strings, or service-role keys.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Port in use | For hosted Supabase, use the exact host and port from **Connect**. For local PostgreSQL, check whether another service uses port `5432`; update the connection URL if needed. |
| Authentication failed | Check username, password, database, and port in the private connection URL. URL-encode reserved characters in the password. Ask the DB admin to verify the migration login; do not switch to a production credential. |
| Permission denied | Ask the DB admin to check the migration login's `CONNECT`, schema `USAGE, CREATE`, and required Supabase Auth grants. Do not use the public client key as a database password. |
| Migration checksum mismatch | Never edit or delete the applied file. Restore it from Git history and put changes in a new migration. |
| Wrong engine version | Supabase hosts PostgreSQL. The local alternative requires PostgreSQL 15 or newer; this runner is not configured for MySQL or SQLite. |
| PowerShell blocks `npm` | Run `npm.cmd` in PowerShell or switch the VS Code terminal to Command Prompt. Do not change the execution policy just for this project. |
| Hosted SSL connection fails | Use the Supabase-provided connection URI and keep `DATABASE_SSL=true`; verify the network permits the selected connection endpoint. |
