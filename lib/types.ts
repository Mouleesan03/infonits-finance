export type Row = {
  id: string;
  created_at: string;
  updated_at: string;
  [key: string]: string | boolean | null;
};
export type Project = Row & {
  name: string;
  client_id: string;
  currency: string;
  amount: string;
  amount_lkr: string;
  exchange_rate: string;
  reporting_month: string;
  status: string;
  notes: string;
  client_name: string;
  received: string;
  costs: string;
  profit: string;
  outstanding: string;
  unpaid_costs: string;
  contract_received: string;
  original_outstanding: string;
  margin: string | null;
  payment_status: string;
};
export type Ledger = {
  clients: Row[];
  projects: Project[];
  client_payments: Row[];
  project_costs: Row[];
  project_cost_payments: Row[];
  operating_expenses: Row[];
  exchange_rates: Row[];
  audit_logs: Row[];
};
export type WorkspaceData = {
  configured: boolean;
  email: string;
  role: string;
  ledger: Ledger;
  error?: string;
};
export const emptyLedger: Ledger = {
  clients: [],
  projects: [],
  client_payments: [],
  project_costs: [],
  project_cost_payments: [],
  operating_expenses: [],
  exchange_rates: [],
  audit_logs: [],
};
