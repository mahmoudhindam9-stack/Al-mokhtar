# Supabase migrations

The previous migrations were removed from this branch because they targeted an uninitialized/legacy database and included temporary development policies that bypassed role checks.

Do not run `supabase db push` until the new **Al-mokhtar** project is created and a reviewed initial schema with authenticated, least-privilege policies has been committed here. The current local application works without Supabase; cloud synchronization is a follow-up step after the project is configured.
