# Task 5: catalogue, team accounts, and password setup

Apply migrations 001-004 before running these commands. The numbered
`002_seed_user_management_catalogue.sql` seed can be run repeatedly; it
upserts three default roles, five modules, and all 36 rights using the stable
codes and checkbox labels already defined by the user-management schema.
`npm run db:seed` runs this catalogue seed as well as the existing sample-data
seed.

## Team Superadmin accounts

1. Copy `db/seeds/team.example.csv` to `db/seeds/team.csv`.
2. Replace the fake rows with one row per team member:

   ```csv
   first_name,last_name,email
   First,Last,person@example.test
   ```

3. Configure the private `.env` or `.env.local` values:
   - `DATABASE_URL`: approved development database connection.
   - `DEV_DATABASE_NAME` and `DEV_ALLOWED_HOSTS`: exact database name and
     allowed host for the development database.
   - `ALLOW_TEAM_SEED=true`: explicit confirmation for this development-only
     account provisioning command.
   - `DEV_SUPABASE_URL` and `DEV_SUPABASE_SERVICE_ROLE_KEY`: matching
     development project's URL and server-only key.
4. Run `npm run db:seed` and then `npm run db:seed-team`.

The team seeder creates missing Supabase Auth identities without supplying a
password, then adds `app_user` rows with a Superadmin role, a NULL
`password_hash`, and `must_set_password = true`. Existing matching profiles are
left unchanged so rerunning the seed does not reset an account that has
already completed onboarding. It fails on a conflicting email/Auth identity.
The seeder refuses production mode, a database-name mismatch, and any host
outside localhost or the explicit allowlist.
The private team roster is ignored by Git; commit only the fake
`team.example.csv`. Do not put team names, addresses, tokens, or credentials in
seed SQL or logs.

## Issuing and consuming setup links

Set `APP_BASE_URL` to the app origin (for example `http://localhost:3000` for
local development or an HTTPS origin for a deployed development app), then
run:

```text
npm run db:issue-setup-links
```

The command finds active, unblocked accounts with NULL `password_hash` and
`must_set_password = true`. For each account it creates 32 random bytes,
stores only the SHA-256 hex digest in `password_reset_token`, and prints the
raw one-time link once to the terminal. The token expires after 24 hours.
Each run marks the prior active, unused `set_password` token used and inactive
before inserting a replacement. Anyone rerunning the command must securely
deliver the newly printed link; the old link is invalid.

The `/set-password` page and server action are implemented in this branch.
They require `DATABASE_URL`, `DATABASE_SSL`, `NEXT_PUBLIC_SUPABASE_URL`, and
the server-only `SUPABASE_SERVICE_ROLE_KEY`. They require a 12-128 character
password, update the credential through Supabase Auth, and then consume the
token and clear `must_set_password` in the locked database transaction. The
page response is non-cacheable and sends `Referrer-Policy: no-referrer`.
Supabase Auth and PostgreSQL do not share a transaction; if the Auth update
succeeds but the database step fails, the action reports temporary
unavailability and the still-unused token can be retried.

The server validates the SHA-256 digest, purpose, unused/active status,
expiry, and linked account eligibility. It does not write
`app_user.password_hash`. Keep the raw token out of logs, analytics, and
referrer URLs; the set-password response is non-cacheable with a no-referrer
policy.

## Optional development-only Admin and User

This seed uses fake `.test` addresses for Lisa Park (Admin) and Alex Rivera
(User), and gives Alex three sample rights: Add Customer, Add Product, and Top
Customers. It is not part of `npm run db:seed` or `npm run db:seed-team`.

Before running it, verify both URLs and keys point to the same development
Supabase project. Configure:

- `ALLOW_DEV_SEED=true`
- `DEV_DATABASE_NAME` to the exact development database name
- `DEV_ALLOWED_HOSTS` to include the exact development database host (or use
  localhost)
- `DEV_SUPABASE_URL` and `DEV_SUPABASE_SERVICE_ROLE_KEY` for the development
  Auth project

The command refuses `NODE_ENV=production`, a database-name mismatch, or any
database host that is not localhost or an exact `DEV_ALLOWED_HOSTS` entry.
Run:

```text
npm run db:seed
npm run db:seed-dev
npm run db:issue-setup-links
```

Do not configure the dev-only Auth key with a production project. Both
accounts have no local password hash and use the same setup-link flow.

## Ignore rules and SQL pre-commit check

The repository `.gitignore` must include:

```gitignore
.env*
!.env.example
!.env.local.example
/db/seeds/team.csv
```

Before committing, scan staged SQL files for bcrypt/Argon2 hashes and
password assignments:

```text
npm run db:check-sql-secrets
```

The check reads staged SQL content and reports only the file and finding type,
never the matched content. It exits unsuccessfully if either pattern is found.
It is a lightweight pre-commit check; it does not replace secret scanning or
review.

## Verification checklist

Run `npm run db:seed` more than once, then execute
`db/verification/verify_task5_seeds.sql`. All checks should pass:

| Catalogue | Expected active count |
| --- | ---: |
| Superadmin, Admin, User roles | 3 |
| Modules | 5 |
| Customer rights | 3 |
| Product rights | 6 |
| Human Resources rights | 13 |
| Sales rights | 7 |
| Reports rights | 7 |
| **All rights** | **36** |

Also verify that each roster row maps to exactly one `app_user` with the
Superadmin role, `password_hash IS NULL`, and `must_set_password = true` on
initial insertion; no duplicate email/Auth identity is created on rerun.
Run link issuance twice for a disposable development account: the second
token must be the only active, unused `set_password` token, the first must be
inactive/used, and only the second link should work. Never paste setup links
or service-role keys into a PR or issue.
