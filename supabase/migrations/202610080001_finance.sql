-- Infonits Finance V1. Apply to a fresh Supabase PostgreSQL 15+ project.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create type public.finance_currency as enum ('LKR','USD','GBP','EUR','AUD','CAD');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 organization_id uuid not null default '11111111-1111-4111-8111-111111111111',
 name text not null default '', role text not null check(role in ('admin','editor')),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- No signup trigger: membership must be explicitly provisioned by the operator.
create function private.organization() returns uuid language sql stable security definer set search_path = '' as $$
 select organization_id from public.profiles where id=(select auth.uid()) and active
 and (role <> 'admin' or (select auth.jwt()->>'aal')='aal2')
$$;
revoke all on function private.organization() from public;
grant execute on function private.organization() to authenticated;
create table public.clients (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(),
 name text not null check(length(trim(name)) between 1 and 160), company text not null default '', country text not null default '',
 email text not null default '', phone text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(), client_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 160), amount numeric(18,2) not null check(amount between 0 and 9999999999.99),
 currency public.finance_currency not null default 'LKR', exchange_rate numeric(18,8) not null check(exchange_rate>0 and exchange_rate<100000000),
 amount_lkr numeric(18,2) generated always as (round(amount*exchange_rate,2)) stored,
 reporting_month date not null check(extract(day from reporting_month)=1),
 status text not null default 'In progress' check(status in ('Planned','In progress','On hold','Completed','Cancelled')),
 notes text not null default '', import_key text, source_record jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(organization_id,import_key),
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete restrict,
 check(currency<>'LKR' or exchange_rate=1)
);
create table public.client_payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(), project_id uuid not null,
 amount numeric(18,2) not null check(amount>0 and amount<=9999999999.99), currency public.finance_currency not null, exchange_rate numeric(18,8) not null check(exchange_rate>0 and exchange_rate<100000000),
 amount_lkr numeric(18,2) not null check(amount_lkr>0 and amount_lkr<=9999999999999999.99), contract_amount numeric(18,2) not null check(contract_amount>0 and contract_amount<=9999999999.99),
 date date not null, method text not null check(length(trim(method))>0), notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(project_id,organization_id) references public.projects(id,organization_id) on delete restrict,
 check(currency<>'LKR' or (exchange_rate=1 and amount=amount_lkr))
);
create table public.project_costs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(), project_id uuid not null,
 description text not null check(length(trim(description))>0), category text not null,
 amount numeric(18,2) not null check(amount>0 and amount<=9999999999.99), currency public.finance_currency not null, exchange_rate numeric(18,8) not null check(exchange_rate>0 and exchange_rate<100000000),
 amount_lkr numeric(18,2) generated always as (round(amount*exchange_rate,2)) stored,
 date date not null, is_estimate boolean not null default false, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),unique(id,organization_id),
 foreign key(project_id,organization_id) references public.projects(id,organization_id) on delete restrict,
 check(currency<>'LKR' or exchange_rate=1)
);
create table public.project_cost_payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(), cost_id uuid not null,
 amount numeric(18,2) not null check(amount>0 and amount<=9999999999.99), currency public.finance_currency not null, exchange_rate numeric(18,8) not null check(exchange_rate>0 and exchange_rate<100000000),
 amount_lkr numeric(18,2) not null check(amount_lkr>0 and amount_lkr<=9999999999999999.99), cost_amount numeric(18,2) not null check(cost_amount>0 and cost_amount<=9999999999.99),
 date date not null, method text not null, is_withheld boolean not null default false, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(cost_id,organization_id) references public.project_costs(id,organization_id) on delete restrict,
 check(currency<>'LKR' or (exchange_rate=1 and amount=amount_lkr))
);
create table public.operating_expenses (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(),
 description text not null check(length(trim(description))>0), category text not null,
 amount numeric(18,2) not null check(amount>0 and amount<=9999999999.99), currency public.finance_currency not null, exchange_rate numeric(18,8) not null check(exchange_rate>0 and exchange_rate<100000000),
 amount_lkr numeric(18,2) generated always as (round(amount*exchange_rate,2)) stored,
 date date not null, paid_lkr numeric(18,2) not null default 0 check(paid_lkr between 0 and 9999999999999999.99), paid_on date, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(paid_lkr<=round(amount*exchange_rate,2)),check((paid_lkr=0 and paid_on is null) or (paid_lkr>0 and paid_on is not null)),
 check(currency<>'LKR' or exchange_rate=1)
);
create table public.exchange_rates (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.organization(), currency public.finance_currency not null,
 rate numeric(18,8) not null check(rate>0 and rate<100000000), date date not null, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,currency,date),check(currency<>'LKR' or rate=1)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, actor_id uuid, table_name text not null, record_id uuid not null,
 action text not null, old_record jsonb, new_record jsonb, created_at timestamptz not null default now()
);
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,actor_id,table_name,record_id,action,old_record,new_record)
 values(coalesce(new.organization_id,old.organization_id),auth.uid(),tg_table_name,coalesce(new.id,old.id),tg_op,
 case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create function private.touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=clock_timestamp();return new;end $$;
-- Serialize obligations and settlements so simultaneous payments cannot over-allocate.
create function private.validate_payment() returns trigger language plpgsql set search_path='' as $$
declare p public.projects; c public.project_costs; total numeric;
begin
 if tg_table_name='client_payments' then
   select * into p from public.projects where id=new.project_id for update;
   select coalesce(sum(contract_amount),0) into total from public.client_payments where project_id=new.project_id and id<>new.id;
   if total+new.contract_amount>p.amount then raise exception 'Payment exceeds remaining original contract balance'; end if;
   if new.currency=p.currency and new.amount<>new.contract_amount then raise exception 'Same-currency payment must match contract allocation'; end if;
 else
   select * into c from public.project_costs where id=new.cost_id for update;
   select coalesce(sum(cost_amount),0) into total from public.project_cost_payments where cost_id=new.cost_id and id<>new.id;
   if total+new.cost_amount>c.amount then raise exception 'Payment exceeds remaining cost obligation'; end if;
   if new.currency=c.currency and new.amount<>new.cost_amount then raise exception 'Same-currency cost payment must match cost allocation'; end if;
 end if;
 return new;
end $$;
create trigger validate_client_payment before insert or update on public.client_payments for each row execute function private.validate_payment();
create trigger validate_cost_payment before insert or update on public.project_cost_payments for each row execute function private.validate_payment();
create function private.validate_obligation() returns trigger language plpgsql set search_path='' as $$
declare paid numeric;
begin
 if tg_table_name='projects' then
   select coalesce(sum(contract_amount),0) into paid from public.client_payments where project_id=new.id;
 else
   select coalesce(sum(cost_amount),0) into paid from public.project_cost_payments where cost_id=new.id;
 end if;
 if new.amount<paid then raise exception 'Value cannot be less than payments already allocated';end if;
 if new.currency<>old.currency and paid>0 then raise exception 'Reverse payments before changing the obligation currency';end if;
 return new;
end $$;
create trigger validate_project before update on public.projects for each row execute function private.validate_obligation();
create trigger validate_cost before update on public.project_costs for each row execute function private.validate_obligation();
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
revoke all on public.profiles from public,anon,authenticated;
grant select on public.profiles to authenticated;
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated using(organization_id=(select private.organization()));
revoke all on public.audit_logs from public,anon,authenticated;
grant select on public.audit_logs to authenticated;
do $$ declare t text; begin
 foreach t in array array['clients','projects','client_payments','project_costs','project_cost_payments','operating_expenses','exchange_rates'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('create policy organization_access on public.%I for all to authenticated using (organization_id=(select private.organization())) with check (organization_id=(select private.organization()))',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
   execute format('grant select,insert,update,delete on public.%I to authenticated',t);
   execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
   execute format('create trigger touch before update on public.%I for each row execute function private.touch()',t);
   execute format('create index on public.%I (organization_id)',t);
 end loop;
end $$;
create trigger audit_profile after insert or update or delete on public.profiles for each row execute function private.audit_change();
create index on public.projects(reporting_month);
create index on public.client_payments(project_id,date);
create index on public.project_costs(project_id);
create index on public.project_cost_payments(cost_id,date);
create index on public.operating_expenses(date);
create index on public.audit_logs(organization_id,created_at desc);
-- Aggregate each child relation first: never multiply payment/cost rows by joining both directly.
create view public.project_financials with(security_invoker=true) as
with receipts as (select project_id,sum(amount_lkr) received,sum(contract_amount) contract_received from public.client_payments group by project_id),
 cost_settlements as (select cost_id,sum(cost_amount) paid from public.project_cost_payments group by cost_id),
 costs as (select c.project_id,sum(c.amount_lkr) costs,sum(round((c.amount-coalesce(s.paid,0))*c.exchange_rate,2)) unpaid_costs from public.project_costs c left join cost_settlements s on s.cost_id=c.id group by c.project_id)
select p.id,p.organization_id,p.client_id,p.name,p.amount::text,p.currency,p.exchange_rate::text,p.amount_lkr::text,p.reporting_month,p.status,p.notes,p.created_at,p.updated_at,
 cl.name client_name,coalesce(r.received,0)::text received,coalesce(c.costs,0)::text costs,
 (p.amount_lkr-coalesce(c.costs,0))::text profit,(p.amount_lkr-coalesce(r.received,0))::text outstanding,
 coalesce(c.unpaid_costs,0)::text unpaid_costs,coalesce(r.contract_received,0)::text contract_received,
 (p.amount-coalesce(r.contract_received,0))::text original_outstanding,
 round((p.amount_lkr-coalesce(c.costs,0))/nullif(p.amount_lkr,0)*100,1)::text margin,
 case when coalesce(r.contract_received,0)>=p.amount then 'Paid' when coalesce(r.contract_received,0)>0 then 'Partially paid' else 'Unpaid' end payment_status
from public.projects p join public.clients cl on cl.id=p.client_id left join receipts r on r.project_id=p.id left join costs c on c.project_id=p.id;
grant select on public.project_financials to authenticated;
revoke all on public.project_financials from anon;
-- Records and audit entries are committed together by PostgreSQL transactions.
-- A reviewed CSV imports contracts only. Ambiguous legacy costs/payments are never guessed.
create function public.import_projects(records jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare row jsonb; count integer:=0;begin
 if private.organization() is null then raise exception 'Unauthorized';end if;
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>500 then raise exception 'Import requires at most 500 rows';end if;
 for row in select * from jsonb_array_elements(records) loop
   insert into public.projects(client_id,name,amount,currency,exchange_rate,reporting_month,status,notes,import_key,source_record)
   values((row->>'client_id')::uuid,row->>'name',(row->>'amount')::numeric,(row->>'currency')::public.finance_currency,
    (row->>'exchange_rate')::numeric,(row->>'reporting_month')::date,row->>'status',coalesce(row->>'notes',''),row->>'import_key',row->'source_record');
   count:=count+1;
 end loop;
 return count;
end $$;
revoke all on function public.import_projects(jsonb) from public,anon;
grant execute on function public.import_projects(jsonb) to authenticated;
commit;
