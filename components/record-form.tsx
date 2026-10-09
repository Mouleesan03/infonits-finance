'use client';
import { useState } from 'react';
import { useForm, type FieldValues } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Plus, LoaderCircle, Info } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { currencies, type TableName, validateRecord } from '@/lib/schemas';
import { convert, today, d } from '@/lib/finance';
import type { Ledger, Row } from '@/lib/types';
export type FormTarget = {
  table: TableName;
  record?: Row;
  defaults?: Record<string, string | boolean>;
};
const titles: Record<TableName, string> = {
  clients: 'client',
  projects: 'project',
  client_payments: 'client payment',
  project_costs: 'project cost',
  project_cost_payments: 'cost payment',
  operating_expenses: 'operating expense',
  exchange_rates: 'exchange rate',
};
export function RecordForm({
  target,
  onClose,
  ledger,
  configured,
  onNotice,
}: {
  target: FormTarget;
  onClose: () => void;
  ledger: Ledger;
  configured: boolean;
  onNotice: (s: string) => void;
}) {
  const router = useRouter();
  const { table, record } = target;
  const [error, setError] = useState('');
  const defaults: FieldValues = {
    name: '',
    description: '',
    company: '',
    country: '',
    email: '',
    phone: '',
    notes: '',
    client_id: '',
    project_id: '',
    cost_id: '',
    currency: 'LKR',
    amount: '',
    exchange_rate: '1',
    amount_lkr: '',
    contract_amount: '',
    cost_amount: '',
    date: today(),
    reporting_month: today().slice(0, 7) + '-01',
    status: 'In progress',
    method: 'Bank transfer',
    category: table === 'operating_expenses' ? 'Software' : 'Freelancer',
    is_estimate: false,
    is_withheld: false,
    paid_lkr: '0',
    paid_on: '',
    rate: '',
    ...record,
    ...target.defaults,
  };
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
    setError: fieldError,
  } = useForm({ defaultValues: defaults });
  const currency = watch('currency');
  const amount = watch('amount');
  const rate = watch('exchange_rate');
  const paid = watch('paid_lkr');
  const selectedProject = ledger.projects.find((p) => p.id === watch('project_id'));
  const selectedCost = ledger.project_costs.find((c) => c.id === watch('cost_id'));
  const monetary = !['clients', 'exchange_rates'].includes(table);
  const payment = ['client_payments', 'project_cost_payments'].includes(table);
  const input = (key: string, label: string, type = 'text', hint?: string) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input
        {...register(key)}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        aria-invalid={!!errors[key]}
        placeholder={key.includes('amount') ? '0.00' : undefined}
      />
      {hint && <small>{hint}</small>}
      {errors[key] && <small className="field-error">{String(errors[key]?.message)}</small>}
    </label>
  );
  const select = (key: string, label: string, options: { value: string; label: string }[]) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <select
        {...register(key, {
          onChange: (event) => {
            if (key === 'currency') {
              setValue('exchange_rate', event.target.value === 'LKR' ? '1' : '');
              setValue('amount_lkr', '');
              if (table === 'exchange_rates')
                setValue('rate', event.target.value === 'LKR' ? '1' : '');
            }
          },
        })}
        aria-invalid={!!errors[key]}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors[key] && <small className="field-error">{String(errors[key]?.message)}</small>}
    </label>
  );
  async function save(values: FieldValues) {
    setError('');
    try {
      if (!configured) throw new Error('Connect Supabase in Settings before saving records.');
      const data = { ...values };
      if (monetary) {
        if (data.currency === 'LKR') data.exchange_rate = '1';
        if (payment && !data.amount_lkr) data.amount_lkr = convert(data.amount, data.exchange_rate);
      }
      if (
        table === 'client_payments' &&
        !data.contract_amount &&
        selectedProject?.currency === data.currency
      )
        data.contract_amount = data.amount;
      if (
        table === 'project_cost_payments' &&
        !data.cost_amount &&
        selectedCost?.currency === data.currency
      )
        data.cost_amount = data.amount;
      if (table === 'operating_expenses') data.paid_on = data.paid_on || null;
      const parsed = validateRecord(table, data);
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          id: record?.id,
          updated_at: record?.updated_at,
          values: parsed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onNotice(
        `${titles[table][0].toUpperCase() + titles[table].slice(1)} ${record ? 'updated' : 'added'}.`,
      );
      router.refresh();
      onClose();
    } catch (e) {
      if (e instanceof z.ZodError) {
        e.issues.forEach((issue) => fieldError(String(issue.path[0]), { message: issue.message }));
        setError('Please check the highlighted fields.');
      } else setError((e as Error).message);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !isSubmitting && onClose()}
      title={`${record ? 'Edit' : 'Add'} ${titles[table]}`}
      description={
        payment
          ? 'Record the actual settlement and keep its historical exchange rate.'
          : 'Keep your records clear, accurate and easy to find.'
      }
    >
      <form onSubmit={handleSubmit(save)}>
        {!configured && (
          <div className="notice">
            <Info size={16} />
            <span>Connect Supabase in Settings to save this record.</span>
          </div>
        )}
        <div className="form-grid">
          {table === 'clients' && (
            <>
              {input('name', 'Client name')}
              {input('company', 'Company')}
              {input('country', 'Country')}
              {input('email', 'Email', 'email')}
              {input('phone', 'Phone / WhatsApp')}
            </>
          )}
          {table === 'projects' && (
            <>
              {input('name', 'Project name')}
              {select(
                'client_id',
                'Client',
                ledger.clients.map((c) => ({ value: c.id, label: String(c.name) })),
              )}
              {input(
                'reporting_month',
                'Reporting month',
                'date',
                'Use the first day of the month.',
              )}
              {select(
                'status',
                'Project status',
                ['Planned', 'In progress', 'On hold', 'Completed', 'Cancelled'].map((s) => ({
                  value: s,
                  label: s,
                })),
              )}
            </>
          )}
          {['client_payments', 'project_costs'].includes(table) &&
            select(
              'project_id',
              'Project',
              ledger.projects.map((p) => ({ value: p.id, label: p.name })),
            )}
          {table === 'project_cost_payments' &&
            select(
              'cost_id',
              'Cost obligation',
              ledger.project_costs.map((c) => ({ value: c.id, label: String(c.description) })),
            )}
          {['project_costs', 'operating_expenses'].includes(table) && (
            <>
              {input('description', 'Description')}
              {input(
                'category',
                'Category',
                'text',
                'For example: Freelancer, Software, or Processing fees.',
              )}
            </>
          )}
          {(monetary || table === 'exchange_rates') &&
            select(
              'currency',
              'Currency',
              currencies.map((c) => ({ value: c, label: c })),
            )}
          {monetary && (
            <>
              {input(
                'amount',
                table === 'projects' ? 'Original contract amount' : 'Original amount',
                'text',
              )}
              {currency !== 'LKR' &&
                input(
                  'exchange_rate',
                  'Historical rate to LKR',
                  'text',
                  'LKR per 1 unit of this currency.',
                )}
            </>
          )}
          {payment && (
            <>
              {input(
                'amount_lkr',
                'Actual LKR settlement',
                'text',
                `Leave blank to use ${amount && rate && /^\d+(\.\d+)?$/.test(amount) && /^\d+(\.\d+)?$/.test(rate) ? convert(amount, rate) : 'amount × rate'}. Record fees separately as project costs.`,
              )}
              {input(
                table === 'client_payments' ? 'contract_amount' : 'cost_amount',
                `Amount applied in ${String((selectedProject ?? selectedCost)?.currency ?? 'original currency')}`,
                'text',
                'Required if payment currency differs; otherwise defaults to payment amount.',
              )}
              {input('method', 'Payment method')}
            </>
          )}
          {!['clients', 'projects'].includes(table) &&
            input('date', payment ? 'Payment date' : 'Date', 'date')}
          {table === 'project_cost_payments' && (
            <label className="checkbox-field">
              <input type="checkbox" {...register('is_withheld')} />
              <span>
                Fee withheld from a client settlement (already included in net receipts; no
                additional cash outflow)
              </span>
            </label>
          )}
          {table === 'project_costs' && (
            <label className="checkbox-field">
              <input type="checkbox" {...register('is_estimate')} />
              <span>This is a planned / estimated cost</span>
            </label>
          )}
          {table === 'operating_expenses' && (
            <>
              {input(
                'paid_lkr',
                'Cash paid (LKR)',
                'text',
                'For multiple settlements, create separate expense entries.',
              )}
              {paid &&
                /^\d+(\.\d+)?$/.test(paid) &&
                d(paid).gt(0) &&
                input('paid_on', 'Cash payment date', 'date')}
            </>
          )}
          {table === 'exchange_rates' && input('rate', 'LKR per 1 unit', 'text')}
          <label className="field full">
            <span>
              Notes <small>Optional</small>
            </span>
            <textarea {...register('notes')} rows={3} placeholder="Add a little context…" />
          </label>
        </div>
        {monetary && (
          <div className="form-note">
            <Info size={15} />
            {table === 'client_payments'
              ? 'Client payments reduce outstanding. They do not reduce project profit.'
              : table === 'project_cost_payments'
                ? 'Paying a recorded cost affects cash flow. It does not deduct the cost from profit again.'
                : 'Amounts retain their recorded exchange rate. Historical results never use a live rate.'}
          </div>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !configured}>
            {isSubmitting ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{' '}
            {record ? 'Save changes' : `Add ${titles[table]}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
