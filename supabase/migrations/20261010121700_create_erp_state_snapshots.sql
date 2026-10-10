-- Per-authenticated-user cloud snapshot for the offline-first desktop app.
-- Local ERP snapshots contain business records; never grant anonymous access.
create table if not exists public.erp_state_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.erp_state_snapshots enable row level security;

grant select, insert, update on public.erp_state_snapshots to authenticated;

create policy "Users can read their own ERP snapshot"
  on public.erp_state_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own ERP snapshot"
  on public.erp_state_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own ERP snapshot"
  on public.erp_state_snapshots
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
