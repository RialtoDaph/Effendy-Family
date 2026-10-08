-- Access-rule checks for the two members. Run in the Supabase SQL editor
-- (or via the MCP execute_sql tool) after both accounts exist. Nothing is
-- changed: everything runs inside a transaction that is rolled back.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
grant all on r to authenticated, anon;

set local role anon;
do $$ begin
  begin perform 1 from public.members; insert into r values ('signed-out visitor blocked from members', false);
  exception when insufficient_privilege then insert into r values ('signed-out visitor blocked from members', true); end;
end $$;
reset role;

do $$
declare a uuid; b uuid; me uuid; other uuid; n int; i int;
begin
  select id into a from public.members where sort = 0;
  select id into b from public.members where sort = 1;
  for i in 1..2 loop
    me := case when i = 1 then a else b end;
    other := case when i = 1 then b else a end;
    perform set_config('request.jwt.claims', json_build_object('sub', me, 'role', 'authenticated')::text, true);
    set local role authenticated;

    select count(*) into n from public.members;
    insert into r values (i || ': sees both members', n = 2);
    select count(*) into n from public.member_settings;
    insert into r values (i || ': sees only own settings', n = 1);

    update public.members set display_name = 'hacked' where id = other;
    get diagnostics n = row_count;
    insert into r values (i || ': cannot rename partner', n = 0);

    update public.member_settings set warn_pct = 99 where member_id = other;
    get diagnostics n = row_count;
    insert into r values (i || ': cannot change partner settings', n = 0);

    begin
      update public.members set role = 'member' where id = me;
      insert into r values (i || ': cannot change own role', false);
    exception when insufficient_privilege then
      insert into r values (i || ': cannot change own role', true);
    end;

    begin
      insert into public.members (id, household_id, display_name) values (gen_random_uuid(), gen_random_uuid(), 'x');
      insert into r values (i || ': cannot add members', false);
    exception when insufficient_privilege then
      insert into r values (i || ': cannot add members', true);
    end;

    update public.members set display_name = display_name where id = me;
    get diagnostics n = row_count;
    insert into r values (i || ': can edit own name', n = 1);
    reset role;
  end loop;
end $$;

select * from r;
rollback;
