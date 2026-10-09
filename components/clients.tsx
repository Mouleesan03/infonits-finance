'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Search, Mail, Phone, Globe, ArrowUpRight, Pencil, Trash2, Users } from 'lucide-react';
import { sum, formatMoney } from '@/lib/finance';
import type { Ledger, Row } from '@/lib/types';
import type { FormTarget } from './record-form';
import type { TableName } from '@/lib/schemas';
import { EmptyState } from './ui/common';
export function Clients({
  ledger,
  openForm,
  onDelete,
}: {
  ledger: Ledger;
  openForm: (f: FormTarget) => void;
  onDelete: (t: TableName, r: Row) => void;
}) {
  const [search, setSearch] = useState('');
  const clients = ledger.clients.filter((c) =>
    [c.name, c.company, c.country, c.email].join(' ').toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="client-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search clients"
            placeholder="Find a client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted">{clients.length} clients · All-time balances</span>
      </div>
      {clients.length ? (
        <div className="client-grid">
          {clients.map((c) => {
            const projects = ledger.projects.filter((p) => p.client_id === c.id);
            return (
              <article className="panel client-card" key={c.id}>
                <div className="client-card-top">
                  <span className="client-avatar large">
                    {String(c.name).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="row-actions">
                    <button
                      aria-label={`Edit ${c.name}`}
                      onClick={() => openForm({ table: 'clients', record: c })}
                    >
                      <Pencil size={14} />
                    </button>
                    <button aria-label={`Delete ${c.name}`} onClick={() => onDelete('clients', c)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <Link href={`/clients/${c.id}`} className="client-name">
                  {String(c.name)}
                  <ArrowUpRight size={17} />
                </Link>
                <p>{String(c.company || 'Individual client')}</p>
                <div className="client-contact">
                  {c.country && (
                    <span>
                      <Globe size={13} />
                      {String(c.country)}
                    </span>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`}>
                      <Mail size={13} />
                      {String(c.email)}
                    </a>
                  )}
                  {c.phone && (
                    <span>
                      <Phone size={13} />
                      {String(c.phone)}
                    </span>
                  )}
                </div>
                <div className="client-card-stats">
                  <div>
                    <small>{projects.length} projects</small>
                    <strong>
                      {formatMoney(sum(projects.map((p) => p.amount_lkr)), 'LKR', true)}
                    </strong>
                  </div>
                  <div>
                    <small>Outstanding</small>
                    <strong>
                      {formatMoney(sum(projects.map((p) => p.outstanding)), 'LKR', true)}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            title={search ? 'No clients found' : 'Good work starts with good clients'}
            description="Keep contact details, projects, payments and client profitability together."
            icon={Users}
            action={{
              label: 'Add your first client',
              onClick: () => openForm({ table: 'clients' }),
            }}
          />
        </section>
      )}
    </>
  );
}
