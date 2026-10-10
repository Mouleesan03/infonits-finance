-- The workspace uses email plus a six-digit PIN as its single sign-in method.
-- Active organization membership remains mandatory for every database request.
begin;

create or replace function private.organization()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.profiles
  where id = (select auth.uid())
    and active
$$;

revoke all on function private.organization() from public;
grant execute on function private.organization() to authenticated;

commit;
