# Sprint 2: Customers, Products, and Price History

The repository uses PostgreSQL. Supabase is only a hosted PostgreSQL
development option; this migration does not use Supabase-specific database
features. The guide sections 3.3 and 3.4 were not present in the repository,
so this implementation follows the Sprint 2 requirements in the task and the
existing schema and guide-based seed data.

## Assumptions

- The trusted backend starts each request transaction by setting
  `app.current_user` to the authenticated user's email, as documented for
  Task 6. Do not accept that identity from browser input.
- Application roles and grants are resolved through `app_user`,
  `v_user_effective_rights`, and the existing permission codes. Superadmin
  retains its existing implicit rights; Admin and User require explicit
  grants for writes.
- A current price is the newest Active `PRICEHIST` entry with `eff_date` on
  or before `CURRENT_DATE`. Future-dated and Inactive history is not current.

## Database behavior

Migration `007_customer_product_access.sql` adds the customer/product access
policies, action-right checks, role-filtered read views, and guards against
physical `DELETE` and `TRUNCATE`. It supports both the canonical migration
columns and the legacy development names (`prodcode`, `effdate`, `unitprice`,
and `is_deleted`) without renaming columns used by existing foreign keys,
views, or audit triggers. Where legacy Product or PRICEHIST tables lack
`status`, it adds the column and backfills it from `is_deleted`; future changes
keep those fields synchronized. Existing audit triggers continue to record
changes and write the `stamp` value.

The read views intentionally have separate projections:

| View | Rows | Columns |
| --- | --- | --- |
| `v_customer_admin` | All rows for Admin/Superadmin | Customer fields, `status`, `stamp` |
| `v_customer_user` | Active rows for User | Customer fields only |
| `v_product_admin` | All rows for Admin/Superadmin | Product fields, derived `current_price`, `status`, `stamp` |
| `v_product_user` | Active rows for User | Product fields and derived `current_price` |
| `v_pricehist_admin` | All rows for Admin/Superadmin | Price history, `status`, `stamp` |
| `v_pricehist_user` | Active rows for User | Price history only |

The base tables also have RLS policies, so User row filtering is enforced in
PostgreSQL rather than by a page. an existing `hope_app` or Supabase `authenticated` role receives only the
customer/product/price-history columns without `status` or `stamp`, the
specific insert/update columns required for soft-delete operations, and the
six views. The migration does not create database roles; provision the
application login separately and keep its credentials server-only.

## S2-DBA-01 view mapping

| View | Who uses it | Columns shown |
| --- | --- | --- |
| `v_customer_active` | User | `cust_no`, `cust_name`, `address`, `pay_terms` |
| `v_customer_admin` | Admin / Superadmin | `cust_no`, `cust_name`, `address`, `pay_terms`, `status`, `stamp` |
| `v_product_active` | User | `prod_code`, `description`, `unit`, derived `current_price` |
| `v_product_admin` | Admin / Superadmin | `prod_code`, `description`, `unit`, derived `current_price`, `status`, `stamp` |
| `v_customer_status_counts` | Admin / Superadmin | `status_filter`, `row_count` |
| `v_product_status_counts` | Admin / Superadmin | `status_filter`, `row_count` |

Do not grant end users direct database credentials. A PostgreSQL custom
setting is trusted only because the private backend sets it after
authentication. Never let a browser choose the view role or transaction
identity.

## Files and commands

Files created/changed:

- `db/migrations/007_customer_product_access.sql`
- `db/scripts/verify-customer-product-access.js`
- `db/verification/verify_customer_product_access.sql`
- `db/sprint2-customer-product-access.md`
- `db/README.md`
- `.env.example`
- `package.json`

From the repository root, using the private development `DATABASE_URL`:

```powershell
npm.cmd run db:status
npm.cmd run db:migrate
$env:ALLOW_SPRINT2_TEST = 'true'
npm.cmd run db:verify-sprint2
Remove-Item Env:\ALLOW_SPRINT2_TEST
```

Apply migrations only to the approved development database, never production.
The verification requires an active, approved, unblocked Superadmin and User
application identity, created through the normal development onboarding flow.
It prints one `PASS:` line for each case and rolls back the migration if
pending, plus all temporary test rows. A failed assertion exits non-zero.
The runner checks `DEV_DATABASE_NAME`, the development host allowlist, and the
explicit `ALLOW_SPRINT2_TEST=true` opt-in.

The SQL file can also be run directly with psql after migration 007 is
applied:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f db/verification/verify_customer_product_access.sql
```

Expected verification results on a development database with the guide sample
seed and active approved test identities:

```text
PASS: active approved Superadmin and User test identities exist
PASS: User-facing views omit Status and Stamp columns
PASS: Admin-facing views include Status and Stamp columns
PASS: RLS is enabled and customer/product/price-history policies are installed
PASS: hope_app cannot select Status or Stamp from base tables
PASS: Admin view returns all five guide customers including inactive C-004
PASS: Admin view returns all five guide products including inactive P-004
PASS: User views return only Active guide customers
PASS: User views return only Active guide products
PASS: P-003 current price is derived as 28.00 and P-004 has no current price
PASS: T-001, T-002, and T-003 totals remain 234.50, 140.00, and 510.00
PASS: sum of Active sales remains 884.50
PASS: active CUSTOMER_ADD right exists for the blocked-user guard test
PASS: blocked users cannot retain customer/product write authorization
PASS: soft delete sets Inactive and records DELETED audit action
PASS: physical DELETE is rejected
PASS: TRUNCATE is rejected
PASS: Sprint 2 verification completed; 007_customer_product_access.sql and all test writes were rolled back.
```

Migration 007 does not change product codes, prices, sales, or totals. Legacy
status backfill only maps `is_deleted` to its equivalent `status`. For a concise independent
read-only count/total report, also run:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f db/verification/verify_hope_sample_data.sql
```

Expected sample totals are T-001 `234.50`, T-002 `140.00`, T-003 `510.00`,
and Active-sales total `884.50`; P-003 current price is `28.00`, and P-004
has no current price.

## Rollback in development

Migrations are forward-only; never edit an applied migration or run a down
migration on a shared database. For a disposable development database only,
the existing guarded `db:reset` workflow recreates the schema and reapplies
the checked-in migrations. Review its target and confirmation prompts
carefully. Do not reset a shared team database. The verification SQL itself
ends with `ROLLBACK` and leaves no fixtures.

## Current environment validation status

The configured development database has migrations 001-004 applied,
migrations 005-006 with checksum mismatches, and migration 007 pending. The
migration runner correctly refuses to continue when an already-applied
migration's checksum differs. Do not edit or bypass migrations 005-006 to
force this migration through. Resolve the pre-existing migration-history
drift with the DB Admin or verify against a clean development database built
from the canonical migrations.

The configured database also does not currently contain the guide Product
keys `P-001` through `P-005` (its product table contains legacy records under
different keys), so the guide-price and sales-total assertions cannot pass
there. The guarded verifier applies 007 and its assertions in a transaction,
then rolls everything back; it does not repair migration history or persist
schema/data changes. Record actual runtime output after the database has the
guide seed and required test identities. Until then, the PASS lines above are
expected output only, not a claim of runtime verification.

Suggested commit message:

```text
feat(db): add customer and product access policies
```
