'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  Download,
  Eye,
  FileDown,
  FileText,
  Folder,
  Globe2,
  KeyRound,
  LogOut,
  Mail,
  MoreVertical,
  Music2,
  Pencil,
  PieChart,
  Plus,
  Printer,
  Repeat2,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  ThumbsUp,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { isSixDigitPin, pinCredential } from '@/lib/auth';
import { browserClient } from '@/lib/supabase/browser';

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
type OperatingExpense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  date: string;
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
  description?: string;
  notes?: string;
  includeBankDetails?: boolean;
  bankDetails?: string;
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
  invoiceId?: string;
  projectId?: string;
  receiptNumber?: string;
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
  domainLogin?: string;
  serverLogin?: string;
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
type RecurringInvoice = {
  id: string;
  clientId: string;
  projectId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  frequency: 'Monthly' | 'Quarterly' | 'Yearly';
  nextRun: string;
  description: string;
  active: boolean;
  lastGenerated?: string;
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
  recurringInvoices: RecurringInvoice[];
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
const paidForInvoice = (invoiceId: string, payments: Payment[]) =>
  payments
    .filter(
      (payment) =>
        payment.invoiceId === invoiceId && payment.type === 'Income' && payment.status === 'Paid',
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
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
  recurringInvoices: [],
};

const advanceRecurringDate = (date: string, frequency: RecurringInvoice['frequency']) => {
  const value = new Date(`${date}T00:00:00Z`);
  if (frequency === 'Yearly') value.setUTCFullYear(value.getUTCFullYear() + 1);
  else value.setUTCMonth(value.getUTCMonth() + (frequency === 'Quarterly' ? 3 : 1));
  return value.toISOString().slice(0, 10);
};

const money = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(value);
const compactMoney = (value: number) =>
  `LKR ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
const lkr = (amount: number, rate: number) => amount * rate;
const clientLabel = (client: ClientRef) => client.company.trim() || client.name;
const socialPlatform = (platform: string) => {
  const normalized = platform.toLowerCase();
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'tiktok') return 'TikTok';
  return 'Instagram';
};
const platformIcon = (platform: string) => {
  const iconProps = { size: 16, strokeWidth: 2 };
  switch (socialPlatform(platform)) {
    case 'Instagram':
      return <Camera {...iconProps} />;
    case 'Facebook':
      return <ThumbsUp {...iconProps} />;
    case 'TikTok':
      return <Music2 {...iconProps} />;
    default:
      return <Camera {...iconProps} />;
  }
};
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
  expenses,
  rates,
  invoiceDefaults,
  openFormSignal = 0,
  preview = false,
}: {
  section: OfficeSection;
  clients: ClientRef[];
  projects: ProjectRef[];
  expenses: OperatingExpense[];
  rates: Record<string, number>;
  invoiceDefaults?: { includeBankDetails: boolean; bankDetails: string; notes: string };
  openFormSignal?: number;
  preview?: boolean;
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
          posts: (savedStore.posts ?? []).map((item) => ({
            ...item,
            platform: socialPlatform(item.platform),
          })),
          recurringInvoices: savedStore.recurringInvoices ?? [],
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
    if (!loaded) return;
    setStore((current) => {
      const due = current.recurringInvoices.filter(
        (schedule) =>
          schedule.active &&
          schedule.nextRun <= today() &&
          schedule.lastGenerated !== schedule.nextRun,
      );
      if (!due.length) return current;
      let documents = [...current.documents];
      const recurringInvoices = current.recurringInvoices.map((schedule) => {
        if (!due.some((item) => item.id === schedule.id)) return schedule;
        const runDate = schedule.nextRun;
        documents = [
          {
            id: crypto.randomUUID(),
            kind: 'Invoice',
            number: nextNumber('Invoice', documents),
            clientId: schedule.clientId,
            projectId: schedule.projectId,
            issueDate: runDate,
            dueDate: addDays(runDate, 10),
            amount: schedule.amount,
            currency: schedule.currency,
            exchangeRate: schedule.exchangeRate,
            status: 'Pending',
            description: schedule.description,
            notes: invoiceDefaults?.notes ?? '',
            includeBankDetails: invoiceDefaults?.includeBankDetails ?? false,
            bankDetails: invoiceDefaults?.includeBankDetails
              ? (invoiceDefaults.bankDetails ?? '')
              : '',
          },
          ...documents,
        ];
        let nextRun = advanceRecurringDate(runDate, schedule.frequency);
        while (nextRun <= today()) nextRun = advanceRecurringDate(nextRun, schedule.frequency);
        return { ...schedule, lastGenerated: runDate, nextRun };
      });
      return { ...current, documents, recurringInvoices };
    });
  }, [
    invoiceDefaults?.bankDetails,
    invoiceDefaults?.includeBankDetails,
    invoiceDefaults?.notes,
    loaded,
  ]);

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
        invoiceDefaults={invoiceDefaults}
        payments={store.payments}
        recurringInvoices={store.recurringInvoices}
        search={search}
        setSearch={setSearch}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) =>
          update('documents', [...store.documents.filter((item) => item.kind !== kind), ...items])
        }
        onPaymentsChange={(items) => update('payments', items)}
        onRecurringChange={(items) => update('recurringInvoices', items)}
      />
    );
  }
  if (section === 'payments')
    return (
      <PaymentsModule
        items={store.payments}
        documents={store.documents}
        projects={projects}
        operatingExpenses={expenses}
        rates={rates}
        formOpen={formOpen}
        setFormOpen={setFormOpen}
        onChange={(items) => update('payments', items)}
        onDocumentsChange={(items) => update('documents', items)}
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
        preview={preview}
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
      operatingExpenses={expenses}
      posts={store.posts}
      projects={projects}
      clients={clients}
      recurringInvoices={store.recurringInvoices}
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
  onEventClick,
  compact = false,
}: {
  month: string;
  events: CalendarEvent[];
  onDateClick: (date: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
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
            <div key={date} className={`office-calendar-day ${date === today() ? 'is-today' : ''}`}>
              <button
                type="button"
                className="office-calendar-date-hit"
                onClick={() => onDateClick(date)}
                aria-label={`Add event on ${date}`}
              >
                <b>{day}</b>
              </button>
              {dayEvents.slice(0, compact ? 3 : 2).map((event) => (
                <button
                  type="button"
                  key={event.id}
                  title={`View ${event.title}`}
                  aria-label={`View ${event.title}`}
                  className={`office-calendar-event ${event.type.toLowerCase()}`}
                  onClick={() => onEventClick?.(event)}
                >
                  {compact ? '' : event.title}
                </button>
              ))}
              {dayEvents.length > (compact ? 3 : 2) && (
                <small>+{dayEvents.length - (compact ? 3 : 2)} more</small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarEventModal({
  initialDate,
  initialEvent,
  dateEvents = [],
  readOnly = false,
  postMode = false,
  clients = [],
  projects = [],
  onClose,
  onSave,
  onDelete,
  onSelectEvent,
}: {
  initialDate: string;
  initialEvent?: CalendarEvent;
  dateEvents?: CalendarEvent[];
  readOnly?: boolean;
  postMode?: boolean;
  clients?: ClientRef[];
  projects?: ProjectRef[];
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  onDelete?: () => void;
  onSelectEvent?: (event: CalendarEvent) => void;
}) {
  const [draft, setDraft] = useState({
    title: initialEvent?.title ?? '',
    date: initialEvent?.date ?? initialDate,
    type: initialEvent?.type ?? (postMode ? 'Post' : 'Task'),
    clientId: initialEvent?.clientId ?? '',
    projectId: initialEvent?.projectId ?? '',
    platform: initialEvent?.platform ?? 'Instagram',
    count: String(initialEvent?.count ?? 1),
    remarks: initialEvent?.remarks ?? '',
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
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
              <h2 id="office-event-modal-title">
                {initialEvent ? 'Event details' : postMode ? 'Add posted update' : 'Add event'}
              </h2>
              <p>
                {readOnly
                  ? 'This item is managed from its original invoice or renewal record.'
                  : postMode
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
              disabled={readOnly}
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
              disabled={readOnly}
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </label>
          {postMode ? (
            <>
              <label>
                <span>Client</span>
                <select
                  disabled={readOnly}
                  value={draft.clientId}
                  onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {clientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Project</span>
                <select
                  disabled={readOnly}
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
                  disabled={readOnly}
                  value={draft.platform}
                  onChange={(event) => setDraft({ ...draft, platform: event.target.value })}
                >
                  <option>Instagram</option>
                  <option>Facebook</option>
                  <option>TikTok</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span>Post count</span>
                <input
                  disabled={readOnly}
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
                disabled={readOnly}
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
              disabled={readOnly}
              rows={3}
              value={draft.remarks}
              onChange={(event) => setDraft({ ...draft, remarks: event.target.value })}
              placeholder="Optional details"
            />
          </label>
          {dateEvents.length > 0 && (
            <section className="office-event-day-list" aria-label={`Events on ${draft.date}`}>
              <div>
                <strong>Events on {draft.date}</strong>
                <small>{dateEvents.length} scheduled</small>
              </div>
              <div>
                {dateEvents.map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    className={event.id === initialEvent?.id ? 'active' : ''}
                    onClick={() => onSelectEvent?.(event)}
                  >
                    <span className={event.type.toLowerCase()} />
                    <b>{event.title}</b>
                    <small>{event.type}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
          <footer>
            {onDelete && !readOnly && (
              <button className="button office-danger-button" type="button" onClick={onDelete}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button className="button button-outline" type="button" onClick={onClose}>
              Cancel
            </button>
            {!readOnly && (
              <button className="button button-primary" type="submit">
                <Check size={16} /> {initialEvent ? 'Save changes' : 'Save'}
              </button>
            )}
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
  invoiceDefaults,
  payments,
  recurringInvoices,
  search,
  setSearch,
  formOpen,
  setFormOpen,
  onChange,
  onPaymentsChange,
  onRecurringChange,
}: {
  kind: DocumentKind;
  items: SalesDocument[];
  allItems: SalesDocument[];
  clients: ClientRef[];
  projects: ProjectRef[];
  rates: Record<string, number>;
  invoiceDefaults?: { includeBankDetails: boolean; bankDetails: string; notes: string };
  payments: Payment[];
  recurringInvoices: RecurringInvoice[];
  search: string;
  setSearch: (value: string) => void;
  formOpen: boolean;
  setFormOpen: (value: boolean) => void;
  onChange: (items: SalesDocument[]) => void;
  onPaymentsChange: (items: Payment[]) => void;
  onRecurringChange: (items: RecurringInvoice[]) => void;
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
    description: '',
    notes:
      kind === 'Invoice'
        ? (invoiceDefaults?.notes ?? 'Payment is due within 10 days of the invoice date.')
        : '',
    includeBankDetails: kind === 'Invoice' && (invoiceDefaults?.includeBankDetails ?? false),
    bankDetails: kind === 'Invoice' ? (invoiceDefaults?.bankDetails ?? '') : '',
  });
  const [preview, setPreview] = useState<SalesDocument | null>(null);
  const [editingId, setEditingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [paymentTarget, setPaymentTarget] = useState<SalesDocument | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ amount: '', date: today(), note: '' });
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringDraft, setRecurringDraft] = useState({
    clientId: '',
    projectId: '',
    amount: '',
    currency: 'LKR',
    frequency: 'Monthly' as RecurringInvoice['frequency'],
    nextRun: today(),
    description: '',
  });
  const names = new Map(clients.map((client) => [client.id, clientLabel(client)]));
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
  useEffect(() => {
    const editId = localStorage.getItem('infonits-invoice-edit-id');
    const viewId = localStorage.getItem('infonits-invoice-view-id');
    const editItem = items.find((item) => item.id === editId);
    const viewItem = items.find((item) => item.id === viewId);
    if (editItem) {
      setDraft({
        clientId: editItem.clientId,
        projectId: editItem.projectId,
        issueDate: editItem.issueDate,
        dueDate: editItem.dueDate,
        amount: String(editItem.amount),
        currency: editItem.currency,
        status: editItem.status,
        taxRate: String(editItem.taxRate ?? 0),
        discount: String(editItem.discount ?? 0),
        advance: String(editItem.advance ?? 0),
        description: editItem.description ?? '',
        notes: editItem.notes ?? '',
        includeBankDetails: editItem.includeBankDetails ?? false,
        bankDetails: editItem.bankDetails ?? '',
      });
      setEditingId(editItem.id);
      setFormOpen(true);
    }
    if (viewItem) setPreview(viewItem);
    localStorage.removeItem('infonits-invoice-edit-id');
    localStorage.removeItem('infonits-invoice-view-id');
  }, [items, setFormOpen]);
  const normalizedItems = items.map((item) => {
    const paid = paidForInvoice(item.id, payments);
    const total = documentTotal(item);
    return {
      ...item,
      dueDate: item.kind === 'Invoice' ? invoiceDueDate(item) : item.dueDate,
      status:
        item.kind === 'Invoice' && paid > 0
          ? paid >= total
            ? 'Paid'
            : 'Partial'
          : currentDocumentStatus(item),
    };
  });
  const visible = normalizedItems.filter(
    (item) =>
      (statusFilter === 'All' || item.status === statusFilter) &&
      `${item.number} ${names.get(item.clientId) ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const invoiceSummary = normalizedItems.reduce(
    (summary, item) => {
      const total = documentTotal(item);
      const value = lkr(total, item.exchangeRate);
      const received = lkr(Math.min(total, paidForInvoice(item.id, payments)), item.exchangeRate);
      return {
        billed: summary.billed + value,
        paid: summary.paid + (received || (item.status === 'Paid' ? value : 0)),
        pending:
          summary.pending +
          (item.status === 'Pending' || item.status === 'Sent' || item.status === 'Partial'
            ? Math.max(0, value - received)
            : 0),
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
    const existing = items.find((item) => item.id === editingId);
    const nextDocument: SalesDocument = {
      id: existing?.id ?? crypto.randomUUID(),
      kind,
      number: existing?.number ?? nextNumber(kind, allItems),
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
      description: draft.description.trim(),
      notes: draft.notes.trim(),
      includeBankDetails: draft.includeBankDetails,
      bankDetails: draft.includeBankDetails ? draft.bankDetails.trim() : '',
    };
    onChange(
      existing
        ? items.map((item) => (item.id === existing.id ? nextDocument : item))
        : [nextDocument, ...items],
    );
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
      description: '',
      notes:
        kind === 'Invoice'
          ? (invoiceDefaults?.notes ?? 'Payment is due within 10 days of the invoice date.')
          : '',
      includeBankDetails: kind === 'Invoice' && (invoiceDefaults?.includeBankDetails ?? false),
      bankDetails: kind === 'Invoice' ? (invoiceDefaults?.bankDetails ?? '') : '',
    });
    setEditingId('');
    setFormOpen(false);
  }

  function editDocument(item: SalesDocument) {
    setDraft({
      clientId: item.clientId,
      projectId: item.projectId,
      issueDate: item.issueDate,
      dueDate: item.dueDate,
      amount: String(item.amount),
      currency: item.currency,
      status: item.status,
      taxRate: String(item.taxRate ?? 0),
      discount: String(item.discount ?? 0),
      advance: String(item.advance ?? 0),
      description: item.description ?? '',
      notes: item.notes ?? '',
      includeBankDetails: item.includeBankDetails ?? false,
      bankDetails: item.bankDetails ?? '',
    });
    setEditingId(item.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function recordInvoicePayment(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentDraft.amount);
    const total = documentTotal(paymentTarget);
    const alreadyPaid = paidForInvoice(paymentTarget.id, payments);
    const remaining = Math.max(0, total - alreadyPaid);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) return;
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(
      payments.filter((item) => item.receiptNumber).length + 1,
    ).padStart(3, '0')}`;
    const nextPayments: Payment[] = [
      {
        id: crypto.randomUUID(),
        type: 'Income',
        category: 'Invoice payment',
        note: paymentDraft.note.trim() || `${paymentTarget.number} payment`,
        amount,
        currency: paymentTarget.currency,
        exchangeRate: paymentTarget.exchangeRate,
        date: paymentDraft.date,
        status: 'Paid',
        invoiceId: paymentTarget.id,
        projectId: paymentTarget.projectId,
        receiptNumber,
      },
      ...payments,
    ];
    onPaymentsChange(nextPayments);
    const nextPaid = alreadyPaid + amount;
    onChange(
      items.map((item) =>
        item.id === paymentTarget.id
          ? { ...item, status: nextPaid >= total ? 'Paid' : 'Partial' }
          : item,
      ),
    );
    setPaymentTarget(null);
    setPaymentDraft({ amount: '', date: today(), note: '' });
  }
  function saveRecurringInvoice(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(recurringDraft.amount);
    if (!recurringDraft.clientId || !Number.isFinite(amount) || amount <= 0) return;
    onRecurringChange([
      {
        id: crypto.randomUUID(),
        clientId: recurringDraft.clientId,
        projectId: recurringDraft.projectId,
        amount,
        currency: recurringDraft.currency,
        exchangeRate: recurringDraft.currency === 'LKR' ? 1 : (rates[recurringDraft.currency] ?? 1),
        frequency: recurringDraft.frequency,
        nextRun: recurringDraft.nextRun,
        description: recurringDraft.description.trim(),
        active: true,
      },
      ...recurringInvoices,
    ]);
    setRecurringDraft({
      clientId: '',
      projectId: '',
      amount: '',
      currency: 'LKR',
      frequency: 'Monthly',
      nextRun: today(),
      description: '',
    });
  }
  return (
    <>
      <ModuleHeader
        eyebrow="SALES"
        title={`${kind}s`}
        subtitle={`Create and track client ${kind.toLowerCase()}s in one clear list.`}
        action={`New ${kind.toLowerCase()}`}
        onAction={() => setFormOpen(!formOpen)}
      >
        {kind === 'Invoice' && (
          <button
            className="button button-outline"
            type="button"
            onClick={() => setRecurringOpen((open) => !open)}
          >
            <Repeat2 size={16} /> Recurring
          </button>
        )}
      </ModuleHeader>
      {kind === 'Invoice' && recurringOpen && (
        <section className="recurring-invoice-panel">
          <header>
            <div>
              <h2>Recurring invoices</h2>
              <p>Create the next invoice automatically on its scheduled date.</p>
            </div>
            <span>{recurringInvoices.filter((item) => item.active).length} active</span>
          </header>
          <form className="recurring-invoice-form" onSubmit={saveRecurringInvoice}>
            <label>
              <span>Client *</span>
              <select
                required
                value={recurringDraft.clientId}
                onChange={(event) =>
                  setRecurringDraft({ ...recurringDraft, clientId: event.target.value })
                }
              >
                <option value="">Choose client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {clientLabel(client)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Project</span>
              <select
                value={recurringDraft.projectId}
                onChange={(event) =>
                  setRecurringDraft({ ...recurringDraft, projectId: event.target.value })
                }
              >
                <option value="">No project</option>
                {projects
                  .filter(
                    (project) =>
                      !recurringDraft.clientId || project.clientId === recurringDraft.clientId,
                  )
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Amount *</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={recurringDraft.amount}
                onChange={(event) =>
                  setRecurringDraft({ ...recurringDraft, amount: event.target.value })
                }
              />
            </label>
            <label>
              <span>Currency</span>
              <select
                value={recurringDraft.currency}
                onChange={(event) =>
                  setRecurringDraft({ ...recurringDraft, currency: event.target.value })
                }
              >
                {currencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Frequency</span>
              <select
                value={recurringDraft.frequency}
                onChange={(event) =>
                  setRecurringDraft({
                    ...recurringDraft,
                    frequency: event.target.value as RecurringInvoice['frequency'],
                  })
                }
              >
                <option>Monthly</option>
                <option>Quarterly</option>
                <option>Yearly</option>
              </select>
            </label>
            <label>
              <span>Next invoice</span>
              <input
                required
                type="date"
                value={recurringDraft.nextRun}
                onChange={(event) =>
                  setRecurringDraft({ ...recurringDraft, nextRun: event.target.value })
                }
              />
            </label>
            <label className="wide">
              <span>Description</span>
              <input
                value={recurringDraft.description}
                onChange={(event) =>
                  setRecurringDraft({ ...recurringDraft, description: event.target.value })
                }
                placeholder="Monthly support, hosting or retainer"
              />
            </label>
            <button className="button button-primary" type="submit">
              <Plus size={16} /> Add schedule
            </button>
          </form>
          {recurringInvoices.length > 0 && (
            <div className="recurring-invoice-list">
              {recurringInvoices.map((schedule) => (
                <article key={schedule.id}>
                  <span className={schedule.active ? 'active' : ''}>
                    <Repeat2 size={16} />
                  </span>
                  <div>
                    <strong>{names.get(schedule.clientId) ?? 'Unknown client'}</strong>
                    <small>
                      {schedule.description ||
                        projectNames.get(schedule.projectId) ||
                        'Recurring invoice'}{' '}
                      · {schedule.frequency} · next {schedule.nextRun}
                    </small>
                  </div>
                  <b>
                    {schedule.currency} {schedule.amount.toLocaleString()}
                  </b>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() =>
                      onRecurringChange(
                        recurringInvoices.map((item) =>
                          item.id === schedule.id ? { ...item, active: !item.active } : item,
                        ),
                      )
                    }
                  >
                    {schedule.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    className="local-delete"
                    aria-label="Delete recurring invoice"
                    onClick={() =>
                      onRecurringChange(recurringInvoices.filter((item) => item.id !== schedule.id))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {kind === 'Invoice' && (
        <>
          <section className="invoice-kpis" aria-label="Invoice totals">
            <article className="blue">
              <span className="invoice-kpi-icon">
                <FileText size={20} />
              </span>
              <div className="invoice-kpi-copy">
                <span>Total invoices</span>
                <strong>{normalizedItems.length}</strong>
                <small>{projects.length} projects</small>
              </div>
              <ChevronRight className="invoice-kpi-chevron" size={18} />
              <button
                className="invoice-kpi-hit"
                aria-label="Show all invoices"
                onClick={() => setStatusFilter('All')}
              />
            </article>
            <article className="amber">
              <span className="invoice-kpi-icon">
                <Coins size={20} />
              </span>
              <div className="invoice-kpi-copy">
                <span>Total billed</span>
                <strong>{money(invoiceSummary.billed)}</strong>
                <small>All recorded invoices</small>
              </div>
              <ChevronRight className="invoice-kpi-chevron" size={18} />
              <button
                className="invoice-kpi-hit"
                aria-label="Show all billed invoices"
                onClick={() => setStatusFilter('All')}
              />
            </article>
            <article className="green">
              <span className="invoice-kpi-icon">
                <CheckCircle2 size={20} />
              </span>
              <div className="invoice-kpi-copy">
                <span>Paid</span>
                <strong>{money(invoiceSummary.paid)}</strong>
                <small>{statusCounts.Paid ?? 0} invoices</small>
              </div>
              <ChevronRight className="invoice-kpi-chevron" size={18} />
              <button
                className="invoice-kpi-hit"
                aria-label="Show paid invoices"
                onClick={() => setStatusFilter('Paid')}
              />
            </article>
            <article className="red">
              <span className="invoice-kpi-icon">
                <Clock3 size={20} />
              </span>
              <div className="invoice-kpi-copy">
                <span>Pending</span>
                <strong>{money(invoiceSummary.pending)}</strong>
                <small>{(statusCounts.Pending ?? 0) + (statusCounts.Sent ?? 0)} invoices</small>
              </div>
              <ChevronRight className="invoice-kpi-chevron" size={18} />
              <button
                className="invoice-kpi-hit"
                aria-label="Show pending invoices"
                onClick={() => setStatusFilter('Pending')}
              />
            </article>
            <article className="purple">
              <span className="invoice-kpi-icon">
                <AlertCircle size={20} />
              </span>
              <div className="invoice-kpi-copy">
                <span>Overdue</span>
                <strong>{money(invoiceSummary.overdue)}</strong>
                <small>{statusCounts.Overdue ?? 0} invoices</small>
              </div>
              <ChevronRight className="invoice-kpi-chevron" size={18} />
              <button
                className="invoice-kpi-hit"
                aria-label="Show overdue invoices"
                onClick={() => setStatusFilter('Overdue')}
              />
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
                  {clientLabel(c)}
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
          <label className="wide">
            <span>{kind} description</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Describe the services, deliverables or items included"
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
                <textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
              <label className="wide invoice-bank-toggle">
                <input
                  type="checkbox"
                  checked={draft.includeBankDetails}
                  onChange={(e) => setDraft({ ...draft, includeBankDetails: e.target.checked })}
                />
                <span>Include bank details on this invoice</span>
              </label>
              {draft.includeBankDetails && (
                <label className="wide">
                  <span>Bank details</span>
                  <textarea
                    required
                    rows={3}
                    value={draft.bankDetails}
                    onChange={(e) => setDraft({ ...draft, bankDetails: e.target.value })}
                    placeholder={'Bank name\nAccount name\nAccount number / SWIFT'}
                  />
                </label>
              )}
            </>
          )}
          <button className="button button-primary" type="submit">
            <Check size={16} />
            {editingId ? 'Update' : 'Save'} {kind.toLowerCase()}
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
          <button
            className="invoice-filter-button"
            aria-label={`${filtersOpen ? 'Hide' : 'Show'} ${kind.toLowerCase()} filters`}
            aria-expanded={filtersOpen}
            title="Filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={17} />
          </button>
          <div className={`invoice-filter-chips ${filtersOpen ? 'is-open' : ''}`}>
            {(kind === 'Invoice'
              ? ['All', 'Paid', 'Partial', 'Sent', 'Pending', 'Overdue']
              : ['All', 'Draft', 'Sent', 'Accepted', 'Declined']
            ).map((status) => (
              <button
                key={status}
                className={`${status.toLowerCase()} ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          <span>
            {visible.length} {kind.toLowerCase()}
            {visible.length === 1 ? '' : 's'}
          </span>
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
                  <tr className="sales-document-row" key={item.id}>
                    <td data-label="Number">
                      <span className="office-document-number-icon">
                        <FileText size={19} />
                      </span>
                      <span className="office-document-number-copy">
                        <strong>{item.number}</strong>
                        <small>{names.get(item.clientId) ?? 'Unknown client'}</small>
                      </span>
                      <MoreVertical className="office-document-more" size={18} />
                    </td>
                    <td data-label="Client">{names.get(item.clientId) ?? 'Unknown client'}</td>
                    <td data-label="Date">
                      <CalendarDays className="office-document-date-icon" size={15} />
                      <span>
                        {item.issueDate}
                        <small>Issue date</small>
                      </span>
                    </td>
                    <td data-label="Due">
                      <CalendarDays className="office-document-date-icon" size={15} />
                      <span>
                        {item.dueDate}
                        <small>Due date</small>
                      </span>
                    </td>
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
                          ? ['Pending', 'Sent', 'Partial', 'Paid', 'Overdue']
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
                        aria-label={`Edit ${item.number}`}
                        title="Edit"
                        onClick={() => editDocument(item)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`Preview ${item.number}`}
                        title="Preview"
                        onClick={() => setPreview(item)}
                      >
                        <Eye size={15} />
                      </button>
                      {kind === 'Invoice' && (
                        <button
                          aria-label={`Record payment for ${item.number}`}
                          title="Record payment"
                          onClick={() => {
                            const remaining = Math.max(
                              0,
                              documentTotal(item) - paidForInvoice(item.id, payments),
                            );
                            setPaymentTarget(item);
                            setPaymentDraft({
                              amount: String(remaining || ''),
                              date: today(),
                              note: '',
                            });
                          }}
                        >
                          <CircleDollarSign size={15} />
                        </button>
                      )}
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
      {paymentTarget && (
        <div
          className="local-modal-layer"
          role="presentation"
          onMouseDown={() => setPaymentTarget(null)}
        >
          <section
            className="local-modal invoice-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-payment-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="local-modal-icon">
                  <CircleDollarSign size={19} />
                </span>
                <div>
                  <h2 id="invoice-payment-title">Record payment</h2>
                  <p>
                    {paymentTarget.number} · {names.get(paymentTarget.clientId) ?? 'Unknown client'}
                  </p>
                </div>
              </div>
              <button aria-label="Close payment form" onClick={() => setPaymentTarget(null)}>
                <X size={19} />
              </button>
            </header>
            <form className="invoice-payment-form" onSubmit={recordInvoicePayment}>
              <div className="invoice-payment-balance">
                <span>Remaining balance</span>
                <strong>
                  {paymentTarget.currency}{' '}
                  {Math.max(
                    0,
                    documentTotal(paymentTarget) - paidForInvoice(paymentTarget.id, payments),
                  ).toLocaleString()}
                </strong>
              </div>
              <label>
                <span>Amount received *</span>
                <input
                  autoFocus
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={Math.max(
                    0,
                    documentTotal(paymentTarget) - paidForInvoice(paymentTarget.id, payments),
                  )}
                  value={paymentDraft.amount}
                  onChange={(event) =>
                    setPaymentDraft({ ...paymentDraft, amount: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Payment date</span>
                <input
                  type="date"
                  value={paymentDraft.date}
                  onChange={(event) =>
                    setPaymentDraft({ ...paymentDraft, date: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                <span>Reference / note</span>
                <input
                  value={paymentDraft.note}
                  onChange={(event) =>
                    setPaymentDraft({ ...paymentDraft, note: event.target.value })
                  }
                  placeholder="Bank transfer reference"
                />
              </label>
              <footer>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setPaymentTarget(null)}
                >
                  Cancel
                </button>
                <button className="button button-primary" type="submit">
                  <Check size={16} /> Save payment
                </button>
              </footer>
            </form>
          </section>
        </div>
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

export async function createInvoicePdf(
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

  pdf.setFillColor(15, 37, 68);
  pdf.rect(0, 0, 210, 43, 'F');
  pdf.setFillColor(38, 126, 230);
  pdf.rect(0, 0, 210, 4, 'F');
  try {
    const logo = await imageDataUrl('/infonits-white-logo.png');
    pdf.addImage(logo, 'PNG', 16, 13, 58, 11.6);
  } catch {
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text('infonits', 16, 23);
  }
  pdf.setTextColor(152, 183, 218);
  pdf.setFontSize(6.5);
  pdf.text('DESIGN  x  TECHNOLOGY', 16, 32);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('BILLING DOCUMENT', 194, 13, { align: 'right' });
  pdf.setFontSize(22);
  pdf.text('INVOICE', 194, 24, { align: 'right' });
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(item.number, 194, 31, { align: 'right' });
  pdf.setFillColor(33, 164, 116);
  pdf.roundedRect(166, 34, 28, 6, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text(item.status.toUpperCase(), 180, 38, { align: 'center' });

  pdf.setTextColor(77, 96, 120);
  pdf.setFontSize(7);
  pdf.text('ISSUED BY', 16, 55);
  pdf.setTextColor(20, 40, 66);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Infonits (Pvt) Ltd', 16, 63);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(83, 101, 124);
  pdf.text('Jaffna, Sri Lanka', 16, 70);
  pdf.text('hello@infonits.io  |  www.infonits.io', 16, 76);

  const meta = [
    ['Invoice number', item.number],
    ['Issue date', item.issueDate],
    ['Due date', item.dueDate],
  ];
  meta.forEach(([label, value], index) => {
    const y = 55 + index * 10;
    pdf.setTextColor(104, 120, 141);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(label, 128, y);
    pdf.setTextColor(25, 45, 70);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text(value, 194, y, { align: 'right' });
  });

  pdf.setFillColor(241, 246, 252);
  pdf.roundedRect(16, 86, 178, 35, 3, 3, 'F');
  pdf.setTextColor(75, 96, 121);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('BILL TO', 22, 96);
  pdf.setTextColor(21, 42, 68);
  pdf.setFontSize(12);
  pdf.text(clientName, 22, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(82, 101, 125);
  const clientLines = [client?.company, client?.email, client?.phone].filter(Boolean) as string[];
  pdf.text(clientLines.length ? clientLines : ['Client account'], 22, 112);
  pdf.setTextColor(75, 96, 121);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('PROJECT', 128, 96);
  pdf.setTextColor(21, 42, 68);
  pdf.setFontSize(9);
  pdf.text(project, 128, 105, { maxWidth: 60 });

  pdf.setTextColor(21, 42, 68);
  pdf.setFontSize(10);
  pdf.text('Services & deliverables', 16, 135);
  pdf.setFillColor(15, 37, 68);
  pdf.roundedRect(16, 140, 178, 11, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.text('DESCRIPTION', 22, 147);
  pdf.text('QTY', 132, 147, { align: 'right' });
  pdf.text('RATE', 162, 147, { align: 'right' });
  pdf.text('AMOUNT', 188, 147, { align: 'right' });

  pdf.setTextColor(21, 42, 68);
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text(project, 22, 161, { maxWidth: 96 });
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 137);
  pdf.setFontSize(7);
  pdf.text(
    pdf.splitTextToSize(item.description || 'Professional services', 96).slice(0, 2),
    22,
    168,
    { lineHeightFactor: 1.15 },
  );
  pdf.setTextColor(39, 56, 78);
  pdf.setFontSize(8);
  pdf.text('1', 132, 161, { align: 'right' });
  pdf.text(currency(subtotal), 162, 161, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.text(currency(subtotal), 188, 161, { align: 'right' });
  pdf.setDrawColor(222, 229, 238);
  pdf.line(16, 176, 194, 176);

  const summaryRows = [
    ['Subtotal', currency(subtotal)],
    ['Discount', `- ${currency(item.discount ?? 0)}`],
    [`Tax (${item.taxRate ?? 0}%)`, currency(tax)],
    ['Invoice total', currency(subtotal + tax - (item.discount ?? 0))],
    ['Advance paid', `- ${currency(item.advance ?? 0)}`],
  ];
  summaryRows.forEach(([label, value], index) => {
    const y = 187 + index * 7;
    pdf.setFont('helvetica', index === 3 ? 'bold' : 'normal');
    pdf.setFontSize(index === 3 ? 8.5 : 8);
    pdf.setTextColor(92, 108, 129);
    pdf.text(label, 126, y);
    pdf.setTextColor(35, 52, 75);
    pdf.text(value, 194, y, { align: 'right' });
  });

  pdf.setTextColor(75, 96, 121);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('PAYMENT NOTE', 16, 187);
  pdf.setTextColor(75, 92, 114);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(item.notes || 'Payment is due within 10 days of the invoice date.', 16, 195, {
    maxWidth: 86,
  });
  pdf.text(`Use ${item.number} as the payment reference.`, 16, 211, { maxWidth: 86 });

  pdf.setFillColor(31, 112, 198);
  pdf.roundedRect(120, 224, 74, 20, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('BALANCE DUE', 126, 232);
  pdf.setFontSize(13);
  pdf.text(currency(total), 188, 238, { align: 'right' });

  pdf.setFillColor(244, 247, 251);
  pdf.roundedRect(16, 224, 94, 32, 3, 3, 'F');
  pdf.setTextColor(21, 42, 68);
  pdf.setFontSize(8.5);
  pdf.text(item.includeBankDetails ? 'BANK DETAILS' : 'Payment reference', 22, 234);
  pdf.setTextColor(83, 101, 124);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  if (item.includeBankDetails && item.bankDetails) {
    pdf.text(pdf.splitTextToSize(item.bankDetails, 82).slice(0, 3), 22, 242, {
      lineHeightFactor: 1.25,
    });
  } else {
    pdf.text(`${item.number}  |  hello@infonits.io`, 22, 243);
    pdf.text(`Recorded value: ${money(lkr(total, item.exchangeRate))}`, 22, 250);
  }

  pdf.setDrawColor(222, 229, 238);
  pdf.line(16, 276, 194, 276);
  pdf.setTextColor(97, 112, 132);
  pdf.setFontSize(7);
  pdf.text('CREATED WITH CARE BY INFONITS', 16, 284);
  pdf.text('hello@infonits.io  |  www.infonits.io', 194, 284, { align: 'right' });
  return pdf;
}

async function downloadInvoicePdf(
  item: SalesDocument,
  client: ClientRef | undefined,
  project: string,
) {
  const pdf = await createInvoicePdf(item, client, project);
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
        <div className="invoice-paper invoice-a4">
          <div className="invoice-a4-header">
            <div>
              <img src="/infonits-white-logo.png" alt="Infonits" />
              <small>DESIGN&nbsp; × &nbsp;TECHNOLOGY</small>
            </div>
            <div>
              <small>BILLING DOCUMENT</small>
              <strong>INVOICE</strong>
              <span>{item.number}</span>
              <em>{item.status}</em>
            </div>
          </div>
          <div className="invoice-a4-meta">
            <div>
              <span>Issued by</span>
              <strong>Infonits (Pvt) Ltd</strong>
              <p>
                Jaffna, Sri Lanka
                <br />
                hello@infonits.io
                <br />
                www.infonits.io
              </p>
            </div>
            <dl>
              <dt>Invoice number</dt>
              <dd>{item.number}</dd>
              <dt>Issue date</dt>
              <dd>{item.issueDate}</dd>
              <dt>Due date</dt>
              <dd>{item.dueDate}</dd>
            </dl>
          </div>
          <div className="invoice-a4-billto">
            <div>
              <span>Bill to</span>
              <strong>{client?.name ?? 'Client'}</strong>
              <p>{[client?.company, client?.email, client?.phone].filter(Boolean).join(' · ')}</p>
            </div>
            <div>
              <span>Project</span>
              <strong>{project}</strong>
            </div>
          </div>
          <div className="invoice-a4-services">
            <h3>Services &amp; deliverables</h3>
            <div className="invoice-a4-table-head">
              <span>Description</span>
              <span>Qty</span>
              <span>Rate</span>
              <span>Amount</span>
            </div>
            <div className="invoice-a4-table-row">
              <span>
                <b>01</b>
                <strong>{project}</strong>
                <small>{item.description || 'Professional services'}</small>
              </span>
              <span>1</span>
              <span>
                {item.currency} {subtotal.toLocaleString()}
              </span>
              <strong>
                {item.currency} {subtotal.toLocaleString()}
              </strong>
            </div>
          </div>
          <div className="invoice-a4-recap">
            <div>
              <span>Payment note</span>
              <p>{item.notes || 'Payment is due within 10 days of the invoice date.'}</p>
              <p>
                Use <strong>{item.number}</strong> as the payment reference.
              </p>
            </div>
            <div className="invoice-a4-totals">
              <span>Subtotal</span>
              <b>
                {item.currency} {subtotal.toLocaleString()}
              </b>
              <span>Discount</span>
              <b>
                − {item.currency} {(item.discount ?? 0).toLocaleString()}
              </b>
              <span>Tax ({item.taxRate ?? 0}%)</span>
              <b>
                {item.currency} {tax.toLocaleString()}
              </b>
              <span>Advance paid</span>
              <b>
                − {item.currency} {(item.advance ?? 0).toLocaleString()}
              </b>
              <strong>Balance due</strong>
              <strong>
                {item.currency} {total.toLocaleString()}
              </strong>
            </div>
          </div>
          <div className="invoice-a4-payment">
            <div>
              <span>{item.includeBankDetails ? 'Bank details' : 'Payment reference'}</span>
              {item.includeBankDetails && item.bankDetails ? (
                <p>{item.bankDetails}</p>
              ) : (
                <strong>{item.number}</strong>
              )}
            </div>
            <div>
              <span>Recorded LKR value</span>
              <strong>{money(lkr(total, item.exchangeRate))}</strong>
            </div>
          </div>
          <div className="invoice-a4-footer">
            <span>
              CREATED WITH CARE BY <strong>INFONITS</strong>
            </span>
            <span>hello@infonits.io · www.infonits.io</span>
          </div>
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
  documents,
  projects,
  operatingExpenses,
  rates,
  formOpen,
  setFormOpen,
  onChange,
  onDocumentsChange,
}: {
  items: Payment[];
  documents: SalesDocument[];
  projects: ProjectRef[];
  operatingExpenses: OperatingExpense[];
  rates: Record<string, number>;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: Payment[]) => void;
  onDocumentsChange: (v: SalesDocument[]) => void;
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
  const automaticRows = useMemo<Payment[]>(
    () => [
      ...documents
        .filter(
          (item) =>
            item.kind === 'Invoice' &&
            item.status === 'Paid' &&
            !items.some((payment) => payment.invoiceId === item.id),
        )
        .map((item) => ({
          id: `invoice-${item.id}`,
          type: 'Income' as const,
          category: 'Paid invoice',
          note: item.number,
          amount: item.amount,
          currency: item.currency,
          exchangeRate: item.exchangeRate,
          date: item.issueDate,
          status: 'Paid' as const,
        })),
      ...operatingExpenses.map((item) => ({
        id: `expense-${item.id}`,
        type: 'Expense' as const,
        category: item.category,
        note: item.description,
        amount: item.amount,
        currency: item.currency,
        exchangeRate: item.exchangeRate,
        date: item.date,
        status: 'Paid' as const,
      })),
      ...projects
        .filter((project) => project.workDue + project.workPaid > 0)
        .map((project) => ({
          id: `work-${project.id}`,
          type: 'Expense' as const,
          category: 'Project work',
          note: project.project,
          amount: project.workDue + project.workPaid,
          currency: 'LKR',
          exchangeRate: 1,
          date: today(),
          status: 'Paid' as const,
        })),
    ],
    [documents, items, operatingExpenses, projects],
  );
  const ledgerRows = useMemo(
    () =>
      [
        ...items.map((item) => ({ ...item, manual: true })),
        ...automaticRows.map((item) => ({ ...item, manual: false })),
      ].toSorted((left, right) => right.date.localeCompare(left.date)),
    [automaticRows, items],
  );
  const totals = useMemo(
    () =>
      ledgerRows.reduce(
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
    [ledgerRows],
  );
  const cashTotal = totals.income + totals.expense;
  const incomeShare = cashTotal ? Math.round((totals.income / cashTotal) * 100) : 0;
  const expenseShare = cashTotal ? 100 - incomeShare : 0;
  function changePayments(nextPayments: Payment[]) {
    onChange(nextPayments);
    onDocumentsChange(
      documents.map((document) => {
        const wasLinked = items.some((payment) => payment.invoiceId === document.id);
        const isLinked = nextPayments.some((payment) => payment.invoiceId === document.id);
        if (!wasLinked && !isLinked) return document;
        const paid = paidForInvoice(document.id, nextPayments);
        const total = documentTotal(document);
        const due = invoiceDueDate(document) < today();
        return {
          ...document,
          status: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : due ? 'Overdue' : 'Pending',
        };
      }),
    );
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.note.trim() || amount <= 0) return;
    changePayments([
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
        title="Finance tracker"
        subtitle="Paid invoices, operating expenses and additional cash records in one connected ledger."
        action="Add transaction"
        onAction={() => setFormOpen(!formOpen)}
      />
      <section className="office-metrics">
        <Metric label="Total income" value={totals.income} tone="green" />
        <Metric label="Total outcome" value={totals.expense} tone="red" />
        <Metric label="Savings & gold" value={totals.assets} tone="blue" />
        <Metric label="Pending" value={totals.pending} tone="amber" />
      </section>
      <section className="finance-tracker-report" aria-label="Income and outcome report">
        <header>
          <div>
            <strong>Cash flow report</strong>
            <small>Live from paid invoices, projects and expenses</small>
          </div>
          <b className={totals.income - totals.expense >= 0 ? 'positive' : 'negative'}>
            {money(totals.income - totals.expense)} net
          </b>
        </header>
        <div className="finance-tracker-chart">
          <div>
            <span>Income</span>
            <i>
              <b style={{ width: `${incomeShare}%` }} />
            </i>
            <strong>{incomeShare}%</strong>
          </div>
          <div>
            <span>Outcome</span>
            <i>
              <b style={{ width: `${expenseShare}%` }} />
            </i>
            <strong>{expenseShare}%</strong>
          </div>
        </div>
        <div className="finance-tracker-sources">
          <span>
            <small>Paid invoices</small>
            <strong>
              {automaticRows.filter((item) => item.category === 'Paid invoice').length}
            </strong>
          </span>
          <span>
            <small>Automatic expenses</small>
            <strong>{automaticRows.filter((item) => item.type === 'Expense').length}</strong>
          </span>
          <span>
            <small>Additional records</small>
            <strong>{items.length}</strong>
          </span>
        </div>
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
      <section className="office-panel finance-ledger-panel">
        {!ledgerRows.length ? (
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
                {ledgerRows.map((item) => (
                  <tr className="finance-ledger-row" key={item.id}>
                    <td data-label="Date">{item.date}</td>
                    <td data-label="Type">
                      <span className={`office-pill ${item.type.toLowerCase()}`}>{item.type}</span>
                    </td>
                    <td data-label="Category">
                      {item.category}
                      <small>
                        {item.receiptNumber ?? (item.manual ? 'Additional record' : 'Automatic')}
                      </small>
                    </td>
                    <td data-label="Note">{item.note}</td>
                    <td data-label="Status">
                      {item.manual ? (
                        <button
                          className={`office-status-button ${item.status.toLowerCase()}`}
                          onClick={() =>
                            changePayments(
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
                      ) : (
                        <span className="office-status-button paid">Paid</span>
                      )}
                    </td>
                    <td
                      data-label="Amount"
                      className={item.type === 'Income' ? 'office-positive' : 'office-negative'}
                    >
                      <strong>
                        {item.type === 'Income' ? '+' : '−'}
                        {money(lkr(item.amount, item.exchangeRate))}
                      </strong>
                      <small>
                        {item.currency} {item.amount.toLocaleString()}
                      </small>
                    </td>
                    <td data-label="Actions" className="office-row-actions">
                      {item.manual && (
                        <button
                          className="local-delete"
                          aria-label="Delete record"
                          onClick={() => changePayments(items.filter((x) => x.id !== item.id))}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
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
  const [selectedId, setSelectedId] = useState('');
  const [editingId, setEditingId] = useState('');
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
  const selected = items.find((item) => item.id === selectedId);
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
      <section className="office-panel office-team-panel">
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
                <div className="office-person-actions">
                  <button
                    className="local-row-action neutral"
                    aria-label={`View ${item.name}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setEditingId('');
                    }}
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    className="local-row-action neutral"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setEditingId(item.id);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
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
      {selected && (
        <div
          className="local-modal-layer"
          role="presentation"
          onMouseDown={() => setSelectedId('')}
        >
          <section
            className="local-modal office-person-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="local-modal-icon">
                  <UserRound size={19} />
                </span>
                <div>
                  <h2 id="team-member-title">{selected.name}</h2>
                  <p>Team member profile and contact details</p>
                </div>
              </div>
              <button aria-label="Close team member" onClick={() => setSelectedId('')}>
                <X size={19} />
              </button>
            </header>
            {editingId === selected.id ? (
              <form
                className="office-form team-member-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  setEditingId('');
                }}
              >
                {(['name', 'role', 'email', 'phone'] as const).map((field) => (
                  <label key={field}>
                    <span>{field[0].toUpperCase() + field.slice(1)}</span>
                    <input
                      type={field === 'email' ? 'email' : 'text'}
                      value={selected[field]}
                      onChange={(event) =>
                        onChange(
                          items.map((item) =>
                            item.id === selected.id
                              ? { ...item, [field]: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <label>
                  <span>Employment</span>
                  <select
                    value={selected.employment}
                    onChange={(event) =>
                      onChange(
                        items.map((item) =>
                          item.id === selected.id
                            ? { ...item, employment: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Freelance</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={selected.status}
                    onChange={(event) =>
                      onChange(
                        items.map((item) =>
                          item.id === selected.id
                            ? { ...item, status: event.target.value as TeamMember['status'] }
                            : item,
                        ),
                      )
                    }
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
                <button className="button button-primary" type="submit">
                  <Check size={16} /> Save changes
                </button>
              </form>
            ) : (
              <div className="office-person-details">
                <span className="office-avatar large">
                  {selected.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <small>Role</small>
                  <strong>{selected.role}</strong>
                </div>
                <div>
                  <small>Employment</small>
                  <strong>{selected.employment}</strong>
                </div>
                <div>
                  <small>Email</small>
                  <strong>{selected.email || 'Not added'}</strong>
                </div>
                <div>
                  <small>Phone</small>
                  <strong>{selected.phone || 'Not added'}</strong>
                </div>
                <div>
                  <small>Status</small>
                  <strong>{selected.status}</strong>
                </div>
                <button className="button button-primary" onClick={() => setEditingId(selected.id)}>
                  <Pencil size={16} /> Edit member
                </button>
              </div>
            )}
          </section>
        </div>
      )}
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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const names = new Map(clients.map((client) => [client.id, clientLabel(client)]));
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
                  {clientLabel(client)}
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
              <option>TikTok</option>
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
              <p>Client plans, channel and monthly progress</p>
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
                    <th>Client / project</th>
                    <th>Platform</th>
                    <th>Team</th>
                    <th>Posts</th>
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
                        <td data-label="Client">
                          <strong>{names.get(item.clientId) || 'Unknown'}</strong>
                          <small>{projectNames.get(item.projectId) || 'No project'}</small>
                        </td>
                        <td data-label="Platform">
                          <span
                            className="office-platform-icon"
                            aria-label={socialPlatform(item.platform)}
                            title={socialPlatform(item.platform)}
                          >
                            {platformIcon(item.platform)}
                          </span>
                        </td>
                        <td data-label="Team">
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
                        <td data-label="Posts" className="office-post-progress">
                          {tracked ? (
                            <>
                              <strong>
                                {postedCount}/{item.required}
                              </strong>
                              <small>{Math.max(0, item.required - postedCount)} left</small>
                            </>
                          ) : (
                            <small>Not tracked</small>
                          )}
                        </td>
                        <td className="office-row-actions">
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
            onDateClick={(date) => {
              setSelectedEvent(null);
              setEventDate(date);
            }}
            onEventClick={(event) => {
              setSelectedEvent(event);
              setEventDate(event.date);
            }}
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
          key={`${selectedEvent?.id ?? 'new'}-${eventDate}`}
          initialDate={eventDate}
          initialEvent={selectedEvent ?? undefined}
          dateEvents={postCalendarEvents.filter((event) => event.date === eventDate)}
          readOnly={Boolean(
            selectedEvent && !events.some((event) => event.id === selectedEvent.id),
          )}
          postMode
          clients={clients}
          projects={projects}
          onSelectEvent={(event) => setSelectedEvent(event)}
          onClose={() => {
            setEventDate(null);
            setSelectedEvent(null);
          }}
          onSave={(event) => {
            onEventsChange(
              selectedEvent
                ? events.map((item) =>
                    item.id === selectedEvent.id ? { id: item.id, ...event } : item,
                  )
                : [...events, { id: crypto.randomUUID(), ...event }],
            );
            setEventDate(null);
            setSelectedEvent(null);
          }}
          onDelete={
            selectedEvent && events.some((event) => event.id === selectedEvent.id)
              ? () => {
                  onEventsChange(events.filter((event) => event.id !== selectedEvent.id));
                  setEventDate(null);
                  setSelectedEvent(null);
                }
              : undefined
          }
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
    domainLogin: '',
    serverLogin: '',
    domainDue: '',
    hostingDue: '',
  });
  const [editingId, setEditingId] = useState('');
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
    const next = { id: editingId || crypto.randomUUID(), ...draft, website: draft.website.trim() };
    onChange(
      editingId ? items.map((item) => (item.id === editingId ? next : item)) : [next, ...items],
    );
    setDraft({
      website: '',
      username: '',
      websiteUrl: '',
      domainLogin: '',
      serverLogin: '',
      domainDue: '',
      hostingDue: '',
    });
    setEditingId('');
    setFormOpen(false);
  }
  function editRenewal(item: Renewal) {
    setDraft({
      website: item.website,
      username: item.username,
      websiteUrl: item.websiteUrl,
      domainLogin: item.domainLogin ?? '',
      serverLogin: item.serverLogin ?? '',
      domainDue: item.domainDue,
      hostingDue: item.hostingDue,
    });
    setEditingId(item.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  return (
    <>
      <ModuleHeader
        eyebrow="ADMIN"
        title="Renewals"
        subtitle="Keep renewal dates and non-secret login identifiers together. Passwords are never stored here."
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
            <span>Domain login ID</span>
            <input
              autoComplete="off"
              placeholder="Username or account email"
              value={draft.domainLogin}
              onChange={(e) => setDraft({ ...draft, domainLogin: e.target.value })}
            />
          </label>
          <label>
            <span>Server login ID</span>
            <input
              autoComplete="off"
              placeholder="Username only — no password"
              value={draft.serverLogin}
              onChange={(e) => setDraft({ ...draft, serverLogin: e.target.value })}
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
            {editingId ? 'Update' : 'Save'} renewal
          </button>
        </form>
      )}
      <section className="office-panel office-renewal-panel">
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
                  <th>Access IDs</th>
                  <th>Domain</th>
                  <th>Hosting</th>
                  <th>Link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Website">
                      <strong>{item.website}</strong>
                    </td>
                    <td data-label="Access IDs">
                      <strong>{item.username || '—'}</strong>
                      {(item.domainLogin || item.serverLogin) && (
                        <small>
                          {item.domainLogin ? `Domain: ${item.domainLogin}` : ''}
                          {item.domainLogin && item.serverLogin ? ' · ' : ''}
                          {item.serverLogin ? `Server: ${item.serverLogin}` : ''}
                        </small>
                      )}
                    </td>
                    <td data-label="Domain">{item.domainDue || '—'}</td>
                    <td data-label="Hosting">{item.hostingDue || '—'}</td>
                    <td data-label="Website link">
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
                    <td className="office-row-actions" data-label="Actions">
                      <button
                        aria-label={`Edit ${item.website}`}
                        title="Edit renewal"
                        onClick={() => editRenewal(item)}
                      >
                        <Pencil size={15} />
                      </button>
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
  const [editingId, setEditingId] = useState('');
  const [preview, setPreview] = useState<ServiceLetter | null>(null);
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
    onChange(
      editingId
        ? items.map((item) => (item.id === editingId ? { id: item.id, ...draft } : item))
        : [{ id: crypto.randomUUID(), ...draft }, ...items],
    );
    setEditingId('');
    setDraft({ date: today(), client: '', subject: '', preparedBy: '', body: '' });
    setFormOpen(false);
  }
  function editLetter(item: ServiceLetter) {
    setEditingId(item.id);
    setDraft({
      date: item.date,
      client: item.client,
      subject: item.subject,
      preparedBy: item.preparedBy,
      body: item.body,
    });
    setFormOpen(true);
  }
  async function downloadLetter(item: ServiceLetter) {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFillColor(15, 37, 68);
    pdf.rect(0, 0, 210, 43, 'F');
    pdf.setFillColor(38, 126, 230);
    pdf.rect(0, 0, 210, 4, 'F');
    try {
      const logo = await imageDataUrl('/infonits-white-logo.png');
      pdf.addImage(logo, 'PNG', 16, 13, 58, 11.6);
    } catch {
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.text('infonits', 16, 24);
    }
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text('SERVICE LETTER', 194, 22, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(177, 201, 228);
    pdf.text(item.date, 194, 30, { align: 'right' });

    pdf.setTextColor(87, 106, 129);
    pdf.setFontSize(8);
    pdf.text('PREPARED FOR', 16, 58);
    pdf.setTextColor(21, 42, 68);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(item.client, 16, 67, { maxWidth: 178 });
    pdf.setFillColor(241, 246, 252);
    pdf.roundedRect(16, 79, 178, 26, 3, 3, 'F');
    pdf.setTextColor(78, 98, 122);
    pdf.setFontSize(7);
    pdf.text('SUBJECT', 22, 89);
    pdf.setTextColor(21, 42, 68);
    pdf.setFontSize(12);
    pdf.text(item.subject, 22, 98, { maxWidth: 166 });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(48, 65, 87);
    const body = pdf.splitTextToSize(item.body || 'No additional details provided.', 174);
    pdf.text(body, 18, 123, { lineHeightFactor: 1.6 });

    pdf.setDrawColor(219, 228, 238);
    pdf.line(16, 251, 88, 251);
    pdf.setTextColor(91, 108, 130);
    pdf.setFontSize(7);
    pdf.text('PREPARED BY', 16, 259);
    pdf.setTextColor(21, 42, 68);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(item.preparedBy || 'Infonits (Pvt) Ltd', 16, 267);
    pdf.setDrawColor(222, 229, 238);
    pdf.line(16, 278, 194, 278);
    pdf.setTextColor(97, 112, 132);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text('INFONITS (PVT) LTD', 16, 286);
    pdf.text('hello@infonits.io  |  www.infonits.io', 194, 286, { align: 'right' });
    const filename = `${item.subject.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'service-letter'}.pdf`;
    pdf.save(filename);
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
        onAction={() => {
          setEditingId('');
          setDraft({ date: today(), client: '', subject: '', preparedBy: '', body: '' });
          setFormOpen(!formOpen);
        }}
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
            {editingId ? 'Update letter' : 'Save letter'}
          </button>
        </form>
      )}
      <section className="office-panel office-letter-panel">
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
                    <td data-label="Date">{item.date}</td>
                    <td data-label="Client">{item.client}</td>
                    <td data-label="Subject">
                      <strong>{item.subject}</strong>
                    </td>
                    <td data-label="Prepared by">{item.preparedBy || '—'}</td>
                    <td className="office-row-actions" data-label="Actions">
                      <button
                        aria-label="View letter"
                        title="View"
                        onClick={() => setPreview(item)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        aria-label="Edit letter"
                        title="Edit"
                        onClick={() => editLetter(item)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label="Download letter PDF"
                        title="Download A4 PDF"
                        onClick={() => void downloadLetter(item)}
                      >
                        <FileDown size={16} />
                      </button>
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
      {preview && (
        <div className="local-modal-layer" role="presentation" onMouseDown={() => setPreview(null)}>
          <section
            className="local-modal letter-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="letter-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="local-modal-icon">
                  <FileText size={19} />
                </span>
                <div>
                  <h2 id="letter-preview-title">{preview.subject}</h2>
                  <p>
                    {preview.client} · {preview.date}
                  </p>
                </div>
              </div>
              <button aria-label="Close letter preview" onClick={() => setPreview(null)}>
                <X size={19} />
              </button>
            </header>
            <article className="letter-preview-paper">
              <span>INFONITS</span>
              <small>{preview.date}</small>
              <p>Prepared for</p>
              <h3>{preview.client}</h3>
              <h4>{preview.subject}</h4>
              <div>{preview.body || 'No letter content provided.'}</div>
              <footer>
                Prepared by <strong>{preview.preparedBy || 'Infonits (Pvt) Ltd'}</strong>
              </footer>
            </article>
            <footer className="letter-preview-actions">
              <button className="button button-outline" onClick={() => printLetter(preview)}>
                <Printer size={16} /> Print
              </button>
              <button
                className="button button-primary"
                onClick={() => void downloadLetter(preview)}
              >
                <FileDown size={16} /> Download PDF
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function UsersModule({
  items,
  formOpen,
  setFormOpen,
  onChange,
  preview,
}: {
  items: WorkspaceUser[];
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  onChange: (v: WorkspaceUser[]) => void;
  preview: boolean;
}) {
  const [accountEmail, setAccountEmail] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountNotice, setAccountNotice] = useState('');
  const [accountError, setAccountError] = useState('');
  const [draft, setDraft] = useState({
    name: '',
    username: '',
    role: 'Project manager',
    access: 'Projects, clients and sales',
  });

  useEffect(() => {
    if (preview) {
      setAccountEmail('preview@infonits.local');
      return;
    }
    let active = true;
    void browserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setAccountEmail(data.user?.email ?? '');
      });
    return () => {
      active = false;
    };
  }, [preview]);

  async function changePin(event: React.FormEvent) {
    event.preventDefault();
    setAccountNotice('');
    setAccountError('');
    if (preview) {
      setAccountNotice('PIN changes are disabled in mobile preview.');
      return;
    }
    if (!isSixDigitPin(newPin)) {
      setAccountError('Enter exactly 6 numbers for the new PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setAccountError('The two PIN entries do not match.');
      return;
    }
    setAccountBusy(true);
    try {
      const db = browserClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user?.email) throw new Error('Your session expired. Log in again to change the PIN.');
      const password = await pinCredential(user.email, newPin);
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      setNewPin('');
      setConfirmPin('');
      setPinOpen(false);
      setAccountNotice('Your PIN was changed successfully.');
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message.includes('session')
          ? error.message
          : 'Unable to change the PIN right now. Please try again.',
      );
    } finally {
      setAccountBusy(false);
    }
  }

  async function logOut() {
    if (preview) {
      setAccountNotice('Sign-out is disabled in mobile preview.');
      return;
    }
    setAccountBusy(true);
    setAccountError('');
    const { error } = await browserClient().auth.signOut({ scope: 'local' });
    if (error) {
      setAccountError('Unable to log out right now. Please try again.');
      setAccountBusy(false);
      return;
    }
    window.location.assign('/login');
  }

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
        subtitle="Manage your sign-in and plan workspace access."
        action="Add user"
        onAction={() => setFormOpen(!formOpen)}
      />
      <section className="office-account-card" aria-labelledby="account-security-title">
        <div className="office-account-summary">
          <span className="office-account-icon">
            <ShieldCheck size={22} />
          </span>
          <div>
            <span>YOUR ACCOUNT</span>
            <h2 id="account-security-title">Sign-in &amp; security</h2>
            <p>
              <Mail size={15} /> {accountEmail || 'Loading account…'}
            </p>
          </div>
        </div>
        <div className="office-account-actions">
          <button
            className="button button-outline"
            type="button"
            disabled={accountBusy}
            onClick={() => {
              if (pinOpen) {
                setNewPin('');
                setConfirmPin('');
              }
              setPinOpen((open) => !open);
              setAccountNotice('');
              setAccountError('');
            }}
          >
            <KeyRound size={16} /> {pinOpen ? 'Cancel' : 'Change PIN'}
          </button>
          <button
            className="button office-logout-button"
            type="button"
            disabled={accountBusy}
            onClick={() => void logOut()}
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
        {pinOpen && (
          <form className="office-pin-form" onSubmit={changePin}>
            <label>
              <span>New 6-digit PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]{6}"
                maxLength={6}
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required
              />
            </label>
            <label>
              <span>Confirm new PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="[0-9]{6}"
                maxLength={6}
                value={confirmPin}
                onChange={(event) =>
                  setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="••••••"
                required
              />
            </label>
            <button className="button button-primary" type="submit" disabled={accountBusy}>
              <KeyRound size={16} /> {accountBusy ? 'Saving…' : 'Save new PIN'}
            </button>
          </form>
        )}
        {accountNotice && (
          <p className="office-account-message success" role="status">
            <Check size={16} /> {accountNotice}
          </p>
        )}
        {accountError && (
          <p className="office-account-message error" role="alert">
            <AlertTriangle size={16} /> {accountError}
          </p>
        )}
      </section>
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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
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
            setSelectedEvent(null);
            setEventDate(date);
            setFormOpen(true);
          }}
          onEventClick={(event) => {
            setSelectedEvent(event);
            setEventDate(event.date);
            setFormOpen(true);
          }}
        />
      </section>
      {formOpen && eventDate && (
        <CalendarEventModal
          key={`${selectedEvent?.id ?? 'new'}-${eventDate}`}
          initialDate={eventDate}
          initialEvent={selectedEvent ?? undefined}
          dateEvents={derived.filter((event) => event.date === eventDate)}
          readOnly={Boolean(selectedEvent && !items.some((event) => event.id === selectedEvent.id))}
          onSelectEvent={(event) => setSelectedEvent(event)}
          onClose={() => {
            setFormOpen(false);
            setEventDate(null);
            setSelectedEvent(null);
          }}
          onSave={(event) => {
            onChange(
              selectedEvent
                ? items.map((item) =>
                    item.id === selectedEvent.id ? { id: item.id, ...event } : item,
                  )
                : [...items, { id: crypto.randomUUID(), ...event }],
            );
            setFormOpen(false);
            setEventDate(null);
            setSelectedEvent(null);
          }}
          onDelete={
            selectedEvent && items.some((event) => event.id === selectedEvent.id)
              ? () => {
                  onChange(items.filter((event) => event.id !== selectedEvent.id));
                  setFormOpen(false);
                  setEventDate(null);
                  setSelectedEvent(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function ReportsModule({
  documents,
  payments,
  operatingExpenses,
  posts,
  projects,
  clients,
  recurringInvoices,
}: {
  documents: SalesDocument[];
  payments: Payment[];
  operatingExpenses: OperatingExpense[];
  posts: PostPlan[];
  projects: ProjectRef[];
  clients: ClientRef[];
  recurringInvoices: RecurringInvoice[];
}) {
  const paidInvoices = payments
    .filter((x) => x.type === 'Income' && x.status === 'Paid' && x.invoiceId)
    .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0);
  const income = payments
    .filter((x) => x.type === 'Income' && x.status === 'Paid' && !x.invoiceId)
    .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0);
  const manualExpenses = payments
    .filter((x) => x.type === 'Expense' && x.status === 'Paid')
    .reduce((s, x) => s + lkr(x.amount, x.exchangeRate), 0);
  const projectValue = projects.reduce((s, x) => s + lkr(x.value, x.exchangeRate), 0);
  const projectCost = projects.reduce((s, x) => s + x.workDue + x.workPaid, 0);
  const operatingExpenseTotal = operatingExpenses.reduce(
    (sum, item) => sum + lkr(item.amount, item.exchangeRate),
    0,
  );
  const expenses = manualExpenses + operatingExpenseTotal + projectCost;
  const required = posts.reduce((s, x) => s + x.required, 0);
  const posted = posts.reduce((s, x) => s + x.posted, 0);
  const monthStarts = Array.from({ length: 3 }, (_, index) => {
    const value = new Date(`${thisMonth()}-01T00:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + index);
    return value.toISOString().slice(0, 7);
  });
  const forecast = monthStarts.map((month) => {
    const invoiceIncome = documents
      .filter(
        (item) =>
          item.kind === 'Invoice' && item.status !== 'Paid' && item.dueDate.startsWith(month),
      )
      .reduce(
        (sum, item) =>
          sum +
          lkr(
            Math.max(0, documentTotal(item) - paidForInvoice(item.id, payments)),
            item.exchangeRate,
          ),
        0,
      );
    const recurringIncome = recurringInvoices
      .filter((item) => item.active && item.nextRun.startsWith(month))
      .reduce((sum, item) => sum + lkr(item.amount, item.exchangeRate), 0);
    return { month, income: invoiceIncome + recurringIncome };
  });
  const clientProfitability = clients
    .map((client) => {
      const clientProjects = projects.filter((project) => project.clientId === client.id);
      const value = clientProjects.reduce(
        (sum, project) => sum + lkr(project.value, project.exchangeRate),
        0,
      );
      const cost = clientProjects.reduce(
        (sum, project) => sum + project.workDue + project.workPaid,
        0,
      );
      const received = payments
        .filter(
          (payment) =>
            payment.status === 'Paid' &&
            payment.invoiceId &&
            clientProjects.some((project) => project.id === payment.projectId),
        )
        .reduce((sum, payment) => sum + lkr(payment.amount, payment.exchangeRate), 0);
      return { id: client.id, label: clientLabel(client), value, received, profit: value - cost };
    })
    .filter((item) => item.value > 0)
    .toSorted((left, right) => right.profit - left.profit)
    .slice(0, 5);
  const cashTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${thisMonth()}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    const month = date.toISOString().slice(0, 7);
    const monthPayments = payments.filter(
      (payment) => payment.status === 'Paid' && payment.date.startsWith(month),
    );
    return {
      month,
      label: date.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
      income: monthPayments
        .filter((payment) => payment.type === 'Income')
        .reduce((sum, payment) => sum + lkr(payment.amount, payment.exchangeRate), 0),
      expenses:
        monthPayments
          .filter((payment) => payment.type === 'Expense')
          .reduce((sum, payment) => sum + lkr(payment.amount, payment.exchangeRate), 0) +
        operatingExpenses
          .filter((item) => item.date.startsWith(month))
          .reduce((sum, item) => sum + lkr(item.amount, item.exchangeRate), 0) +
        (month === thisMonth() ? projectCost : 0),
    };
  });
  const cashTrendMax = Math.max(1, ...cashTrend.flatMap((item) => [item.income, item.expenses]));
  const paidCash = paidInvoices + income;
  const cashMixTotal = Math.max(1, paidCash + expenses);
  const paidCashShare = Math.round((paidCash / cashMixTotal) * 100);
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
      <section className="office-report-visuals" aria-label="Financial charts">
        <article className="report-chart-card">
          <header>
            <span className="report-chart-icon">
              <ChartNoAxesColumnIncreasing size={19} />
            </span>
            <div>
              <h2>Six-month cash movement</h2>
              <p>Paid income and expenses by month</p>
            </div>
            <div className="report-chart-legend" aria-label="Chart legend">
              <span className="income">Income</span>
              <span className="expense">Expenses</span>
            </div>
          </header>
          <div className="report-bar-chart">
            {cashTrend.map((item) => (
              <div className="report-bar-group" key={item.month}>
                <div className="report-bars">
                  <i
                    className="income"
                    style={{
                      height: `${Math.max(item.income ? 8 : 2, (item.income / cashTrendMax) * 100)}%`,
                    }}
                    title={`${item.label} income: ${money(item.income)}`}
                  />
                  <i
                    className="expense"
                    style={{
                      height: `${Math.max(item.expenses ? 8 : 2, (item.expenses / cashTrendMax) * 100)}%`,
                    }}
                    title={`${item.label} expenses: ${money(item.expenses)}`}
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="report-chart-card report-donut-card">
          <header>
            <span className="report-chart-icon violet">
              <PieChart size={19} />
            </span>
            <div>
              <h2>Cash mix</h2>
              <p>Paid inflow compared with outflow</p>
            </div>
          </header>
          <div className="report-donut-body">
            <div
              className="report-donut"
              style={{
                background: `conic-gradient(#2377de 0 ${paidCashShare}%, #f07c67 ${paidCashShare}% 100%)`,
              }}
              role="img"
              aria-label={`${paidCashShare}% income and ${100 - paidCashShare}% expenses`}
            >
              <span>
                <strong>{paidCashShare}%</strong>
                <small>income</small>
              </span>
            </div>
            <div className="report-donut-values">
              <div>
                <span>
                  <i className="income" /> Paid income
                </span>
                <strong>{compactMoney(paidCash)}</strong>
              </div>
              <div>
                <span>
                  <i className="expense" /> Paid expenses
                </span>
                <strong>{compactMoney(expenses)}</strong>
              </div>
            </div>
          </div>
        </article>
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
        <article className="office-report-card report-forecast-card">
          <h2>90-day cash forecast</h2>
          <p className="report-card-intro">
            Expected from open invoices and active recurring schedules.
          </p>
          {forecast.map((item) => (
            <div key={item.month}>
              <span>
                {new Date(`${item.month}-02`).toLocaleDateString('en', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <strong>{money(item.income)}</strong>
            </div>
          ))}
        </article>
        <article className="office-report-card report-client-card">
          <h2>Client profitability</h2>
          <p className="report-card-intro">
            Project value after recorded work costs, with cash received.
          </p>
          {clientProfitability.length ? (
            clientProfitability.map((item) => (
              <div key={item.id}>
                <span>
                  <b>{item.label}</b>
                  <small>{money(item.received)} received</small>
                </span>
                <strong>{money(item.profit)}</strong>
              </div>
            ))
          ) : (
            <p>No project value recorded yet.</p>
          )}
        </article>
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
      <strong title={raw ? value.toLocaleString() : money(value)}>
        {raw ? value.toLocaleString() : compactMoney(value)}
      </strong>
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
