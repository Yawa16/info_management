# Hope, Inc. ERP database setup

PostgreSQL is the database engine. The source `HopeDB_audit.sql` uses PostgreSQL-specific syntax, including JSONB and PL/pgSQL trigger functions. Use PostgreSQL 15 or newer for local development. The Node.js tools below work on Windows, macOS, and Linux.

## Repository layout

```text
.
├── .env.example
├── .gitignore
├── package.json
├── db/
│   ├── README.md
│   ├── migrations/       # numbered, forward-only PostgreSQL SQL files
│   ├── seeds/            # repeatable, idempotent seed SQL files
│   └── scripts/          # cross-platform Node.js migration and seed tools
└── README.md
```

No application tables or schema migrations are included yet. The migration runner creates only its own `public.schema_migrations` tracking table.

## Team database approach

| Approach | Advantages | Tradeoffs |
| --- | --- | --- |
| (a) Each student installs PostgreSQL locally | Isolated, fast, and works offline | Every student must maintain a local database and apply changes |
| (b) One shared hosted dev database | Easy onboarding; no local database server needed | Shared data can be overwritten, and the team depends on network access |
| (c) Local development plus a shared integration database | Safe daily work and a common place to verify team changes | Requires local PostgreSQL plus careful separation of local and shared credentials |

**Recommendation: (c).** Install PostgreSQL 15+ locally for daily work; use one free-tier hosted PostgreSQL database (the team's Supabase project) for integration checks. Both environments use the same numbered migration files and Node runner, so they receive the same schema. Never point the reset command at the shared integration database. Do not use Docker.

For students who cannot install a local server, the team may temporarily use the shared integration database with their individual database login; avoid destructive actions and coordinate data changes.

## Student setup (Windows, macOS, and Linux)

### 1. Install PostgreSQL 15+

Install PostgreSQL 15 or newer using the official [Windows installer](https://www.postgresql.org/download/windows/), [macOS packages](https://www.postgresql.org/download/macosx/), or your Linux distribution's PostgreSQL package instructions at [postgresql.org/download](https://www.postgresql.org/download/). On Windows, include command-line tools in the installer. During local setup, make note of the administrator username (commonly `postgres`) and port (commonly `5432`). You need the database server and `psql` command-line client; Docker is not needed.

Verify the client is installed and on your PATH:

```text
psql --version
```

Expected output resembles `psql (PostgreSQL) 15.x` or newer.

Install Node.js 20 LTS or newer from the official [Node.js downloads](https://nodejs.org/en/download). Verify:

```text
node --version
npm --version
```

Expected output resembles `v20.x.x` and an npm version number.

### 2. Create a local development database and least-privilege app user

Connect using your local PostgreSQL administrator account:

```text
psql -U postgres -h localhost -d postgres
```

At the `postgres=#` prompt, create two separate logins without putting passwords in shell history, set their passwords interactively, and create the development database:

```sql
CREATE ROLE hope_app LOGIN;
\password hope_app
CREATE ROLE hope_migrator LOGIN;
\password hope_migrator
CREATE DATABASE hope_erp_dev OWNER hope_migrator;
GRANT CONNECT ON DATABASE hope_erp_dev TO hope_app;
\q
```

Use unique local development passwords when prompted. `hope_app` has only database connect access and is the least-privilege runtime login; grant it only the specific table/sequence permissions the application needs after migrations create those objects. `hope_migrator` owns only the development database and is used by migration and seed commands; never use it in application code. Do not use the PostgreSQL superuser in the application.

Expected output includes `CREATE ROLE` and `CREATE DATABASE`. The password prompt does not echo the password.

For the hosted integration database, a project owner should create separate `hope_migrator` and `hope_app` database logins over a secure `psql` session. Grant the migration login `CONNECT` on the project database and `USAGE, CREATE` on `public`; grant the app login only `CONNECT` and `USAGE` initially, then only the required table privileges after tables exist. Store the individual connection URLs in `.env`; keep each password private. Set `DATABASE_SSL=true`. Do not enable reset for the shared database.

### 3. Clone the repository

Clone the team repository using Git or your IDE. In a terminal, enter the checked-out repository directory.

Verify you are at the project root:

```text
git status --short --branch
```

Expected output shows your current branch and no unexpected changes.

### 4. Create your private `.env`

Copy the committed template:

```text
Windows PowerShell:  Copy-Item .env.example .env
macOS/Linux shell:   cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your own local database password:

```dotenv
DATABASE_URL=postgresql://hope_migrator:YOUR_MIGRATOR_PASSWORD@localhost:5432/hope_erp_dev
APP_DATABASE_URL=postgresql://hope_app:YOUR_APP_PASSWORD@localhost:5432/hope_erp_dev
DATABASE_SSL=false
ALLOW_DATABASE_RESET=false
DEV_DATABASE_NAME=hope_erp_dev
DEV_ALLOWED_HOSTS=
DATABASE_ADMIN_URL=postgresql://postgres:YOUR_LOCAL_ADMIN_PASSWORD@localhost:5432/postgres
NODE_ENV=development
```

For Supabase, use the project's PostgreSQL connection URL instead and set `DATABASE_SSL=true`. Keep reset disabled. Add a hosted hostname to `DEV_ALLOWED_HOSTS` only if the team explicitly chooses that exact development host for destructive reset; never add a production/shared host. `.env` is ignored by Git; never commit it or share its passwords.

Expected output: `.env` exists locally. It should not appear in `git status --short`.

### 5. Install project dependencies

Run the same npm command on every operating system:

```text
npm install
```

Expected output reports the packages added/audited and creates `node_modules/` and `package-lock.json`.

### 6. Check migration status

```text
npm run db:status
```

Expected output includes `Database: hope_erp_dev (localhost)` and `No migration files found.` The runner creates the `schema_migrations` metadata table. No HOPE application tables are created in this task.

### 7. Apply pending migrations

```text
npm run db:migrate
```

Expected output:

```text
No migration files found. schema_migrations is ready.
```

Once the team adds numbered SQL migrations, this command applies them in filename order and stores their SHA-256 checksums. Each migration runs in a transaction, including the tracking-row insert.

### 8. Run seed files

```text
npm run db:seed
```

Expected output:

```text
No seed files found. Add idempotent SQL seeds when the schema is ready.
```

When seed files are added, each one is run in its own transaction. Seed SQL must use PostgreSQL upserts (`INSERT ... ON CONFLICT ...`) or another idempotent pattern because the command safely runs all seed files every time.

### 9. Verify the database

Run the following using `psql` with the same database URL settings:

```sql
SELECT current_database();
SELECT filename, checksum, applied_at FROM public.schema_migrations ORDER BY filename;
```

Expected results: the first query returns `hope_erp_dev`; the second returns zero rows because no application migrations exist yet. The tracking table itself exists.

## Commands

All team commands use npm and work the same on Windows, macOS, and Linux:

| Command | Effect |
| --- | --- |
| `npm run db:status` | Shows applied/pending migrations; exits non-zero for changed or missing applied migration files |
| `npm run db:migrate` | Creates migration tracking if needed and applies pending migrations in filename order |
| `npm run db:seed` | Runs each idempotent seed SQL file in its own transaction |
| `npm run db:reset` | Destructive development-only reset; requires explicit configuration and interactive confirmation |

### Reset a local development database

Reset permanently deletes all data. The command refuses to run unless `ALLOW_DATABASE_RESET=true`, the target database name exactly equals `DEV_DATABASE_NAME`, the host is localhost or an exact hostname in `DEV_ALLOWED_HOSTS`, and `DATABASE_ADMIN_URL` uses the same host and port but connects to a maintenance database. It also refuses non-interactive use and `NODE_ENV=production`.

For a local-only reset, set `ALLOW_DATABASE_RESET=true` in `.env`, ensure `DEV_DATABASE_NAME=hope_erp_dev`, and leave `DEV_ALLOWED_HOSTS` empty. Run:

```text
npm run db:reset
```

At the prompt, type the exact text `RESET hope_erp_dev`. The database is dropped and recreated owned by the migration user in `DATABASE_URL`. Then apply migrations and seeds again. Restore `ALLOW_DATABASE_RESET=false` afterward. This command is not for the shared Supabase database.

## Migration and seed rules

- Never edit an applied migration. Add a new migration instead.
- Use one migration per pull request.
- Pull the latest branch before choosing a migration number.
- Name files with zero-padded increasing numbers and snake_case, for example `001_create_customers.sql`.
- The runner orders SQL files by their numeric prefix and refuses duplicate migration/seed numbers.
- If two people choose the same number, the person whose change has not merged should pull the latest branch, rename their **unapplied** migration to the next unused number, and update its PR. Never rename or edit a migration already applied by anyone.
- Migration files must not include `BEGIN` or `COMMIT`; the runner wraps each file and its checksum record in one transaction.
- Once a migration is applied, preserve its exact contents. The runner compares SHA-256 and refuses changed or missing migration files.
- Seed files also use numbered snake_case names and must be idempotent, typically with `ON CONFLICT ... DO UPDATE` or `DO NOTHING`.
- Never commit `.env`, passwords, connection strings, or service-role keys.
- Keep local and shared hosted connection settings separate; do not run reset against shared integration or production.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Port in use | PostgreSQL commonly uses `5432`. Check whether another local PostgreSQL service is running; choose an unused port and update `DATABASE_URL`. |
| Authentication failed | Confirm the username, password, database name, and port. URL-encode special characters in the password (for example, `@` as `%40`). Check the user's database privileges. |
| Permission denied | Use `hope_migrator` for migrations and seeds; it owns the local dev database. Keep `hope_app` separate and grant it only needed runtime permissions. Do not run routine migrations as `postgres`. For hosted PostgreSQL, ask the database admin for `USAGE, CREATE` on `public` for the migration role. |
| Migration checksum mismatch | Do not edit or delete the applied file. Restore it from Git history. Put the desired change in a new migration; if a migration is missing locally, restore it from the team branch. |
| Wrong engine version | Run `psql --version` and check the server with `SELECT version();`. Use PostgreSQL 15+ and ensure the URL points to PostgreSQL, not another database engine. |
| `psql` or Node not found | Install PostgreSQL client tools or Node.js 20+, then reopen the terminal so PATH updates take effect. |
| Hosted SSL connection fails | Use the Supabase-provided connection URL and set `DATABASE_SSL=true`. Verify that the network permits the chosen Supabase connection endpoint. |

## Current scope

This setup deliberately does not define HOPE application tables or permissions yet. Add them later as reviewed, numbered migrations informed by the team's approved ERD and table dictionary.
