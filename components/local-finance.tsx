'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Download,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

type Section = 'dashboard' | 'projects' | 'clients' | 'expenses';
type LocalClient = { id: string; name: string; company: string; email: string; phone: string };
type LocalRow = {
  id: string;
  project: string;
  clientId: string;
  value: number;
  currency: string;
  exchangeRate: number;
  note: string;
  advance: number;
  workDue: number;
  workPaid: number;
  status: 'Waiting' | 'Partial' | 'Paid';
  createdAt: string;
};
type LocalExpense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  date: string;
};
type FxRate = { date: string; base: string; quote: string; rate: number };

const storageKey = 'infonits-finance-local-v1';
const currencies = ['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'INR', 'AED', 'SGD', 'JPY'];
const today = () => new Date().toISOString().slice(0, 10);
const emptyClient = { name: '', company: '', email: '', phone: '' };
const emptyProject = { project: '', clientId: '', value: '', currency: 'LKR', note: '' };
const emptyExpense = {
  description: '',
  category: 'Office',
  amount: '',
  currency: 'LKR',
  date: today(),
};
const money = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(value);
const localValue = (value: number, rate: number) => value * rate;

export function LocalFinance() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [fxRates, setFxRates] = useState<Record<string, number>>({ LKR: 1 });
  const [fxDate, setFxDate] = useState('');
  const [fxStatus, setFxStatus] = useState<'loading' | 'live' | 'saved'>('loading');
  const [section, setSection] = useState<Section>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState(emptyProject);
  const [clientDraft, setClientDraft] = useState(emptyClient);
  const [expenseDraft, setExpenseDraft] = useState(emptyExpense);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    let savedDate = '';
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved
        ? (JSON.parse(saved) as {
            month?: string;
            rows?: Array<Partial<LocalRow> & { id: string; project: string; value: number }>;
            clients?: LocalClient[];
            expenses?: LocalExpense[];
            fxRates?: Record<string, number>;
            fxDate?: string;
          })
        : null;
      savedDate = parsed?.fxDate ?? '';
      setMonth(parsed?.month || today().slice(0, 7));
      setRows(
        (parsed?.rows ?? [])
          .map((row) => ({
            id: row.id,
            project: row.project,
            clientId: row.clientId ?? '',
            value: Number(row.value) || 0,
            currency: row.currency ?? 'LKR',
            exchangeRate: Number(row.exchangeRate) || 1,
            note: row.note ?? '',
            advance: Number(row.advance) || 0,
            workDue: Number(row.workDue) || 0,
            workPaid: Number(row.workPaid) || 0,
            status: row.status ?? 'Waiting',
            createdAt: row.createdAt ?? today(),
          }))
          .filter(
            (row) => row.project.trim() || row.value || row.advance || row.workDue || row.workPaid,
          ),
      );
      setClients(parsed?.clients ?? []);
      setExpenses(parsed?.expenses ?? []);
      setFxRates(parsed?.fxRates ?? { LKR: 1 });
      setFxDate(savedDate);
      setFxStatus(savedDate ? 'saved' : 'loading');
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }

    async function refreshRates() {
      if (savedDate === today()) {
        if (active) setFxStatus('live');
        return;
      }
      try {
        const response = await fetch(
          'https://api.frankfurter.dev/v2/rates?base=USD&quotes=LKR,GBP,EUR,AUD,CAD,INR,AED,SGD,JPY',
        );
        if (!response.ok) throw new Error('Rate service unavailable');
        const data = (await response.json()) as FxRate[];
        const usdLkr = data.find((item) => item.quote === 'LKR');
        if (!usdLkr) throw new Error('LKR rate unavailable');
        const next: Record<string, number> = { LKR: 1, USD: usdLkr.rate };
        for (const item of data) {
          if (item.quote !== 'LKR') next[item.quote] = usdLkr.rate / item.rate;
        }
        if (!active) return;
        setFxRates(next);
        setFxDate(usdLkr.date);
        setFxStatus('live');
      } catch {
        if (active) setFxStatus('saved');
      }
    }
    void refreshRates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loaded)
      localStorage.setItem(
        storageKey,
        JSON.stringify({ month, rows, clients, expenses, fxRates, fxDate }),
      );
  }, [clients, expenses, fxDate, fxRates, loaded, month, rows]);

  const totals = useMemo(() => {
    const projects = rows.reduce(
      (sum, row) => {
        const valueLkr = localValue(row.value, row.exchangeRate);
        return {
          value: sum.value + valueLkr,
          received: sum.received + row.advance,
          work: sum.work + row.workDue + row.workPaid,
          remaining: sum.remaining + valueLkr - row.advance - row.workDue - row.workPaid,
        };
      },
      { value: 0, received: 0, work: 0, remaining: 0 },
    );
    const expenseTotal = expenses.reduce(
      (sum, expense) => sum + localValue(expense.amount, expense.exchangeRate),
      0,
    );
    return {
      ...projects,
      expenses: expenseTotal,
      net: projects.value - projects.work - expenseTotal,
    };
  }, [expenses, rows]);

  const chart = [
    { label: 'Value', value: totals.value, tone: 'blue' },
    { label: 'Income', value: totals.received, tone: 'green' },
    { label: 'Work', value: totals.work, tone: 'red' },
    { label: 'Expenses', value: totals.expenses, tone: 'orange' },
  ];
  const chartMax = Math.max(...chart.map((item) => item.value), 1);

  function changeSection(next: Section) {
    setSection(next);
    setMenuOpen(false);
  }

  function rateFor(currency: string) {
    return currency === 'LKR' ? 1 : (fxRates[currency] ?? 1);
  }

  function addProject(event: React.FormEvent) {
    event.preventDefault();
    const project = projectDraft.project.trim();
    const value = Number(projectDraft.value);
    if (!project || !Number.isFinite(value) || value < 0) return;
    setRows((current) => [
      {
        id: crypto.randomUUID(),
        project,
        clientId: projectDraft.clientId,
        value,
        currency: projectDraft.currency,
        exchangeRate: rateFor(projectDraft.currency),
        note: projectDraft.note.trim(),
        advance: 0,
        workDue: 0,
        workPaid: 0,
        status: 'Waiting',
        createdAt: today(),
      },
      ...current,
    ]);
    setProjectDraft(emptyProject);
    setProjectFormOpen(false);
    setSection('projects');
  }

  function updateProject(id: string, patch: Partial<LocalRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addClient(event: React.FormEvent) {
    event.preventDefault();
    const name = clientDraft.name.trim();
    if (!name) return;
    setClients((current) => [...current, { id: crypto.randomUUID(), ...clientDraft, name }]);
    setClientDraft(emptyClient);
    setClientFormOpen(false);
  }

  function addExpense(event: React.FormEvent) {
    event.preventDefault();
    const description = expenseDraft.description.trim();
    const amount = Number(expenseDraft.amount);
    if (!description || !Number.isFinite(amount) || amount < 0) return;
    setExpenses((current) => [
      {
        id: crypto.randomUUID(),
        description,
        category: expenseDraft.category,
        amount,
        currency: expenseDraft.currency,
        exchangeRate: rateFor(expenseDraft.currency),
        date: expenseDraft.date,
      },
      ...current,
    ]);
    setExpenseDraft(emptyExpense);
    setExpenseFormOpen(false);
  }

  function openProjectForm() {
    setProjectFormOpen(true);
    setSection('projects');
    setMenuOpen(false);
  }

  function exportCsv() {
    const clientNames = new Map(clients.map((client) => [client.id, client.name]));
    const csv = [
      [
        'Project',
        'Client',
        'Amount',
        'Currency',
        'Rate to LKR',
        'Value LKR',
        'Advance LKR',
        'Work due LKR',
        'Work paid LKR',
        'Status',
        'Note',
      ],
      ...rows.map((row) => [
        row.project,
        clientNames.get(row.clientId) ?? '',
        row.value,
        row.currency,
        row.exchangeRate,
        localValue(row.value, row.exchangeRate),
        row.advance,
        row.workDue,
        row.workPaid,
        row.status,
        row.note,
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

  if (!loaded) return <main className="local-loading">Opening your finance workspace…</main>;

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
        <nav className="local-nav" aria-label="Workspace navigation">
          <button
            className={section === 'dashboard' ? 'active' : ''}
            onClick={() => changeSection('dashboard')}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>
          <button
            className={section === 'projects' ? 'active' : ''}
            onClick={() => changeSection('projects')}
          >
            <BriefcaseBusiness size={19} />
            <span>Projects</span>
            <b>{rows.length}</b>
          </button>
          <button
            className={section === 'clients' ? 'active' : ''}
            onClick={() => changeSection('clients')}
          >
            <Users size={19} />
            <span>Clients</span>
            <b>{clients.length}</b>
          </button>
          <button
            className={section === 'expenses' ? 'active' : ''}
            onClick={() => changeSection('expenses')}
          >
            <ReceiptText size={19} />
            <span>Expenses</span>
            <b>{expenses.length}</b>
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
          {section === 'dashboard' && (
            <Dashboard
              totals={totals}
              chart={chart}
              chartMax={chartMax}
              rows={rows}
              expenses={expenses}
              fxDate={fxDate}
              fxStatus={fxStatus}
              onAddProject={openProjectForm}
              onSection={changeSection}
            />
          )}

          {section === 'projects' && (
            <>
              <PageHeading
                eyebrow="WORK"
                title="Projects"
                subtitle="Add projects, record money in or out, and see every value in LKR."
              >
                <button onClick={exportCsv} className="button button-outline">
                  <Download size={16} /> Export
                </button>
                <button
                  className="button button-primary"
                  onClick={() => setProjectFormOpen((open) => !open)}
                >
                  {projectFormOpen ? <X size={16} /> : <Plus size={16} />}
                  {projectFormOpen ? 'Close' : 'Add project'}
                </button>
              </PageHeading>
              {projectFormOpen && (
                <ProjectForm
                  draft={projectDraft}
                  setDraft={setProjectDraft}
                  clients={clients}
                  rates={fxRates}
                  onSubmit={addProject}
                />
              )}
              <section className="local-sheet-card">
                <div className="local-sheet-toolbar">
                  <div>
                    <strong>
                      {new Date(`${month}-02`).toLocaleDateString('en-GB', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </strong>
                    <small>{rows.length} projects · all totals in LKR</small>
                  </div>
                  <input
                    aria-label="Finance month"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </div>
                <ProjectTable
                  rows={rows}
                  clients={clients}
                  rates={fxRates}
                  onUpdate={updateProject}
                  onDelete={(id) => setRows((current) => current.filter((row) => row.id !== id))}
                />
              </section>
            </>
          )}

          {section === 'clients' && (
            <>
              <PageHeading
                eyebrow="RELATIONSHIPS"
                title="Clients"
                subtitle="Keep client contacts connected to their projects."
              >
                <button
                  className="button button-primary"
                  onClick={() => setClientFormOpen((open) => !open)}
                >
                  {clientFormOpen ? <X size={16} /> : <UserPlus size={16} />}
                  {clientFormOpen ? 'Close' : 'Add client'}
                </button>
              </PageHeading>
              {clientFormOpen && (
                <ClientForm draft={clientDraft} setDraft={setClientDraft} onSubmit={addClient} />
              )}
              <ClientList
                clients={clients}
                rows={rows}
                onAdd={() => setClientFormOpen(true)}
                onRemove={(id) => {
                  setClients((current) => current.filter((client) => client.id !== id));
                  setRows((current) =>
                    current.map((row) => (row.clientId === id ? { ...row, clientId: '' } : row)),
                  );
                }}
              />
            </>
          )}

          {section === 'expenses' && (
            <>
              <PageHeading
                eyebrow="OUTGOING"
                title="Expenses"
                subtitle="Track operating costs separately from project work costs."
              >
                <button
                  className="button button-primary"
                  onClick={() => setExpenseFormOpen((open) => !open)}
                >
                  {expenseFormOpen ? <X size={16} /> : <Plus size={16} />}
                  {expenseFormOpen ? 'Close' : 'Add expense'}
                </button>
              </PageHeading>
              {expenseFormOpen && (
                <ExpenseForm
                  draft={expenseDraft}
                  setDraft={setExpenseDraft}
                  rates={fxRates}
                  onSubmit={addExpense}
                />
              )}
              <ExpenseList
                expenses={expenses}
                onAdd={() => setExpenseFormOpen(true)}
                onDelete={(id) =>
                  setExpenses((current) => current.filter((expense) => expense.id !== id))
                }
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="local-titlebar">
      <div>
        <span className="local-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="local-actions">{children}</div>
    </section>
  );
}

function Dashboard({
  totals,
  chart,
  chartMax,
  rows,
  expenses,
  fxDate,
  fxStatus,
  onAddProject,
  onSection,
}: {
  totals: { value: number; received: number; work: number; expenses: number; net: number };
  chart: Array<{ label: string; value: number; tone: string }>;
  chartMax: number;
  rows: LocalRow[];
  expenses: LocalExpense[];
  fxDate: string;
  fxStatus: string;
  onAddProject: () => void;
  onSection: (section: Section) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Dashboard"
        subtitle="Your current financial picture, without the spreadsheet noise."
      >
        <button className="button button-primary" onClick={onAddProject}>
          <Plus size={16} /> Add project
        </button>
      </PageHeading>
      <section className="local-summary" aria-label="Finance totals">
        <article>
          <span>Project value</span>
          <strong>{money(totals.value)}</strong>
          <WalletCards size={18} />
        </article>
        <article className="income">
          <span>Income received</span>
          <strong>{money(totals.received)}</strong>
          <ArrowUpRight size={18} />
        </article>
        <article className="outcome">
          <span>Total outcome</span>
          <strong>{money(totals.work + totals.expenses)}</strong>
          <ArrowDownRight size={18} />
        </article>
        <article className="highlight">
          <span>Estimated profit</span>
          <strong>{money(totals.net)}</strong>
          <TrendingUp size={18} />
        </article>
      </section>
      <section className="local-dashboard-grid">
        <article className="local-chart-card">
          <div className="local-card-heading">
            <div>
              <BarChart3 size={18} />
              <div>
                <strong>Money overview</strong>
                <small>Income and outcomes in LKR</small>
              </div>
            </div>
            <span className={`local-fx-badge ${fxStatus}`}>
              {fxStatus === 'live' ? 'Daily rates' : 'Saved rates'} · {fxDate || 'offline'}
            </span>
          </div>
          <div className="local-bar-chart">
            {chart.map((item) => (
              <div className="local-bar-column" key={item.label}>
                <div className="local-bar-value">{money(item.value)}</div>
                <div
                  className={`local-bar ${item.tone}`}
                  style={{ height: `${Math.max(10, (item.value / chartMax) * 155)}px` }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="local-activity-card">
          <div className="local-card-heading">
            <div>
              <RefreshCw size={18} />
              <div>
                <strong>Current activity</strong>
                <small>Latest projects and expenses</small>
              </div>
            </div>
          </div>
          <div className="local-activity-list">
            {rows.slice(0, 3).map((row) => (
              <button key={row.id} onClick={() => onSection('projects')}>
                <span className="income">
                  <BriefcaseBusiness size={15} />
                </span>
                <div>
                  <strong>{row.project}</strong>
                  <small>
                    {row.currency} {row.value.toLocaleString()}
                  </small>
                </div>
                <b>{money(localValue(row.value, row.exchangeRate))}</b>
              </button>
            ))}
            {expenses.slice(0, 3).map((expense) => (
              <button key={expense.id} onClick={() => onSection('expenses')}>
                <span className="outcome">
                  <ReceiptText size={15} />
                </span>
                <div>
                  <strong>{expense.description}</strong>
                  <small>{expense.category}</small>
                </div>
                <b className="negative">
                  −{money(localValue(expense.amount, expense.exchangeRate))}
                </b>
              </button>
            ))}
            {!rows.length && !expenses.length && (
              <div className="local-empty-activity">
                <BriefcaseBusiness size={24} />
                <p>Add a project or expense to see activity here.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </>
  );
}

function ProjectForm({
  draft,
  setDraft,
  clients,
  rates,
  onSubmit,
}: {
  draft: typeof emptyProject;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyProject>>;
  clients: LocalClient[];
  rates: Record<string, number>;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const rate = draft.currency === 'LKR' ? 1 : (rates[draft.currency] ?? 1);
  return (
    <form className="local-entry-form" onSubmit={onSubmit}>
      <div className="local-form-title">
        <Plus size={18} />
        <div>
          <strong>New project</strong>
          <small>Required fields are marked *</small>
        </div>
      </div>
      <label>
        <span>Project name *</span>
        <input
          autoFocus
          required
          value={draft.project}
          onChange={(event) => setDraft({ ...draft, project: event.target.value })}
          placeholder="Website redesign"
        />
      </label>
      <label>
        <span>Client</span>
        <select
          value={draft.clientId}
          onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
        >
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Currency *</span>
        <select
          value={draft.currency}
          onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
        >
          {currencies.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Project amount *</span>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={draft.value}
          onChange={(event) => setDraft({ ...draft, value: event.target.value })}
          placeholder="0.00"
        />
      </label>
      <label className="wide">
        <span>Note</span>
        <input
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          placeholder="Optional project note"
        />
      </label>
      <div className="local-rate-preview">
        <small>Rate to LKR</small>
        <strong>
          1 {draft.currency} = {rate.toFixed(4)} LKR
        </strong>
        <span>{draft.value ? money(Number(draft.value) * rate) : money(0)}</span>
      </div>
      <button className="button button-primary" type="submit">
        <Plus size={16} /> Save project
      </button>
    </form>
  );
}

function ProjectTable({
  rows,
  clients,
  rates,
  onUpdate,
  onDelete,
}: {
  rows: LocalRow[];
  clients: LocalClient[];
  rates: Record<string, number>;
  onUpdate: (id: string, patch: Partial<LocalRow>) => void;
  onDelete: (id: string) => void;
}) {
  const totals = rows.reduce(
    (sum, row) => ({
      value: sum.value + localValue(row.value, row.exchangeRate),
      advance: sum.advance + row.advance,
      workDue: sum.workDue + row.workDue,
      workPaid: sum.workPaid + row.workPaid,
      mine:
        sum.mine +
        localValue(row.value, row.exchangeRate) -
        row.advance -
        row.workDue -
        row.workPaid,
    }),
    { value: 0, advance: 0, workDue: 0, workPaid: 0, mine: 0 },
  );
  if (!rows.length)
    return (
      <div className="local-empty-table">
        <BriefcaseBusiness size={27} />
        <strong>No projects yet</strong>
        <p>Use “Add project” to create your first project.</p>
      </div>
    );
  return (
    <div className="local-sheet-wrap">
      <table className="local-sheet">
        <thead>
          <tr>
            <th>Project details</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Currency / Rate</th>
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
            const mine =
              localValue(row.value, row.exchangeRate) - row.advance - row.workDue - row.workPaid;
            return (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label="Project details"
                    value={row.project}
                    onChange={(event) => onUpdate(row.id, { project: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label="Client"
                    value={row.clientId}
                    onChange={(event) => onUpdate(row.id, { clientId: event.target.value })}
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
                    aria-label="Project amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.value || ''}
                    onChange={(event) => onUpdate(row.id, { value: Number(event.target.value) })}
                  />
                </td>
                <td className="local-currency-cell">
                  <select
                    aria-label="Currency"
                    value={row.currency}
                    onChange={(event) =>
                      onUpdate(row.id, {
                        currency: event.target.value,
                        exchangeRate:
                          event.target.value === 'LKR'
                            ? 1
                            : (rates[event.target.value] ?? row.exchangeRate),
                      })
                    }
                  >
                    {currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Exchange rate to LKR"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={row.exchangeRate}
                    onChange={(event) =>
                      onUpdate(row.id, { exchangeRate: Number(event.target.value) })
                    }
                  />
                </td>
                {(['advance', 'workDue', 'workPaid'] as const).map((field) => (
                  <td
                    key={field}
                    className={`local-money-cell ${field === 'advance' ? 'income-cell' : 'outcome-cell'}`}
                  >
                    <input
                      aria-label={field}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row[field] || ''}
                      placeholder="0.00"
                      onChange={(event) =>
                        onUpdate(row.id, { [field]: Number(event.target.value) })
                      }
                    />
                  </td>
                ))}
                <td>
                  <select
                    aria-label="Payment status"
                    value={row.status}
                    onChange={(event) =>
                      onUpdate(row.id, { status: event.target.value as LocalRow['status'] })
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
                    aria-label={`Delete ${row.project}`}
                    onClick={() => onDelete(row.id)}
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
            <td className="positive">{money(totals.advance)}</td>
            <td className="negative">{money(totals.workDue)}</td>
            <td className="negative">{money(totals.workPaid)}</td>
            <td />
            <td>{money(totals.mine)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ClientForm({
  draft,
  setDraft,
  onSubmit,
}: {
  draft: typeof emptyClient;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyClient>>;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="local-client-form" onSubmit={onSubmit}>
      {(['name', 'company', 'email', 'phone'] as const).map((field) => (
        <label key={field}>
          <span>
            {field === 'name' ? 'Client name *' : field[0].toUpperCase() + field.slice(1)}
          </span>
          <input
            required={field === 'name'}
            type={field === 'email' ? 'email' : 'text'}
            value={draft[field]}
            onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
            placeholder={
              field === 'name'
                ? 'Full name'
                : field === 'company'
                  ? 'Company name'
                  : field === 'email'
                    ? 'client@example.com'
                    : 'Phone number'
            }
          />
        </label>
      ))}
      <button className="button button-primary" type="submit">
        <Plus size={16} /> Save client
      </button>
    </form>
  );
}

function ClientList({
  clients,
  rows,
  onAdd,
  onRemove,
}: {
  clients: LocalClient[];
  rows: LocalRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  if (!clients.length)
    return (
      <section className="local-empty-clients">
        <div>
          <Users size={28} />
        </div>
        <h2>No clients yet</h2>
        <p>Add your first client, then link them to projects.</p>
        <button className="button button-primary" onClick={onAdd}>
          <UserPlus size={16} /> Add first client
        </button>
      </section>
    );
  return (
    <section className="local-client-grid">
      {clients.map((client) => {
        const clientRows = rows.filter((row) => row.clientId === client.id);
        const value = clientRows.reduce(
          (sum, row) => sum + localValue(row.value, row.exchangeRate),
          0,
        );
        return (
          <article className="local-client-card" key={client.id}>
            <div className="local-client-avatar">{client.name.slice(0, 2).toUpperCase()}</div>
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
              <strong>{money(value)}</strong>
              <span>Total value</span>
            </div>
            <button
              className="local-delete"
              aria-label={`Remove ${client.name}`}
              onClick={() => onRemove(client.id)}
            >
              <Trash2 size={16} />
            </button>
          </article>
        );
      })}
    </section>
  );
}

function ExpenseForm({
  draft,
  setDraft,
  rates,
  onSubmit,
}: {
  draft: typeof emptyExpense;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyExpense>>;
  rates: Record<string, number>;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const rate = draft.currency === 'LKR' ? 1 : (rates[draft.currency] ?? 1);
  return (
    <form className="local-entry-form expense-form" onSubmit={onSubmit}>
      <div className="local-form-title">
        <ReceiptText size={18} />
        <div>
          <strong>New expense</strong>
          <small>Operating cost</small>
        </div>
      </div>
      <label>
        <span>Description *</span>
        <input
          autoFocus
          required
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          placeholder="Software subscription"
        />
      </label>
      <label>
        <span>Category</span>
        <select
          value={draft.category}
          onChange={(event) => setDraft({ ...draft, category: event.target.value })}
        >
          <option>Office</option>
          <option>Software</option>
          <option>Marketing</option>
          <option>Travel</option>
          <option>Utilities</option>
          <option>Other</option>
        </select>
      </label>
      <label>
        <span>Currency</span>
        <select
          value={draft.currency}
          onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
        >
          {currencies.map((currency) => (
            <option key={currency}>{currency}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Amount *</span>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={draft.amount}
          onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
        />
      </label>
      <label>
        <span>Date</span>
        <input
          type="date"
          value={draft.date}
          onChange={(event) => setDraft({ ...draft, date: event.target.value })}
        />
      </label>
      <div className="local-rate-preview">
        <small>Converted value</small>
        <strong>{money(Number(draft.amount || 0) * rate)}</strong>
        <span>
          1 {draft.currency} = {rate.toFixed(4)} LKR
        </span>
      </div>
      <button className="button button-primary" type="submit">
        <Plus size={16} /> Save expense
      </button>
    </form>
  );
}

function ExpenseList({
  expenses,
  onAdd,
  onDelete,
}: {
  expenses: LocalExpense[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  if (!expenses.length)
    return (
      <section className="local-empty-clients">
        <div className="expense">
          <ReceiptText size={28} />
        </div>
        <h2>No expenses yet</h2>
        <p>Add rent, software, marketing and other operating costs.</p>
        <button className="button button-primary" onClick={onAdd}>
          <Plus size={16} /> Add first expense
        </button>
      </section>
    );
  const total = expenses.reduce((sum, item) => sum + localValue(item.amount, item.exchangeRate), 0);
  return (
    <section className="local-expense-list">
      <div className="local-expense-total">
        <span>Total operating expenses</span>
        <strong>−{money(total)}</strong>
      </div>
      {expenses.map((expense) => (
        <article key={expense.id}>
          <span className="local-expense-icon">
            <ReceiptText size={17} />
          </span>
          <div>
            <strong>{expense.description}</strong>
            <small>
              {expense.category} · {expense.date}
            </small>
          </div>
          <div className="local-expense-amount">
            <span>
              {expense.currency} {expense.amount.toLocaleString()}
            </span>
            <strong>−{money(localValue(expense.amount, expense.exchangeRate))}</strong>
          </div>
          <button
            className="local-delete"
            aria-label={`Delete ${expense.description}`}
            onClick={() => onDelete(expense.id)}
          >
            <Trash2 size={15} />
          </button>
        </article>
      ))}
    </section>
  );
}
