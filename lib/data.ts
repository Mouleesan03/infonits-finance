import 'server-only';
import { redirect } from 'next/navigation';
import { authorize, configured } from './supabase/server';
import { emptyLedger, type WorkspaceData, type Ledger } from './types';
const base = 'id,organization_id,created_at,updated_at';
export const selects: Record<string, string> = {
  clients: '*',
  projects: '*',
  client_payments: `${base},project_id,amount::text,currency,exchange_rate::text,amount_lkr::text,contract_amount::text,date,method,notes`,
  project_costs: `${base},project_id,description,category,amount::text,currency,exchange_rate::text,amount_lkr::text,date,is_estimate,notes`,
  project_cost_payments: `${base},cost_id,amount::text,currency,exchange_rate::text,amount_lkr::text,cost_amount::text,date,method,is_withheld,notes`,
  operating_expenses: `${base},description,category,amount::text,currency,exchange_rate::text,amount_lkr::text,date,paid_lkr::text,paid_on,notes`,
  exchange_rates: `${base},currency,rate::text,date,notes`,
  audit_logs:
    'id,organization_id,actor_id,table_name,record_id,action,created_at,old_record::text,new_record::text',
};
export async function getWorkspace(): Promise<WorkspaceData> {
  if (!configured()) return { configured: false, email: '', role: '', ledger: emptyLedger };
  let auth;
  try {
    auth = await authorize();
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'MFA_REQUIRED') redirect('/login?step=mfa');
    if (code === 'FORBIDDEN') redirect('/login?error=membership');
    redirect('/login');
  }
  const { db, user, profile } = auth;
  try {
    const entries = await Promise.all(
      Object.keys(emptyLedger).map(async (table) => {
        // Paginate to avoid silently dropping financial rows at Supabase's default 1000-row limit.
        const rows: unknown[] = [];
        for (let page = 0; ; page++) {
          const { data, error } = await db
            .from(table === 'projects' ? 'project_financials' : table)
            .select(selects[table])
            .order('id')
            .range(page * 500, page * 500 + 499);
          if (error) throw new Error(`Unable to load ${table}. Check migrations and permissions.`);
          rows.push(...(data ?? []));
          if ((data?.length ?? 0) < 500) break;
        }
        return [table, rows];
      }),
    );
    return {
      configured: true,
      email: user.email ?? '',
      role: profile.role,
      ledger: Object.fromEntries(entries) as Ledger,
    };
  } catch (error) {
    return {
      configured: true,
      email: user.email ?? '',
      role: profile.role,
      ledger: emptyLedger,
      error: (error as Error).message,
    };
  }
}
