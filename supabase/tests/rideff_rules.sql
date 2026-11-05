-- Privacy and tenancy checks for rideff Life. Two households, three people.
-- Run in the SQL editor or through execute_sql. The block always ends in an
-- exception that carries the report, so every test row is rolled back.
do $test$
declare
  a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid(); c1 uuid := gen_random_uuid();
  ha uuid; hb uuid; tok text; n int; v text; g uuid; report text := ''; fails int := 0; passed int := 0;
  meta jsonb;
begin
  create temp table ck(name text, ok boolean) on commit drop;
  grant all on ck to authenticated, anon;

  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a1, 'a1@rls.test', 'authenticated', 'authenticated', '{"display_name":"Ann","household_name":"House A","lang":"de"}');
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (b1, 'b1@rls.test', 'authenticated', 'authenticated', '{"display_name":"Bob","household_name":"House B"}');
  select household_id into ha from public.members where id = a1;
  select household_id into hb from public.members where id = b1;

  insert into ck values
    ('sign-up makes separate households', ha <> hb),
    ('first person is owner', (select role from public.members where id = a1) = 'owner'),
    ('language from sign-up', (select lang from public.member_settings where member_id = a1) = 'de'),
    ('plan row exists', exists (select 1 from public.subscriptions_billing where household_id = ha and seats = 4));

  -- Invite: Ann invites Pia with money hidden off by default later.
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok := public.create_invite('Pia', 'partner', null);
  reset role;
  meta := jsonb_build_object('display_name', 'Pia', 'invite_token', tok);
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (a2, 'a2@rls.test', 'authenticated', 'authenticated', meta);
  insert into ck values
    ('invite joins the household', (select household_id from public.members where id = a2) = ha),
    ('invite gives its role', (select role from public.members where id = a2) = 'partner'),
    ('invite marked used', (select used_by from public.invites where household_id = ha) = a2);
  -- The same token again, and a made-up one: own household, not Ann's.
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (a3, 'a3@rls.test', 'authenticated', 'authenticated', meta);
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (c1, 'c1@rls.test', 'authenticated', 'authenticated', '{"invite_token":"rl_fake"}');
  insert into ck values
    ('used invite cannot be reused', (select household_id from public.members where id = a3) <> ha),
    ('made-up invite gets nowhere', (select household_id from public.members where id = c1) <> ha);

  -- Ann's rows.
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.transactions (amount, payee, visibility) values (-10, 'family row', 'family'), (-99, 'private row', 'private');
  insert into public.goals (name, visibility) values ('family goal', 'family'), ('secret goal', 'private');
  insert into public.debts (name, visibility, balance) values ('family debt', 'family', 100), ('secret debt', 'private', 900);
  insert into public.journal_entries (text, visibility) values ('dear diary', 'family');
  insert into public.yearly_goals (name, target, visibility) values ('yg', 10, 'family') returning id into g;
  insert into public.goal_progress (goal_id, amount) values (g, 1);
  insert into public.ai_memories (text, scope) values ('ann private', 'private'), ('ann shared', 'shared');
  select count(*) into n from public.journal_entries where visibility = 'private';
  insert into ck values ('journal forced private', n = 1);
  reset role;

  -- Pia, same household.
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.transactions; insert into ck values ('partner sees family money only', n = 1);
  select coalesce(sum(amount), 0)::int into n from public.transactions; insert into ck values ('private row not in partner total', n = -10);
  select count(*) into n from public.goals; insert into ck values ('partner sees family goals only', n = 1);
  select count(*) into n from public.debts; insert into ck values ('partner sees family debts only', n = 1);
  select count(*) into n from public.journal_entries; insert into ck values ('partner cannot read journal', n = 0);
  select count(*) into n from public.ai_memories; insert into ck values ('memory hidden while sharing is off', n = 0);
  update public.transactions set payee = 'x' where payee = 'private row';
  get diagnostics n = row_count; insert into ck values ('partner cannot edit private row', n = 0);
  delete from public.ai_memories; get diagnostics n = row_count; insert into ck values ('partner cannot forget memories', n = 0);
  select count(*) into n from public.member_settings; insert into ck values ('settings are own only', n = 1);
  begin
    perform public.set_member_share(a2, '{"money":true}');
    insert into ck values ('partner cannot change share', false);
  exception when raise_exception then insert into ck values ('partner cannot change share', true); end;
  reset role;

  -- Ann turns memory sharing on: only the shared one appears.
  update public.member_settings set memory_shared = true where member_id = a1;
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ai_memories; insert into ck values ('shared memory visible, private not', n = 1);
  select text into v from public.ai_memories limit 1; insert into ck values ('it is the shared one', v = 'ann shared');
  update public.ai_memories set text = 'x'; get diagnostics n = row_count; insert into ck values ('only the owner edits a memory', n = 0);
  reset role;

  -- Goal goes private: its progress goes with it.
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.yearly_goals set visibility = 'private' where id = g;
  perform public.set_member_share(a2, '{"money":false,"goals":true,"cal":true,"docs":true,"debts":false,"remit":true}');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.goal_progress; insert into ck values ('private goal hides its progress', n = 0);
  select count(*) into n from public.transactions; insert into ck values ('share off hides family money', n = 0);
  select count(*) into n from public.debts; insert into ck values ('share off hides family debts', n = 0);
  select count(*) into n from public.goals; insert into ck values ('share on keeps goals', n = 1);
  insert into public.transactions (amount, payee, visibility) values (-5, 'pia own', 'private');
  select count(*) into n from public.transactions; insert into ck values ('own rows stay visible with share off', n = 1);
  reset role;

  -- Bob, another household.
  perform set_config('request.jwt.claims', json_build_object('sub', b1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.members; insert into ck values ('other household: members hidden', n = 1);
  select count(*) into n from public.households; insert into ck values ('other household: household hidden', n = 1);
  select count(*) into n from public.transactions; insert into ck values ('other household: money hidden', n = 0);
  select count(*) into n from public.ai_memories; insert into ck values ('other household: memory hidden', n = 0);
  select count(*) into n from public.invites; insert into ck values ('other household: invites hidden', n = 0);
  update public.transactions set payee = 'x'; get diagnostics n = row_count; insert into ck values ('other household: cannot edit', n = 0);
  begin
    insert into public.transactions (household_id, amount, payee) values (ha, -1, 'planted');
    insert into ck values ('cannot write into another household', false);
  exception when insufficient_privilege then insert into ck values ('cannot write into another household', true); end;
  begin
    perform public.set_member_share(a2, '{}');
    insert into ck values ('cannot change another household', false);
  exception when raise_exception then insert into ck values ('cannot change another household', true); end;
  begin
    perform 1 from public.security;
    insert into ck values ('PIN table closed to clients', false);
  exception when insufficient_privilege then insert into ck values ('PIN table closed to clients', true); end;
  begin
    perform token_hash from public.invites;
    insert into ck values ('token hash unreadable', false);
  exception when insufficient_privilege then insert into ck values ('token hash unreadable', true); end;
  begin
    update public.members set role = 'owner', household_id = ha where id = b1;
    insert into ck values ('cannot change own role or household', false);
  exception when insufficient_privilege then insert into ck values ('cannot change own role or household', true); end;
  reset role;

  -- Seats, member role, signed-out visitors.
  update public.subscriptions_billing set seats = 2 where household_id = ha;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.create_invite('Too many');
    insert into ck values ('no invite without a free seat', false);
  exception when raise_exception then insert into ck values ('no invite without a free seat', true); end;
  reset role;
  update public.subscriptions_billing set seats = 4 where household_id = ha;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok := public.create_invite('Rae');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select invitee into v from public.invite_preview(tok); insert into ck values ('join page can read the invite', v = 'Rae');
  select count(*) into n from public.invite_preview('rl_wrong'); insert into ck values ('wrong token shows nothing', n = 0);
  begin
    perform 1 from public.members;
    insert into ck values ('signed-out visitor blocked', false);
  exception when insufficient_privilege then insert into ck values ('signed-out visitor blocked', true); end;
  begin
    perform public.create_invite('Anon');
    insert into ck values ('signed-out visitor cannot invite', false);
  exception when insufficient_privilege then insert into ck values ('signed-out visitor cannot invite', true); end;
  reset role;

  select count(*) filter (where ok), count(*) filter (where ok is not true),
         coalesce(string_agg(name, ' | ') filter (where ok is not true), 'none')
    into passed, fails, report from ck;
  raise exception 'RESULT passed=% failed=% failures: %', passed, fails, report;
end $test$;

-- Sample data and family viewers. Same idea: the report is the exception.
do $t$
declare a uuid := gen_random_uuid(); v uuid := gen_random_uuid(); tok text; n int; c text := '';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (a, 's1@rls.test', 'authenticated', 'authenticated', '{"display_name":"Ann"}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.load_sample_data();
  select count(*) into n from public.categories; c := c || 'cats=' || n;
  begin perform public.load_sample_data(); c := c || ' SECOND_LOAD_ALLOWED'; exception when raise_exception then c := c || ' second_load_blocked'; end;
  tok := public.create_invite('Oma', 'member', '{"money":false,"goals":true,"cal":true,"docs":false,"debts":false,"remit":false}');
  reset role;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (v, 's2@rls.test', 'authenticated', 'authenticated', jsonb_build_object('invite_token', tok));
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.goals; c := c || ' viewer_goals=' || n;
  select count(*) into n from public.transactions; c := c || ' viewer_tx=' || n;
  update public.goals set name = 'x'; get diagnostics n = row_count; c := c || ' viewer_edits=' || n;
  delete from public.events; get diagnostics n = row_count; c := c || ' viewer_deletes=' || n;
  begin insert into public.goals (name) values ('x'); c := c || ' VIEWER_INSERTED'; exception when insufficient_privilege then c := c || ' viewer_insert_blocked'; end;
  begin insert into public.journal_entries (text) values ('my own'); c := c || ' viewer_journal_ok'; exception when others then c := c || ' VIEWER_JOURNAL_FAILED'; end;
  reset role;
  raise exception 'RESULT %', c;
end $t$;

-- Share off also hides household-wide money tables.
do $t$
declare a uuid := gen_random_uuid(); v uuid := gen_random_uuid(); tok text; n int; c text := '';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (a, 's3@rls.test', 'authenticated', 'authenticated', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.load_sample_data();
  insert into public.networth_history (day, net) values (current_date, 1000);
  insert into public.tax_years (year, refund_estimate) values (2026, 500);
  select count(*) into n from public.categories; c := c || 'owner_cats=' || n;
  tok := public.create_invite('Oma', 'member', '{"money":false,"goals":true,"cal":true,"docs":false,"debts":false,"remit":false}');
  reset role;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (v, 's4@rls.test', 'authenticated', 'authenticated', jsonb_build_object('invite_token', tok));
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.networth_history; c := c || ' viewer_networth=' || n;
  select count(*) into n from public.tax_years; c := c || ' viewer_tax=' || n;
  select count(*) into n from public.categories; c := c || ' viewer_cats=' || n;
  select count(*) into n from public.debt_settings; c := c || ' viewer_debt_settings=' || n;
  select count(*) into n from public.fx_rates; c := c || ' viewer_fx=' || n;
  reset role;
  raise exception 'RESULT %', c;
end $t$;

-- Recurring posting: subscriptions book like any recurring row, once a month,
-- and private ones stay private. Expect first_run=2 second_run=0 owner_tx=2
-- cancelled_posted=0 future_posted=0 partner_tx=1 partner_secret_tx=0.
do $t$
declare a uuid := gen_random_uuid(); p uuid := gen_random_uuid(); tok text; n int; c text := ''; first int; second int;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (a, 'r1@rls.test', 'authenticated', 'authenticated', '{"display_name":"Ann"}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok := public.create_invite('Pia', 'partner', null);
  insert into public.recurring (name, amount, day_of_month, is_subscription, visibility) values
    ('fam sub', -10, 1, true, 'family'), ('secret sub', -20, 1, true, 'private'), ('future bill', -30, 28, false, 'family');
  insert into public.recurring (name, amount, day_of_month, is_subscription, active, cancelled_on) values ('cancelled sub', -40, 1, true, false, current_date);
  reset role;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (p, 'r2@rls.test', 'authenticated', 'authenticated', jsonb_build_object('invite_token', tok));
  -- New rows whose day has passed start as already booked, so clear that here.
  update public.recurring set last_posted_month = null;
  first := private.post_recurring(true);
  second := private.post_recurring(true);
  c := 'first_run=' || first || ' second_run=' || second;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.transactions where source = 'recurring'; c := c || ' owner_tx=' || n;
  select count(*) into n from public.transactions where payee = 'cancelled sub'; c := c || ' cancelled_posted=' || n;
  select count(*) into n from public.transactions where payee = 'future bill'; c := c || ' future_posted=' || n;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.transactions where source = 'recurring'; c := c || ' partner_tx=' || n;
  select count(*) into n from public.transactions where payee = 'secret sub'; c := c || ' partner_secret_tx=' || n;
  reset role;
  raise exception 'RESULT %', c;
end $t$;

-- Time & health: the wage is personal, the journal stays private, sample data fills Gym and Learning.
-- Expect gym_fee=1 minutes=8 own_wage_set=1 journal_forced=1 partner_reads_wage=none partner_edits_wage=0 partner_journal=0.
do $t$
declare a uuid := gen_random_uuid(); p uuid := gen_random_uuid(); tok text; n int; c text := ''; w numeric;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (a, 't1@rls.test', 'authenticated', 'authenticated', '{"display_name":"Ann"}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.load_sample_data();
  select count(*) into n from public.recurring where name = 'FitStudio'; c := c || 'gym_fee=' || n;
  select count(*) into n from public.learning_minutes; c := c || ' minutes=' || n;
  update public.member_settings set shift_wage = 15 where member_id = a; get diagnostics n = row_count; c := c || ' own_wage_set=' || n;
  tok := public.create_invite('Pia', 'partner', null);
  insert into public.journal_entries (text, visibility) values ('mine', 'family');
  select count(*) into n from public.journal_entries where text = 'mine' and visibility = 'private'; c := c || ' journal_forced=' || n;
  reset role;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values (p, 't2@rls.test', 'authenticated', 'authenticated', jsonb_build_object('invite_token', tok));
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select shift_wage into w from public.member_settings where member_id = a; c := c || ' partner_reads_wage=' || coalesce(w::text, 'none');
  update public.member_settings set shift_wage = 1 where member_id = a; get diagnostics n = row_count; c := c || ' partner_edits_wage=' || n;
  select count(*) into n from public.journal_entries; c := c || ' partner_journal=' || n;
  reset role;
  raise exception 'RESULT %', c;
end $t$;

-- Assistant: quotas, closed sessions, memory privacy (run this block on its own; it rolls back).
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); hh uuid; n int; seen int;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'ai-a@rls.test', 'authenticated', 'authenticated', '{"display_name":"Ann","household_name":"House A"}'),
    (b, 'ai-b@rls.test', 'authenticated', 'authenticated', '{"display_name":"Ben","household_name":"House B"}');
  select household_id into hh from public.members where id = a;
  update public.members set household_id = hh where id = b;
  update public.member_settings set household_id = hh where member_id = b;
  insert into public.subscriptions_billing (household_id, plan, status) values (hh, 'life', 'active')
    on conflict (household_id) do update set plan = 'life', status = 'active';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin perform public.ai_session_start('voice'); raise exception 'life plan opened voice';
  exception when others then if sqlerrm <> 'voice_quota' then raise; end if; end;

  for n in 1..20 loop perform public.ai_message_used(); end loop;
  begin perform public.ai_message_used(); raise exception 'message 21 allowed';
  exception when others then if sqlerrm <> 'ai_quota' then raise; end if; end;

  begin insert into public.ai_sessions (mode) values ('voice'); raise exception 'client made a session';
  exception when insufficient_privilege then null; end;
  begin update public.usage set voice_seconds = 0; raise exception 'client changed usage';
  exception when insufficient_privilege then null; end;

  insert into public.ai_memories (text, scope) values ('private of a', 'private'), ('shared of a', 'shared');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into seen from public.ai_memories where owner_id = a;
  if seen <> 0 then raise exception 'partner saw % memories while sharing is off', seen; end if;
  reset role;

  update public.member_settings set memory_shared = true where member_id = a;
  set local role authenticated;
  select count(*) into seen from public.ai_memories where owner_id = a;
  if seen <> 1 then raise exception 'partner should see only the shared memory, saw %', seen; end if;
  update public.ai_memories set text = 'changed' where owner_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'partner edited a memory'; end if;
  delete from public.ai_memories where owner_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'partner deleted a memory'; end if;
  reset role;

  raise exception 'assistant rules ok';
end $$;

-- Plans and reset (phase 7): run alone, it ends in a raise so nothing stays.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  hh uuid;
  n int;
begin
  insert into auth.users (id, email) values (a, a || '@test.local');
  select household_id into hh from public.members where id = a;
  update public.subscriptions_billing set plan = 'together', seats = 4 where household_id = hh;
  insert into auth.users (id, email) values (b, b || '@test.local');
  update public.members set household_id = hh, role = 'partner' where id = b;
  update public.member_settings set household_id = hh where member_id = b;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.plan_choose('life'); raise exception 'partner changed the plan';
  exception when others then if sqlerrm <> 'not_allowed' then raise; end if; end;
  begin update public.subscriptions_billing set plan = 'life'; 
    get diagnostics n = row_count; if n > 0 then raise exception 'client wrote billing'; end if;
  exception when insufficient_privilege then null; end;
  insert into public.goals (name, target, visibility) values ('of b', 100, 'family');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.plan_choose('life'); raise exception 'two people fit on one seat';
  exception when others then if sqlerrm <> 'seats_in_use' then raise; end if; end;
  perform public.plan_choose('together', 'year');
  insert into public.goals (name, target, visibility) values ('of a', 100, 'family');
  perform public.reset_my_data();
  select count(*) into n from public.goals where household_id = hh and name = 'of a';
  if n <> 0 then raise exception 'reset left own rows'; end if;
  select count(*) into n from public.goals where household_id = hh and name = 'of b';
  if n <> 1 then raise exception 'reset touched the partner'; end if;
  reset role;

  update public.subscriptions_billing set status = 'active' where household_id = hh;
  set local role authenticated;
  begin perform public.plan_choose('plus'); raise exception 'changed a paid plan without paying';
  exception when others then if sqlerrm <> 'use_billing' then raise; end if; end;
  reset role;

  raise exception 'plan rules ok';
end $$;
