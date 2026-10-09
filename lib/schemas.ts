import { z } from 'zod';
import { d } from './finance';
export const currencies = ['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD'] as const;
const text = z.string().trim().max(2000).default('');
const name = z.string().trim().min(1, 'This field is required').max(160);
const uuid = z.uuid();
export const amount = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use a positive amount with up to 2 decimal places');
const rate = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,8})?$/, 'Enter an exchange rate with up to 8 decimals')
  .refine((v) => d(v).gt(0), 'Rate must be greater than zero');
const date = z.iso.date();
const currency = z.enum(currencies);
const monetary = { amount, currency, exchange_rate: rate };
const settled = { ...monetary, amount_lkr: amount };
export const schemas = {
  clients: z.object({
    name,
    company: text,
    country: text,
    email: z.union([z.email(), z.literal('')]).default(''),
    phone: text,
    notes: text,
  }),
  projects: z.object({
    name,
    client_id: uuid,
    ...monetary,
    reporting_month: date.refine(
      (v) => v.endsWith('-01'),
      'Use the first day of the reporting month',
    ),
    status: z.enum(['Planned', 'In progress', 'On hold', 'Completed', 'Cancelled']),
    notes: text,
  }),
  client_payments: z.object({
    project_id: uuid,
    ...settled,
    contract_amount: amount,
    date,
    method: name,
    notes: text,
  }),
  project_costs: z.object({
    project_id: uuid,
    description: name,
    category: name,
    ...monetary,
    date,
    is_estimate: z.boolean(),
    notes: text,
  }),
  project_cost_payments: z.object({
    cost_id: uuid,
    ...settled,
    cost_amount: amount,
    date,
    method: name,
    is_withheld: z.boolean().default(false),
    notes: text,
  }),
  operating_expenses: z.object({
    description: name,
    category: name,
    ...monetary,
    date,
    paid_lkr: amount,
    paid_on: z.union([date, z.null()]),
    notes: text,
  }),
  exchange_rates: z.object({ currency, rate, date, notes: text }),
};
export type TableName = keyof typeof schemas;
export function validateRecord<T extends TableName>(table: T, input: unknown) {
  const data = schemas[table].parse(input);
  if (
    'currency' in data &&
    data.currency === 'LKR' &&
    'exchange_rate' in data &&
    !d(data.exchange_rate).eq(1)
  )
    throw new Error('LKR exchange rate must be 1');
  if ('amount_lkr' in data && data.currency === 'LKR' && !d(data.amount_lkr).eq(data.amount))
    throw new Error('LKR settlement must match its original amount');
  if ('paid_lkr' in data) {
    if (d(data.paid_lkr).gt(d(data.amount).times(data.exchange_rate).toDecimalPlaces(2)))
      throw new Error('Operating cash paid cannot exceed the expense value');
    if (d(data.paid_lkr).gt(0) && !data.paid_on) throw new Error('Enter the date cash was paid');
    if (d(data.paid_lkr).isZero() && data.paid_on)
      throw new Error('An unpaid expense cannot have a payment date');
  }
  return data as z.infer<(typeof schemas)[T]>;
}
export const tableSchema = z.enum(Object.keys(schemas) as [TableName, ...TableName[]]);
