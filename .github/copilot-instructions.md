
# Global Copilot Instructions

- Tech Stack: Next.js (App Router), Tailwind CSS, Supabase Auth & Database.
- User Roles: superadmin, admin, user. Every new signup must receive role `user` and approval status `pending`; never accept role or approval status from the browser.
- Security: Enable Row Level Security (RLS) on all Supabase tables.
- Git Strategy: Never commit directly to main branch. Always create feature branches.
