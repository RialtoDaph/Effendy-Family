-- Two people in one household (a, b) and a stranger (c). Every table with `visibility`,
-- with a's rows made private: b must not read, change or delete them, and c must not read
-- anything of the household. Ends in a raise, so nothing stays. Expect:
-- "REPORT tables=23 control_b_family_tx=6 b_journal=0" with no LEAK_ or SELECT_FAIL entry.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  hh uuid; n int; t record; rep text := ''; vis text[]; ok int := 0; y uuid;
  -- Columns the app selects, so a hidden column shows up here and not on a real phone.
  q jsonb := '{"member_settings":"ai_name,ef_months,lang,memory_on,voice,warn_pct,brief_at","subscriptions_billing":"current_period_end,interval,plan,seats,status","invites":"expires_at,id,name,used_at","usage":"ai_messages,extra_voice_seconds,voice_seconds","files":"id,kind,mime,name,owner_id,size,storage_path,visibility"}';
  k text; v text;
begin
  insert into auth.users (id, email) values (a, a || '@t.local'), (c, c || '@t.local');
  select household_id into hh from public.members where id = a;
  insert into auth.users (id, email) values (b, b || '@t.local');
  update public.members set household_id = hh, role = 'partner' where id = b;
  update public.member_settings set household_id = hh where member_id = b;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for k, v in select * from jsonb_each_text(q) loop
    begin execute format('select %s from public.%I limit 0', v, k);
    exception when others then rep := rep || 'SELECT_FAIL:' || k || ' '; end;
  end loop;
  perform public.load_sample_data();
  insert into public.week_priorities (week_start, title) values (date_trunc('week', now())::date, 'p');
  insert into public.yearly_goals (name, target, unit, year) values ('y', 1, 'x', 2026) returning id into y;
  insert into public.goal_progress (goal_id, amount) values (y, 1);
  insert into public.career_steps (title) values ('c');
  insert into public.files (storage_path, name, kind) values (hh || '/' || a || '/x', 'n', 'receipt');
  insert into public.tax_deductions (year, title) values (2026, 't');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.transactions; rep := rep || 'control_b_family_tx=' || n || ' ';
  select count(*) into n from public.journal_entries; rep := rep || 'b_journal=' || n || ' ';
  reset role;

  select array_agg(table_name::text) into vis from information_schema.columns where table_schema = 'public' and column_name = 'visibility';
  for t in select unnest(vis) tb loop
    execute format('alter table public.%I disable trigger user', t.tb);
    execute format('update public.%I set visibility = ''private'' where household_id = $1', t.tb) using hh;
    execute format('alter table public.%I enable trigger user', t.tb);
  end loop;

  set local role authenticated;
  for t in select unnest(vis) tb loop
    execute format('select count(*) from public.%I where owner_id = $1', t.tb) into n using a;
    if n > 0 then rep := rep || 'LEAK_b_read:' || t.tb || '=' || n || ' '; end if;
    begin
      execute format('with x as (update public.%I set updated_at = now() where owner_id = $1 returning 1) select count(*) from x', t.tb) into n using a;
      if n > 0 then rep := rep || 'LEAK_b_update:' || t.tb || '=' || n || ' '; end if;
    exception when insufficient_privilege then null; end;
    begin
      execute format('with x as (delete from public.%I where owner_id = $1 returning 1) select count(*) from x', t.tb) into n using a;
      if n > 0 then rep := rep || 'LEAK_b_delete:' || t.tb || '=' || n || ' '; end if;
    exception when insufficient_privilege then null; end;
    ok := ok + 1;
  end loop;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for t in
    select c2.table_name tb from information_schema.columns c2 join information_schema.tables x using (table_schema, table_name)
    where c2.table_schema = 'public' and c2.column_name = 'household_id' and x.table_type = 'BASE TABLE' and c2.table_name <> 'security'
  loop
    begin
      execute format('select count(*) from public.%I where household_id = $1', t.tb) into n using hh;
      if n > 0 then rep := rep || 'LEAK_c_read:' || t.tb || '=' || n || ' '; end if;
    exception when insufficient_privilege then null; end;
  end loop;
  reset role;
  raise exception 'REPORT tables=% %', ok, rep;
end $$;
