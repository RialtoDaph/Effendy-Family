-- Bug reports and ideas from inside the app, worked on as a small kanban
-- (To do → Doing → Done). Shared by the whole household: both of you see them.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  kind text not null default 'bug' check (kind in ('bug', 'idea', 'other')),
  title text not null check (length(trim(title)) between 1 and 200),
  note text check (length(note) <= 4000),
  page text check (length(page) <= 200), -- the screen it was sent from, e.g. "/budget"
  device text check (length(device) <= 300),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.feedback (household_id, status, created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon;
create policy "read household" on public.feedback for select to authenticated
  using (household_id = (select private.my_household()));
create policy "add as self" on public.feedback for insert to authenticated
  with check (household_id = (select private.my_household()) and owner_id = (select auth.uid()));
create policy "edit household" on public.feedback for update to authenticated
  using (household_id = (select private.my_household()))
  with check (household_id = (select private.my_household()));
create policy "delete household" on public.feedback for delete to authenticated
  using (household_id = (select private.my_household()));
revoke update on public.feedback from authenticated;
grant update (kind, title, note, status, updated_at) on public.feedback to authenticated;
