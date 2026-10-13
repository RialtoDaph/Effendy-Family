-- The ✕ on the Home Inbox card hides that day's digest (on every device).
-- A new digest (next morning, or a fresh run the same day) shows again.
alter table public.inbox_digests add column dismissed boolean not null default false;
grant update (dismissed) on public.inbox_digests to authenticated;
create policy "owner hides" on public.inbox_digests for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function public.save_inbox_digest(p_key text, p_day date, p_account text, p_summary text, p_items jsonb, p_count int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid;
  hh uuid;
begin
  select k.member_id, m.household_id into who, hh
  from private.inbox_keys k join public.members m on m.id = k.member_id
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  if who is null then raise exception 'unknown key'; end if;
  if jsonb_typeof(p_items) <> 'array' or length(p_summary) > 4000 or length(p_items::text) > 200000 then
    raise exception 'digest too large';
  end if;
  insert into public.inbox_digests (household_id, owner_id, day, account, summary, items, mail_count)
  values (hh, who, p_day, left(p_account, 200), p_summary, p_items, greatest(0, p_count))
  on conflict (owner_id, day) do update
    set account = excluded.account, summary = excluded.summary, items = excluded.items,
        mail_count = excluded.mail_count, created_at = now(), dismissed = false;
  update private.inbox_keys set last_used_at = now() where member_id = who;
end $$;
