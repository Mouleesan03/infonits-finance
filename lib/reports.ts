import { d, sum, inPeriod, cashFlow } from './finance';
import type { Ledger } from './types';
/** Project profitability uses the contract reporting month; cash uses settlement dates. */
export function periodReport(ledger: Ledger, period: string) {
  const projects = ledger.projects.filter((p) => inPeriod(p.reporting_month, period));
  const receipts = ledger.client_payments.filter((p) => inPeriod(String(p.date), period));
  const costPayments = ledger.project_cost_payments.filter(
    (p) => !p.is_withheld && inPeriod(String(p.date), period),
  );
  const cashExpenses = ledger.operating_expenses.filter(
    (e) => e.paid_on && inPeriod(String(e.paid_on), period),
  );
  const incurredExpenses = ledger.operating_expenses.filter((e) =>
    inPeriod(String(e.date), period),
  );
  const cashIn = sum(receipts.map((p) => String(p.amount_lkr)));
  const cashOut = sum([
    ...costPayments.map((p) => String(p.amount_lkr)),
    ...cashExpenses.map((e) => String(e.paid_lkr)),
  ]);
  const netCash = cashFlow(
    receipts.map((p) => String(p.amount_lkr)),
    costPayments.map((p) => String(p.amount_lkr)),
    cashExpenses.map((e) => String(e.paid_lkr)),
  );
  const expectedProfit = sum(projects.map((p) => p.profit));
  const netExpectedProfit = d(expectedProfit)
    .minus(sum(incurredExpenses.map((e) => String(e.amount_lkr))))
    .toFixed(2);
  return {
    projects,
    receipts,
    costPayments,
    cashExpenses,
    incurredExpenses,
    cashIn,
    cashOut,
    netCash,
    expectedProfit,
    netExpectedProfit,
  };
}
