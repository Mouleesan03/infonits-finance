'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Globe2,
  Download,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessagesSquare,
  Pencil,
  PieChart,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { LocalOfficeModule, type OfficeSection } from './local-office-modules';
import { LocalCloudSync } from './local-cloud-sync';

type Section = 'dashboard' | 'projects' | 'clients' | 'expenses' | OfficeSection;
type LocalClient = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
};
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
type OfficeOverview = {
  documents: Array<{
    id: string;
    kind: 'Invoice' | 'Quotation';
    number: string;
    projectId: string;
    clientId?: string;
    dueDate: string;
    status: string;
    amount: number;
    currency: string;
    exchangeRate: number;
  }>;
  payments: Array<{
    id: string;
    note: string;
    category: string;
    date: string;
    status: string;
    amount: number;
    currency: string;
    exchangeRate: number;
  }>;
  renewals: Array<{
    id: string;
    website: string;
    domainDue: string;
    hostingDue: string;
  }>;
};

const storageKey = 'infonits-finance-local-v1';
const officeStorageKey = 'infonits-finance-office-v1';
const currencies = ['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'INR', 'AED', 'SGD', 'JPY'];
const countries = [
  'Sri Lanka',
  'Australia',
  'Canada',
  'France',
  'India',
  'Singapore',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Other',
];
const countryFlags: Record<string, string> = {
  'Sri Lanka': '🇱🇰',
  Australia: '🇦🇺',
  Canada: '🇨🇦',
  France: '🇫🇷',
  India: '🇮🇳',
  Singapore: '🇸🇬',
  'United Arab Emirates': '🇦🇪',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  Other: '🌐',
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyClient = { name: '', company: '', email: '', phone: '', country: 'Sri Lanka' };
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
const compactNumber = (value: number) =>
  new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
const compactMoney = (value: number) => `LKR ${compactNumber(value)}`;
const shortDate = (value: string, includeYear = true) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: '2-digit' as const } : {}),
  }).format(date);
};
const localValue = (value: number, rate: number) => value * rate;

function readOfficeOverview(): OfficeOverview {
  try {
    const saved = JSON.parse(
      localStorage.getItem(officeStorageKey) ?? '{}',
    ) as Partial<OfficeOverview>;
    return {
      documents: saved.documents ?? [],
      payments: saved.payments ?? [],
      renewals: saved.renewals ?? [],
    };
  } catch {
    return { documents: [], payments: [], renewals: [] };
  }
}

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
  const [officeOverview, setOfficeOverview] = useState<OfficeOverview>({
    documents: [],
    payments: [],
    renewals: [],
  });
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [officeFormSignal, setOfficeFormSignal] = useState(0);
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
      setClients(
        (parsed?.clients ?? []).map((client) => ({ ...client, country: client.country ?? '' })),
      );
      setExpenses(parsed?.expenses ?? []);
      setFxRates(parsed?.fxRates ?? { LKR: 1 });
      setFxDate(savedDate);
      setFxStatus(savedDate ? 'saved' : 'loading');
      setOfficeOverview(readOfficeOverview());
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
    window.dispatchEvent(new Event('infonits:local-change'));
  }, [clients, expenses, fxDate, fxRates, loaded, month, rows]);

  useEffect(() => {
    const refreshOfficeOverview = () => setOfficeOverview(readOfficeOverview());
    window.addEventListener('infonits:local-change', refreshOfficeOverview);
    window.addEventListener('storage', refreshOfficeOverview);
    return () => {
      window.removeEventListener('infonits:local-change', refreshOfficeOverview);
      window.removeEventListener('storage', refreshOfficeOverview);
    };
  }, []);

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
  const selectedProject = rows.find((row) => row.id === selectedProjectId);
  const selectedProjectClient = clients.find((client) => client.id === selectedProject?.clientId);
  const selectedProjectInvoices = officeOverview.documents.filter(
    (document) => document.kind === 'Invoice' && document.projectId === selectedProjectId,
  );

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

  function quickAdd(type: 'project' | 'client' | 'expense' | 'invoice') {
    setQuickAddOpen(false);
    if (type === 'project') {
      openProjectForm();
      return;
    }
    if (type === 'client') {
      setSection('clients');
      setClientFormOpen(true);
      return;
    }
    if (type === 'expense') {
      setSection('expenses');
      setExpenseFormOpen(true);
      return;
    }
    setSection('invoices');
    setOfficeFormSignal((current) => current + 1);
  }

  function createInvoice(row: LocalRow) {
    localStorage.setItem(
      'infonits-invoice-draft',
      JSON.stringify({
        clientId: row.clientId,
        projectId: row.id,
        amount: String(row.value),
        currency: row.currency,
      }),
    );
    setSection('invoices');
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
          <span className="local-brand-compact" aria-hidden="true">
            IN
          </span>
          <button
            className="local-sidebar-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="local-nav" aria-label="Workspace navigation">
          <SidebarGroup label="Overview">
            <button
              className={section === 'dashboard' ? 'active' : ''}
              onClick={() => changeSection('dashboard')}
            >
              <LayoutDashboard size={19} />
              <span>Dashboard</span>
            </button>
            <button
              className={section === 'calendar' ? 'active' : ''}
              onClick={() => changeSection('calendar')}
            >
              <CalendarDays size={19} />
              <span>Calendar</span>
            </button>
          </SidebarGroup>
          <SidebarGroup label="Sales">
            <button
              className={section === 'clients' ? 'active' : ''}
              onClick={() => changeSection('clients')}
            >
              <Users size={19} />
              <span>Clients</span>
              <b>{clients.length}</b>
            </button>
            <button
              className={section === 'invoices' ? 'active' : ''}
              onClick={() => changeSection('invoices')}
            >
              <FileText size={19} />
              <span>Invoices</span>
            </button>
            <button
              className={section === 'quotations' ? 'active' : ''}
              onClick={() => changeSection('quotations')}
            >
              <FileCheck2 size={19} />
              <span>Quotations</span>
            </button>
          </SidebarGroup>
          <SidebarGroup label="Work">
            <button
              className={section === 'projects' ? 'active' : ''}
              onClick={() => changeSection('projects')}
            >
              <BriefcaseBusiness size={19} />
              <span>Projects</span>
              <b>{rows.length}</b>
            </button>
            <button
              className={section === 'team' ? 'active' : ''}
              onClick={() => changeSection('team')}
            >
              <UsersRound size={19} />
              <span>Team</span>
            </button>
            <button
              className={section === 'posts' ? 'active' : ''}
              onClick={() => changeSection('posts')}
            >
              <MessagesSquare size={19} />
              <span>Post tracker</span>
            </button>
          </SidebarGroup>
          <SidebarGroup label="Finance">
            <button
              className={section === 'payments' ? 'active' : ''}
              onClick={() => changeSection('payments')}
            >
              <CircleDollarSign size={19} />
              <span>Payments</span>
            </button>
            <button
              className={section === 'expenses' ? 'active' : ''}
              onClick={() => changeSection('expenses')}
            >
              <ReceiptText size={19} />
              <span>Expenses</span>
              <b>{expenses.length}</b>
            </button>
            <button
              className={section === 'reports' ? 'active' : ''}
              onClick={() => changeSection('reports')}
            >
              <PieChart size={19} />
              <span>Reports</span>
            </button>
          </SidebarGroup>
          <SidebarGroup label="Admin">
            <button
              className={section === 'renewals' ? 'active' : ''}
              onClick={() => changeSection('renewals')}
            >
              <Globe2 size={19} />
              <span>Renewals</span>
            </button>
            <button
              className={section === 'documents' ? 'active' : ''}
              onClick={() => changeSection('documents')}
            >
              <FileText size={19} />
              <span>Documents</span>
            </button>
            <button
              className={section === 'users' ? 'active' : ''}
              onClick={() => changeSection('users')}
            >
              <ShieldCheck size={19} />
              <span>Users & roles</span>
            </button>
          </SidebarGroup>
        </nav>
        <div className="local-sidebar-note">
          <LockKeyhole size={17} />
          <div>
            <strong>Automatic backup</strong>
            <small>Every change saves securely to Supabase.</small>
          </div>
        </div>
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
          <LocalCloudSync />
        </header>

        <main className="local-main">
          {section === 'dashboard' && (
            <Dashboard
              totals={totals}
              chart={chart}
              chartMax={chartMax}
              rows={rows}
              clients={clients}
              expenses={expenses}
              fxDate={fxDate}
              fxStatus={fxStatus}
              office={officeOverview}
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
                <div
                  className="local-modal-layer"
                  role="presentation"
                  onMouseDown={() => setProjectFormOpen(false)}
                >
                  <section
                    className="local-modal local-project-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="new-project-title"
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <header>
                      <div>
                        <span className="local-modal-icon">
                          <BriefcaseBusiness size={19} />
                        </span>
                        <div>
                          <h2 id="new-project-title">Add project</h2>
                          <p>Keep project value, client and currency in one clear record.</p>
                        </div>
                      </div>
                      <button
                        aria-label="Close project form"
                        onClick={() => setProjectFormOpen(false)}
                      >
                        <X size={19} />
                      </button>
                    </header>
                    <ProjectForm
                      draft={projectDraft}
                      setDraft={setProjectDraft}
                      clients={clients}
                      rates={fxRates}
                      onSubmit={addProject}
                      onCancel={() => setProjectFormOpen(false)}
                    />
                  </section>
                </div>
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
                  onView={setSelectedProjectId}
                  onInvoice={createInvoice}
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
                onUpdate={(id, patch) =>
                  setClients((current) =>
                    current.map((client) => (client.id === id ? { ...client, ...patch } : client)),
                  )
                }
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

          {!['dashboard', 'projects', 'clients', 'expenses'].includes(section) && (
            <LocalOfficeModule
              section={section as OfficeSection}
              clients={clients}
              projects={rows}
              rates={fxRates}
              openFormSignal={officeFormSignal}
            />
          )}
        </main>
        <nav className="local-mobile-nav" aria-label="Mobile workspace navigation">
          <button
            className={section === 'dashboard' ? 'active' : ''}
            onClick={() => changeSection('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Home</span>
          </button>
          <button
            className={section === 'projects' ? 'active' : ''}
            onClick={() => changeSection('projects')}
          >
            <BriefcaseBusiness size={20} />
            <span>Projects</span>
          </button>
          <button className="add" aria-label="Quick add" onClick={() => setQuickAddOpen(true)}>
            <Plus size={24} />
          </button>
          <button
            className={section === 'clients' ? 'active' : ''}
            onClick={() => changeSection('clients')}
          >
            <Users size={20} />
            <span>Clients</span>
          </button>
          <button
            className={section === 'expenses' ? 'active' : ''}
            onClick={() => changeSection('expenses')}
          >
            <ReceiptText size={20} />
            <span>Expenses</span>
          </button>
        </nav>
      </div>
      {quickAddOpen ? (
        <QuickAddMenu onClose={() => setQuickAddOpen(false)} onAdd={quickAdd} />
      ) : null}
      {selectedProject ? (
        <ProjectDetail
          row={selectedProject}
          client={selectedProjectClient}
          invoices={selectedProjectInvoices}
          onClose={() => setSelectedProjectId('')}
          onInvoice={(row) => {
            setSelectedProjectId('');
            createInvoice(row);
          }}
        />
      ) : null}
    </div>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="local-nav-group is-open">
      <div className="local-nav-group-toggle">
        <span>{label}</span>
      </div>
      <div className="local-nav-group-links">{children}</div>
    </section>
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

function QuickAddMenu({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (type: 'project' | 'client' | 'expense' | 'invoice') => void;
}) {
  const actions = [
    { id: 'project' as const, label: 'Project', hint: 'Start new work', icon: BriefcaseBusiness },
    { id: 'client' as const, label: 'Client', hint: 'Add contact', icon: Users },
    { id: 'expense' as const, label: 'Expense', hint: 'Record a cost', icon: ReceiptText },
    { id: 'invoice' as const, label: 'Invoice', hint: 'Create a bill', icon: CreditCard },
  ];
  return (
    <div className="local-modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="local-modal local-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="quick-add-title">Quick add</h2>
            <p>What do you want to create?</p>
          </div>
          <button type="button" aria-label="Close quick add" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="local-quick-grid">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id} type="button" onClick={() => onAdd(action.id)}>
                <span>
                  <Icon size={21} />
                </span>
                <strong>{action.label}</strong>
                <small>{action.hint}</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProjectDetail({
  row,
  client,
  invoices,
  onClose,
  onInvoice,
}: {
  row: LocalRow;
  client?: LocalClient;
  invoices: OfficeOverview['documents'];
  onClose: () => void;
  onInvoice: (row: LocalRow) => void;
}) {
  const value = localValue(row.value, row.exchangeRate);
  const work = row.workDue + row.workPaid;
  const remaining = value - row.advance - work;
  return (
    <div className="local-modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="local-modal local-project-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="local-eyebrow">PROJECT DETAILS</span>
            <h2 id="project-detail-title">{row.project}</h2>
            <p>{client?.name || 'No client assigned'}</p>
          </div>
          <button type="button" aria-label="Close project details" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="local-detail-stats">
          <article>
            <span>Project value</span>
            <strong>{money(value)}</strong>
          </article>
          <article className="income">
            <span>Received</span>
            <strong>{money(row.advance)}</strong>
          </article>
          <article className="outcome">
            <span>Work cost</span>
            <strong>{money(work)}</strong>
          </article>
          <article className="highlight">
            <span>For me</span>
            <strong>{money(remaining)}</strong>
          </article>
        </div>
        <dl className="local-detail-list">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`local-detail-status ${row.status.toLowerCase()}`}>
                {row.status}
              </span>
            </dd>
          </div>
          <div>
            <dt>Original amount</dt>
            <dd>
              {row.currency} {row.value.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Exchange rate</dt>
            <dd>
              1 {row.currency} = {row.exchangeRate.toLocaleString()} LKR
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{shortDate(row.createdAt)}</dd>
          </div>
          <div>
            <dt>Invoices</dt>
            <dd>{invoices.length}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{client?.email || client?.phone || 'Not added'}</dd>
          </div>
        </dl>
        {row.note ? (
          <div className="local-detail-note">
            <span>Note</span>
            <p>{row.note}</p>
          </div>
        ) : null}
        <footer>
          <button type="button" className="button button-outline" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button button-primary" onClick={() => onInvoice(row)}>
            <FilePlus2 size={16} /> Create invoice
          </button>
        </footer>
      </section>
    </div>
  );
}

function Dashboard({
  totals,
  chart,
  chartMax,
  rows,
  clients,
  expenses,
  fxDate,
  fxStatus,
  office,
  onAddProject,
  onSection,
}: {
  totals: { value: number; received: number; work: number; expenses: number; net: number };
  chart: Array<{ label: string; value: number; tone: string }>;
  chartMax: number;
  rows: LocalRow[];
  clients: LocalClient[];
  expenses: LocalExpense[];
  fxDate: string;
  fxStatus: string;
  office: OfficeOverview;
  onAddProject: () => void;
  onSection: (section: Section) => void;
}) {
  const now = new Date(`${today()}T00:00:00`).getTime();
  const day = 86_400_000;
  const totalOutcome = totals.work + totals.expenses;
  const collectionRate = totals.value
    ? Math.min(100, Math.round((totals.received / totals.value) * 100))
    : 0;
  const actions = [
    ...office.documents
      .filter((item) => item.kind === 'Invoice' && item.status !== 'Paid')
      .map((item) => {
        const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`).getTime() : now;
        const overdue = item.status === 'Overdue' || due < now;
        return {
          id: `invoice-${item.id}`,
          title: `${item.number} ${overdue ? 'is overdue' : 'needs payment'}`,
          meta: `${item.currency} ${compactNumber(item.amount)} · ${item.dueDate ? shortDate(item.dueDate) : 'No due date'}`,
          tone: overdue ? 'urgent' : 'waiting',
          date: due,
          section: 'invoices' as Section,
        };
      }),
    ...office.payments
      .filter((item) => item.status === 'Pending')
      .map((item) => ({
        id: `payment-${item.id}`,
        title: item.note || item.category || 'Pending payment',
        meta: `${item.currency} ${compactNumber(item.amount)} · ${item.date}`,
        tone: 'waiting',
        date: item.date ? new Date(`${item.date}T00:00:00`).getTime() : now,
        section: 'payments' as Section,
      })),
    ...office.renewals.flatMap((item) =>
      [
        { type: 'Domain', date: item.domainDue },
        { type: 'Hosting', date: item.hostingDue },
      ]
        .filter(({ date }) => {
          if (!date) return false;
          const due = new Date(`${date}T00:00:00`).getTime();
          return due - now <= 30 * day;
        })
        .map(({ type, date }) => {
          const due = new Date(`${date}T00:00:00`).getTime();
          return {
            id: `renewal-${item.id}-${type}`,
            title: `${item.website} ${type.toLowerCase()} renewal`,
            meta: due < now ? `Overdue · ${date}` : `Due ${date}`,
            tone: due < now ? 'urgent' : 'renewal',
            date: due,
            section: 'renewals' as Section,
          };
        }),
    ),
  ]
    .toSorted((left, right) => left.date - right.date)
    .slice(0, 5);
  const outstandingInvoices = office.documents.filter(
    (item) => item.kind === 'Invoice' && item.status !== 'Paid',
  );
  const outstandingTotal = outstandingInvoices.reduce(
    (sum, item) => sum + localValue(item.amount, item.exchangeRate),
    0,
  );
  const outstandingClientCount = new Set(
    outstandingInvoices.map((item) => item.clientId).filter(Boolean),
  ).size;
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));

  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Finance dashboard"
        subtitle="Projects, cash received and profitability at a glance."
      >
        <button className="button button-outline" onClick={() => onSection('projects')}>
          <BriefcaseBusiness size={16} /> View projects
        </button>
        <button className="button button-primary" onClick={onAddProject}>
          <Plus size={16} /> Add project
        </button>
      </PageHeading>
      <section className="local-summary" aria-label="Finance totals">
        <article>
          <span>Project value</span>
          <strong title={money(totals.value)}>{compactMoney(totals.value)}</strong>
          <small>{rows.length} projects in this workspace</small>
          <WalletCards size={18} />
        </article>
        <article className="income">
          <span>Income received</span>
          <strong title={money(totals.received)}>{compactMoney(totals.received)}</strong>
          <small>{collectionRate}% of project value collected</small>
          <ArrowUpRight size={18} />
        </article>
        <article className="outcome">
          <span>Total outcome</span>
          <strong title={money(totalOutcome)}>{compactMoney(totalOutcome)}</strong>
          <small>
            {compactMoney(totals.work)} work · {compactMoney(totals.expenses)} expenses
          </small>
          <ArrowDownRight size={18} />
        </article>
        <article className="highlight">
          <span>Estimated profit</span>
          <strong title={money(totals.net)}>{compactMoney(totals.net)}</strong>
          <small>After all recorded costs</small>
          <TrendingUp size={18} />
        </article>
      </section>
      <section className="local-dashboard-middle">
        <article className="local-outstanding-card">
          <div className="local-card-heading">
            <div>
              <Clock3 size={18} />
              <div>
                <strong>Outstanding client payments</strong>
                <small>Invoices and payments that need attention</small>
              </div>
            </div>
            <b>{actions.length}</b>
          </div>
          <div className="local-outstanding-total">
            <strong title={money(outstandingTotal)}>{compactMoney(outstandingTotal)}</strong>
            <span>
              {outstandingInvoices.length} invoice{outstandingInvoices.length === 1 ? '' : 's'}
              {outstandingClientCount ? ` from ${outstandingClientCount} clients` : ''}
            </span>
            <button className="button button-outline" onClick={() => onSection('invoices')}>
              View outstanding <ArrowUpRight size={15} />
            </button>
          </div>
          {actions.length ? (
            <div className="local-attention-preview">
              {actions.slice(0, 2).map((item) => (
                <button key={item.id} onClick={() => onSection(item.section)}>
                  <i className={item.tone} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="local-action-empty">
              <ShieldCheck size={19} /> Everything is up to date.
            </div>
          )}
        </article>
        <article className="local-chart-card">
          <div className="local-card-heading">
            <div>
              <BarChart3 size={18} />
              <div>
                <strong>Financial overview</strong>
                <small>Project value, income and costs in LKR</small>
              </div>
            </div>
            <span className={`local-fx-badge ${fxStatus}`}>
              {fxStatus === 'live' ? 'Daily rates' : 'Saved rates'} ·{' '}
              {fxDate ? shortDate(fxDate, false) : 'offline'}
            </span>
          </div>
          <div className="local-bar-chart" aria-label="Financial totals comparison">
            {chart.map((item) => (
              <div className="local-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div className="local-bar-track" aria-hidden="true">
                  <div
                    className={`local-bar ${item.tone}`}
                    style={{
                      width: `${item.value ? Math.max(5, (item.value / chartMax) * 100) : 0}%`,
                    }}
                  />
                </div>
                <strong className="local-bar-value" title={money(item.value)}>
                  {compactMoney(item.value)}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="local-dashboard-lower">
        <article className="local-project-finance-card">
          <div className="local-card-heading">
            <div>
              <BriefcaseBusiness size={18} />
              <div>
                <strong>Project finance</strong>
                <small>Latest projects and current profitability</small>
              </div>
            </div>
            <button className="local-card-link" onClick={() => onSection('projects')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="local-project-preview-head" aria-hidden="true">
            <span>#</span>
            <span>Project</span>
            <span>Value</span>
            <span>Received</span>
            <span>Profit</span>
            <span>Status</span>
          </div>
          <div className="local-project-preview-list">
            {rows.slice(0, 5).map((row, index) => {
              const value = localValue(row.value, row.exchangeRate);
              const profit = value - row.advance - row.workDue - row.workPaid;
              return (
                <button key={row.id} onClick={() => onSection('projects')}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <strong>{row.project}</strong>
                    <small>{clientNames.get(row.clientId) ?? 'No client'}</small>
                  </span>
                  <b title={money(value)}>{compactMoney(value)}</b>
                  <b className="positive" title={money(row.advance)}>
                    {compactMoney(row.advance)}
                  </b>
                  <b className={profit < 0 ? 'negative' : 'positive'} title={money(profit)}>
                    {compactMoney(profit)}
                  </b>
                  <em className={row.status.toLowerCase()}>{row.status}</em>
                </button>
              );
            })}
            {!rows.length && <div className="local-empty-activity">Add your first project.</div>}
          </div>
        </article>
        <article className="local-activity-card">
          <div className="local-card-heading">
            <div>
              <RefreshCw size={18} />
              <div>
                <strong>Recent activity</strong>
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
                    {row.currency} {compactNumber(row.value)}
                  </small>
                </div>
                <b title={money(localValue(row.value, row.exchangeRate))}>
                  {compactMoney(localValue(row.value, row.exchangeRate))}
                </b>
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
                  −{compactMoney(localValue(expense.amount, expense.exchangeRate))}
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
  onCancel,
}: {
  draft: typeof emptyProject;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyProject>>;
  clients: LocalClient[];
  rates: Record<string, number>;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const rate = draft.currency === 'LKR' ? 1 : (rates[draft.currency] ?? 1);
  return (
    <form className="local-entry-form modal-project-form" onSubmit={onSubmit}>
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
      <div className="local-modal-actions">
        <button className="button button-outline" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button button-primary" type="submit">
          <Plus size={16} /> Add project
        </button>
      </div>
    </form>
  );
}

function ProjectTable({
  rows,
  clients,
  rates,
  onUpdate,
  onView,
  onInvoice,
  onDelete,
}: {
  rows: LocalRow[];
  clients: LocalClient[];
  rates: Record<string, number>;
  onUpdate: (id: string, patch: Partial<LocalRow>) => void;
  onView: (id: string) => void;
  onInvoice: (row: LocalRow) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
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
    <section className="local-project-ledger" aria-label="Project records">
      <div className="local-project-ledger-head" aria-hidden="true">
        <span>#</span>
        <span>Project</span>
        <span>Value</span>
        <span>Received</span>
        <span>Work cost</span>
        <span>Balance</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      <div className="local-project-records">
        {rows.map((row, index) => {
          const value = localValue(row.value, row.exchangeRate);
          const workCost = row.workDue + row.workPaid;
          const mine = value - row.advance - workCost;
          const clientName = clients.find((client) => client.id === row.clientId)?.name;
          const isEditing = editingId === row.id;
          return (
            <article className="local-project-record" key={row.id}>
              <span className="local-project-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="local-project-main">
                <strong>{row.project}</strong>
                <small>
                  {clientName || 'No client'} · {shortDate(row.createdAt)}
                </small>
              </div>
              <div className="local-project-value">
                <strong title={money(value)}>{compactMoney(value)}</strong>
                <small>
                  {row.currency} {compactNumber(row.value)}
                </small>
              </div>
              <strong className="local-project-money income" title={money(row.advance)}>
                {compactMoney(row.advance)}
              </strong>
              <strong className="local-project-money outcome" title={money(workCost)}>
                {compactMoney(workCost)}
              </strong>
              <strong
                className={`local-project-money ${mine < 0 ? 'negative' : 'profit'}`}
                title={money(mine)}
              >
                {compactMoney(mine)}
              </strong>
              <div className="local-project-status">
                <select
                  aria-label="Payment status"
                  className={row.status.toLowerCase()}
                  value={row.status}
                  onChange={(event) =>
                    onUpdate(row.id, { status: event.target.value as LocalRow['status'] })
                  }
                >
                  <option>Waiting</option>
                  <option>Partial</option>
                  <option>Paid</option>
                </select>
              </div>
              <div className="local-card-actions">
                <button
                  className={`local-row-action neutral ${isEditing ? 'active' : ''}`}
                  aria-label={`${isEditing ? 'Close editor for' : 'Edit'} ${row.project}`}
                  title={isEditing ? 'Close editor' : 'Edit project'}
                  onClick={() => setEditingId(isEditing ? null : row.id)}
                >
                  {isEditing ? <X size={16} /> : <Pencil size={16} />}
                </button>
                <button
                  className="local-row-action neutral"
                  aria-label={`View ${row.project} details`}
                  title="Project details"
                  onClick={() => onView(row.id)}
                >
                  <Eye size={16} />
                </button>
                <button
                  className="local-row-action"
                  aria-label={`Create invoice for ${row.project}`}
                  title="Create invoice"
                  onClick={() => onInvoice(row)}
                >
                  <FilePlus2 size={16} />
                </button>
                <button
                  className="local-delete"
                  aria-label={`Delete ${row.project}`}
                  onClick={() => onDelete(row.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {isEditing && (
                <div className="local-project-editor">
                  <label>
                    <span>Project</span>
                    <input
                      aria-label="Project name"
                      value={row.project}
                      onChange={(event) => onUpdate(row.id, { project: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Client</span>
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
                  </label>
                  <label className="local-project-editor-amount">
                    <span>Amount</span>
                    <div>
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
                        aria-label="Project amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.value || ''}
                        onChange={(event) =>
                          onUpdate(row.id, { value: Number(event.target.value) })
                        }
                      />
                    </div>
                  </label>
                  <label>
                    <span>Rate to LKR</span>
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
                  </label>
                  {(
                    [
                      ['advance', 'Received'],
                      ['workDue', 'To pay'],
                      ['workPaid', 'Paid'],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <input
                        aria-label={label}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row[field] || ''}
                        placeholder="0.00"
                        onChange={(event) =>
                          onUpdate(row.id, { [field]: Number(event.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setEditingId(null)}
                  >
                    Done
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <footer className="local-project-totals">
        <div>
          <span>Total value</span>
          <strong title={money(totals.value)}>{compactMoney(totals.value)}</strong>
        </div>
        <div className="positive">
          <span>Received</span>
          <strong title={money(totals.advance)}>{compactMoney(totals.advance)}</strong>
        </div>
        <div className="negative">
          <span>Work cost</span>
          <strong title={money(totals.workDue + totals.workPaid)}>
            {compactMoney(totals.workDue + totals.workPaid)}
          </strong>
        </div>
        <div>
          <span>Balance</span>
          <strong title={money(totals.mine)}>{compactMoney(totals.mine)}</strong>
        </div>
      </footer>
    </section>
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
      <label>
        <span>Country</span>
        <select
          value={draft.country}
          onChange={(event) => setDraft({ ...draft, country: event.target.value })}
        >
          {countries.map((country) => (
            <option key={country} value={country}>
              {countryFlags[country]} {country}
            </option>
          ))}
        </select>
      </label>
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
  onUpdate,
  onRemove,
}: {
  clients: LocalClient[];
  rows: LocalRow[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<LocalClient>) => void;
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
              <label className="local-client-country">
                <span aria-hidden="true">{countryFlags[client.country] || '🌐'}</span>
                <select
                  aria-label={`Country for ${client.name}`}
                  value={client.country}
                  onChange={(event) => onUpdate(client.id, { country: event.target.value })}
                >
                  <option value="">Choose country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {countryFlags[country]} {country}
                    </option>
                  ))}
                </select>
              </label>
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
              {expense.category} · {shortDate(expense.date)}
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
