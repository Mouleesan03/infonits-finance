import { describe, it, expect } from 'vitest';
import {
  convert,
  financials,
  sum,
  cashFlow,
  inPeriod,
  periodBounds,
  formatMoney,
} from '../lib/finance';
import { parseCsv, exportCsv } from '../lib/csv';
import { validateRecord } from '../lib/schemas';
describe('money and financial separation', () => {
  it('never subtracts an advance from project profit', () => {
    const f = financials('43045.33', '16000', '20000', '0');
    expect(f.profit).toBe('23045.33');
    expect(f.outstanding).toBe('27045.33');
    expect(f.unpaidCosts).toBe('20000.00');
  });
  it('does not subtract payments against an already recorded cost twice', () => {
    const f = financials('1151926.06', '500000', '500000', '200000');
    expect(f.profit).toBe('651926.06');
    expect(f.unpaidCosts).toBe('300000.00');
  });
  it('adds cents exactly', () => {
    expect(sum(['0.10', '0.20'])).toBe('0.30');
    expect(sum(Array(10000).fill('0.01'))).toBe('100.00');
  });
  it('converts historic rates once, rounding half up', () => {
    expect(convert('65', '331.11784615')).toBe('21522.66');
    expect(convert('1', '1.005')).toBe('1.01');
    expect(convert('9999999999.99', '999.12345678')).toBe('9991234567790.01');
  });
  it.each(['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD'])(
    'accepts %s as a contract currency',
    (currency) => {
      expect(
        validateRecord('projects', {
          name: 'Test',
          client_id: '11111111-1111-4111-8111-111111111111',
          amount: '100.00',
          currency,
          exchange_rate: currency === 'LKR' ? '1' : '300.12345678',
          reporting_month: '2026-01-01',
          status: 'In progress',
          notes: '',
        }).currency,
      ).toBe(currency);
    },
  );
  it('supports negative expected profit', () => {
    const f = financials('100', '20', '150', '30');
    expect(f.profit).toBe('-50.00');
    expect(f.margin).toBe('-50.0');
  });
  it('does not invent a margin for a zero-value project', () =>
    expect(financials('0', '0', '10', '0').margin).toBeNull());
  it('keeps actual cash separate from profit', () =>
    expect(cashFlow(['10.15', '20.10'], ['5.05'], ['7.10'])).toBe('18.10'));
  it('handles year-end and leap-year period boundaries', () => {
    expect(periodBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(inPeriod('2024-02-29', '2024-02')).toBe(true);
    expect(inPeriod('2024-03-01', '2024-02')).toBe(false);
    expect(inPeriod('2026-12-31', '2026')).toBe(true);
    expect(() => periodBounds('2026-13')).toThrow();
  });
  it('formats large values without converting to floating point', () =>
    expect(formatMoney('9999999999999999.99')).toBe('Rs.9,999,999,999,999,999.99'));
  it('rejects nonnumeric, negative, malformed and excessive-precision financial input', () => {
    for (const amount of ['NaN', '-1', '0.001', '1e4', '10000000000'])
      expect(() =>
        validateRecord('projects', {
          name: 'Bad',
          client_id: '11111111-1111-4111-8111-111111111111',
          amount,
          currency: 'LKR',
          exchange_rate: '1',
          reporting_month: '2026-01-01',
          status: 'Planned',
        }),
      ).toThrow();
  });
  it('rejects invalid LKR rates and operating cash dates', () => {
    expect(() =>
      validateRecord('projects', {
        name: 'Bad',
        client_id: '11111111-1111-4111-8111-111111111111',
        amount: '100',
        currency: 'LKR',
        exchange_rate: '300',
        reporting_month: '2026-01-01',
        status: 'Planned',
      }),
    ).toThrow('LKR');
    expect(() =>
      validateRecord('operating_expenses', {
        description: 'Rent',
        category: 'Rent',
        amount: '100',
        currency: 'LKR',
        exchange_rate: '1',
        date: '2026-01-01',
        paid_lkr: '40',
        paid_on: null,
      }),
    ).toThrow('date');
  });
});
describe('CSV migration safety', () => {
  it('supports quoted commas and multiline source notes', () => {
    const { rows } = parseCsv('name,amount,notes\n"Website, A",100,"line 1\nline 2"');
    expect(rows[0].name).toBe('Website, A');
    expect(rows[0].notes).toBe('line 1\nline 2');
  });
  it('rejects broken CSV and empty imports', () => {
    expect(() => parseCsv('name,amount\n')).toThrow();
    expect(() => parseCsv('name,amount\n"unterminated,1')).toThrow();
  });
  it('neutralizes spreadsheet formula injection', () => {
    const output = exportCsv([
      { name: '=HYPERLINK("https://example.com")', notes: ' @SUM(1,1)', value: '-20' },
    ]);
    const data = parseCsv(output).rows[0];
    expect(data.name.startsWith("'=")).toBe(true);
    expect(data.notes.startsWith("' @")).toBe(true);
    expect(data.value).toBe("'-20");
  });
});
