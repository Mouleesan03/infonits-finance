'use client';
import Link from 'next/link';
import { Pencil, Trash2, Plus, ArrowLeft, Info } from 'lucide-react';
import { formatMoney, d, sum } from '@/lib/finance';
import type { Ledger, Project, Row } from '@/lib/types';
import type { TableName } from '@/lib/schemas';
import type { FormTarget } from './record-form';
import { SummaryCards } from './summary-cards';
import { Entries } from './entries';
import { Button } from './ui/button';
import { Badge, SectionHeading } from './ui/common';
export function ProjectDetail({
  project: p,
  ledger,
  openForm,
  onDelete,
}: {
  project: Project;
  ledger: Ledger;
  openForm: (f: FormTarget) => void;
  onDelete: (t: TableName, r: Row) => void;
}) {
  const costs = ledger.project_costs.filter((c) => c.project_id === p.id);
  const costIds = new Set(costs.map((c) => c.id));
  const payments = ledger.client_payments.filter((c) => c.project_id === p.id);
  const settlements = ledger.project_cost_payments.filter((s) => costIds.has(String(s.cost_id)));
  const fx = d(p.received).minus(d(p.contract_received).times(p.exchange_rate)).toFixed(2);
  return (
    <>
      <Link href="/projects" className="back-link">
        <ArrowLeft size={15} />
        All projects
      </Link>
      <section className="panel detail-intro">
        <div>
          <span className="eyebrow">PROJECT FINANCIALS</span>
          <h2>{p.name}</h2>
          <Link href={`/clients/${p.client_id}`} className="text-link">
            {p.client_name}
          </Link>
        </div>
        <div className="detail-actions">
          <Badge tone="blue">{p.status}</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openForm({ table: 'projects', record: p })}
          >
            <Pencil size={14} />
            Edit
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Delete project"
            onClick={() => onDelete('projects', p)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </section>
      <SummaryCards projects={[p]} />
      <div className="detail-grid">
        <section className="panel detail-breakdown">
          <SectionHeading title="What’s yours" description="Expected project profitability" />
          <dl>
            <div>
              <dt>Agreed project value</dt>
              <dd>{formatMoney(p.amount_lkr)}</dd>
            </div>
            <div>
              <dt>All direct project costs</dt>
              <dd>− {formatMoney(p.costs)}</dd>
            </div>
            <div className="profit-result">
              <dt>For Me · Expected profit</dt>
              <dd className={d(p.profit).lt(0) ? 'negative' : 'positive'}>
                {formatMoney(p.profit)}
              </dd>
            </div>
            <div>
              <dt>Expected profit margin</dt>
              <dd>{p.margin === null ? 'Not applicable' : `${p.margin}%`}</dd>
            </div>
            <div>
              <dt>Unpaid work obligations</dt>
              <dd>{formatMoney(p.unpaid_costs)}</dd>
            </div>
          </dl>
        </section>
        <section className="panel detail-breakdown">
          <SectionHeading
            title="Contract & settlement"
            description="Original currency and recorded conversion"
          />
          <dl>
            <div>
              <dt>Original contract</dt>
              <dd>{formatMoney(p.amount, p.currency)}</dd>
            </div>
            <div>
              <dt>Historical rate to LKR</dt>
              <dd>{p.exchange_rate}</dd>
            </div>
            <div>
              <dt>Original currency remaining</dt>
              <dd>{formatMoney(p.original_outstanding, p.currency)}</dd>
            </div>
            <div>
              <dt>Settlement FX difference</dt>
              <dd>{formatMoney(fx)}</dd>
            </div>
            <div>
              <dt>Actual project cash flow</dt>
              <dd>
                {formatMoney(
                  d(p.received)
                    .minus(
                      sum(
                        settlements.filter((s) => !s.is_withheld).map((s) => String(s.amount_lkr)),
                      ),
                    )
                    .toFixed(2),
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="notice">
        <Info size={16} />
        <span>
          LKR outstanding is project value minus actual receipts. A settlement-rate difference is
          not an additional invoice in the original currency. Payment status follows the original
          contract balance.
        </span>
      </div>
      {p.notes && (
        <section className="panel notes-panel">
          <h3>Project notes</h3>
          <p>{p.notes}</p>
        </section>
      )}
      <div className="section-actions">
        <h2>Client payments</h2>
        <Button
          size="sm"
          onClick={() =>
            openForm({
              table: 'client_payments',
              defaults: { project_id: p.id, currency: p.currency, exchange_rate: p.exchange_rate },
            })
          }
        >
          <Plus size={14} />
          Record payment
        </Button>
      </div>
      <Entries
        table="client_payments"
        rows={payments}
        ledger={ledger}
        openForm={openForm}
        onDelete={onDelete}
      />
      <div className="section-actions">
        <h2>Direct project costs</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openForm({ table: 'project_costs', defaults: { project_id: p.id } })}
        >
          <Plus size={14} />
          Add cost
        </Button>
      </div>
      <Entries
        table="project_costs"
        rows={costs}
        ledger={ledger}
        openForm={openForm}
        onDelete={onDelete}
      />
      <Entries
        title="Cost payments · actual cash paid"
        table="project_cost_payments"
        rows={settlements}
        ledger={ledger}
        openForm={openForm}
        onDelete={onDelete}
      />
    </>
  );
}
