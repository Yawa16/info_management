# Task 6: application-user audit logging

## Current behavior and identity

The migrated database in this repository has `stamp` columns but does not yet
contain `audit_user()` or `audit_log`; the original `HopeDB_audit.sql` is not
present in the repository to inspect. Before this migration, row stamps were
supplied by seed/application SQL and there was no central row-change audit
record. A PostgreSQL connection identifies its database login/role, not the
human signed into Supabase Auth, so `current_user` alone cannot distinguish
application users who share a pooled database connection.

Migration `005_create_audit_log.sql` introduces `public.audit_user()`. It
reads the transaction-local `app.current_user` setting and returns `system`
when the setting is absent or blank. The audit table stores that application
identity separately from `SESSION_USER`, the PostgreSQL login used by the
connection.

## Identity context and missing-user policy

At the start of **every database request transaction**, after authenticating
the request and before any data writes, the trusted backend must run:

```sql
SELECT set_config('app.current_user', '<authenticated user email or id>', TRUE);
```

The third argument must remain `TRUE` (transaction-local). Do not use
session-level `SET`; pooled connections could otherwise attribute a later
request to the previous user. Bind the identity as a query parameter.

Node.js / TypeScript example using the project's `pg` driver:

```ts
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "SELECT set_config('app.current_user', $1, TRUE)",
    [authenticatedUser.email],
  );
  await performRequestWrites(client);
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

Set the value only from a server-verified identity; never trust a
browser-provided email or user ID. The first-password setup flow verifies its
single-use token, resolves the linked account email in the database, and sets
that email as the actor before updating the token or account. Other future
database write routes must set the setting from their authenticated Supabase
user before writing. PostgreSQL custom settings are not
cryptographically authenticated, so any code with direct SQL access could
spoof the value. Keep the database credential server-only and do not expose
direct SQL access to the browser.

Database writes with no setting are **not rejected**: they are recorded as
`system` so migrations, seeds, and legitimate maintenance work are not blocked.
The backend should reject an unauthenticated user-initiated write in its
request authorization layer rather than relying on the database fallback.
Background jobs should either omit the setting and audit as `system`, or set
an explicit service identity such as `job:nightly-reconciliation` at the
start of each job transaction.

## Audit behavior

The migration attaches triggers to every public table that has both `status`
and `stamp`, including `app_user`, `user_permission`, and
`password_reset_token`. It discovers each table's primary key and stores
`record_key` as a JSON object of those key values. Stamps use
`ACTION app_user YYYY-MM-DD H:MM AM` in `Asia/Manila`; the `stamp` columns are
widened to `TEXT` so an email identity and timestamp are not silently
truncated.

- Insert is `CREATED`; ordinary update is `EDITED`; physical delete is
  `DELETED`.
- `Active` to `Inactive` is `DELETED`; `Inactive` to `Active` is `RESTORED`.
- `old_values` and `new_values` omit `password_hash`, `token_hash`,
  `password`, `token`, and `raw_token`.
- `audit_log` is protected by RLS, has no end-user policies, revokes direct
  privileges from common app roles, and rejects `UPDATE`, `DELETE`, and
  `TRUNCATE` with a trigger.

## Verification

Apply migrations 001-005 to a disposable development database. The serial
SQL tests can be run with psql:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f db/verification/verify_audit_user.sql
```

The full suite also checks transaction-local pooling and two independent
sessions, which a single SQL session cannot reliably simulate. Configure
`ALLOW_AUDIT_TEST=true`, `DEV_DATABASE_NAME`, `DEV_ALLOWED_HOSTS`, and the
matching `DEV_SUPABASE_URL` in the private environment, then run:

```powershell
npm.cmd run db:verify-audit
```

The runner refuses production, an unallowlisted host, or a database name or
Supabase project mismatch. It reports PASS/FAIL for all nine requested cases
and exits non-zero on failure. SQL fixtures and audit records are enclosed in
transactions that are rolled back; the session-locality test writes no rows.
The SQL permission test requires an active approved Admin/Superadmin as the
grantor, another active approved account, and at least one unassigned active
right.

## Migration and deployment notes

Apply this as a new forward-only migration; do not edit migrations 001-004.
The first-password setup path sets transaction-local identity from the
token-linked account. Future request handlers that write directly to
PostgreSQL must also call `set_config` before their first write. The existing
Task 3 permission guard still validates the actual grantor role separately;
the audit context records the actor value provided by trusted backend code
and is not authorization on its own.
