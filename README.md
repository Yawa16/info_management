# Hope, Inc. ERP

Student database setup for PostgreSQL, with a cross-platform Node.js migration runner and idempotent seed command. No Docker is required.

Start with the [student database setup guide](db/README.md). It covers PostgreSQL installation, local and shared Supabase development, `.env` configuration, migrations, seeds, verification, reset safety, and team migration rules.

This task creates only the `schema_migrations` tracking table at runtime. It does not add HOPE application-table migrations.
