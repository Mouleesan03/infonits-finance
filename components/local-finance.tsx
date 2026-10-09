'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  Download,
  LockKeyhole,
  Menu,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

type LocalClient = { id: string; name: string; company: string; email: string; phone: string };
type LocalRow = {
  id: string;
  project: string;
  clientId: string;
  value: number;
  note: string;
  advance: number;
  workDue: number;
  workPaid: number;
  status: 'Waiting' | 'Partial' | 'Paid';
};

const storageKey = 'infonits-finance-local-v1';
const blankRow = (): LocalRow => ({
  id: crypto.randomUUID(),
  project: '',
  clientId: '',
  value: 0,
  note: '',
  advance: 0,
  workDue: 0,
  workPaid: 0,
  status: 'Waiting',
});
const emptyClient = { name: '', company: '', email: '', phone: '' };
const money = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(value);

export function LocalFinance() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [section, setSection] = useState<'sheet' | 'clients'>('sheet');
  const [menuOpen, setMenuOpen] = useState(false);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clientDraft, setClientDraft] = useState(emptyClient);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved
        ? (JSON.parse(saved) as {
            month?: string;
            rows?: Array<LocalRow | Omit<LocalRow, 'clientId'>>;
            clients?: LocalClient[];
          })
        : null;
      setMonth(parsed?.month || new Date().toISOString().slice(0, 7));
      setRows(
        parsed?.rows?.length
          ? parsed.rows.map((row) => ({ ...row, clientId: 'clientId' in row ? row.clientId : '' }))
          : [blankRow()],
      );
      setClients(parsed?.clients ?? []);
    } catch {
      setRows([blankRow()]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify({ month, rows, clients }));
  }, [clients, loaded, month, rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          value: sum.value + row.value,
          advance: sum.advance + row.advance,
          workDue: sum.workDue + row.workDue,
          workPaid: sum.workPaid + row.workPaid,
          mine: sum.mine + row.value - row.advance - row.workDue - row.workPaid,
        }),
        { value: 0, advance: 0, workDue: 0, workPaid: 0, mine: 0 },
      ),
    [rows],
  );

  function update(id: string, field: keyof LocalRow, value: string | number) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function changeSection(next: 'sheet' | 'clients') {
    setSection(next);
    setMenuOpen(false);
  }

  function addClient(event: React.FormEvent) {
    event.preventDefault();
    const name = clientDraft.name.trim();
    if (!name) return;
    setClients((current) => [...current, { id: crypto.randomUUID(), ...clientDraft, name }]);
    setClientDraft(emptyClient);
    setClientFormOpen(false);
  }

  function removeClient(client: LocalClient) {
    if (!window.confirm(`Remove ${client.name}? Projects will remain in the finance sheet.`))
      return;
    setClients((current) => current.filter((item) => item.id !== client.id));
    setRows((current) =>
      current.map((row) => (row.clientId === client.id ? { ...row, clientId: '' } : row)),
    );
  }

  function exportCsv() {
    const clientNames = new Map(clients.map((client) => [client.id, client.name]));
    const csv = [
      [
        'Project details',
        'Client',
        'Project value (LKR)',
        'Note',
        'Advance received',
        'Pay for work',
        'Paid for work',
        'Payment status',
        'For me',
      ],
      ...rows.map((row) => [
        row.project,
        clientNames.get(row.clientId) ?? '',
        row.value,
        row.note,
        row.advance,
        row.workDue,
        row.workPaid,
        row.status,
        row.value - row.advance - row.workDue - row.workPaid,
      ]),
    ]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `infonits-finance-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) return <main className="local-loading">Opening your local finance workspace…</main>;

  return (
    <div className="local-app">
      {menuOpen && (
        <button
          className="local-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`local-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="local-brand">
          <img src="/infonits-logo.png" alt="infonits" width={154} height={36} />
          <span>finance</span>
          <button aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="local-mode-chip">Browser workspace</div>
        <nav className="local-nav" aria-label="Local workspace navigation">
          <button
            className={section === 'sheet' ? 'active' : ''}
            onClick={() => changeSection('sheet')}
          >
            <BriefcaseBusiness size={19} />
            <span>Finance sheet</span>
            <b>{rows.filter((row) => row.project).length}</b>
          </button>
          <button
            className={section === 'clients' ? 'active' : ''}
            onClick={() => changeSection('clients')}
          >
            <Users size={19} />
            <span>Clients</span>
            <b>{clients.length}</b>
          </button>
        </nav>
        <div className="local-sidebar-note">
          <LockKeyhole size={17} />
          <div>
            <strong>Saved on this device</strong>
            <small>Export CSV regularly for backup.</small>
          </div>
        </div>
        <Link href="/login" className="local-login-link">
          <LockKeyhole size={17} /> Secure Supabase login
        </Link>
      </aside>

      <div className="local-content">
        <header className="local-topbar">
          <button
            className="local-menu-button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={21} />
          </button>
          <span>Infonits Finance</span>
          <div>
            <span className="local-save-dot" /> Autosaved
          </div>
        </header>

        <main className="local-main">
          {section === 'sheet' ? (
            <>
              <section className="local-titlebar">
                <div>
                  <span className="local-eyebrow">LOCAL WORKSPACE</span>
                  <h1>Finance sheet</h1>
                  <p>Projects, payments, costs and profit in one clear view.</p>
                </div>
                <div className="local-actions">
                  <button onClick={exportCsv} className="button button-outline">
                    <Download size={16} /> Export CSV
                  </button>
                  <button
                    className="button button-primary"
                    onClick={() => setRows((current) => [...current, blankRow()])}
                  >
                    <Plus size={16} /> Add project
                  </button>
                </div>
              </section>

              <section className="local-summary" aria-label="Finance totals">
                <article>
                  <span>Project value</span>
                  <strong>{money(totals.value)}</strong>
                  <Building2 size={18} />
                </article>
                <article>
                  <span>Received</span>
                  <strong>{money(totals.advance)}</strong>
                  <Download size={18} />
                </article>
                <article>
                  <span>Work costs</span>
                  <strong>{money(totals.workDue + totals.workPaid)}</strong>
                  <BriefcaseBusiness size={18} />
                </article>
                <article className="highlight">
                  <span>For me</span>
                  <strong>{money(totals.mine)}</strong>
                  <span className="local-up">↗</span>
                </article>
              </section>

              <section className="local-sheet-card">
                <div className="local-sheet-toolbar">
                  <div>
                    <strong>
                      {new Date(`${month}-02`).toLocaleDateString('en-GB', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>
                    <small>
                      {rows.length} project {rows.length === 1 ? 'row' : 'rows'}
                    </small>
                  </div>
                  <input
                    aria-label="Finance month"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </div>
                <div className="local-sheet-wrap">
                  <table className="local-sheet">
                    <thead>
                      <tr>
                        <th>Project details</th>
                        <th>Client</th>
                        <th>Project value</th>
                        <th>Note</th>
                        <th>Advance received</th>
                        <th>Pay for work</th>
                        <th>Paid for work</th>
                        <th>Payment status</th>
                        <th>For me</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const mine = row.value - row.advance - row.workDue - row.workPaid;
                        return (
                          <tr key={row.id}>
                            <td>
                              <input
                                aria-label="Project details"
                                value={row.project}
                                placeholder="Project name"
                                onChange={(event) => update(row.id, 'project', event.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                aria-label="Client"
                                value={row.clientId}
                                onChange={(event) => update(row.id, 'clientId', event.target.value)}
                              >
                                <option value="">No client</option>
                                {clients.map((client) => (
                                  <option key={client.id} value={client.id}>
                                    {client.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="local-money-cell">
                              <input
                                aria-label="Project value"
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.value || ''}
                                placeholder="0.00"
                                onChange={(event) =>
                                  update(row.id, 'value', Number(event.target.value))
                                }
                              />
                            </td>
                            <td>
                              <input
                                aria-label="Note"
                                value={row.note}
                                placeholder="Optional note"
                                onChange={(event) => update(row.id, 'note', event.target.value)}
                              />
                            </td>
                            {(['advance', 'workDue', 'workPaid'] as const).map((field) => (
                              <td key={field} className="local-money-cell">
                                <input
                                  aria-label={field}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row[field] || ''}
                                  placeholder="0.00"
                                  onChange={(event) =>
                                    update(row.id, field, Number(event.target.value))
                                  }
                                />
                              </td>
                            ))}
                            <td>
                              <select
                                aria-label="Payment status"
                                value={row.status}
                                onChange={(event) =>
                                  update(row.id, 'status', event.target.value as LocalRow['status'])
                                }
                              >
                                <option>Waiting</option>
                                <option>Partial</option>
                                <option>Paid</option>
                              </select>
                            </td>
                            <td className="local-mine">{money(mine)}</td>
                            <td>
                              <button
                                className="local-delete"
                                aria-label={`Delete ${row.project || 'row'}`}
                                onClick={() =>
                                  setRows((current) =>
                                    current.length === 1
                                      ? [blankRow()]
                                      : current.filter((item) => item.id !== row.id),
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="local-total">
                        <th>Total</th>
                        <td />
                        <td>{money(totals.value)}</td>
                        <td />
                        <td>{money(totals.advance)}</td>
                        <td>{money(totals.workDue)}</td>
                        <td>{money(totals.workPaid)}</td>
                        <td />
                        <td>{money(totals.mine)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button
                  className="local-add"
                  onClick={() => setRows((current) => [...current, blankRow()])}
                >
                  <Plus size={16} /> Add row
                </button>
              </section>
            </>
          ) : (
            <>
              <section className="local-titlebar">
                <div>
                  <span className="local-eyebrow">RELATIONSHIPS</span>
                  <h1>Clients</h1>
                  <p>Keep client contacts connected to their projects.</p>
                </div>
                <button
                  className="button button-primary"
                  onClick={() => setClientFormOpen((open) => !open)}
                >
                  {clientFormOpen ? <X size={16} /> : <UserPlus size={16} />}
                  {clientFormOpen ? 'Close' : 'Add client'}
                </button>
              </section>

              {clientFormOpen && (
                <form className="local-client-form" onSubmit={addClient}>
                  <div>
                    <label htmlFor="local-client-name">Client name</label>
                    <input
                      id="local-client-name"
                      required
                      value={clientDraft.name}
                      onChange={(event) =>
                        setClientDraft({ ...clientDraft, name: event.target.value })
                      }
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label htmlFor="local-client-company">Company</label>
                    <input
                      id="local-client-company"
                      value={clientDraft.company}
                      onChange={(event) =>
                        setClientDraft({ ...clientDraft, company: event.target.value })
                      }
                      placeholder="Company name"
                    />
                  </div>
                  <div>
                    <label htmlFor="local-client-email">Email</label>
                    <input
                      id="local-client-email"
                      type="email"
                      value={clientDraft.email}
                      onChange={(event) =>
                        setClientDraft({ ...clientDraft, email: event.target.value })
                      }
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="local-client-phone">Phone</label>
                    <input
                      id="local-client-phone"
                      value={clientDraft.phone}
                      onChange={(event) =>
                        setClientDraft({ ...clientDraft, phone: event.target.value })
                      }
                      placeholder="Phone number"
                    />
                  </div>
                  <button className="button button-primary" type="submit">
                    <Plus size={16} /> Save client
                  </button>
                </form>
              )}

              {clients.length ? (
                <section className="local-client-grid">
                  {clients.map((client) => {
                    const clientRows = rows.filter((row) => row.clientId === client.id);
                    const clientValue = clientRows.reduce((sum, row) => sum + row.value, 0);
                    return (
                      <article className="local-client-card" key={client.id}>
                        <div className="local-client-avatar">
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="local-client-details">
                          <h2>{client.name}</h2>
                          <p>{client.company || 'Independent client'}</p>
                          <div>
                            <span>{client.email || 'No email'}</span>
                            <span>{client.phone || 'No phone'}</span>
                          </div>
                        </div>
                        <div className="local-client-stats">
                          <strong>{clientRows.length}</strong>
                          <span>Projects</span>
                          <strong>{money(clientValue)}</strong>
                          <span>Total value</span>
                        </div>
                        <button
                          className="local-delete"
                          aria-label={`Remove ${client.name}`}
                          onClick={() => removeClient(client)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </article>
                    );
                  })}
                </section>
              ) : (
                <section className="local-empty-clients">
                  <div>
                    <Users size={28} />
                  </div>
                  <h2>No clients yet</h2>
                  <p>Add your first client, then link them to projects in the finance sheet.</p>
                  <button className="button button-primary" onClick={() => setClientFormOpen(true)}>
                    <UserPlus size={16} /> Add first client
                  </button>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
