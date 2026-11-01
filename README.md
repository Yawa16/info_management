# info_management

## Task 1: Supabase scaffold

The reusable Supabase clients are in `lib/supabase/client.ts` for browser
components and `lib/supabase/server.ts` for server components, actions, and
route handlers. Both use the project URL and anon key; the service-role client
is separate and server-only.

Copy `.env.local.example` to `.env.local` and fill in the values locally. The
development server uses port 3000 by default; if Next.js selects another port,
set `NEXT_PUBLIC_SITE_URL` to the exact local origin it prints. Keep `.env.local`
out of Git.

The SQL migration `supabase/migrations/20261025100000_health_check.sql`
defines `public.health_check()`, a minimal RPC that returns `true`, and grants
execution to Supabase `anon` and `authenticated` roles. Apply migrations only
to the team-approved development project. The app endpoint `/api/health`
returns `{"status":"ok","database":"connected"}` when it can call that RPC.
This tests connectivity, not the presence or correctness of application
tables. It does not create any user table.

## Registration setup

Copy `.env.local.example` to `.env.local` and set the Supabase project URL,
anon key, local site URL, and server-only service-role key. Set the site URL to
the exact local origin printed by `npm run dev`, including its port. Never
expose or commit the service-role key; it bypasses RLS and is used only by
server-side registration and profile approval checks.

The migration `supabase/migrations/20261028170000_create_profiles_table.sql`
defines `public.profiles` with the following schema:

| Column | Expected type / behavior |
| --- | --- |
| `id` | `uuid`, primary key and foreign key to `auth.users.id` |
| `first_name` | `text`, required, 1–80 trimmed characters |
| `last_name` | `text`, required, 1–80 trimmed characters |
| `email` | `text`, required and unique |
| `role` | `text`, one of `superadmin`, `admin`, or `user`; defaults to `user` |
| `approval_status` | `text`, `pending` or `approved`; defaults to `pending` |
| `created_at` | `timestamptz`, defaults to the current time |

The migration enables RLS, permits authenticated users to read only their own
profile, and grants no client-side insert, update, or delete access. Server
actions use the server-only service-role key and must perform their own
authorization checks. The registration action always assigns
`role = 'user'` and `approval_status = 'pending'` on the server; it ignores any
role or approval values supplied by a browser.

The `/api/health` endpoint calls the Supabase RPC `public.health_check()`. A
successful response is `{"status":"ok","database":"connected"}`. This checks
connectivity to the project configured in `.env.local`; it does not verify the
profiles schema.

Before applying the migration, have the DB Admin confirm the intended schema
and target project. The project shown in the earlier screenshots is marked
Production and already contains an `app_user` table, so do not apply this
migration there or create duplicate user data without explicit approval.

New registrations are not signed into the application. Authentication and
email-confirmation links return through `/auth/callback`. In the development
Supabase project's Authentication → URL Configuration, set the Site URL to
the local origin and allow the callback URLs, for example
`http://localhost:3000/auth/callback` and
`http://localhost:3000/auth/callback?next=/reset-password/update`. Password
reset links return to `/reset-password/update`; after a successful password
change, the user is signed out and must sign in again. Do not change production
Supabase settings for local testing.

The login flow checks the profile on the server and rejects users whose
approval status is pending. Approved Admins and Superadmins can open
`/users` to approve pending regular User accounts. The server verifies the
approver's authenticated profile and only updates a target row whose role is
`user` and status is `pending`; Admins cannot view or modify Superadmin
accounts. Protected pages must be placed under
`app/(protected)/` so its server layout checks the current Supabase user and
approval status on every request. Server actions and route handlers that
access protected data must also check approval status before doing work; the
layout is not a substitute for authorization in data operations.

The registration action always sets `role = 'user'` and
`approval_status = 'pending'` on the server and never accepts those values
from the browser. Confirm with the DB Admin that the status used after
approval is exactly `approved` before deploying this check.

## Login and first-time password setup

The migration `supabase/migrations/20261101100000_add_login_access_flags.sql`
adds `must_change_password` and `is_blocked` boolean columns to
`public.profiles`. Both default to `false`. Apply it to the approved Supabase
project before deploying the Task 3 login code. The existing profiles RLS
policies remain enabled and unchanged.

Login uses Supabase Auth, which stores password hashes; the application never
hashes or stores passwords itself. After authentication, the server checks the
profile. Pending and blocked accounts are signed out and shown an appropriate
message. Approved accounts with `must_change_password = true` are sent to
`/set-password`; after Supabase accepts the new password, the server clears
that profile flag and sends the user to the dashboard. Admin-created temporary
accounts must have this flag set to `true` by the trusted server-side account
creation flow.

Middleware refreshes Supabase cookies so sessions survive navigation and
refreshes. Protected pages verify the session and profile server-side on every
request. Repeated failed sign-in attempts rely on Supabase Auth's configured
rate limits; review the Auth rate-limit settings in the Supabase project.