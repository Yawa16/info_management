# Hope, Inc. ERP

Cross-platform team database setup for the student ERP project. The team uses a non-production Supabase development project, which hosts PostgreSQL; students do not need to install a local database server or Docker.

Follow the [student database setup guide](db/README.md) to set up a private environment file, run the migration and seed commands, and verify the database connection. The runner is ready, but **no HOPE application-table migrations or seeds are included yet**.

Never commit credentials or edit an applied migration. Add a new numbered migration when the team is ready to define application tables.
