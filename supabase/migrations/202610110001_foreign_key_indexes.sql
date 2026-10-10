-- Cover composite foreign keys used by finance relationships.
-- These indexes keep parent updates/deletes and joined lookups efficient as data grows.
begin;

create index if not exists projects_client_organization_idx
  on public.projects (client_id, organization_id);

create index if not exists client_payments_project_organization_idx
  on public.client_payments (project_id, organization_id);

create index if not exists project_costs_project_organization_idx
  on public.project_costs (project_id, organization_id);

create index if not exists project_cost_payments_cost_organization_idx
  on public.project_cost_payments (cost_id, organization_id);

commit;
