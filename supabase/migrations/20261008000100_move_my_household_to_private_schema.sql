-- Keep the RLS helper out of the REST API (/rest/v1/rpc).
-- Policies reference the function by OID, so they follow the move.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.my_household() set schema private;
