# Hope, Inc. ERP

Next.js App Router starter for the Hope, Inc. business management system.

## Local setup

1. Install the project dependencies:

   ```powershell
   npm install
   ```

2. Create `.env.local` from the example, then replace the placeholders with the
   Supabase project URL and anon key:

   ```powershell
   Copy-Item .env.local.example .env.local
   ```

   `.env.local` is ignored by Git. Never commit it or put a Supabase service-role
   key in a `NEXT_PUBLIC_` variable.

3. Apply `supabase/migrations/20261025100000_health_check.sql` in the Supabase
   SQL Editor. This adds the read-only `health_check()` RPC used by the health
   route; it creates no tables and does not change table RLS.

4. Start the development server:

   ```powershell
   npm run dev
   ```

   Visit `http://localhost:3000` for the landing page and
   `http://localhost:3000/api/health` to check Supabase connectivity.

Use `npm run typecheck` and `npm run build` to verify the project.

## Starter structure

- `app/`: App Router pages, shared layout/styles, and the API health route.
- `app/(auth)/`: Sign-in and registration route placeholders; authentication UI
  is not implemented in this scaffold.
- `components/`: Shared landing-page account links and auth-page placeholder.
- `lib/supabase/`: Shared environment validation plus browser, server, and
  middleware clients.
- `middleware.ts`: Refreshes Supabase sessions and cookies. It does not grant
  module access; server-side role and rights checks must be implemented for
  protected routes and data operations.
- `supabase/migrations/`: Database SQL migrations, including the health-check
  RPC.
