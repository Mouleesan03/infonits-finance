'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircleDollarSign,
  Download,
  Eye,
  FileDown,
  FileText,
  Folder,
  Globe2,
  Plus,
  Printer,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

export type OfficeSection =
  | 'calendar'
  | 'invoices'
  | 'quotations'
  | 'payments'
  | 'team'
  | 'posts'
  | 'renewals'
  | 'documents'
  | 'reports'
  | 'users';

type ClientRef = {
  id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
};
type ProjectRef = {
  id: string;
  project: string;
  clientId: string;
  value: number;
  currency: string;
  exchangeRate: number;
  advance: number;
  workDue: number;
  workPaid: number;
  status: string;
};
type DocumentKind = 'Invoice' | 'Quotation';
type SalesDocument = {
  id: string;
  kind: DocumentKind;
  number: string;
  clientId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  status: string;
  taxRate?: number;
  discount?: number;
  advance?: number;
  notes?: string;
};
type Payment = {
  id: string;
  type: 'Income' | 'Expense' | 'Saving' | 'Gold' | 'Loan';
  category: string;
  note: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  date: string;
  status: 'Paid' | 'Pending';
};
type TeamMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  employment: string;
  status: 'Active' | 'Inactive';
};
type PostPlan = {
  id: string;
  clientId: string;
  projectId: string;
  platform: string;
  month: string;
  required: number;
  posted: number;
  memberId: string;
};
type Renewal = {
  id: string;
  website: string;
  username: string;
  websiteUrl: string;
  domainDue: string;
  hostingDue: string;
};
type ServiceLetter = {
  id: string;
  date: string;
  client: string;
  subject: string;
  preparedBy: string;
  body: string;
};
type WorkspaceUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  access: string;
  status: 'Active' | 'Inactive';
};
type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  clientId?: string;
  projectId?: string;
  platform?: string;
  count?: number;
  remarks?: string;
};
type Store = {
  documents: SalesDocument[];
  payments: Payment[];
  team: TeamMember[];
  posts: PostPlan[];
  renewals: Renewal[];
  letters: ServiceLetter[];
  users: WorkspaceUser[];
  events: CalendarEvent[];
};

const storeKey = 'infonits-finance-office-v1';
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const invoiceDueDate = (item: Pick<SalesDocument, 'issueDate' | 'dueDate'>) =>
  addDays(item.issueDate, 10);
const currentDocumentStatus = (item: SalesDocument) => {
  if (item.kind !== 'Invoice' || item.status === 'Paid') return item.status;
  return invoiceDueDate(item) < today() ? 'Overdue' : item.status;
};
const currencies = ['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'INR', 'AED', 'SGD', 'JPY'];
const emptyStore: Store = {
  documents: [],
  payments: [],
  team: [],
  posts: [],
  renewals: [],
  letters: [],
  users: [
    {
      id: 'local-admin',
      name: 'Admin',
      username: 'admin',
      role: 'Admin',
      access: 'Full control',
      status: 'Active',
    },
  ],
  events: [],
};

const money = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(value);
const lkr = (amount: number, rate: number) => amount * rate;
const documentTotal = (item: SalesDocument) =>
  Math.max(
    0,
    item.amount +
      item.amount * ((item.taxRate ?? 0) / 100) -
      (item.discount ?? 0) -
      (item.advance ?? 0),
  );
const nextNumber = (kind: DocumentKind, documents: SalesDocument[]) => {
  const sequence = documents
    .filter((item) => item.kind === kind)
    .reduce((highest, item) => Math.max(highest, Number(item.number.split('-').at(-1)) || 0), 0);
  return `${kind === 'Invoice' ? 'INV' : 'QUO'}-${new Date().getFullYear()}-${String(
    sequence + 1,
  ).padStart(3, '0')}`;
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });

export function LocalOfficeModule({
  section,
  clients,
  projects,
  rates,
  openFormSignal = 0,
}: {
  section: OfficeSection;
  clients: ClientRef[];
  projects: ProjectRef[];
  rates: Record<string, number>;
  openFormSignal?: number;
}) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) {
        const savedStore = JSON.parse(saved) as Partial<Store>;
        const parsed: Store = {
          ...emptyStore,
          ...savedStore,
          documents: savedStore.documents ?? [],
        };
        setStore({
          ...parsed,
          documents: parsed.documents.map((item) => ({
            ...item,
            dueDate: item.kind === 'Invoice' ? invoiceDueDate(item) : item.dueDate,
            status: currentDocumentStatus(item),
          })),
        });
      }
    } catch {
      setStore(emptyStore);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(storeKey, JSON.stringify(store));
      window.dispatchEvent(new Event('infonits:local-change'));
    }
  }, [loaded, store]);

  useEffect(() => {
    setFormOpen(false);
    setSearch('');
  }, [section]);

  useEffect(() => {
    if (openFormSignal > 0) setFormOpen(true);
  }, [openFormSignal]);

  function update<K extends keyof Store>(key: K, value: Store[K]) {
    setStore((current) => ({ ...current, [key]: value }));
  }

  if (!loaded) return <div className="office-loading">Opening module…</div>;

  if (section === 'invoices' || section === 'quotations') {
    const kind: DocumentKind = section === 'invoices' ? 'Invoice' : 'Quotation';
    return (
      <SalesDocuments
        kind={kind}
        items={store.documents.filter((item) => item.kind === kind)}
        allItems={store.documents}
        clients={clients}
        projects={projects}
        rates={rates}
        search={search}
        setSearch={setSearch}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) =>
          update('documents', [...store.documents.filter((item) => item.kind !== kind), ...items])
        }
      />
    );
  }
  if (section === 'payments')
    return (
      <PaymentsModule
        items={store.payments}
        rates={rates}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('payments', items)}
      />
    );
  if (section === 'team')
    return (
      <TeamModule
        items={store.team}
        search={search}
        setSearch={setSearch}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('team', items)}
      />
    );
  if (section === 'posts')
    return (
      <PostsModule
        items={store.posts}
        events={store.events}
        renewals={store.renewals}
        clients={clients}
        projects={projects}
        team={store.team}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('posts', items)}
        onEventsChange={(items) => update('events', items)}
      />
    );
  if (section === 'renewals')
    return (
      <RenewalsModule
        items={store.renewals}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('renewals', items)}
      />
    );
  if (section === 'documents')
    return (
      <LettersModule
        items={store.letters}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('letters', items)}
      />
    );
  if (section === 'users')
    return (
      <UsersModule
        items={store.users}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('users', items)}
      />
    );
  if (section === 'calendar')
    return (
      <CalendarModule
        items={store.events}
        documents={store.documents}
        renewals={store.renewals}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('events', items)}
      />
    );
  return (
    <ReportsModule
      documents={store.documents}
      payments={store.payments}
      posts={store.posts}
      projects={projects}
      clients={clients}
    />
  );
}

function ModuleHeader({
  eyebrow,
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <section className="local-titlebar office-titlebar">
        <div>
          <span className="local-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="local-actions">
          {children}
          {action && onAction && (
            <button className="button button-primary" onClick={onAction}>
              <Plus size={16} /> {action}
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="office-search">
      <Search size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="office-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function MonthCalendar({
  month,
  events,
  onDateClick,
  compact = false,
}: {
  month: string;
  events: CalendarEvent[];
  onDateClick: (date: string) => void;
  compact?: boolean;
}) {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1,
  );
  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const current = eventsByDate.get(event.date) ?? [];
    current.push(event);
    eventsByDate.set(event.date, current);
  });
  return (
    <div className={`office-month-grid ${compact ? 'compact' : ''}`}>
      <div className="office-post-weekdays" aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="office-post-days">
        {cells.map((day, index) => {
          if (!day) return <span className="is-blank" key={`blank-${index}`} />;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const dayEvents = eventsByDate.get(date) ?? [];
          return (
            <button
              type="button"
              key={date}
              className={date === today() ? 'is-today' : ''}
              onClick={() => onDateClick(date)}
              aria-label={`Add event on ${date}`}
            >
              <b>{day}</b>
              {dayEvents.slice(0, compact ? 3 : 2).map((event) => (
                <span key={event.id} title={event.title} className={event.type.toLowerCase()}>
                  {compact ? '' : event.title}
                </span>
              ))}
              {dayEvents.length > (compact ? 3 : 2) && (
                <small>+{dayEvents.length - (compact ? 3 : 2)} more</small>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarEventModal({
  initialDate,
  postMode = false,
  clients = [],
  projects = [],
  onClose,
  onSave,
}: {
  initialDate: string;
  postMode?: boolean;
  clients?: ClientRef[];
  projects?: ProjectRef[];
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
}) {
  const [draft, setDraft] = useState({
    title: '',
    date: initialDate,
    type: postMode ? 'Post' : 'Task',
    clientId: '',
    projectId: '',
    platform: 'Instagram',
    count: '1',
    remarks: '',
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onSave({
      title: draft.title.trim(),
      date: draft.date,
      type: postMode ? 'Post' : draft.type,
      clientId: draft.clientId || undefined,
      projectId: draft.projectId || undefined,
      platform: postMode ? draft.platform : undefined,
      count: postMode ? Math.max(1, Number(draft.count) || 1) : undefined,
      remarks: draft.remarks.trim() || undefined,
    });
  };
  return (
    <div className="local-modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="local-modal office-event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="office-event-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="local-modal-icon">
              <CalendarDays size={19} />
            </span>
            <div>
              <h2 id="office-event-modal-title">{postMode ? 'Add posted update' : 'Add event'}</h2>
              <p>
                {postMode
                  ? 'Record content for the selected date.'
                  : 'Add a reminder to your calendar.'}
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close event form" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <form className="office-event-form" onSubmit={submit}>
          <label className="wide">
            <span>{postMode ? 'Update title' : 'Event'} *</span>
            <input
              autoFocus
              required
              placeholder={postMode ? 'e.g. Published campaign reel' : 'e.g. Client review meeting'}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
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
          {postMode ? (
            <>
              <label>
                <span>Client</span>
                <select
                  value={draft.clientId}
                  onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Project</span>
                <select
                  value={draft.projectId}
                  onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Platform</span>
                <select
                  value={draft.platform}
                  onChange={(event) => setDraft({ ...draft, platform: event.target.value })}
                >
                  <option>Instagram</option>
                  <option>Facebook</option>
                  <option>LinkedIn</option>
                  <option>TikTok</option>
                  <option>YouTube</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span>Post count</span>
                <input
                  type="number"
                  min="1"
                  value={draft.count}
                  onChange={(event) => setDraft({ ...draft, count: event.target.value })}
                />
              </label>
            </>
          ) : (
            <label>
              <span>Type</span>
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value })}
              >
                <option>Task</option>
                <option>Meeting</option>
                <option>Reminder</option>
                <option>Holiday</option>
                <option>Post</option>
              </select>
            </label>
          )}
          <label className="wide">
            <span>Notes</span>
            <textarea
              rows={3}
              value={draft.remarks}
              onChange={(event) => setDraft({ ...draft, remarks: event.target.value })}
              placeholder="Optional details"
            />
          </label>
          <footer>
            <button className="button button-outline" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              <Check size={16} /> Save
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function SalesDocuments({
  kind,
  items,
  allItems,
  clients,
  projects,
  rates,
  search,
  setSearch,
  formOpen,
  setFormOpen,
  onChange,
}: {
  kind: DocumentKind;
  items: SalesDocument[];
  allItems: SalesDocument[];
  clients: ClientRef[];
  projects: ProjectRef[];
  rates: Record<string, number>;
  search: string;
  setSearch: (value: string) => void;
  formOpen: boolean;
  setFormOpen: (value: boolean) => void;
  onChange: (items: SalesDocument[]) => void;
}) {
  const [draft, setDraft] = useState({
    clientId: '',
    projectId: '',
    issueDate: today(),
    dueDate: addDays(today(), 10),
    amount: '',
    currency: 'LKR',
    status: kind === 'Invoice' ? 'Pending' : 'Draft',
    taxRate: '0',
    discount: '0',
    advance: '0',
    notes: 'Payment is due within 10 days of the invoice date.',
  });
  const [preview, setPreview] = useState<SalesDocument | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const names = new Map(clients.map((client) => [client.id, client.name]));
  const clientDetails = new Map(clients.map((client) => [client.id, client]));
  const projectNames = new Map(projects.map((project) => [project.id, project.project]));

  useEffect(() => {
    if (kind !== 'Invoice') return;
    try {
      const saved = localStorage.getItem('infonits-invoice-draft');
      if (!saved) return;
      const seed = JSON.parse(saved) as Partial<typeof draft>;
      setDraft((current) => ({ ...current, ...seed, status: 'Pending' }));
      localStorage.removeItem('infonits-invoice-draft');
      setFormOpen(true);
    } catch {
      localStorage.removeItem('infonits-invoice-draft');
    }
  }, [kind, setFormOpen]);
  useEffect(() => setStatusFilter('All'), [kind]);
  const normalizedItems = items.map((item) => ({
    ...item,
    dueDate: item.kind === 'Invoice' ? invoiceDueDate(item) : item.dueDate,
    status: currentDocumentStatus(item),
  }));
  const visible = normalizedItems.filter(
    (item) =>
      (statusFilter === 'All' || item.status === statusFilter) &&
      `${item.number} ${names.get(item.clientId) ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const invoiceSummary = normalizedItems.reduce(
    (summary, item) => {
      const value = lkr(documentTotal(item), item.exchangeRate);
      return {
        billed: summary.billed + value,
        paid: summary.paid + (item.status === 'Paid' ? value : 0),
        pending:
          summary.pending + (item.status === 'Pending' || item.status === 'Sent' ? value : 0),
        overdue: summary.overdue + (item.status === 'Overdue' ? value : 0),
      };
    },
    { billed: 0, paid: 0, pending: 0, overdue: 0 },
  );
  const statusCounts = normalizedItems.reduce(
    (counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const invoiceCount = Math.max(normalizedItems.length, 1);
  const paidPercent = ((statusCounts.Paid ?? 0) / invoiceCount) * 100;
  const sentPercent = ((statusCounts.Sent ?? 0) / invoiceCount) * 100;
  const pendingPercent = ((statusCounts.Pending ?? 0) / invoiceCount) * 100;
  const overduePercent = ((statusCounts.Overdue ?? 0) / invoiceCount) * 100;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.clientId || !Number.isFinite(amount) || amount <= 0) return;
    onChange([
      {
        id: crypto.randomUUID(),
        kind,
        number: nextNumber(kind, allItems),
        clientId: draft.clientId,
        projectId: draft.projectId,
        issueDate: draft.issueDate,
        dueDate: kind === 'Invoice' ? addDays(draft.issueDate, 10) : draft.dueDate,
        amount,
        currency: draft.currency,
        exchangeRate: draft.currency === 'LKR' ? 1 : (rates[draft.currency] ?? 1),
        status: draft.status,
        taxRate: Number(draft.taxRate) || 0,
        discount: Number(draft.discount) || 0,
        advance: Number(draft.advance) || 0,
        notes: draft.notes.trim(),
      },
      ...items,
    ]);
    setDraft({
      clientId: '',
      projectId: '',
      issueDate: today(),
      dueDate: addDays(today(), 10),
      amount: '',
      currency: 'LKR',
      status: kind === 'Invoice' ? 'Pending' : 'Draft',
      taxRate: '0',
      discount: '0',
      advance: '0',
      notes: 'Payment is due within 10 days of the invoice date.',
    });
    setFormOpen(false);
  }
  return (
    <>
      <ModuleHeader
        eyebrow="SALES"
        title={`${kind}s`}
        subtitle={`Create and track client ${kind.toLowerCase()}s in one clear list.`}
        action={`New ${kind.toLowerCase()}`}
        onAction={() => setFormOpen(!formOpen)}
      />
      {kind === 'Invoice' && (
        <>
          <section className="invoice-kpis" aria-label="Invoice totals">
            <article className="blue">
              <span>Total invoices</span>
              <strong>{normalizedItems.length}</strong>
              <small>{projects.length} projects</small>
            </article>
            <article className="amber">
              <span>Total billed</span>
              <strong>{money(invoiceSummary.billed)}</strong>
              <small>All recorded invoices</small>
            </article>
            <article className="green">
              <span>Paid</span>
              <strong>{money(invoiceSummary.paid)}</strong>
              <small>{statusCounts.Paid ?? 0} invoices</small>
            </article>
            <article className="red">
              <span>Pending</span>
              <strong>{money(invoiceSummary.pending)}</strong>
              <small>{(statusCounts.Pending ?? 0) + (statusCounts.Sent ?? 0)} invoices</small>
            </article>
            <article className="purple">
              <span>Overdue</span>
              <strong>{money(invoiceSummary.overdue)}</strong>
              <small>{statusCounts.Overdue ?? 0} invoices</small>
            </article>
          </section>
          <section className="invoice-status-card">
            <div>
              <span>Invoice status</span>
              <strong>{normalizedItems.length}</strong>
              <small>Automatically updated after the 10-day due date.</small>
            </div>
            <div className="invoice-status-bars">
              {[
                ['Paid', paidPercent],
                ['Sent', sentPercent],
                ['Pending', pendingPercent],
                ['Overdue', overduePercent],
              ].map(([label, percent]) => (
                <button key={label} onClick={() => setStatusFilter(String(label))}>
                  <span className={String(label).toLowerCase()} />
                  <b>{label}</b>
                  <i style={{ width: `${Number(percent)}%` }} />
                  <strong>{statusCounts[String(label)] ?? 0}</strong>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {formOpen && (
        <form className="office-form" onSubmit={submit}>
          <label>
            <span>Client *</span>
            <select
              required
              value={draft.clientId}
              onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
            >
              <option value="">Choose client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select
              value={draft.projectId}
              onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Issue date</span>
            <input
              type="date"
              value={draft.issueDate}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  issueDate: e.target.value,
                  dueDate: addDays(e.target.value, 10),
                })
              }
            />
          </label>
          <label>
            <span>Due date</span>
            <input
              type="date"
              value={draft.dueDate}
              readOnly={kind === 'Invoice'}
              onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
            />
            {kind === 'Invoice' ? <small>Automatically set to 10 days after issue.</small> : null}
          </label>
          <label>
            <span>Currency</span>
            <select
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
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
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </label>
          {kind === 'Invoice' && (
            <>
              <label>
                <span>Tax %</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.taxRate}
                  onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })}
                />
              </label>
              <label>
                <span>Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.discount}
                  onChange={(e) => setDraft({ ...draft, discount: e.target.value })}
                />
              </label>
              <label>
                <span>Advance paid</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.advance}
                  onChange={(e) => setDraft({ ...draft, advance: e.target.value })}
                />
              </label>
              <label className="wide">
                <span>Notes</span>
                <input
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
            </>
          )}
          <button className="button button-primary" type="submit">
            <Check size={16} />
            Save {kind.toLowerCase()}
          </button>
        </form>
      )}
      <section className="office-panel sales-document-panel">
        <div className="office-toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={`Search ${kind.toLowerCase()}s`}
          />
          <div className="invoice-filter-chips">
            {(kind === 'Invoice'
              ? ['All', 'Paid', 'Sent', 'Pending', 'Overdue']
              : ['All', 'Draft', 'Sent', 'Accepted', 'Declined']
            ).map((status) => (
              <button
                key={status}
                className={statusFilter === status ? 'active' : ''}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <span>{visible.length} shown</span>
        </div>
        {!visible.length ? (
          <Empty
            icon={<FileText size={25} />}
            title={`No ${kind.toLowerCase()}s yet`}
            text={`Create the first ${kind.toLowerCase()} from the button above.`}
          />
        ) : (
          <div className="office-table-wrap">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Number">
                      <strong>{item.number}</strong>
                    </td>
                    <td data-label="Client">{names.get(item.clientId) ?? 'Unknown client'}</td>
                    <td data-label="Date">{item.issueDate}</td>
                    <td data-label="Due">{item.dueDate}</td>
                    <td data-label="Status">
                      <select
                        className={`office-status ${item.status.toLowerCase()}`}
                        value={item.status}
                        onChange={(e) =>
                          onChange(
                            items.map((x) =>
                              x.id === item.id ? { ...x, status: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        {(kind === 'Invoice'
                          ? ['Pending', 'Sent', 'Paid', 'Overdue']
                          : ['Draft', 'Sent', 'Accepted', 'Declined']
                        ).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Total">
                      <strong>
                        {item.currency} {documentTotal(item).toLocaleString()}
                      </strong>
                      <small>{money(lkr(documentTotal(item), item.exchangeRate))}</small>
                    </td>
                    <td className="office-row-actions" data-label="Actions">
                      <button
                        aria-label={`Preview ${item.number}`}
                        title="Preview"
                        onClick={() => setPreview(item)}
                      >
                        <Eye size={15} />
                      </button>
                      {kind === 'Invoice' && (
                        <button
                          aria-label={`Download ${item.number} PDF`}
                          title="Download PDF"
                          onClick={() =>
                            void downloadInvoicePdf(
                              item,
                              clientDetails.get(item.clientId),
                              projectNames.get(item.projectId) ?? 'Professional services',
                            )
                          }
                        >
                          <FileDown size={15} />
                        </button>
                      )}
                      <button
                        className="local-delete"
                        aria-label={`Delete ${item.number}`}
                        onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {preview && (
        <InvoicePreview
          item={preview}
          client={clientDetails.get(preview.clientId)}
          project={projectNames.get(preview.projectId) ?? 'Professional services'}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

async function imageDataUrl(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Logo unavailable');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function downloadInvoicePdf(
  item: SalesDocument,
  client: ClientRef | undefined,
  project: string,
) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const subtotal = item.amount;
  const tax = subtotal * ((item.taxRate ?? 0) / 100);
  const total = documentTotal(item);
  const currency = (value: number) =>
    `${item.currency} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const clientName = client?.name ?? 'Client';

  pdf.setFillColor(10, 49, 86);
  pdf.rect(0, 0, 210, 44, 'F');
  pdf.setFillColor(255, 105, 45);
  pdf.rect(0, 0, 6, 44, 'F');
  try {
    const logo = await imageDataUrl('/infonits-logo.png');
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(14, 8, 66, 22, 3, 3, 'F');
    pdf.addImage(logo, 'PNG', 18, 12, 58, 13.4);
  } catch {
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text('infonits', 18, 21);
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Digital solutions & creative technology', 18, 36);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('INVOICE', 192, 18, { align: 'right' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(item.number, 192, 27, { align: 'right' });
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(164, 31, 28, 7, 2, 2, 'F');
  pdf.setTextColor(10, 49, 86);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text(item.status.toUpperCase(), 178, 35.5, { align: 'center' });

  pdf.setFillColor(247, 249, 252);
  pdf.roundedRect(18, 54, 82, 43, 3, 3, 'F');
  pdf.roundedRect(110, 54, 82, 43, 3, 3, 'F');
  pdf.setFontSize(8);
  pdf.setTextColor(102, 117, 138);
  pdf.text('FROM', 24, 63);
  pdf.text('BILL TO', 116, 63);
  pdf.setTextColor(31, 47, 68);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Infonits Pvt Ltd.', 24, 72);
  pdf.text(clientName, 116, 72);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(82, 98, 119);
  pdf.text('Jaffna, Sri Lanka', 24, 79);
  pdf.text('hello@infonits.com', 24, 85);
  pdf.text('+94 77 607 9157', 24, 91);
  if (client?.company) pdf.text(client.company, 116, 79);
  if (client?.email) pdf.text(client.email, 116, client.company ? 85 : 79);
  if (client?.phone) pdf.text(client.phone, 116, client.company || client.email ? 91 : 85);

  pdf.setFillColor(237, 244, 252);
  pdf.roundedRect(18, 104, 174, 18, 2, 2, 'F');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 137);
  pdf.text('ISSUE DATE', 24, 111);
  pdf.text('DUE DATE', 82, 111);
  pdf.text('CURRENCY', 140, 111);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(31, 47, 68);
  pdf.setFontSize(9);
  pdf.text(item.issueDate, 24, 117);
  pdf.text(item.dueDate, 82, 117);
  pdf.text(item.currency, 140, 117);

  pdf.setFillColor(10, 49, 86);
  pdf.rect(18, 132, 174, 11, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DESCRIPTION', 23, 139);
  pdf.text('AMOUNT', 187, 139, { align: 'right' });
  pdf.setTextColor(37, 53, 74);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(project, 23, 154, { maxWidth: 112 });
  pdf.text(currency(subtotal), 187, 154, { align: 'right' });
  pdf.setDrawColor(220, 227, 235);
  pdf.line(18, 164, 192, 164);

  const summaryRows = [
    ['Subtotal', currency(subtotal)],
    [`Tax (${item.taxRate ?? 0}%)`, currency(tax)],
    ['Discount', `- ${currency(item.discount ?? 0)}`],
    ['Advance paid', `- ${currency(item.advance ?? 0)}`],
  ];
  pdf.setFontSize(9);
  summaryRows.forEach(([label, value], index) => {
    const y = 176 + index * 8;
    pdf.setTextColor(100, 114, 133);
    pdf.text(label, 128, y);
    pdf.setTextColor(40, 55, 75);
    pdf.text(value, 187, y, { align: 'right' });
  });
  pdf.setFillColor(10, 49, 86);
  pdf.roundedRect(122, 207, 70, 18, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('AMOUNT DUE', 128, 214);
  pdf.setFontSize(13);
  pdf.text(currency(total), 187, 219, { align: 'right' });

  pdf.setTextColor(72, 88, 109);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('NOTES & PAYMENT', 18, 215);
  pdf.setFont('helvetica', 'normal');
  pdf.text(item.notes || 'Payment is due within 10 days of the invoice date.', 18, 223, {
    maxWidth: 92,
  });
  pdf.text(`Use ${item.number} as the payment reference.`, 18, 239, { maxWidth: 92 });
  pdf.setTextColor(111, 125, 143);
  pdf.text(`Recorded LKR value: ${money(lkr(total, item.exchangeRate))}`, 122, 232, {
    maxWidth: 70,
  });

  pdf.setDrawColor(224, 230, 237);
  pdf.line(18, 270, 192, 270);
  pdf.setTextColor(105, 119, 138);
  pdf.text('Thank you for choosing Infonits.', 18, 278);
  pdf.text('infonits.com', 192, 278, { align: 'right' });
  pdf.save(`${item.number}.pdf`);
}

function InvoicePreview({
  item,
  client,
  project,
  onClose,
}: {
  item: SalesDocument;
  client?: ClientRef;
  project: string;
  onClose: () => void;
}) {
  const subtotal = item.amount;
  const tax = subtotal * ((item.taxRate ?? 0) / 100);
  const total = documentTotal(item);
  return (
    <div className="local-modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="local-modal invoice-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-preview-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="local-modal-icon">
              <FileText size={19} />
            </span>
            <div>
              <h2 id="invoice-preview-title">Invoice preview</h2>
              <p>Review the document before downloading.</p>
            </div>
          </div>
          <button aria-label="Close invoice preview" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="invoice-paper">
          <div className="invoice-brand">
            <div>
              <span className="invoice-logo-panel">
                <img src="/infonits-logo.png" alt="Infonits" />
              </span>
              <small>
                Digital solutions & creative technology
                <br />
                Jaffna, Sri Lanka · hello@infonits.com · +94 77 607 9157
              </small>
            </div>
            <div className="invoice-brand-title">
              <span>INVOICE</span>
              <small>
                {item.number} · {item.status}
              </small>
            </div>
          </div>
          <div className="invoice-meta">
            <div className="invoice-meta-card">
              <span>Invoice</span>
              <strong>{item.number}</strong>
              <span>Issue date</span>
              <strong>{item.issueDate}</strong>
              <span>Due date</span>
              <strong>{item.dueDate}</strong>
            </div>
            <div className="invoice-bill-card">
              <span>Bill to</span>
              <strong>{client?.name ?? 'Client'}</strong>
              {client?.company ? <small>{client.company}</small> : null}
              {client?.email ? <small>{client.email}</small> : null}
              {client?.phone ? <small>{client.phone}</small> : null}
            </div>
          </div>
          <div className="invoice-line">
            <strong>Description</strong>
            <strong>Amount</strong>
            <span>{project}</span>
            <span>
              {item.currency} {subtotal.toLocaleString()}
            </span>
          </div>
          <div className="invoice-summary-row">
            <div className="invoice-notes">
              <strong>Notes & payment</strong>
              <p>{item.notes || 'Payment is due within 10 days of the invoice date.'}</p>
              <p>Use {item.number} as the payment reference.</p>
            </div>
            <div className="invoice-total">
              <span>Subtotal</span>
              <b>
                {item.currency} {subtotal.toLocaleString()}
              </b>
              <span>Tax ({item.taxRate ?? 0}%)</span>
              <b>
                {item.currency} {tax.toLocaleString()}
              </b>
              <span>Discount</span>
              <b>
                {item.currency} {(item.discount ?? 0).toLocaleString()}
              </b>
              <span>Advance paid</span>
              <b>
                {item.currency} {(item.advance ?? 0).toLocaleString()}
              </b>
              <span className="grand">Amount due</span>
              <strong>
                {item.currency} {total.toLocaleString()}
              </strong>
              <small>{money(lkr(total, item.exchangeRate))} at recorded exchange rate</small>
            </div>
          </div>
          <p>Thank you for choosing Infonits.</p>
        </div>
        <footer className="invoice-preview-actions">
          <button className="button button-outline" onClick={onClose}>
            Close
          </button>
          <button
            className="button button-primary"
            onClick={() => void downloadInvoicePdf(item, client, project)}
          >
            <FileDown size={16} />
            Download PDF
          </button>
        </footer>
      </section>
    </div>
  );
}

function PaymentsModule({
  items,
  rates,
  formOpen,
  setFormOpen,
  onChange,
}: {
  items: Payment[];
  rates: Record<string, number>;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: Payment[]) => void;
}) {
  const [draft, setDraft] = useState({
    type: 'Income' as Payment['type'],
    category: 'Project',
    note: '',
    amount: '',
    currency: 'LKR',
    date: today(),
    status: 'Paid' as Payment['status'],
  });
  const totals = useMemo(
    () =>
      items.reduce(
        (sum, item) => {
          const value = lkr(item.amount, item.exchangeRate);
          if (item.status === 'Pending') return { ...sum, pending: sum.pending + value };
          if (item.type === 'Income') return { ...sum, income: sum.income + value };
          if (item.type === 'Expense') return { ...sum, expense: sum.expense + value };
          if (item.type === 'Loan') return { ...sum, loan: sum.loan + value };
          return { ...sum, assets: sum.assets + value };
        },
        { income: 0, expense: 0, assets: 0, loan: 0, pending: 0 },
      ),
    [items],
  );
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.note.trim() || amount <= 0) return;
    onChange([
      {
        id: crypto.randomUUID(),
        ...draft,
        note: draft.note.trim(),
        amount,
        exchangeRate: draft.currency === 'LKR' ? 1 : (rates[draft.currency] ?? 1),
      },
      ...items,
    ]);
    setDraft({
      type: 'Income',
      category: 'Project',
      note: '',
      amount: '',
      currency: 'LKR',
      date: today(),
      status: 'Paid',
    });
    setFormOpen(false);
  }
  return (
    <>
      <ModuleHeader
        eyebrow="FINANCE"
        title="Payments"
        subtitle="See income, expenses, savings, gold and loans in one ledger."
        action="Add record"
        onAction={() => setFormOpen(!formOpen)}
      />
      <section className="office-metrics">
        <Metric label="Income" value={totals.income} tone="green" />
        <Metric label="Expenses" value={totals.expense} tone="red" />
        <Metric label="Savings & gold" value={totals.assets} tone="blue" />
        <Metric label="Pending" value={totals.pending} tone="amber" />
      </section>
      {formOpen && (
        <form className="office-form" onSubmit={submit}>
          <label>
            <span>Type</span>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as Payment['type'] })}
            >
              {['Income', 'Expense', 'Saving', 'Gold', 'Loan'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>Note *</span>
            <input
              required
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          <label>
            <span>Currency</span>
            <select
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
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
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </label>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Payment['status'] })}
            >
              <option>Paid</option>
              <option>Pending</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            <Check size={16} />
            Save record
          </button>
        </form>
      )}
      <section className="office-panel">
        {!items.length ? (
          <Empty
            icon={<CircleDollarSign size={25} />}
            title="No payment records"
            text="Add income, expense or asset records here."
          />
        ) : (
          <div className="office-table-wrap">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>
                      <span className={`office-pill ${item.type.toLowerCase()}`}>{item.type}</span>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.note}</td>
                    <td>
                      <button
                        className={`office-status-button ${item.status.toLowerCase()}`}
                        onClick={() =>
                          onChange(
                            items.map((x) =>
                              x.id === item.id
                                ? { ...x, status: x.status === 'Paid' ? 'Pending' : 'Paid' }
                                : x,
                            ),
                          )
                        }
                      >
                        {item.status}
                      </button>
                    </td>
                    <td className={item.type === 'Income' ? 'office-positive' : 'office-negative'}>
                      <strong>
                        {item.type === 'Income' ? '+' : '−'}
                        {money(lkr(item.amount, item.exchangeRate))}
                      </strong>
                      <small>
                        {item.currency} {item.amount.toLocaleString()}
                      </small>
                    </td>
                    <td>
                      <button
                        className="local-delete"
                        aria-label="Delete record"
                        onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function TeamModule({
  items,
  search,
  setSearch,
  formOpen,
  setFormOpen,
  onChange,
}: {
  items: TeamMember[];
  search: string;
  setSearch: (v: string) => void;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: TeamMember[]) => void;
}) {
  const [draft, setDraft] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    employment: 'Full-time',
  });
  const visible = items.filter((x) =>
    `${x.name} ${x.role}`.toLowerCase().includes(search.toLowerCase()),
  );
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.role.trim()) return;
    onChange([{ id: crypto.randomUUID(), ...draft, status: 'Active' }, ...items]);
    setDraft({ name: '', role: '', email: '', phone: '', employment: 'Full-time' });
    setFormOpen(false);
  }
  return (
    <>
      <ModuleHeader
        eyebrow="PEOPLE"
        title="Team"
        subtitle="Keep roles, contacts and availability easy to scan."
        action="Add member"
        onAction={() => setFormOpen(!formOpen)}
      />
      {formOpen && (
        <form className="office-form" onSubmit={submit}>
          {(['name', 'role', 'email', 'phone'] as const).map((k) => (
            <label key={k}>
              <span>
                {k[0].toUpperCase() + k.slice(1)}
                {k === 'name' || k === 'role' ? ' *' : ''}
              </span>
              <input
                required={k === 'name' || k === 'role'}
                type={k === 'email' ? 'email' : 'text'}
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
          <label>
            <span>Employment</span>
            <select
              value={draft.employment}
              onChange={(e) => setDraft({ ...draft, employment: e.target.value })}
            >
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Freelance</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            <Check size={16} />
            Save member
          </button>
        </form>
      )}
      <section className="office-panel">
        <div className="office-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search team" />
          <span>{items.filter((x) => x.status === 'Active').length} active</span>
        </div>
        {!visible.length ? (
          <Empty
            icon={<UsersRound size={25} />}
            title="No team members"
            text="Add people to assign project and post work."
          />
        ) : (
          <div className="office-card-grid">
            {visible.map((item) => (
              <article className="office-person" key={item.id}>
                <span className="office-avatar">{item.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.role} · {item.employment}
                  </p>
                  <small>{item.email || item.phone || 'No contact added'}</small>
                </div>
                <button
                  className={`office-status-button ${item.status.toLowerCase()}`}
                  onClick={() =>
                    onChange(
                      items.map((x) =>
                        x.id === item.id
                          ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' }
                          : x,
                      ),
                    )
                  }
                >
                  {item.status}
                </button>
                <button
                  className="local-delete"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function PostsModule({
  items,
  events,
  renewals,
  clients,
  projects,
  team,
  formOpen,
  setFormOpen,
  onChange,
  onEventsChange,
}: {
  items: PostPlan[];
  events: CalendarEvent[];
  renewals: Renewal[];
  clients: ClientRef[];
  projects: ProjectRef[];
  team: TeamMember[];
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: PostPlan[]) => void;
  onEventsChange: (v: CalendarEvent[]) => void;
}) {
  const [draft, setDraft] = useState({
    clientId: '',
    projectId: '',
    platform: 'Instagram',
    month: thisMonth(),
    required: '12',
    memberId: '',
  });
  const [calendarMonth, setCalendarMonth] = useState(thisMonth());
  const [eventDate, setEventDate] = useState<string | null>(null);
  const names = new Map(clients.map((client) => [client.id, client.name]));
  const projectNames = new Map(projects.map((project) => [project.id, project.project]));
  const members = new Map(team.map((member) => [member.id, member.name]));
  const monthPlans = items.filter((item) => item.month === calendarMonth);
  const postEvents = events.filter(
    (event) => event.type === 'Post' && event.date.startsWith(calendarMonth),
  );
  const postCalendarEvents: CalendarEvent[] = [
    ...events,
    ...renewals
      .flatMap((renewal) => [
        {
          id: `post-domain-${renewal.id}`,
          title: `${renewal.website} domain`,
          date: renewal.domainDue,
          type: 'Renewal',
        },
        {
          id: `post-hosting-${renewal.id}`,
          title: `${renewal.website} hosting`,
          date: renewal.hostingDue,
          type: 'Renewal',
        },
      ])
      .filter((event) => event.date),
  ].filter((event) => event.date.startsWith(calendarMonth));
  const required = monthPlans.reduce((sum, item) => sum + item.required, 0);
  const recordedPosts = postEvents.reduce((sum, event) => sum + (event.count ?? 1), 0);
  const legacyPosted = monthPlans.reduce((sum, item) => sum + item.posted, 0);
  const posted = Math.max(recordedPosts, legacyPosted);
  const remaining = Math.max(0, required - posted);
  const [, selectedMonth] = calendarMonth.split('-').map(Number);
  const selectedYear = Number(calendarMonth.slice(0, 4));
  const selectedDays = new Date(selectedYear, selectedMonth, 0).getDate();
  const elapsedRatio =
    calendarMonth < thisMonth()
      ? 1
      : calendarMonth > thisMonth()
        ? 0
        : Math.min(1, new Date().getDate() / selectedDays);
  const expected = monthPlans.reduce(
    (sum, item) => sum + Math.floor(item.required * elapsedRatio),
    0,
  );
  const missed = Math.max(0, expected - posted);
  const activeProjects = projects.length;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const planRequired = Number(draft.required);
    if (!draft.clientId || planRequired <= 0) return;
    onChange([{ id: crypto.randomUUID(), ...draft, required: planRequired, posted: 0 }, ...items]);
    setCalendarMonth(draft.month);
    setFormOpen(false);
  }

  const defaultUpdateDate = calendarMonth === thisMonth() ? today() : `${calendarMonth}-01`;

  return (
    <>
      <ModuleHeader
        eyebrow="DELIVERY"
        title="Post tracker"
        subtitle="Plan monthly content, assign work and record every posted update."
        action="Add post plan"
        onAction={() => setFormOpen(!formOpen)}
      >
        <input
          className="office-month"
          type="month"
          value={calendarMonth}
          onChange={(event) => setCalendarMonth(event.target.value)}
          aria-label="Post tracker month"
        />
        <button className="button button-outline" onClick={() => setEventDate(defaultUpdateDate)}>
          <Plus size={16} /> Add posted update
        </button>
      </ModuleHeader>

      <section className="office-post-summary" aria-label="Post tracker totals">
        <article className="blue">
          <span>
            <Folder size={20} />
          </span>
          <div>
            <small>Active projects</small>
            <strong>{activeProjects}</strong>
          </div>
        </article>
        <article className="purple">
          <span>
            <Send size={20} />
          </span>
          <div>
            <small>Posted this month</small>
            <strong>{posted}</strong>
          </div>
        </article>
        <article className="orange">
          <span>
            <FileText size={20} />
          </span>
          <div>
            <small>Remaining posts</small>
            <strong>{remaining}</strong>
          </div>
        </article>
        <article className="red">
          <span>
            <AlertTriangle size={20} />
          </span>
          <div>
            <small>Missed posts</small>
            <strong>{missed}</strong>
          </div>
        </article>
      </section>

      {formOpen && (
        <form className="office-form office-plan-form" onSubmit={submit}>
          <label>
            <span>Client *</span>
            <select
              required
              value={draft.clientId}
              onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
            >
              <option value="">Choose client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select
              value={draft.projectId}
              onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Platform</span>
            <select
              value={draft.platform}
              onChange={(event) => setDraft({ ...draft, platform: event.target.value })}
            >
              <option>Instagram</option>
              <option>Facebook</option>
              <option>LinkedIn</option>
              <option>TikTok</option>
              <option>YouTube</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            <span>Month</span>
            <input
              type="month"
              value={draft.month}
              onChange={(event) => setDraft({ ...draft, month: event.target.value })}
            />
          </label>
          <label>
            <span>Required posts</span>
            <input
              type="number"
              min="1"
              value={draft.required}
              onChange={(event) => setDraft({ ...draft, required: event.target.value })}
            />
          </label>
          <label>
            <span>Assign to</span>
            <select
              value={draft.memberId}
              onChange={(event) => setDraft({ ...draft, memberId: event.target.value })}
            >
              <option value="">Unassigned</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" type="submit">
            <Check size={16} /> Save plan
          </button>
        </form>
      )}

      <section className="office-post-workspace">
        <article className="office-post-projects">
          <header>
            <div>
              <h2>Projects</h2>
              <p>Team, platforms and monthly count</p>
            </div>
          </header>
          {!items.length ? (
            <Empty
              icon={<Folder size={24} />}
              title="No post plans"
              text="Add a monthly target for a client project."
            />
          ) : (
            <div className="office-table-wrap">
              <table className="office-table office-post-project-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Project</th>
                    <th>Platform</th>
                    <th>Team</th>
                    <th>This month</th>
                    <th>Remaining</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const tracked = item.month === calendarMonth;
                    const eventCount = postEvents
                      .filter(
                        (event) =>
                          event.clientId === item.clientId &&
                          (!event.projectId || event.projectId === item.projectId),
                      )
                      .reduce((sum, event) => sum + (event.count ?? 1), 0);
                    const postedCount = Math.max(item.posted, eventCount);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{names.get(item.clientId) || 'Unknown'}</strong>
                        </td>
                        <td>{projectNames.get(item.projectId) || 'No project'}</td>
                        <td>
                          <span className="office-pill">{item.platform}</span>
                        </td>
                        <td>
                          <select
                            className="office-inline-select"
                            value={item.memberId}
                            onChange={(event) =>
                              onChange(
                                items.map((plan) =>
                                  plan.id === item.id
                                    ? { ...plan, memberId: event.target.value }
                                    : plan,
                                ),
                              )
                            }
                          >
                            <option value="">Not assigned</option>
                            {team.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {tracked ? (
                            `${postedCount} / ${item.required}`
                          ) : (
                            <small>Not tracked</small>
                          )}
                        </td>
                        <td>
                          <strong>
                            {tracked ? Math.max(0, item.required - postedCount) : '—'}
                          </strong>
                        </td>
                        <td>
                          <button
                            className="local-delete"
                            aria-label="Delete post plan"
                            onClick={() => onChange(items.filter((plan) => plan.id !== item.id))}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="office-post-calendar compact" aria-label="Post calendar">
          <header>
            <div>
              <CalendarDays size={20} />
              <span>
                <strong>Post calendar</strong>
                <small>Posted updates and events</small>
              </span>
            </div>
          </header>
          <MonthCalendar
            month={calendarMonth}
            events={postCalendarEvents}
            onDateClick={setEventDate}
            compact
          />
        </article>
      </section>

      <section className="office-post-records">
        <header>
          <div>
            <h2>Posted records</h2>
            <p>
              {postEvents.length
                ? `${postEvents.length} updates this month`
                : 'No posted records for this month'}
            </p>
          </div>
        </header>
        <div className="office-table-wrap">
          <table className="office-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Date</th>
                <th>Client</th>
                <th>Project</th>
                <th>Platform</th>
                <th>Count</th>
                <th>Remarks</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!postEvents.length ? (
                <tr>
                  <td colSpan={8} className="office-table-empty">
                    Click a calendar date to add the first posted update.
                  </td>
                </tr>
              ) : (
                postEvents.map((event, index) => (
                  <tr key={event.id}>
                    <td>{String(index + 1).padStart(2, '0')}</td>
                    <td>{event.date}</td>
                    <td>
                      <strong>{names.get(event.clientId || '') || '—'}</strong>
                    </td>
                    <td>{projectNames.get(event.projectId || '') || '—'}</td>
                    <td>{event.platform || '—'}</td>
                    <td>{event.count ?? 1}</td>
                    <td>{event.remarks || event.title}</td>
                    <td>
                      <button
                        className="local-delete"
                        aria-label={`Delete ${event.title}`}
                        onClick={() =>
                          onEventsChange(events.filter((item) => item.id !== event.id))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {eventDate && (
        <CalendarEventModal
          key={eventDate}
          initialDate={eventDate}
          postMode
          clients={clients}
          projects={projects}
          onClose={() => setEventDate(null)}
          onSave={(event) => {
            onEventsChange([...events, { id: crypto.randomUUID(), ...event }]);
            setEventDate(null);
          }}
        />
      )}
    </>
  );
}

function RenewalsModule({
  items,
  formOpen,
  setFormOpen,
  onChange,
}: {
  items: Renewal[];
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: Renewal[]) => void;
}) {
  const [draft, setDraft] = useState({
    website: '',
    username: '',
    websiteUrl: '',
    domainDue: '',
    hostingDue: '',
  });
  const soon = items.filter((x) =>
    [x.domainDue, x.hostingDue].some(
      (d) =>
        d &&
        new Date(d).getTime() - Date.now() < 31 * 86400000 &&
        new Date(d).getTime() >= Date.now(),
    ),
  ).length;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.website.trim()) return;
    onChange([{ id: crypto.randomUUID(), ...draft, website: draft.website.trim() }, ...items]);
    setDraft({ website: '', username: '', websiteUrl: '', domainDue: '', hostingDue: '' });
    setFormOpen(false);
  }
  return (
    <>
      <ModuleHeader
        eyebrow="ADMIN"
        title="Renewals"
        subtitle="Keep website, domain and hosting dates visible. Passwords are not stored in browser mode."
        action="Add renewal"
        onAction={() => setFormOpen(!formOpen)}
      >
        <span className="office-due-chip">{soon} due soon</span>
      </ModuleHeader>
      {formOpen && (
        <form className="office-form" onSubmit={submit}>
          <label>
            <span>Website *</span>
            <input
              required
              value={draft.website}
              onChange={(e) => setDraft({ ...draft, website: e.target.value })}
            />
          </label>
          <label>
            <span>Username</span>
            <input
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>Website URL</span>
            <input
              type="url"
              value={draft.websiteUrl}
              onChange={(e) => setDraft({ ...draft, websiteUrl: e.target.value })}
            />
          </label>
          <label>
            <span>Domain renewal</span>
            <input
              type="date"
              value={draft.domainDue}
              onChange={(e) => setDraft({ ...draft, domainDue: e.target.value })}
            />
          </label>
          <label>
            <span>Hosting renewal</span>
            <input
              type="date"
              value={draft.hostingDue}
              onChange={(e) => setDraft({ ...draft, hostingDue: e.target.value })}
            />
          </label>
          <button className="button button-primary" type="submit">
            <Check size={16} />
            Save renewal
          </button>
        </form>
      )}
      <section className="office-panel">
        {!items.length ? (
          <Empty
            icon={<Globe2 size={25} />}
            title="No renewals saved"
            text="Add domain and hosting dates to get a clear reminder."
          />
        ) : (
          <div className="office-table-wrap">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Website</th>
                  <th>Login</th>
                  <th>Domain</th>
                  <th>Hosting</th>
                  <th>Link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.website}</strong>
                    </td>
                    <td>{item.username || '—'}</td>
                    <td>{item.domainDue || '—'}</td>
                    <td>{item.hostingDue || '—'}</td>
                    <td>
                      {item.websiteUrl ? (
                        <a
                          className="office-link"
                          href={item.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open site
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        className="local-delete"
                        aria-label={`Delete ${item.website}`}
                        onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function LettersModule({
  items,
  formOpen,
  setFormOpen,
  onChange,
}: {
  items: ServiceLetter[];
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: ServiceLetter[]) => void;
}) {
  const [draft, setDraft] = useState({
    date: today(),
    client: '',
    subject: '',
    preparedBy: '',
    body: '',
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.client.trim() || !draft.subject.trim()) return;
    onChange([{ id: crypto.randomUUID(), ...draft }, ...items]);
    setFormOpen(false);
  }
  function printLetter(item: ServiceLetter) {
    const popup = window.open('', '_blank', 'width=800,height=900');
    if (!popup) return;
    popup.document.write(
      `<html><head><title>${escapeHtml(item.subject)}</title><style>body{font-family:Arial;padding:70px;line-height:1.7;color:#172033}h1{color:#0d4070;font-size:24px}small{color:#667}</style></head><body><h1>Infonits</h1><small>${escapeHtml(item.date)}</small><h2>${escapeHtml(item.subject)}</h2><p>To: ${escapeHtml(item.client)}</p><p>${escapeHtml(item.body).replaceAll('\n', '<br>')}</p><br><p>Prepared by<br><strong>${escapeHtml(item.preparedBy)}</strong></p></body></html>`,
    );
    popup.document.close();
    popup.print();
  }
  return (
    <>
      <ModuleHeader
        eyebrow="ADMIN"
        title="Documents"
        subtitle="Create and print simple service letters from one place."
        action="New service letter"
        onAction={() => setFormOpen(!formOpen)}
      />
      {formOpen && (
        <form className="office-form letter-form" onSubmit={submit}>
          <label>
            <span>Date</span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label>
            <span>Client *</span>
            <input
              required
              value={draft.client}
              onChange={(e) => setDraft({ ...draft, client: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>Subject *</span>
            <input
              required
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </label>
          <label className="wide">
            <span>Letter</span>
            <textarea
              rows={5}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <label>
            <span>Prepared by</span>
            <input
              value={draft.preparedBy}
              onChange={(e) => setDraft({ ...draft, preparedBy: e.target.value })}
            />
          </label>
          <button className="button button-primary" type="submit">
            <Check size={16} />
            Save letter
          </button>
        </form>
      )}
      <section className="office-panel">
        {!items.length ? (
          <Empty
            icon={<FileText size={25} />}
            title="No documents"
            text="Create your first service letter."
          />
        ) : (
          <div className="office-table-wrap">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Subject</th>
                  <th>Prepared by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.client}</td>
                    <td>
                      <strong>{item.subject}</strong>
                    </td>
                    <td>{item.preparedBy || '—'}</td>
                    <td className="office-row-actions">
                      <button aria-label="Print letter" onClick={() => printLetter(item)}>
                        <Printer size={16} />
                      </button>
                      <button
                        className="local-delete"
                        aria-label="Delete letter"
                        onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function UsersModule({
  items,
  formOpen,
  setFormOpen,
  onChange,
}: {
  items: WorkspaceUser[];
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: WorkspaceUser[]) => void;
}) {
  const [draft, setDraft] = useState({
    name: '',
    username: '',
    role: 'Project manager',
    access: 'Projects, clients and sales',
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.username.trim()) return;
    onChange([...items, { id: crypto.randomUUID(), ...draft, status: 'Active' }]);
    setFormOpen(false);
  }
  return (
    <>
      <ModuleHeader
        eyebrow="ACCESS"
        title="Users & roles"
        subtitle="Plan user access before connecting secure Supabase accounts."
        action="Add user"
        onAction={() => setFormOpen(!formOpen)}
      />
      {formOpen && (
        <form className="office-form" onSubmit={submit}>
          <label>
            <span>Name *</span>
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            <span>Username *</span>
            <input
              required
              value={draft.username}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            >
              <option>Admin</option>
              <option>Project manager</option>
              <option>Designer</option>
              <option>Developer</option>
              <option>Finance</option>
            </select>
          </label>
          <label className="wide">
            <span>Access</span>
            <input
              value={draft.access}
              onChange={(e) => setDraft({ ...draft, access: e.target.value })}
            />
          </label>
          <button className="button button-primary" type="submit">
            <Check size={16} />
            Save user
          </button>
        </form>
      )}
      <section className="office-panel">
        <div className="office-card-grid">
          {items.map((item) => (
            <article className="office-person" key={item.id}>
              <span className="office-avatar">
                <UserRound size={18} />
              </span>
              <div>
                <h3>{item.name}</h3>
                <p>
                  @{item.username} · {item.role}
                </p>
                <small>{item.access}</small>
              </div>
              <button
                className={`office-status-button ${item.status.toLowerCase()}`}
                onClick={() =>
                  onChange(
                    items.map((x) =>
                      x.id === item.id
                        ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' }
                        : x,
                    ),
                  )
                }
              >
                {item.status}
              </button>
              {item.id !== 'local-admin' && (
                <button
                  className="local-delete"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </article>
          ))}
        </div>
        <p className="office-security-note">
          <ShieldCheck size={16} /> Passwords and authentication remain in Supabase. This page
          stores role planning only.
        </p>
      </section>
    </>
  );
}

function CalendarModule({
  items,
  documents,
  renewals,
  formOpen,
  setFormOpen,
  onChange,
}: {
  items: CalendarEvent[];
  documents: SalesDocument[];
  renewals: Renewal[];
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: CalendarEvent[]) => void;
}) {
  const [month, setMonth] = useState(thisMonth());
  const [eventDate, setEventDate] = useState<string | null>(null);
  const derived: CalendarEvent[] = [
    ...items,
    ...documents
      .filter((document) => document.dueDate)
      .map((document) => ({
        id: `doc-${document.id}`,
        title: `${document.number} due`,
        date: document.dueDate,
        type: document.kind,
      })),
    ...renewals
      .flatMap((renewal) => [
        {
          id: `domain-${renewal.id}`,
          title: `${renewal.website} domain`,
          date: renewal.domainDue,
          type: 'Renewal',
        },
        {
          id: `hosting-${renewal.id}`,
          title: `${renewal.website} hosting`,
          date: renewal.hostingDue,
          type: 'Renewal',
        },
      ])
      .filter((event) => event.date),
  ].filter((event) => event.date.startsWith(month));
  const defaultDate = month === thisMonth() ? today() : `${month}-01`;

  useEffect(() => {
    if (formOpen && !eventDate) setEventDate(defaultDate);
  }, [defaultDate, eventDate, formOpen]);

  return (
    <>
      <ModuleHeader
        eyebrow="SCHEDULE"
        title="Calendar"
        subtitle="Invoices, renewals, posts and custom events in one monthly view."
        action="Add event"
        onAction={() => {
          setEventDate(defaultDate);
          setFormOpen(true);
        }}
      >
        <input
          className="office-month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-label="Calendar month"
        />
      </ModuleHeader>
      <section className="office-main-calendar">
        <header>
          <div>
            <h2>
              {new Date(`${month}-01T00:00:00`).toLocaleDateString('en', {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <p>Click any date to add an event.</p>
          </div>
          <div className="office-calendar-legend" aria-label="Calendar event types">
            <span className="post">Posts</span>
            <span className="invoice">Invoices</span>
            <span className="renewal">Renewals</span>
            <span className="task">Events</span>
          </div>
        </header>
        <MonthCalendar
          month={month}
          events={derived}
          onDateClick={(date) => {
            setEventDate(date);
            setFormOpen(true);
          }}
        />
      </section>
      {formOpen && eventDate && (
        <CalendarEventModal
          key={eventDate}
          initialDate={eventDate}
          onClose={() => {
            setFormOpen(false);
            setEventDate(null);
          }}
          onSave={(event) => {
            onChange([...items, { id: crypto.randomUUID(), ...event }]);
            setFormOpen(false);
            setEventDate(null);
          }}
        />
      )}
    </>
  );
}

function ReportsModule({
  documents,
  payments,
  posts,
  projects,
  clients,
}: {
  documents: SalesDocument[];
  payments: Payment[];
  posts: PostPlan[];
  projects: ProjectRef[];
  clients: ClientRef[];
}) {
  const paidInvoices = documents
    .filter((x) => x.kind === 'Invoice' && x.status === 'Paid')
    .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0);
  const income = payments
    .filter((x) => x.type === 'Income' && x.status === 'Paid')
    .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0);
  const expenses = payments
    .filter((x) => x.type === 'Expense' && x.status === 'Paid')
    .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0);
  const projectValue = projects.reduce((s, x) => s + lkr(x.value, x.exchangeRate), 0);
  const projectCost = projects.reduce((s, x) => s + x.workDue + x.workPaid, 0);
  const required = posts.reduce((s, x) => s + x.required, 0);
  const posted = posts.reduce((s, x) => s + x.posted, 0);
  function download() {
    const rows = [
      ['Metric', 'Value'],
      ['Paid invoice income', paidInvoices],
      ['Other paid income', income],
      ['Paid expenses', expenses],
      ['Project value', projectValue],
      ['Project profit', projectValue - projectCost],
      ['Clients', clients.length],
      ['Required posts', required],
      ['Posted posts', posted],
    ];
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `infonits-report-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <ModuleHeader
        eyebrow="INSIGHTS"
        title="Reports"
        subtitle="A simple live summary built from this browser workspace."
      >
        <button className="button button-outline" onClick={download}>
          <Download size={16} />
          Download CSV
        </button>
        <button className="button button-primary" onClick={() => window.print()}>
          <Printer size={16} />
          Print report
        </button>
      </ModuleHeader>
      <section className="office-metrics">
        <Metric label="Paid income" value={paidInvoices + income} tone="green" />
        <Metric label="Paid expenses" value={expenses} tone="red" />
        <Metric label="Net balance" value={paidInvoices + income - expenses} tone="blue" />
        <Metric label="Project profit" value={projectValue - projectCost} tone="amber" />
      </section>
      <section className="office-report-grid">
        <ReportCard
          title="Sales summary"
          lines={[
            [`${documents.filter((x) => x.kind === 'Invoice').length} invoices`, paidInvoices],
            [
              `${documents.filter((x) => x.kind === 'Quotation').length} quotations`,
              documents
                .filter((x) => x.kind === 'Quotation')
                .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0),
            ],
            [`${clients.length} clients`, projectValue],
          ]}
        />
        <ReportCard
          title="Project summary"
          lines={[
            [`${projects.length} projects`, projectValue],
            ['Work cost', projectCost],
            ['Estimated profit', projectValue - projectCost],
          ]}
        />
        <ReportCard
          title="Post tracker"
          lines={[
            [`${posts.length} client plans`, required],
            ['Posted', posted],
            ['Remaining', Math.max(0, required - posted)],
          ]}
        />
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  tone = '',
  raw = false,
}: {
  label: string;
  value: number;
  tone?: string;
  raw?: boolean;
}) {
  return (
    <article className={`office-metric ${tone}`}>
      <span>{label}</span>
      <strong>{raw ? value.toLocaleString() : money(value)}</strong>
    </article>
  );
}
function ReportCard({ title, lines }: { title: string; lines: Array<[string, number]> }) {
  return (
    <article className="office-report-card">
      <h2>{title}</h2>
      {lines.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>
            {Number.isInteger(value) && value < 1000 ? value.toLocaleString() : money(value)}
          </strong>
        </div>
      ))}
    </article>
  );
}
