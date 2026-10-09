import { describe, it, expect } from 'vitest';
import { periodReport } from '../lib/reports';
import { emptyLedger, type Ledger, type Project, type Row } from '../lib/types';
const row = (fields: Record<string, string | boolean | null>): Row => ({
  id: 'test',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...fields,
});
const project: Project = {
  ...row({}),
  name: 'Website',
  client_id: 'client',
  currency: 'LKR',
  amount: '1000.00',
  exchange_rate: '1',
  amount_lkr: '1000.00',
  reporting_month: '2026-01-01',
  status: 'In progress',
  notes: '',
  client_name: 'Client',
  received: '600.00',
  costs: '200.00',
  profit: '800.00',
  outstanding: '400.00',
  unpaid_costs: '100.00',
  contract_received: '600.00',
  original_outstanding: '400.00',
  margin: '80.0',
  payment_status: 'Partially paid',
};
const ledger: Ledger = {
  ...emptyLedger,
  projects: [project],
  client_payments: [
    row({ date: '2026-01-20', amount_lkr: '250.00' }),
    row({ date: '2026-02-20', amount_lkr: '350.00' }),
  ],
  project_cost_payments: [
    row({ date: '2026-01-20', amount_lkr: '100.00', is_withheld: false }),
    row({ date: '2026-01-20', amount_lkr: '10.00', is_withheld: true }),
  ],
  operating_expenses: [
    row({ date: '2026-01-10', paid_on: '2026-02-01', amount_lkr: '50.00', paid_lkr: '50.00' }),
    row({ date: '2025-12-20', paid_on: '2026-01-02', amount_lkr: '20.00', paid_lkr: '20.00' }),
  ],
};
describe('dashboard reporting periods', () => {
  it('separates lifetime balances of selected projects from monthly cash receipts', () => {
    const report = periodReport(ledger, '2026-01');
    expect(report.projects[0].received).toBe('600.00');
    expect(report.cashIn).toBe('250.00');
    expect(report.expectedProfit).toBe('800.00');
  });
  it('never double-deducts a fee already withheld from net client receipts', () => {
    const report = periodReport(ledger, '2026-01');
    expect(report.cashOut).toBe('120.00');
    expect(report.netCash).toBe('130.00');
  });
  it('uses incurred dates for operating profit and paid dates for cash', () => {
    const january = periodReport(ledger, '2026-01');
    const february = periodReport(ledger, '2026-02');
    expect(january.netExpectedProfit).toBe('750.00');
    expect(february.expectedProfit).toBe('0.00');
    expect(february.cashOut).toBe('50.00');
    expect(february.netCash).toBe('300.00');
  });
  it('aggregates a full year without confusing project value with cash', () => {
    const report = periodReport(ledger, '2026');
    expect(report.cashIn).toBe('600.00');
    expect(report.netCash).toBe('430.00');
    expect(report.netExpectedProfit).toBe('750.00');
  });
});
