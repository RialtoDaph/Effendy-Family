-- Bug reports kanban: shared by both members, author cannot be faked,
-- anon sees nothing. Needs two members (A, B). Everything is rolled back.
begin;
create temp table r(check_name text, ok boolean) on commit drop;
grant all on r to authenticated, anon;

do $$
declare
  a uuid := (select id from public.members order by sort limit 1);
  b uuid := (select id from public.members order by sort offset 1 limit 1);
  fid uuid;
  n int;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.feedback (title, note, page) values ('Test bug', 'details', '/budget') returning id into fid;
  insert into r values ('1 author is set to the sender', (select owner_id = a from public.feedback where id = fid));

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.feedback where id = fid;
  insert into r values ('2 partner sees the report', n = 1);
  update public.feedback set status = 'doing' where id = fid;
  insert into r values ('3 partner can move it', (select status = 'doing' from public.feedback where id = fid));

  begin
    insert into public.feedback (title, owner_id) values ('fake', a);
    insert into r values ('4 cannot send as someone else', false);
  exception when others then insert into r values ('4 cannot send as someone else', true);
  end;

  begin
    update public.feedback set owner_id = b where id = fid;
    insert into r values ('5 author cannot be changed', false);
  exception when insufficient_privilege then insert into r values ('5 author cannot be changed', true);
  end;

  begin
    update public.feedback set status = 'later' where id = fid;
    insert into r values ('6 unknown status refused', false);
  exception when check_violation then insert into r values ('6 unknown status refused', true);
  end;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    select count(*) into n from public.feedback;
    insert into r values ('7 anon cannot read', false);
  exception when insufficient_privilege then insert into r values ('7 anon cannot read', true);
  end;
exception when others then
  insert into r values ('unexpected error: ' || sqlerrm, false);
end $$;

reset role;
select * from r order by check_name;
rollback;
