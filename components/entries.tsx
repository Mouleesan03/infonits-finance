'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search, Pencil, Trash2, Plus, ArrowUpRight, ReceiptText } from 'lucide-react';
import type { Ledger, Row } from '@/lib/types';
import type { TableName } from '@/lib/schemas';
import { d, formatMoney, sum } from '@/lib/finance';
import type { FormTarget } from './record-form';
import { EmptyState, Badge, SectionHeading } from './ui/common';
import { Button } from './ui/button';
export function costStatus(cost: Row, payments: Row[]) {
  const paid = d(
    sum(payments.filter((p) => p.cost_id === cost.id).map((p) => String(p.cost_amount))),
  );
  return paid.gte(String(cost.amount))
    ? 'Paid'
    : paid.gt(0)
      ? 'Partially paid'
      : cost.is_estimate
        ? 'Planned'
        : 'Unpaid';
}
export function Entries({
  table,
  rows,
  ledger,
  openForm,
  onDelete,
  title,
}: {
  table: TableName;
  rows: Row[];
  ledger: Ledger;
  openForm: (f: FormTarget) => void;
  onDelete: (t: TableName, r: Row) => void;
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const names = Object.fromEntries(ledger.projects.map((p) => [p.id, p.name]));
  const filtered = rows
    .filter((r) =>
      [r.description, r.notes, r.method, names[String(r.project_id)]]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return (
    <section className="panel">
      {title && (
        <SectionHeading title={title}>
          <Button variant="outline" size="sm" onClick={() => openForm({ table })}>
            <Plus size={14} />
            Add entry
          </Button>
        </SectionHeading>
      )}
      <div className="entries-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            aria-label="Search records"
          />
        </div>
        <span className="muted">{filtered.length} records</span>
      </div>
      {filtered.length ? (
        <div className="entry-list">
          {filtered.map((row) => {
            const isCost = table === 'project_costs';
            const status = isCost
              ? costStatus(row, ledger.project_cost_payments)
              : table === 'operating_expenses'
                ? d(String(row.paid_lkr)).eq(String(row.amount_lkr))
                  ? 'Paid'
                  : d(String(row.paid_lkr)).gt(0)
                    ? 'Partially paid'
                    : 'Unpaid'
                : '';
            return (
              <article className="entry-row" key={row.id}>
                <span className="entry-icon">
                  <ReceiptText size={18} />
                </span>
                <div className="entry-description">
                  <strong>
                    {String(
                      row.description ??
                        names[String(row.project_id)] ??
                        ledger.project_costs.find((c) => c.id === row.cost_id)?.description ??
                        'Payment',
                    )}
                  </strong>
                  <small>
                    {String(row.date)} · {String(row.category ?? row.method ?? '')}
                    {row.is_withheld ? ' · Withheld fee (no additional cash outflow)' : ''}
                    {row.project_id && (
                      <>
                        {' '}
                        ·{' '}
                        <Link href={`/projects/${row.project_id}`}>
                          {names[String(row.project_id)]} <ArrowUpRight size={10} />
                        </Link>
                      </>
                    )}
                  </small>
                  {row.notes && <p>{String(row.notes)}</p>}
                </div>
                <div className="entry-value">
                  <strong>{formatMoney(String(row.amount_lkr))}</strong>
                  {row.currency !== 'LKR' && (
                    <small>
                      {formatMoney(String(row.amount), String(row.currency))} · Rate{' '}
                      {String(row.exchange_rate)}
                    </small>
                  )}
                  {status && <Badge tone={status === 'Paid' ? 'green' : 'amber'}>{status}</Badge>}
                </div>
                <div className="row-actions">
                  {isCost && status !== 'Paid' && (
                    <button
                      title="Pay cost"
                      aria-label={`Pay ${row.description}`}
                      onClick={() =>
                        openForm({
                          table: 'project_cost_payments',
                          defaults: {
                            cost_id: row.id,
                            currency: String(row.currency),
                            exchange_rate: String(row.exchange_rate),
                          },
                        })
                      }
                    >
                      <Plus size={16} />
                    </button>
                  )}
                  <button
                    title="Edit"
                    aria-label={`Edit ${row.description ?? 'payment'}`}
                    onClick={() => openForm({ table, record: row })}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    title="Delete"
                    aria-label={`Delete ${row.description ?? 'payment'}`}
                    onClick={() => onDelete(table, row)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={search ? 'No matching records' : 'No records yet'}
          description="Your entries will appear here once they’re recorded."
          icon={ReceiptText}
          action={{ label: 'Add an entry', onClick: () => openForm({ table }) }}
        />
      )}
    </section>
  );
}
