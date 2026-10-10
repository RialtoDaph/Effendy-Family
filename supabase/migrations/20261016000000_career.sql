-- Phase 5: career roadmap (stages you tick off), filled in by you.
create table public.career_steps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.members (id) on delete cascade,
  visibility text not null default 'family' check (visibility in ('family', 'private')),
  plan text not null default 'Studio' check (length(trim(plan)) > 0), -- e.g. "RIDEFF Studio", "Atelier"
  title text not null check (length(trim(title)) > 0),
  timing text, -- free text: "Jul", "in progress", "1 of 3"
  status text not null default 'next' check (status in ('done', 'now', 'next')),
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.career_steps (household_id, plan, sort);
alter table public.career_steps enable row level security;
revoke all on public.career_steps from anon;
create policy "read family or own" on public.career_steps for select to authenticated
  using (household_id = (select private.my_household()) and (visibility = 'family' or owner_id = (select auth.uid())));
create policy "add as self" on public.career_steps for insert to authenticated
  with check (household_id = (select private.my_household()) and owner_id = (select auth.uid()));
create policy "edit family or own" on public.career_steps for update to authenticated
  using (household_id = (select private.my_household()) and (visibility = 'family' or owner_id = (select auth.uid())))
  with check (household_id = (select private.my_household()) and (visibility = 'family' or owner_id = (select auth.uid())));
create policy "delete family or own" on public.career_steps for delete to authenticated
  using (household_id = (select private.my_household()) and (visibility = 'family' or owner_id = (select auth.uid())));
revoke update on public.career_steps from authenticated;
grant update (visibility, plan, title, timing, status, sort, updated_at) on public.career_steps to authenticated;
