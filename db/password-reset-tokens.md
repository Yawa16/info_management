# Password reset and set-password tokens

Migration `004_create_password_reset_token.sql` adds the server-only
`public.password_reset_token` table. Apply it after migrations 001-003 with
the normal migration runner; the runner wraps each migration in a transaction.
The table references `app_user.id`, stores a unique 64-character lowercase
SHA-256 hex digest, has a purpose check, expiry check, status/stamp fields,
token lookup and expiry indexes, and RLS enabled without browser-facing
policies.

## Used-state semantics

`used_at IS NULL` means unused; a non-NULL timestamp means consumed or
invalidated. A timestamp records when that happened and distinguishes
consumption from expiry for audit/diagnostics. A separate boolean would
duplicate the same state and could disagree with the timestamp. When a token
is superseded, set both `used_at` and `status = 'Inactive'`.

The partial unique index covers active, unused rows per `(user_id, purpose)`.
It intentionally does not compare `expires_at` with `now()`: PostgreSQL does
not allow a volatile current-time expression in an index predicate. It
therefore guarantees at most one active unused row even if it has expired.
The issuance transaction below marks any previous row used/inactive before
inserting its replacement, so a new token invalidates the old one.

## Issuing and rotating a token

Generate and hash the token in trusted server code. Choose the absolute expiry
from application configuration and pass the values as bound parameters.
Run all statements on one connection in one transaction. If the locked user
query returns no row, roll back and do not issue a token.

```sql
BEGIN;

-- $1: app_user.id. Serializes concurrent token issuance for this user.
SELECT id
FROM public.app_user
WHERE id = $1
  AND status = 'Active'
  AND is_blocked = FALSE
FOR UPDATE;

-- $1: user id, $3: purpose. A prior expired unused token is superseded too.
UPDATE public.password_reset_token
SET used_at = CURRENT_TIMESTAMP,
    status = 'Inactive',
    stamp = 'EDITED token-rotation ' ||
        to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')
WHERE user_id = $1
  AND purpose = $3
  AND used_at IS NULL
  AND status = 'Active';

-- $1: user id, $2: 64-character SHA-256 hex digest,
-- $3: set_password or reset_password, $4: configured absolute expiry.
INSERT INTO public.password_reset_token (user_id, token_hash, purpose, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, expires_at;

COMMIT;
```

The server must confirm the user-lock query matched before continuing. This
avoids issuing tokens for blocked or inactive users and serializes concurrent
issuance. Keep email responses neutral so the forgot-password flow does not
reveal whether an address is registered.

## Validation query

Hash the presented raw token with SHA-256 in the server and bind the digest as
`$1`; bind the expected flow purpose as `$2`. A row is valid only when the
digest matches, the token is unused, unexpired and active, and the linked user
is active and not blocked.

```sql
SELECT token.id, token.user_id, token.purpose, token.expires_at
FROM public.password_reset_token AS token
JOIN public.app_user AS app_user ON app_user.id = token.user_id
WHERE token.token_hash = $1
  AND token.purpose = $2
  AND token.used_at IS NULL
  AND token.expires_at > CURRENT_TIMESTAMP
  AND token.status = 'Active'
  AND app_user.status = 'Active'
  AND app_user.is_blocked = FALSE;
```

SQL equality and index lookup are not a substitute for constant-time
application comparison. When comparing candidate and stored digest bytes in
the application, check they are both exactly 32 bytes and use a
constant-time primitive (for example Node's `crypto.timingSafeEqual`). Do not
return different public errors for unknown, expired, used, or blocked tokens.
Consume a valid token atomically with the password update: conditionally
update `used_at` only where it is still NULL, active, and unexpired, and
require exactly one updated row before reporting success.

## Expiry configuration and token handling

Keep durations in application configuration, not in the database schema:

| Purpose | Suggested lifetime |
| --- | --- |
| `set_password` | 24 hours (`86,400` seconds) |
| `reset_password` | 30 minutes (`1,800` seconds) |

Generate at least 32 cryptographically random bytes and encode them as a
URL-safe token (for example Node `randomBytes(32).toString('base64url')`).
Compute `SHA-256(raw_token)` and store only its lowercase hexadecimal digest.
Show the raw token once, send it through the approved email flow, or print it
to the console only in development. Never persist or log the raw token,
password, or reset URL containing the token.

## Cleanup

Run this periodically as a trusted maintenance job after the team provisions
one. It physically removes only expired, used, or explicitly inactive token
rows; do not expose this operation to browser clients.

```sql
DELETE FROM public.password_reset_token
WHERE expires_at <= CURRENT_TIMESTAMP
   OR used_at IS NOT NULL
   OR status = 'Inactive';
```

## Verification

Run `db/verification/verify_password_reset_tokens.sql` against a disposable
development database after migration 004. It requires at least one active,
unblocked `app_user` row. The script inserts valid, expired, and used fixtures,
temporarily blocks the test user for the blocked case, displays the expected
and actual validation results, then rolls back the entire transaction. All
four cases should pass: valid is accepted; expired, used, and blocked are
rejected.

### Development verification result

On 2026-11-04, the verification script was run against the `HOPE ERP Dev
Fresh` development project using a disposable active, unblocked Auth-linked
`app_user`. All four cases passed: valid token accepted; expired token, used
token, and blocked user rejected. The verification transaction rolled back,
and the disposable Auth user, `app_user`, and token fixtures were confirmed
removed afterward.

### Runtime re-verification

On 2026-11-05, the development target was rechecked before testing: the
configured database name and allowlisted host matched, the database and Auth
URLs resolved to the same Supabase project, SSL was enabled, and migration
004 plus `public.password_reset_token` were present. The verification SQL
then ran with a disposable Auth-linked `app_user` fixture inside a rollback
transaction:

| Case | Result |
| --- | --- |
| Valid token | Accepted |
| Expired token | Rejected |
| Already-used token | Rejected |
| Blocked user | Rejected |

All four checks passed. The transaction rollback removed the disposable
`app_user` and token rows, and the disposable Auth user was deleted. These
checks exercise the database token-eligibility predicates; they do not claim
to exercise an application HTTP/UI password-reset flow. No credentials or raw
tokens were logged.
