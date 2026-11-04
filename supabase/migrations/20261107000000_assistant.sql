-- Phase 6: assistant sessions, quotas and confirmed writes.
-- Sessions and usage change only through these functions, so a browser can neither
-- skip its quota nor shorten what it used. Limits come from the handoff's plans:
-- Life 20 AI messages, Life Plus 60 voice minutes, Together 120 voice minutes.

drop policy if exists "own sessions: add" on public.ai_sessions;
revoke insert on public.ai_sessions from authenticated;

-- What a saved card wrote, so Undo can take back exactly that.
alter table public.ai_pending_actions add column if not exists result jsonb;
grant update (status, result) on public.ai_pending_actions to authenticated;

create or replace function private.usage_month()
returns text language sql stable set search_path = '' as $$
  select to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM')
$$;

create or replace function private.ai_plan(p_household uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case when status = 'cancelled' then 'life' else plan end
                   from public.subscriptions_billing where household_id = p_household), 'together')
$$;

-- Closes a session and books its voice time. A session left open counts for an hour at most.
create or replace function private.ai_close(p_session uuid, p_tools jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s public.ai_sessions;
  secs integer;
begin
  select * into s from public.ai_sessions where id = p_session and ended_at is null for update;
  if not found then return 0; end if;
  secs := least(3600, greatest(0, extract(epoch from now() - s.started_at)::integer));
  update public.ai_sessions set ended_at = now(), seconds = secs, tool_calls = coalesce(p_tools, tool_calls) where id = s.id;
  if s.mode = 'voice' then
    insert into public.usage (member_id, household_id, month, voice_seconds)
    values (s.member_id, s.household_id, private.usage_month(), secs)
    on conflict (member_id, month) do update set voice_seconds = public.usage.voice_seconds + excluded.voice_seconds;
  end if;
  return secs;
end $$;

create or replace function public.ai_session_start(p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  hh uuid := private.my_household();
  plan text;
  u public.usage;
  cap integer;
  left_s integer;
  left_m integer;
  open_id uuid;
  new_id uuid;
begin
  if me is null or hh is null then raise exception 'not_member'; end if;
  if p_mode not in ('voice', 'text') then raise exception 'bad_mode'; end if;
  for open_id in select id from public.ai_sessions where member_id = me and ended_at is null loop
    perform private.ai_close(open_id, null);
  end loop;

  plan := private.ai_plan(hh);
  select * into u from public.usage where member_id = me and month = private.usage_month();
  cap := case plan when 'plus' then 3600 when 'together' then 7200 else 0 end;
  left_s := greatest(0, cap + coalesce(u.extra_voice_seconds, 0) - coalesce(u.voice_seconds, 0));
  left_m := case when plan = 'life' then greatest(0, 20 - coalesce(u.ai_messages, 0)) end;
  if p_mode = 'voice' and left_s = 0 then raise exception 'voice_quota'; end if;
  if p_mode = 'text' and left_m = 0 then raise exception 'ai_quota'; end if;

  insert into public.ai_sessions (household_id, member_id, mode) values (hh, me, p_mode) returning id into new_id;
  return jsonb_build_object('session_id', new_id, 'plan', plan, 'voice_left', left_s, 'ai_left', left_m);
end $$;

create or replace function public.ai_session_end(p_session uuid, p_tools jsonb default null)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.ai_sessions where id = p_session and member_id = auth.uid()) then
    raise exception 'not_found';
  end if;
  return private.ai_close(p_session, p_tools);
end $$;

-- One typed message. Only the Life plan has a limit; returns what is left, null for no limit.
create or replace function public.ai_message_used()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  hh uuid := private.my_household();
  used integer;
begin
  if me is null or hh is null then raise exception 'not_member'; end if;
  insert into public.usage (member_id, household_id, month, ai_messages)
  values (me, hh, private.usage_month(), 1)
  on conflict (member_id, month) do update set ai_messages = public.usage.ai_messages + 1
  returning ai_messages into used;
  if private.ai_plan(hh) <> 'life' then return null; end if;
  if used > 20 then
    update public.usage set ai_messages = 20 where member_id = me and month = private.usage_month();
    raise exception 'ai_quota';
  end if;
  return 20 - used;
end $$;

revoke all on function private.usage_month() from public, anon, authenticated;
revoke all on function private.ai_plan(uuid) from public, anon, authenticated;
revoke all on function private.ai_close(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ai_session_start(text) from public, anon;
revoke all on function public.ai_session_end(uuid, jsonb) from public, anon;
revoke all on function public.ai_message_used() from public, anon;
grant execute on function public.ai_session_start(text) to authenticated;
grant execute on function public.ai_session_end(uuid, jsonb) to authenticated;
grant execute on function public.ai_message_used() to authenticated;
