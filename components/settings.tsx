'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ShieldCheck,
  Database,
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  CheckCircle2,
  History,
} from 'lucide-react';
import type { WorkspaceData, Row } from '@/lib/types';
import type { TableName } from '@/lib/schemas';
import type { FormTarget } from './record-form';
import { Button } from './ui/button';
import { SectionHeading, EmptyState, Badge } from './ui/common';
import { Dialog } from './ui/dialog';
export function Settings({
  data,
  openForm,
  onDelete,
}: {
  data: WorkspaceData;
  openForm: (f: FormTarget) => void;
  onDelete: (t: TableName, r: Row) => void;
}) {
  const [audit, setAudit] = useState<Row | null>(null);
  return (
    <>
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="settings-icon">
            <Database size={23} />
          </span>
          <h2>Workspace connection</h2>
          <p>Financial records are stored in your private Supabase database.</p>
          <Badge tone={data.configured ? 'green' : 'amber'}>
            {data.configured ? 'Supabase configured' : 'Connection required'}
          </Badge>
          {!data.configured && (
            <ol className="setup-list">
              <li>Create a Supabase project and apply the SQL migration.</li>
              <li>
                Add the project URL and public anon key to <code>.env.local</code>.
              </li>
              <li>Disable public signups, invite your team, and provision their profiles.</li>
              <li>Restart the application and sign in.</li>
            </ol>
          )}
          <p className="setting-note">
            See README.md for setup, database migration and deployment instructions. No service-role
            key belongs in this application.
          </p>
        </section>
        <section className="panel settings-card">
          <span className="settings-icon">
            <ShieldCheck size={23} />
          </span>
          <h2>Private by design</h2>
          <p>
            Invitation-only accounts, organization access policies and an audit trail for financial
            changes.
          </p>
          <div className="security-lines">
            <span>
              <CheckCircle2 size={15} />
              Server-side access checks
            </span>
            <span>
              <CheckCircle2 size={15} />
              Row Level Security in PostgreSQL
            </span>
            <span>
              <CheckCircle2 size={15} />
              MFA required for administrators
            </span>
          </div>
          <div className="account-detail">
            <small>Signed in as</small>
            <strong>{data.email || 'Not connected'}</strong>
            {data.role && <Badge>{data.role}</Badge>}
          </div>
          {data.configured && (
            <Button variant="outline" asChild>
              <Link href="/login?step=mfa">
                <KeyRound size={15} />
                Authenticator settings
              </Link>
            </Button>
          )}
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="Recorded exchange rates"
          description="Reference rates for entry. Changing these never changes historical transactions."
        >
          <Button size="sm" variant="outline" onClick={() => openForm({ table: 'exchange_rates' })}>
            <Plus size={14} />
            Add rate
          </Button>
        </SectionHeading>
        {data.ledger.exchange_rates.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>LKR per unit</th>
                  <th>Effective date</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.exchange_rates.map((row) => (
                  <tr key={row.id}>
                    <td>{String(row.currency)}</td>
                    <td>{String(row.rate)}</td>
                    <td>{String(row.date)}</td>
                    <td>{String(row.notes)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label="Edit rate"
                          onClick={() => openForm({ table: 'exchange_rates', record: row })}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          aria-label="Delete rate"
                          onClick={() => onDelete('exchange_rates', row)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Your rates, recorded"
            description="Save a historical rate for USD, GBP, EUR, AUD or CAD. LKR always uses a rate of 1."
          />
        )}
      </section>
      <section className="panel">
        <SectionHeading
          title="Financial audit history"
          description="Immutable records of additions, edits and deletions"
        />
        {data.ledger.audit_logs.length ? (
          <div className="audit-list">
            {[...data.ledger.audit_logs]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 100)
              .map((log) => (
                <button key={log.id} onClick={() => setAudit(log)}>
                  <History size={16} />
                  <span>
                    <strong>
                      {String(log.action)} · {String(log.table_name).replaceAll('_', ' ')}
                    </strong>
                    <small>
                      {new Date(log.created_at).toLocaleString('en-GB', {
                        timeZone: 'Asia/Colombo',
                      })}{' '}
                      · {String(log.actor_id ?? 'System')}
                    </small>
                  </span>
                  <ExternalLink size={14} />
                </button>
              ))}
          </div>
        ) : (
          <EmptyState
            title="A traceable history"
            description="Each saved financial change records who changed it, when, and its before-and-after values."
            icon={History}
          />
        )}
      </section>
      {audit && (
        <Dialog
          open
          onOpenChange={(v) => !v && setAudit(null)}
          title="Audit record"
          description={`${String(audit.action)} · ${String(audit.table_name)}`}
        >
          <div className="audit-detail">
            <h3>Before</h3>
            <pre className="audit-json">{String(audit.old_record ?? 'No prior record')}</pre>
            <h3>After</h3>
            <pre className="audit-json">{String(audit.new_record ?? 'Record deleted')}</pre>
            <p>
              Actor: {String(audit.actor_id ?? 'System')} · {audit.created_at}
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
