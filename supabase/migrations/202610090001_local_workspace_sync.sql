-- Cross-device storage for the browser workspace.
-- Each authenticated Supabase user can read and write only their own JSON snapshot.
begin;

create table if not exists public.local_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.local_workspaces enable row level security;

drop policy if exists own_local_workspace on public.local_workspaces;
create policy own_local_workspace
on public.local_workspaces
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.local_workspaces from public, anon, authenticated;
grant select, insert, update, delete on public.local_workspaces to authenticated;

create or replace function private.touch_local_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end
$$;

drop trigger if exists touch_local_workspace on public.local_workspaces;
create trigger touch_local_workspace
before update on public.local_workspaces
for each row execute function private.touch_local_workspace();

commit;
