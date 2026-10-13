-- Inbox digest: the key works only for its owner, digests are owner-only
-- (not even the partner), anon cannot read. Everything is rolled back.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
grant all on r to authenticated, anon;

do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := (select id from public.members order by sort offset 1 limit 1);
  ka text; kb text; old text;
  n int;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  old := public.create_inbox_key();
  ka := public.create_inbox_key();
  insert into r values ('1 new key replaces the old one', not public.inbox_key_ok(old) and public.inbox_key_ok(ka));
  insert into r values ('2 key is long and random', length(ka) = 68);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  kb := public.create_inbox_key();

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform public.save_inbox_digest(ka, current_date, 'a@example.com', 'A summary', '[{"title":"x"}]', 3);
  perform public.save_inbox_digest(kb, current_date, 'b@example.com', 'B summary', '[]', 1);
  begin
    perform public.save_inbox_digest('efk_wrong', current_date, 'x', 'evil', '[]', 1);
    insert into r values ('3 wrong key refused', false);
  exception when others then insert into r values ('3 wrong key refused', sqlerrm = 'unknown key');
  end;
  begin
    select count(*) into n from public.inbox_digests;
    insert into r values ('4 anon cannot read digests', false);
  exception when insufficient_privilege then insert into r values ('4 anon cannot read digests', true);
  end;
  begin
    perform public.create_inbox_key();
    insert into r values ('5 anon cannot make a key', false);
  exception when insufficient_privilege then insert into r values ('5 anon cannot make a key', true);
  end;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.inbox_digests;
  insert into r values ('6 owner sees only own digest', n = 1 and (select summary from public.inbox_digests) = 'A summary');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.inbox_digests where summary = 'A summary';
  insert into r values ('7 partner cannot read it', n = 0);
  begin
    insert into public.inbox_digests (household_id, owner_id, day, summary) select household_id, a, current_date - 1, 'fake' from public.members where id = a;
    insert into r values ('8 nobody writes digests directly', false);
  exception when insufficient_privilege then insert into r values ('8 nobody writes digests directly', true);
  end;
  perform public.revoke_inbox_key();
  insert into r values ('9 revoked key stops working', not public.inbox_key_ok(kb));
exception when others then
  insert into r values ('unexpected error: ' || sqlerrm, false);
end $$;

reset role;
select * from r order by check_name;
rollback;
