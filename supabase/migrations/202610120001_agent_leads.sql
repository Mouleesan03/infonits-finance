-- Leads captured by the infonits.io agent plugin.
begin;

create table if not exists public.agent_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null default '' check (length(name) <= 160),
  email text not null default '' check (length(email) <= 320),
  phone text not null default '' check (length(phone) <= 80),
  message text not null default '' check (length(message) <= 5000),
  source text not null default 'infonits.io agent' check (length(source) <= 160),
  page_url text not null default '',
  status text not null default 'New' check (status in ('New','Contacted','Qualified','Closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email <> '' or phone <> '')
);

alter table public.agent_leads enable row level security;
drop policy if exists agent_leads_read on public.agent_leads;
create policy agent_leads_read on public.agent_leads
for select to authenticated
using (organization_id = (select private.organization()));

drop policy if exists agent_leads_update on public.agent_leads;
create policy agent_leads_update on public.agent_leads
for update to authenticated
using (organization_id = (select private.organization()))
with check (organization_id = (select private.organization()));

revoke all on public.agent_leads from public, anon, authenticated;
grant select, update on public.agent_leads to authenticated;

drop trigger if exists touch_agent_leads on public.agent_leads;
create trigger touch_agent_leads before update on public.agent_leads
for each row execute function private.touch();

create index if not exists agent_leads_org_created_idx
on public.agent_leads (organization_id, created_at desc);
create index if not exists agent_leads_org_status_idx
on public.agent_leads (organization_id, status);

commit;
