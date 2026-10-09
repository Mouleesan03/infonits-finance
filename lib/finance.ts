import Decimal from 'decimal.js';
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Money = string;
export const d = (value: string | number | undefined | null) => new Decimal(value ?? '0');
export const money = (value: Decimal.Value) => new Decimal(value).toFixed(2);
export const sum = (values: (string | number | null | undefined)[]) =>
  values.reduce<Decimal>((total, value) => total.plus(d(value)), d(0)).toFixed(2);
export const convert = (amount: string, rate: string) => d(amount).times(rate).toFixed(2);
export function financials(value: string, received: string, costs: string, costsPaid: string) {
  const profit = d(value).minus(costs);
  return {
    value: money(value),
    received: money(received),
    costs: money(costs),
    profit: profit.toFixed(2),
    outstanding: d(value).minus(received).toFixed(2),
    unpaidCosts: d(costs).minus(costsPaid).toFixed(2),
    margin: d(value).isZero() ? null : profit.div(value).times(100).toFixed(1),
  };
}
export function cashFlow(received: string[], costPayments: string[], operatingPaid: string[]) {
  return d(sum(received)).minus(sum(costPayments)).minus(sum(operatingPaid)).toFixed(2);
}
export function formatMoney(value: string | number, currency = 'LKR', compact = false) {
  const amount = d(value);
  const prefix = currency === 'LKR' ? 'Rs.' : currency + ' ';
  if (compact && amount.abs().gte(1000000)) return prefix + amount.div(1000000).toFixed(2) + 'm';
  if (compact && amount.abs().gte(100000)) return prefix + amount.div(1000).toFixed(1) + 'k';
  const [whole, fraction] = amount.toFixed(2).split('.');
  return prefix + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
}
export function periodBounds(period: string) {
  if (!/^\d{4}(-\d{2})?$/.test(period)) throw new Error('Invalid period');
  const year = Number(period.slice(0, 4));
  const month = period.length === 7 ? Number(period.slice(5)) : 1;
  if (month < 1 || month > 12 || year < 1900 || year > 2200) throw new Error('Invalid period');
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to:
      period.length === 4
        ? `${year + 1}-01-01`
        : month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`,
  };
}
export const inPeriod = (date: string, period: string) => {
  const { from, to } = periodBounds(period);
  return date >= from && date < to;
};
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
