'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Bell,
  Bot,
  Archive,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  DatabaseBackup,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Globe2,
  Download,
  LayoutDashboard,
  ListTodo,
  RadioTower,
  LogOut,
  Menu,
  MessagesSquare,
  Pencil,
  PieChart,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Repeat2,
  Settings2,
  Sparkles,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  UserCircle2,
  Users,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { LocalOfficeModule, type OfficeSection } from './local-office-modules';
import { lastCloudSyncKey, LocalCloudSync } from './local-cloud-sync';
import { AgentLeads } from './agent-leads';
import { InfonitsAssistant, type AssistantAction } from './infonits-assistant';
import { browserClient } from '@/lib/supabase/browser';
import { buildMobilePreviewData, mobilePreviewSeedVersion } from '@/lib/mobile-preview-data';
import { StatusSelect } from './ui/status-select';
import { PageTitle } from './ui/typography';
import { FormModal } from './ui/form-modal';
import { DescriptionAssistant } from './ui/description-assistant';

type Section =
  | 'dashboard'
  | 'attention'
  | 'assistant'
  | 'projects'
  | 'clients'
  | 'leads'
  | 'expenses'
  | 'settings'
  | OfficeSection;
export type WorkspacePreferences = {
  businessName: string;
  invoiceBankDefault: boolean;
  bankDetails: string;
  showPaymentTerms: boolean;
  paymentTerms: string;
  voiceEnabled: boolean;
  autoSpeak: boolean;
  speechRate: number;
  voiceLanguage: string;
  notificationsEnabled: boolean;
  invoiceReminderDays: number;
  renewalReminderDays: number;
  eventReminderDays: number;
};
type LocalClient = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  followUpDate?: string;
  notes?: string;
};
type LocalRow = {
  id: string;
  project: string;
  clientId: string;
  value: number;
  currency: string;
  exchangeRate: number;
  note: string;
  discount: number;
  advance: number;
  workDue: number;
  workPaid: number;
  status: 'Waiting' | 'Partial' | 'Paid' | 'Overdue';
  createdAt: string;
  startMonth: string;
  completedMonth?: string;
  recurring: boolean;
  receivedLkr?: number;
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
    issueDate?: string;
    dueDate: string;
    status: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    description?: string;
    notes?: string;
    includeBankDetails?: boolean;
    bankDetails?: string;
    sourceQuotationId?: string;
  }>;
  trashedDocuments: Array<OfficeOverview['documents'][number] & { deletedAt: string }>;
  activityLog: Array<{
    id: string;
    action: string;
    entity: string;
    recordId: string;
    label: string;
    occurredAt: string;
  }>;
  payments: Array<{
    id: string;
    type: 'Income' | 'Expense' | 'Saving' | 'Gold' | 'Loan';
    note: string;
    category: string;
    date: string;
    status: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    invoiceId?: string;
    projectId?: string;
    receiptNumber?: string;
  }>;
  renewals: Array<{
    id: string;
    website: string;
    username?: string;
    websiteUrl?: string;
    siteStatus?: 'Unknown' | 'Online' | 'Issue' | 'Offline' | 'Maintenance';
    monitorError?: string;
    agentConnected?: boolean;
    agentLastSeen?: string;
    domainDue: string;
    hostingDue: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    date: string;
    type: string;
    completed?: boolean;
    priority?: 'Low' | 'Medium' | 'High';
    remarks?: string;
    clientId?: string;
    projectId?: string;
    memberId?: string;
  }>;
  letters: Array<{ id: string; client: string; subject: string; date: string }>;
  recurringInvoices: Array<{
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
  }>;
};

const storageKey = 'infonits-finance-local-v1';
const officeStorageKey = 'infonits-finance-office-v1';
const previewSeedKey = 'infonits-mobile-preview-seed-version';
const previewSections: Section[] = [
  'dashboard',
  'attention',
  'assistant',
  'calendar',
  'todos',
  'leads',
  'clients',
  'invoices',
  'quotations',
  'projects',
  'team',
  'posts',
  'payments',
  'expenses',
  'reports',
  'renewals',
  'documents',
  'settings',
  'users',
];
const currencies = ['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'INR', 'AED', 'SGD', 'JPY'];
const countries = [
  'Sri Lanka',
  'Australia',
  'Canada',
  'France',
  'Switzerland',
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
  Switzerland: '🇨🇭',
  India: '🇮🇳',
  Singapore: '🇸🇬',
  'United Arab Emirates': '🇦🇪',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  Other: '🌐',
};
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const emptyClient = {
  name: '',
  company: '',
  email: '',
  phone: '',
  country: 'Sri Lanka',
  followUpDate: '',
  notes: '',
};
const emptyProject = {
  project: '',
  clientId: '',
  value: '',
  discount: '',
  advance: '',
  currency: 'LKR',
  note: '',
  recurring: false,
};
const projectTemplates = [
  {
    id: 'website',
    label: 'New website',
    project: 'Website Design & Development',
    note: 'Discovery, UI design, responsive WordPress development, testing and launch support.',
    recurring: false,
  },
  {
    id: 'maintenance',
    label: 'Website care',
    project: 'Website Maintenance & Support',
    note: 'Monthly WordPress updates, backups, uptime checks, security review and content support.',
    recurring: true,
  },
  {
    id: 'social',
    label: 'Social media',
    project: 'Social Media Marketing',
    note: 'Monthly content planning, design, publishing coordination and performance reporting.',
    recurring: true,
  },
] as const;
const emptyExpense = {
  description: '',
  category: 'Office',
  amount: '',
  currency: 'LKR',
  date: today(),
};
const defaultPreferences: WorkspacePreferences = {
  businessName: 'Infonits (Pvt) Ltd',
  invoiceBankDefault: false,
  bankDetails: '',
  showPaymentTerms: true,
  paymentTerms: 'Payment is due within 10 days of the invoice date.',
  voiceEnabled: true,
  autoSpeak: true,
  speechRate: 1,
  voiceLanguage: 'en-US',
  notificationsEnabled: true,
  invoiceReminderDays: 7,
  renewalReminderDays: 30,
  eventReminderDays: 7,
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
const compactCurrency = (value: number, currency: string) => `${currency} ${compactNumber(value)}`;
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
const clientLabel = (client: Pick<LocalClient, 'name' | 'company'>) =>
  client.company.trim() || client.name;

function readOfficeOverview(): OfficeOverview {
  try {
    const saved = JSON.parse(
      localStorage.getItem(officeStorageKey) ?? '{}',
    ) as Partial<OfficeOverview>;
    return {
      documents: saved.documents ?? [],
      trashedDocuments: saved.trashedDocuments ?? [],
      activityLog: saved.activityLog ?? [],
      payments: saved.payments ?? [],
      renewals: saved.renewals ?? [],
      events: saved.events ?? [],
      letters: saved.letters ?? [],
      recurringInvoices: saved.recurringInvoices ?? [],
    };
  } catch {
    return {
      documents: [],
      trashedDocuments: [],
      activityLog: [],
      payments: [],
      renewals: [],
      events: [],
      letters: [],
      recurringInvoices: [],
    };
  }
}

export function LocalFinance() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [clients, setClients] = useState<LocalClient[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [fxRates, setFxRates] = useState<Record<string, number>>({ LKR: 1 });
  const [fxDate, setFxDate] = useState('');
  const [, setFxStatus] = useState<'loading' | 'live' | 'saved'>('loading');
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
    trashedDocuments: [],
    activityLog: [],
    payments: [],
    renewals: [],
    events: [],
    letters: [],
    recurringInvoices: [],
  });
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [officeFormSignal, setOfficeFormSignal] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'notifications' | 'today'>(
    'notifications',
  );
  const [seenNotifications, setSeenNotifications] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<WorkspacePreferences>(defaultPreferences);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);

  useEffect(() => {
    let active = true;
    let savedDate = '';
    try {
      const previewQuery = new URLSearchParams(window.location.search);
      const previewSection = previewQuery.get('ui-section');
      const isMobilePreview =
        process.env.NODE_ENV === 'development' && previewQuery.get('mobile-preview') === '1';
      const isUiPreview =
        process.env.NODE_ENV === 'development' && previewQuery.get('ui-preview') === '1';
      setMobilePreview(isMobilePreview || isUiPreview);
      if (
        process.env.NODE_ENV === 'development' &&
        previewSection &&
        previewSections.includes(previewSection as Section)
      ) {
        if (previewSection === 'assistant') {
          setSection('dashboard');
          setNovaOpen(true);
        } else {
          setSection(previewSection as Section);
        }
      }
      if (isMobilePreview && localStorage.getItem(previewSeedKey) !== mobilePreviewSeedVersion) {
        const previewData = buildMobilePreviewData();
        localStorage.setItem(storageKey, JSON.stringify(previewData.finance));
        localStorage.setItem(officeStorageKey, JSON.stringify(previewData.office));
        localStorage.setItem(previewSeedKey, mobilePreviewSeedVersion);
      }
      const saved = localStorage.getItem(storageKey);
      const parsed = saved
        ? (JSON.parse(saved) as {
            month?: string;
            rows?: Array<Partial<LocalRow> & { id: string; project: string; value: number }>;
            clients?: LocalClient[];
            expenses?: LocalExpense[];
            fxRates?: Record<string, number>;
            fxDate?: string;
            preferences?: Partial<WorkspacePreferences>;
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
            discount: Number(row.discount) || 0,
            advance: Number(row.advance) || 0,
            workDue: Number(row.workDue) || 0,
            workPaid: Number(row.workPaid) || 0,
            status: row.status ?? 'Waiting',
            createdAt: row.createdAt ?? today(),
            startMonth: row.startMonth ?? (row.createdAt ?? today()).slice(0, 7),
            completedMonth: row.completedMonth,
            recurring: row.recurring ?? false,
          }))
          .filter(
            (row) =>
              row.project.trim() ||
              row.value ||
              row.discount ||
              row.advance ||
              row.workDue ||
              row.workPaid,
          ),
      );
      setClients(
        (parsed?.clients ?? []).map((client) => ({
          ...client,
          country: client.country ?? '',
          followUpDate: client.followUpDate ?? '',
          notes: client.notes ?? '',
        })),
      );
      setExpenses(parsed?.expenses ?? []);
      setFxRates(parsed?.fxRates ?? { LKR: 1 });
      setFxDate(savedDate);
      setPreferences({ ...defaultPreferences, ...parsed?.preferences });
      setFxStatus(savedDate ? 'saved' : 'loading');
      setOfficeOverview(readOfficeOverview());
      setSeenNotifications(
        JSON.parse(localStorage.getItem('infonits-seen-notifications') ?? '[]') as string[],
      );
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
        JSON.stringify({ month, rows, clients, expenses, fxRates, fxDate, preferences }),
      );
    window.dispatchEvent(new Event('infonits:local-change'));
  }, [clients, expenses, fxDate, fxRates, loaded, month, preferences, rows]);

  useEffect(() => {
    if (!loaded) return;
    const office = readOfficeOverview();
    const due = office.recurringInvoices.filter(
      (item) => item.active && item.nextRun <= today() && item.lastGenerated !== item.nextRun,
    );
    if (!due.length) return;
    const documents = [...office.documents];
    const generatedActivity: OfficeOverview['activityLog'] = [];
    const recurringInvoices = office.recurringInvoices.map((schedule) => {
      if (!due.some((item) => item.id === schedule.id)) return schedule;
      const sequence =
        documents
          .filter((item) => item.kind === 'Invoice')
          .reduce(
            (highest, item) => Math.max(highest, Number(item.number.split('-').at(-1)) || 0),
            0,
          ) + 1;
      const runDate = schedule.nextRun;
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(sequence).padStart(3, '0')}`;
      documents.unshift({
        id: invoiceId,
        kind: 'Invoice',
        number: invoiceNumber,
        clientId: schedule.clientId,
        projectId: schedule.projectId,
        issueDate: runDate,
        dueDate: addDays(runDate, 10),
        status: 'Pending',
        amount: schedule.amount,
        currency: schedule.currency,
        exchangeRate: schedule.exchangeRate,
        description: schedule.description,
        notes: preferences.showPaymentTerms ? preferences.paymentTerms : '',
        includeBankDetails: preferences.invoiceBankDefault,
        bankDetails: preferences.invoiceBankDefault ? preferences.bankDetails : '',
      });
      generatedActivity.push({
        id: crypto.randomUUID(),
        action: 'Generated',
        entity: 'Recurring invoice',
        recordId: invoiceId,
        label: invoiceNumber,
        occurredAt: new Date().toISOString(),
      });
      const next = new Date(`${runDate}T00:00:00Z`);
      if (schedule.frequency === 'Yearly') next.setUTCFullYear(next.getUTCFullYear() + 1);
      else next.setUTCMonth(next.getUTCMonth() + (schedule.frequency === 'Quarterly' ? 3 : 1));
      let nextRun = next.toISOString().slice(0, 10);
      while (nextRun <= today()) {
        const later = new Date(`${nextRun}T00:00:00Z`);
        if (schedule.frequency === 'Yearly') later.setUTCFullYear(later.getUTCFullYear() + 1);
        else later.setUTCMonth(later.getUTCMonth() + (schedule.frequency === 'Quarterly' ? 3 : 1));
        nextRun = later.toISOString().slice(0, 10);
      }
      return { ...schedule, lastGenerated: runDate, nextRun };
    });
    const raw = JSON.parse(localStorage.getItem(officeStorageKey) ?? '{}') as Record<
      string,
      unknown
    >;
    localStorage.setItem(
      officeStorageKey,
      JSON.stringify({
        ...raw,
        documents,
        recurringInvoices,
        activityLog: [...generatedActivity, ...office.activityLog].slice(0, 200),
      }),
    );
    setOfficeOverview({
      ...office,
      documents,
      recurringInvoices,
      activityLog: [...generatedActivity, ...office.activityLog].slice(0, 200),
    });
    window.dispatchEvent(new Event('infonits:local-change'));
  }, [loaded]);

  useEffect(() => {
    const refreshOfficeOverview = () => setOfficeOverview(readOfficeOverview());
    window.addEventListener('infonits:local-change', refreshOfficeOverview);
    window.addEventListener('infonits:cloud-update', refreshOfficeOverview);
    window.addEventListener('storage', refreshOfficeOverview);
    return () => {
      window.removeEventListener('infonits:local-change', refreshOfficeOverview);
      window.removeEventListener('infonits:cloud-update', refreshOfficeOverview);
      window.removeEventListener('storage', refreshOfficeOverview);
    };
  }, []);

  const paidInvoiceTotals = useMemo(() => {
    const values = new Map<string, number>();
    officeOverview.documents
      .filter((item) => item.kind === 'Invoice' && item.projectId)
      .forEach((item) => {
        const linked = officeOverview.payments.filter(
          (payment) =>
            payment.invoiceId === item.id && payment.type === 'Income' && payment.status === 'Paid',
        );
        const received = linked.length
          ? linked.reduce(
              (sum, payment) => sum + localValue(payment.amount, payment.exchangeRate),
              0,
            )
          : item.status === 'Paid'
            ? localValue(item.amount, item.exchangeRate)
            : 0;
        if (!received) return;
        values.set(item.projectId, (values.get(item.projectId) ?? 0) + received);
      });
    return values;
  }, [officeOverview.documents, officeOverview.payments]);

  const effectiveRows = useMemo(
    () =>
      rows.map((row) => {
        const value = localValue(row.value, row.exchangeRate);
        const recordedReceived = localValue(row.advance, row.exchangeRate);
        const receivedLkr = Math.max(recordedReceived, paidInvoiceTotals.get(row.id) ?? 0);
        const receivedOriginal = row.exchangeRate ? receivedLkr / row.exchangeRate : row.advance;
        return {
          ...row,
          advance: Math.max(row.advance, receivedOriginal),
          receivedLkr,
          status:
            receivedLkr >= value && value > 0
              ? ('Paid' as const)
              : receivedLkr > 0
                ? ('Partial' as const)
                : row.status,
        };
      }),
    [paidInvoiceTotals, rows],
  );

  const monthRows = useMemo(
    () =>
      effectiveRows.filter((row) => {
        if (row.startMonth > month) return false;
        if (row.recurring) return true;
        return !row.completedMonth || month <= row.completedMonth;
      }),
    [effectiveRows, month],
  );

  const totals = useMemo(() => {
    const projects = monthRows.reduce(
      (sum, row) => {
        const valueLkr = localValue(row.value, row.exchangeRate);
        const receivedLkr = row.receivedLkr ?? localValue(row.advance, row.exchangeRate);
        const workLkr = localValue(row.workDue + row.workPaid, row.exchangeRate);
        return {
          value: sum.value + valueLkr,
          received: sum.received + receivedLkr,
          work: sum.work + workLkr,
          remaining: sum.remaining + valueLkr - receivedLkr - workLkr,
        };
      },
      { value: 0, received: 0, work: 0, remaining: 0 },
    );
    const expenseTotal = expenses.reduce(
      (sum, expense) => sum + localValue(expense.amount, expense.exchangeRate),
      0,
    );
    const additionalIncome = officeOverview.payments
      .filter(
        (payment) => payment.status === 'Paid' && payment.type === 'Income' && !payment.invoiceId,
      )
      .reduce((sum, payment) => sum + localValue(payment.amount, payment.exchangeRate), 0);
    const additionalExpenses = officeOverview.payments
      .filter((payment) => payment.status === 'Paid' && payment.type === 'Expense')
      .reduce((sum, payment) => sum + localValue(payment.amount, payment.exchangeRate), 0);
    return {
      ...projects,
      received: projects.received + additionalIncome,
      expenses: expenseTotal + additionalExpenses,
      net: projects.value - projects.work - expenseTotal - additionalExpenses,
    };
  }, [expenses, monthRows, officeOverview.payments]);

  const notifications = useMemo(() => {
    const now = new Date(`${today()}T00:00:00`).getTime();
    const invoiceItems = officeOverview.documents
      .filter((item) => {
        if (!preferences.notificationsEnabled || item.kind !== 'Invoice' || item.status === 'Paid')
          return false;
        const due = new Date(`${item.dueDate || today()}T00:00:00`).getTime();
        return due - now <= preferences.invoiceReminderDays * 86_400_000;
      })
      .map((item) => {
        const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`).getTime() : now;
        const overdue = item.status === 'Overdue' || due < now;
        return {
          id: `invoice-${item.id}`,
          title: `${item.number} ${overdue ? 'is overdue' : 'needs payment'}`,
          detail: `${item.currency} ${compactNumber(item.amount)} · ${shortDate(item.dueDate)}`,
          tone: overdue ? 'urgent' : 'info',
          section: 'invoices' as Section,
        };
      });
    const renewalItems = officeOverview.renewals
      .flatMap((item) => [
        { id: `domain-${item.id}`, label: 'domain', date: item.domainDue },
        { id: `hosting-${item.id}`, label: 'hosting', date: item.hostingDue },
      ])
      .filter((item) => {
        if (!item.date) return false;
        const due = new Date(`${item.date}T00:00:00`).getTime();
        return (
          preferences.notificationsEnabled &&
          due - now <= preferences.renewalReminderDays * 86_400_000
        );
      })
      .map((item) => ({
        id: item.id,
        title: `${item.label[0].toUpperCase()}${item.label.slice(1)} renewal due`,
        detail: shortDate(item.date),
        tone: 'warning',
        section: 'renewals' as Section,
      }));
    const eventItems = officeOverview.events
      .filter((item) => {
        if (!preferences.notificationsEnabled || !item.date) return false;
        const due = new Date(`${item.date}T00:00:00`).getTime();
        return due >= now && due - now <= preferences.eventReminderDays * 86_400_000;
      })
      .map((item) => ({
        id: `event-${item.id}`,
        title: item.title,
        detail: `${item.type} · ${shortDate(item.date)}`,
        tone: 'info',
        section: (item.type === 'Task' ? 'todos' : 'calendar') as Section,
      }));
    return [...invoiceItems, ...renewalItems, ...eventItems].slice(0, 12);
  }, [
    officeOverview,
    preferences.eventReminderDays,
    preferences.invoiceReminderDays,
    preferences.notificationsEnabled,
    preferences.renewalReminderDays,
  ]);

  const todayNotifications = useMemo(() => {
    const clientNames = new Map(clients.map((client) => [client.id, clientLabel(client)]));
    return [
      ...officeOverview.events
        .filter((item) => item.type === 'Task' && !item.completed && item.date <= today())
        .map((item) => ({
          id: `today-task-${item.id}`,
          title: item.title,
          detail: item.date < today() ? `Overdue · ${shortDate(item.date)}` : 'Due today',
          tone: item.date < today() ? 'urgent' : 'info',
          section: 'todos' as Section,
        })),
      ...clients
        .filter((client) => client.followUpDate && client.followUpDate <= today())
        .map((client) => ({
          id: `today-client-${client.id}`,
          title: `Follow up ${clientLabel(client)}`,
          detail: client.notes || client.email || client.phone || 'Open client profile',
          tone: 'warning',
          section: 'clients' as Section,
        })),
      ...officeOverview.documents
        .filter(
          (item) =>
            item.kind === 'Invoice' &&
            item.status !== 'Paid' &&
            Boolean(item.dueDate) &&
            item.dueDate < today(),
        )
        .map((item) => ({
          id: `today-invoice-${item.id}`,
          title: `${item.number} payment`,
          detail: `${clientNames.get(item.clientId ?? '') ?? 'Unknown client'} · overdue`,
          tone: 'urgent',
          section: 'invoices' as Section,
        })),
    ].slice(0, 10);
  }, [clients, officeOverview.documents, officeOverview.events]);

  const unreadNotifications = notifications.filter(
    (notification) => !seenNotifications.includes(notification.id),
  ).length;
  const visibleNotificationItems = notificationTab === 'today' ? todayNotifications : notifications;
  const assistantContext = useMemo(
    () => ({
      today: today(),
      totals: {
        projectValue: totals.value,
        received: totals.received,
        workCost: totals.work,
        expenses: totals.expenses,
        estimatedProfit: totals.net,
      },
      clients: clients.map((client) => ({ id: client.id, name: clientLabel(client) })),
      projects: effectiveRows.map((row) => ({ id: row.id, name: row.project })),
      recentInvoices: officeOverview.documents
        .filter((document) => document.kind === 'Invoice')
        .slice(0, 20)
        .map((document) => ({
          number: document.number,
          client: clientLabel(
            clients.find((client) => client.id === document.clientId) ?? {
              name: 'Unknown',
              company: '',
            },
          ),
          status: document.status,
          amount: document.amount,
          currency: document.currency,
          project: effectiveRows.find((row) => row.id === document.projectId)?.project ?? '',
          dueDate: document.dueDate,
        })),
      recentExpenses: expenses.slice(0, 20).map((expense) => ({
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date,
      })),
      recentPayments: officeOverview.payments.slice(0, 20).map((payment) => ({
        type: payment.type,
        category: payment.category,
        note: payment.note,
        amount: payment.amount,
        currency: payment.currency,
        date: payment.date,
        status: payment.status,
      })),
      renewals: officeOverview.renewals.slice(0, 20).map((renewal) => ({
        website: renewal.website,
        domainDue: renewal.domainDue,
        hostingDue: renewal.hostingDue,
        siteStatus: renewal.siteStatus,
        monitorError: renewal.monitorError,
      })),
      events: officeOverview.events.slice(0, 20).map((event) => ({
        title: event.title,
        date: event.date,
        type: event.type,
        completed: event.completed,
      })),
      letters: officeOverview.letters.slice(0, 20).map((letter) => ({
        client: letter.client,
        subject: letter.subject,
        date: letter.date,
      })),
    }),
    [clients, effectiveRows, expenses, officeOverview, totals],
  );
  const globalSearchItems = useMemo(
    () => [
      ...clients.map((client) => ({
        id: `client-${client.id}`,
        recordId: client.id,
        kind: 'Client',
        title: clientLabel(client),
        subtitle: client.email || client.phone || 'Client record',
        section: 'clients' as Section,
      })),
      ...effectiveRows.map((project) => ({
        id: `project-${project.id}`,
        recordId: project.id,
        kind: 'Project',
        title: project.project,
        subtitle: `${project.currency} ${project.value.toLocaleString()} · ${project.status}`,
        section: 'projects' as Section,
      })),
      ...officeOverview.documents.map((document) => ({
        id: `document-${document.id}`,
        recordId: document.id,
        kind: document.kind,
        title: document.number,
        subtitle: `${document.currency} ${document.amount.toLocaleString()} · ${document.status}`,
        section: (document.kind === 'Invoice' ? 'invoices' : 'quotations') as Section,
      })),
      ...officeOverview.renewals.map((website) => ({
        id: `website-${website.id}`,
        recordId: website.id,
        kind: 'Website',
        title: website.website,
        subtitle: website.websiteUrl || website.siteStatus || 'Website care',
        section: 'renewals' as Section,
      })),
      ...officeOverview.events.map((event) => ({
        id: `event-${event.id}`,
        recordId: event.id,
        kind: event.type,
        title: event.title,
        subtitle: `${event.date}${event.completed ? ' · Completed' : ''}`,
        section: (event.type === 'Task' ? 'todos' : 'calendar') as Section,
      })),
    ],
    [
      clients,
      effectiveRows,
      officeOverview.documents,
      officeOverview.events,
      officeOverview.renewals,
    ],
  );

  const selectedProject = effectiveRows.find((row) => row.id === selectedProjectId);
  const selectedProjectClient = clients.find((client) => client.id === selectedProject?.clientId);
  const selectedProjectInvoices = officeOverview.documents.filter(
    (document) => document.kind === 'Invoice' && document.projectId === selectedProjectId,
  );

  function changeSection(next: Section) {
    if (next === 'assistant') {
      setNovaOpen(true);
      setMenuOpen(false);
      setNotificationsOpen(false);
      setProfileOpen(false);
      return;
    }
    setSection(next);
    setMenuOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  function rateFor(currency: string) {
    return currency === 'LKR' ? 1 : (fxRates[currency] ?? 1);
  }

  function addProject(event: React.FormEvent) {
    event.preventDefault();
    const project = projectDraft.project.trim();
    const value = Number(projectDraft.value);
    const discount = Number(projectDraft.discount || 0);
    const advance = Number(projectDraft.advance || 0);
    if (
      !project ||
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isFinite(discount) ||
      discount < 0 ||
      !Number.isFinite(advance) ||
      advance < 0
    )
      return;
    setRows((current) => [
      {
        id: crypto.randomUUID(),
        project,
        clientId: projectDraft.clientId,
        value,
        currency: projectDraft.currency,
        exchangeRate: rateFor(projectDraft.currency),
        note: projectDraft.note.trim(),
        discount,
        advance,
        workDue: 0,
        workPaid: 0,
        status: 'Waiting',
        createdAt: today(),
        startMonth: month,
        recurring: projectDraft.recurring,
      },
      ...current,
    ]);
    setProjectDraft(emptyProject);
    setProjectFormOpen(false);
    setSection('projects');
  }

  function updateProject(id: string, patch: Partial<LocalRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (patch.status === 'Paid' && row.status !== 'Paid') next.completedMonth = month;
        if (patch.status && patch.status !== 'Paid') next.completedMonth = undefined;
        return next;
      }),
    );
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

  function quickAdd(type: 'project' | 'client' | 'expense' | 'invoice' | 'task') {
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
    if (type === 'task') {
      setSection('todos');
      setOfficeFormSignal((current) => current + 1);
      return;
    }
    setSection('invoices');
    setOfficeFormSignal((current) => current + 1);
  }

  function applyAssistantAction(action: Exclude<AssistantAction, { type: 'none' }>): string {
    if (action.type === 'batch') {
      const results = action.actions.map((item) => applyAssistantAction(item));
      return `${action.title} applied. ${results.join(' ')}`;
    }
    const findClient = (name: string) => {
      const target = name.trim().toLowerCase();
      return clients.find(
        (client) =>
          client.name.toLowerCase() === target ||
          client.company.toLowerCase() === target ||
          clientLabel(client).toLowerCase() === target,
      );
    };
    const findProject = (name: string) =>
      rows.find((row) => row.project.toLowerCase() === name.trim().toLowerCase());
    const rate = (currency: string) => (currency === 'LKR' ? 1 : (fxRates[currency] ?? 1));

    if (action.type === 'create_client') {
      setClients((current) => [
        {
          id: crypto.randomUUID(),
          name: action.name,
          company: action.company,
          email: action.email,
          phone: action.phone,
          country: action.country || 'Sri Lanka',
        },
        ...current,
      ]);
      return `${action.name} was added to Clients.`;
    }
    if (action.type === 'create_project') {
      const client = findClient(action.clientName);
      setRows((current) => [
        {
          id: crypto.randomUUID(),
          project: action.project,
          clientId: client?.id ?? '',
          value: action.amount,
          currency: action.currency,
          exchangeRate: rate(action.currency),
          note: action.note,
          discount: 0,
          advance: 0,
          workDue: 0,
          workPaid: 0,
          status: 'Waiting',
          createdAt: today(),
          startMonth: month,
          recurring: false,
        },
        ...current,
      ]);
      return `${action.project} was added to Projects${client ? ` for ${clientLabel(client)}` : ''}.`;
    }
    if (action.type === 'create_expense') {
      setExpenses((current) => [
        {
          id: crypto.randomUUID(),
          description: action.description,
          category: action.category,
          amount: action.amount,
          currency: action.currency,
          exchangeRate: rate(action.currency),
          date: action.date || today(),
        },
        ...current,
      ]);
      return `${action.description} was added to Expenses.`;
    }

    let saved: Record<string, unknown[]>;
    try {
      saved = JSON.parse(localStorage.getItem(officeStorageKey) ?? '{}') as Record<
        string,
        unknown[]
      >;
    } catch {
      saved = {};
    }
    const documents = (saved.documents ?? []) as OfficeOverview['documents'];
    const payments = (saved.payments ?? []) as OfficeOverview['payments'];
    const renewals = (saved.renewals ?? []) as OfficeOverview['renewals'];
    const events = (saved.events ?? []) as Array<Record<string, unknown>>;
    const letters = (saved.letters ?? []) as Array<{
      id: string;
      date: string;
      client: string;
      subject: string;
      preparedBy: string;
      body: string;
    }>;

    if (action.type === 'create_invoice' || action.type === 'create_quotation') {
      const client = findClient(action.clientName);
      if (!client)
        return `I could not apply this because client “${action.clientName}” was not found.`;
      const project = findProject(action.projectName);
      const kind = action.type === 'create_invoice' ? 'Invoice' : 'Quotation';
      const prefix = kind === 'Invoice' ? 'INV' : 'QUO';
      const next =
        documents
          .filter((item) => item.kind === kind)
          .reduce(
            (highest, item) => Math.max(highest, Number(item.number.split('-').at(-1)) || 0),
            0,
          ) + 1;
      documents.unshift({
        id: crypto.randomUUID(),
        kind,
        number: `${prefix}-${new Date().getFullYear()}-${String(next).padStart(3, '0')}`,
        clientId: client.id,
        projectId: project?.id ?? '',
        dueDate: addDays(today(), 10),
        status: kind === 'Invoice' ? 'Pending' : 'Draft',
        amount: action.amount,
        currency: action.currency,
        exchangeRate: rate(action.currency),
        issueDate: today(),
        description: action.description,
        notes: action.notes,
        includeBankDetails: action.includeBankDetails || preferences.invoiceBankDefault,
        bankDetails:
          action.bankDetails || (preferences.invoiceBankDefault ? preferences.bankDetails : ''),
      } as OfficeOverview['documents'][number]);
      saved.documents = documents;
      localStorage.setItem(officeStorageKey, JSON.stringify(saved));
      setOfficeOverview(readOfficeOverview());
      window.dispatchEvent(new Event('infonits:local-change'));
      return `${kind} ${prefix}-${new Date().getFullYear()}-${String(next).padStart(3, '0')} was created for ${clientLabel(client)}.`;
    }
    if (action.type === 'create_letter') {
      letters.unshift({
        id: crypto.randomUUID(),
        date: action.date || today(),
        client: action.clientName,
        subject: action.subject,
        preparedBy: action.preparedBy || 'Infonits (Pvt) Ltd',
        body: action.body,
      });
      saved.letters = letters;
      localStorage.setItem(officeStorageKey, JSON.stringify(saved));
      setOfficeOverview(readOfficeOverview());
      window.dispatchEvent(new Event('infonits:local-change'));
      return `The service letter “${action.subject}” was added to Documents.`;
    }
    if (action.type === 'create_payment') {
      payments.unshift({
        id: crypto.randomUUID(),
        note: action.note,
        category: action.category,
        date: action.date || today(),
        status: 'Pending',
        amount: action.amount,
        currency: action.currency,
        exchangeRate: rate(action.currency),
        type: action.paymentType,
      } as OfficeOverview['payments'][number]);
      saved.payments = payments;
    } else if (action.type === 'create_event') {
      events.unshift({
        id: crypto.randomUUID(),
        title: action.title,
        date: action.date,
        type: action.eventType,
      });
      saved.events = events;
    } else if (action.type === 'create_renewal') {
      renewals.unshift({
        id: crypto.randomUUID(),
        website: action.website,
        username: '',
        websiteUrl: '',
        domainDue: action.domainDue,
        hostingDue: action.hostingDue,
      });
      saved.renewals = renewals;
    }
    localStorage.setItem(officeStorageKey, JSON.stringify(saved));
    setOfficeOverview(readOfficeOverview());
    window.dispatchEvent(new Event('infonits:local-change'));
    return 'The new record was added to your workspace.';
  }

  function createInvoice(row: LocalRow) {
    localStorage.setItem(
      'infonits-invoice-draft',
      JSON.stringify({
        clientId: row.clientId,
        projectId: row.id,
        amount: String(row.value),
        currency: row.currency,
        description: row.note,
        discount: String(row.discount),
        advance: String(row.advance),
        notes: preferences.showPaymentTerms ? preferences.paymentTerms : '',
        includeBankDetails: preferences.invoiceBankDefault,
        bankDetails: preferences.invoiceBankDefault ? preferences.bankDetails : '',
      }),
    );
    setSection('invoices');
    setMenuOpen(false);
  }

  function openDashboardInvoice(id: string, mode: 'view' | 'edit') {
    localStorage.setItem(`infonits-invoice-${mode}-id`, id);
    setNotificationsOpen(false);
    setSection('invoices');
  }

  async function logOut() {
    const { error } = await browserClient().auth.signOut({ scope: 'local' });
    if (error) {
      window.alert('Unable to log out right now. Please try again.');
      return;
    }
    window.location.assign('/login');
  }

  function deleteDashboardInvoice(id: string) {
    if (!window.confirm('Move this invoice to Trash? You can restore it for 30 days.')) return;
    let saved: Record<string, unknown>;
    try {
      saved = JSON.parse(localStorage.getItem(officeStorageKey) ?? '{}') as Record<string, unknown>;
    } catch {
      saved = {};
    }
    const documents = Array.isArray(saved.documents)
      ? (saved.documents as OfficeOverview['documents'])
      : [];
    const deleted = documents.find((document) => document.id === id);
    if (!deleted) return;
    const trashedDocuments = Array.isArray(saved.trashedDocuments)
      ? (saved.trashedDocuments as OfficeOverview['trashedDocuments'])
      : [];
    const activityLog = Array.isArray(saved.activityLog)
      ? (saved.activityLog as OfficeOverview['activityLog'])
      : [];
    saved.documents = documents.filter((document) => document.id !== id);
    saved.trashedDocuments = [
      { ...deleted, deletedAt: new Date().toISOString() },
      ...trashedDocuments,
    ];
    saved.activityLog = [
      {
        id: crypto.randomUUID(),
        action: 'Deleted',
        entity: 'Invoice',
        recordId: deleted.id,
        label: deleted.number,
        occurredAt: new Date().toISOString(),
      },
      ...activityLog,
    ].slice(0, 200);
    localStorage.setItem(officeStorageKey, JSON.stringify(saved));
    setOfficeOverview(readOfficeOverview());
    window.dispatchEvent(new Event('infonits:local-change'));
  }

  function updateDashboardInvoiceStatus(id: string, status: string) {
    let saved: Record<string, unknown>;
    try {
      saved = JSON.parse(localStorage.getItem(officeStorageKey) ?? '{}') as Record<string, unknown>;
    } catch {
      saved = {};
    }
    const documents = Array.isArray(saved.documents)
      ? (saved.documents as OfficeOverview['documents'])
      : [];
    const changed = documents.find((document) => document.id === id);
    const activityLog = Array.isArray(saved.activityLog)
      ? (saved.activityLog as OfficeOverview['activityLog'])
      : [];
    saved.documents = documents.map((document) =>
      document.id === id ? { ...document, status } : document,
    );
    if (changed) {
      saved.activityLog = [
        {
          id: crypto.randomUUID(),
          action: 'Updated',
          entity: 'Invoice',
          recordId: changed.id,
          label: `${changed.number} · ${status}`,
          occurredAt: new Date().toISOString(),
        },
        ...activityLog,
      ].slice(0, 200);
    }
    localStorage.setItem(officeStorageKey, JSON.stringify(saved));
    setOfficeOverview(readOfficeOverview());
    window.dispatchEvent(new Event('infonits:local-change'));
  }

  function exportCsv() {
    const clientNames = new Map(clients.map((client) => [client.id, clientLabel(client)]));
    const csv = [
      [
        'Project',
        'Client',
        'Amount',
        'Currency',
        'Rate to LKR',
        'Value LKR',
        'Advance',
        'Advance LKR',
        'Work due',
        'Work due LKR',
        'Work paid',
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
        localValue(row.advance, row.exchangeRate),
        row.workDue,
        localValue(row.workDue, row.exchangeRate),
        row.workPaid,
        localValue(row.workPaid, row.exchangeRate),
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

  if (!loaded)
    return (
      <main className="workspace-loader" role="status">
        <div className="workspace-loader-mark">
          <img src="/infonits-logo.png" alt="" width={136} height={34} />
          <span>
            <i />
            <i />
            <i />
          </span>
        </div>
        <strong>Preparing your workspace</strong>
        <p>Syncing projects, invoices and finance data…</p>
        <div className="workspace-loader-line">
          <i />
        </div>
      </main>
    );

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
          <img src="/infonits-white-logo.png" alt="infonits" width={154} height={36} />
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
              className={section === 'attention' ? 'active' : ''}
              onClick={() => changeSection('attention')}
            >
              <AlertTriangle size={19} />
              <span>Attention</span>
              <b>{notifications.length}</b>
            </button>
            <button
              className={section === 'calendar' ? 'active' : ''}
              onClick={() => changeSection('calendar')}
            >
              <CalendarDays size={19} />
              <span>Calendar</span>
            </button>
            <button
              className={section === 'todos' ? 'active' : ''}
              onClick={() => changeSection('todos')}
            >
              <ListTodo size={19} />
              <span>To-do</span>
              <b>
                {
                  officeOverview.events.filter((event) => event.type === 'Task' && !event.completed)
                    .length
                }
              </b>
            </button>
          </SidebarGroup>
          <SidebarGroup label="Sales">
            <button
              className={section === 'leads' ? 'active' : ''}
              onClick={() => changeSection('leads')}
            >
              <RadioTower size={19} />
              <span>Agent leads</span>
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
              <span>Finance tracker</span>
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
              <span>Website care</span>
            </button>
            <button
              className={section === 'documents' ? 'active' : ''}
              onClick={() => changeSection('documents')}
            >
              <FileText size={19} />
              <span>Documents</span>
            </button>
          </SidebarGroup>
        </nav>
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
          <div className="local-topbar-actions">
            <button
              type="button"
              className="local-global-search-button"
              aria-label="Search workspace"
              onClick={() => setGlobalSearchOpen(true)}
            >
              <Search size={17} /> <span>Search</span>
            </button>
            <button
              type="button"
              className="local-ai-shortcut"
              aria-label="Open Nova personal assistant"
              aria-expanded={novaOpen}
              onClick={() => setNovaOpen(true)}
            >
              <Sparkles size={17} />
            </button>
            <div className="local-notification-wrap">
              <button
                type="button"
                className="local-notification-button"
                aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {unreadNotifications > 0 && <b>{unreadNotifications}</b>}
              </button>
              {notificationsOpen && (
                <section className="local-notification-panel" aria-label="Notifications panel">
                  <header>
                    <div>
                      <strong>{notificationTab === 'today' ? 'Today' : 'Notifications'}</strong>
                      <small>
                        {notificationTab === 'today'
                          ? 'Tasks, follow-ups and overdue invoices'
                          : 'Invoices, events and website care'}
                      </small>
                    </div>
                    {notificationTab === 'notifications' && unreadNotifications > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const ids = notifications.map((item) => item.id);
                          setSeenNotifications(ids);
                          localStorage.setItem('infonits-seen-notifications', JSON.stringify(ids));
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </header>
                  <div className="local-notification-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={notificationTab === 'notifications'}
                      className={notificationTab === 'notifications' ? 'active' : ''}
                      onClick={() => setNotificationTab('notifications')}
                    >
                      <Bell size={14} /> <span>Notifications</span> <b>{unreadNotifications}</b>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={notificationTab === 'today'}
                      className={notificationTab === 'today' ? 'active' : ''}
                      onClick={() => setNotificationTab('today')}
                    >
                      <CalendarDays size={14} /> <span>Today</span>{' '}
                      <b>{todayNotifications.length}</b>
                    </button>
                  </div>
                  <div>
                    {visibleNotificationItems.length ? (
                      visibleNotificationItems.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          className={seenNotifications.includes(notification.id) ? 'seen' : ''}
                          onClick={() => {
                            if (notificationTab === 'notifications') {
                              const next = [...new Set([...seenNotifications, notification.id])];
                              setSeenNotifications(next);
                              localStorage.setItem(
                                'infonits-seen-notifications',
                                JSON.stringify(next),
                              );
                            }
                            setNotificationsOpen(false);
                            changeSection(notification.section);
                          }}
                        >
                          <i className={notification.tone} />
                          <span>
                            <strong>{notification.title}</strong>
                            <small>{notification.detail}</small>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p>
                        <ShieldCheck size={18} /> You are all caught up.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
            <LocalCloudSync />
            <div className="local-profile-wrap">
              <button
                type="button"
                className="local-profile-button"
                aria-label="Open profile settings"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((open) => !open)}
              >
                <UserCircle2 size={19} />
              </button>
              {profileOpen && (
                <section className="local-profile-menu" aria-label="Profile menu">
                  <strong>{preferences.businessName || 'Workspace'}</strong>
                  <small>Workspace administrator</small>
                  <button type="button" onClick={() => changeSection('settings')}>
                    <Settings2 size={15} /> Profile & settings
                  </button>
                  <button type="button" className="logout" onClick={() => void logOut()}>
                    <LogOut size={15} /> Log out
                  </button>
                </section>
              )}
            </div>
          </div>
        </header>

        <main className="local-main">
          {section === 'dashboard' && (
            <Dashboard
              totals={totals}
              rows={monthRows}
              rates={fxRates}
              clients={clients}
              expenses={expenses}
              office={officeOverview}
              onAddProject={openProjectForm}
              onSection={changeSection}
              onInvoiceView={(id) => openDashboardInvoice(id, 'view')}
              onInvoiceEdit={(id) => openDashboardInvoice(id, 'edit')}
              onInvoiceStatusChange={updateDashboardInvoiceStatus}
              onInvoiceDelete={deleteDashboardInvoice}
            />
          )}

          {section === 'attention' && (
            <AttentionCenter
              office={officeOverview}
              clients={clients}
              preferences={preferences}
              onSection={changeSection}
            />
          )}

          {section === 'settings' && (
            <WorkspaceSettings
              preferences={preferences}
              onChange={setPreferences}
              clients={clients}
              projects={rows}
              expenses={expenses}
              rates={fxRates}
              preview={mobilePreview}
            />
          )}

          {section === 'projects' && (
            <>
              <PageHeading
                eyebrow="WORK"
                title="Projects"
                subtitle="Track every project in its original currency with the LKR equivalent underneath."
              >
                <button onClick={exportCsv} className="button button-outline">
                  <Download size={16} /> Export
                </button>
                <button className="button button-primary" onClick={() => setProjectFormOpen(true)}>
                  <Plus size={16} /> Add project
                </button>
              </PageHeading>
              {projectFormOpen && (
                <FormModal
                  title="Add project"
                  subtitle="Keep project value, client and currency in one clear record."
                  icon={<BriefcaseBusiness size={19} />}
                  className="local-project-modal"
                  onClose={() => setProjectFormOpen(false)}
                >
                  <ProjectForm
                    draft={projectDraft}
                    setDraft={setProjectDraft}
                    clients={clients}
                    rates={fxRates}
                    onSubmit={addProject}
                    onCancel={() => setProjectFormOpen(false)}
                  />
                </FormModal>
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
                    <small>{monthRows.length} projects · all totals in LKR</small>
                  </div>
                  <input
                    aria-label="Finance month"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </div>
                <ProjectTable
                  rows={monthRows}
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
                <button className="button button-primary" onClick={() => setClientFormOpen(true)}>
                  <UserPlus size={16} /> Add client
                </button>
              </PageHeading>
              {clientFormOpen && (
                <FormModal
                  title="Add client"
                  subtitle="Create a client profile and connect it to future projects."
                  icon={<UserPlus size={19} />}
                  onClose={() => setClientFormOpen(false)}
                >
                  <ClientForm draft={clientDraft} setDraft={setClientDraft} onSubmit={addClient} />
                </FormModal>
              )}
              <ClientList
                clients={clients}
                rows={effectiveRows}
                office={officeOverview}
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

          {section === 'leads' && <AgentLeads preview={mobilePreview} />}

          {section === 'expenses' && (
            <>
              <PageHeading
                eyebrow="OUTGOING"
                title="Expenses"
                subtitle="Track operating costs separately from project work costs."
              >
                <button className="button button-primary" onClick={() => setExpenseFormOpen(true)}>
                  <Plus size={16} /> Add expense
                </button>
              </PageHeading>
              {expenseFormOpen && (
                <FormModal
                  title="Add expense"
                  subtitle="Record an operating cost in its original currency."
                  icon={<ReceiptText size={19} />}
                  onClose={() => setExpenseFormOpen(false)}
                >
                  <ExpenseForm
                    draft={expenseDraft}
                    setDraft={setExpenseDraft}
                    rates={fxRates}
                    onSubmit={addExpense}
                  />
                </FormModal>
              )}
              <ExpenseList
                expenses={expenses}
                rates={fxRates}
                onAdd={() => setExpenseFormOpen(true)}
                onUpdate={(id, patch) =>
                  setExpenses((current) =>
                    current.map((expense) =>
                      expense.id === id ? { ...expense, ...patch } : expense,
                    ),
                  )
                }
                onDelete={(id) =>
                  setExpenses((current) => current.filter((expense) => expense.id !== id))
                }
              />
            </>
          )}

          {![
            'dashboard',
            'attention',
            'assistant',
            'projects',
            'clients',
            'leads',
            'expenses',
            'settings',
          ].includes(section) && (
            <LocalOfficeModule
              section={section as OfficeSection}
              clients={clients}
              projects={effectiveRows}
              expenses={expenses}
              rates={fxRates}
              openFormSignal={officeFormSignal}
              invoiceDefaults={{
                includeBankDetails: preferences.invoiceBankDefault,
                bankDetails: preferences.bankDetails,
                notes: preferences.showPaymentTerms ? preferences.paymentTerms : '',
              }}
              preview={mobilePreview}
            />
          )}
        </main>

        {novaOpen && (
          <div
            className="local-modal-layer nova-layer"
            role="presentation"
            onMouseDown={() => setNovaOpen(false)}
          >
            <InfonitsAssistant
              context={assistantContext}
              onApply={applyAssistantAction}
              onClose={() => setNovaOpen(false)}
              voice={{
                enabled: preferences.voiceEnabled,
                autoSpeak: preferences.autoSpeak,
                rate: preferences.speechRate,
                language: preferences.voiceLanguage,
              }}
            />
          </div>
        )}
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
      {globalSearchOpen ? (
        <GlobalSearch
          items={globalSearchItems}
          onClose={() => setGlobalSearchOpen(false)}
          onSelect={(item) => {
            setGlobalSearchOpen(false);
            if (item.kind === 'Invoice') openDashboardInvoice(item.recordId, 'view');
            else {
              changeSection(item.section);
              if (item.kind === 'Project') setSelectedProjectId(item.recordId);
            }
          }}
        />
      ) : null}
      {selectedProject ? (
        <ProjectDetail
          row={selectedProject}
          rates={fxRates}
          client={selectedProjectClient}
          invoices={selectedProjectInvoices}
          payments={officeOverview.payments}
          tasks={officeOverview.events.filter(
            (event) => event.type === 'Task' && event.projectId === selectedProject.id,
          )}
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

function WorkspaceSettings({
  preferences,
  onChange,
  clients,
  projects,
  expenses,
  rates,
  preview,
}: {
  preferences: WorkspacePreferences;
  onChange: React.Dispatch<React.SetStateAction<WorkspacePreferences>>;
  clients: LocalClient[];
  projects: LocalRow[];
  expenses: LocalExpense[];
  rates: Record<string, number>;
  preview: boolean;
}) {
  const update = <K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) =>
    onChange((current) => ({ ...current, [key]: value }));
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE"
        title="Settings"
        subtitle="Control business identity, document defaults, automation and workspace access."
      />
      <section className="settings-shell">
        <aside className="settings-section-nav" aria-label="Settings sections">
          <span>SETTINGS</span>
          <a className="active" href="#settings-overview">
            <LayoutDashboard size={16} /> Overview
          </a>
          <a href="#settings-profile">
            <UserCircle2 size={16} /> Business profile
          </a>
          <a href="#settings-documents">
            <CreditCard size={16} /> Invoice defaults
          </a>
          <a href="#settings-assistant">
            <Bot size={16} /> Assistant
          </a>
          <a href="#settings-reminders">
            <Bell size={16} /> Reminders
          </a>
          <a href="#settings-access">
            <ShieldCheck size={16} /> Access & security
          </a>
          <small>Changes are saved automatically on this device.</small>
        </aside>
        <div className="settings-content">
          <section
            className="settings-control-center"
            id="settings-overview"
            aria-label="Workspace settings overview"
          >
            <div className="settings-control-copy">
              <span className="settings-control-icon">
                <Settings2 size={22} />
              </span>
              <div>
                <strong>Workspace control centre</strong>
                <p>Changes save automatically on this device.</p>
              </div>
            </div>
            <div className="settings-control-stats">
              <span>
                <b>{clients.length}</b> clients
              </span>
              <span>
                <b>{projects.length}</b> projects
              </span>
              <span>
                <b>{expenses.length}</b> expenses
              </span>
              <span className="is-secure">
                <ShieldCheck size={14} /> Local preview
              </span>
            </div>
          </section>
          <section className="workspace-settings-grid">
            <div className="workspace-settings-column">
              <article className="workspace-settings-card profile" id="settings-profile">
                <header>
                  <span className="workspace-settings-card-icon">
                    <UserCircle2 size={19} />
                  </span>
                  <div>
                    <h2>Business profile</h2>
                    <p>Used across your workspace documents.</p>
                  </div>
                </header>
                <label>
                  <span>Business name</span>
                  <input
                    value={preferences.businessName}
                    onChange={(e) => update('businessName', e.target.value)}
                  />
                </label>
              </article>
              <article className="workspace-settings-card assistant" id="settings-assistant">
                <header>
                  <span className="workspace-settings-card-icon">
                    <Bot size={19} />
                  </span>
                  <div>
                    <h2>Nova personal assistant</h2>
                    <p>Control microphone input for Claude requests.</p>
                  </div>
                </header>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.voiceEnabled}
                    onChange={(e) => update('voiceEnabled', e.target.checked)}
                  />
                  <span>Enable microphone mode</span>
                </label>
                <div>
                  <label>
                    <span>Voice language</span>
                    <select
                      value={preferences.voiceLanguage}
                      onChange={(e) => update('voiceLanguage', e.target.value)}
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="en-IN">English (South Asia)</option>
                      <option value="ta-IN">Tamil</option>
                    </select>
                  </label>
                </div>
              </article>
            </div>
            <div className="workspace-settings-column">
              <article className="workspace-settings-card documents" id="settings-documents">
                <header>
                  <span className="workspace-settings-card-icon">
                    <CreditCard size={19} />
                  </span>
                  <div>
                    <h2>Invoice defaults</h2>
                    <p>New invoices start with these choices. You can override each invoice.</p>
                  </div>
                </header>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.invoiceBankDefault}
                    onChange={(e) => update('invoiceBankDefault', e.target.checked)}
                  />
                  <span>Show bank details by default</span>
                </label>
                {preferences.invoiceBankDefault && (
                  <label>
                    <span>Bank details</span>
                    <textarea
                      rows={4}
                      value={preferences.bankDetails}
                      onChange={(e) => update('bankDetails', e.target.value)}
                      placeholder={'Bank name\nAccount name\nAccount number / SWIFT'}
                    />
                  </label>
                )}
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.showPaymentTerms}
                    onChange={(e) => update('showPaymentTerms', e.target.checked)}
                  />
                  <span>Show payment terms by default</span>
                </label>
                {preferences.showPaymentTerms && (
                  <label>
                    <span>Payment terms</span>
                    <textarea
                      rows={3}
                      value={preferences.paymentTerms}
                      onChange={(e) => update('paymentTerms', e.target.value)}
                    />
                  </label>
                )}
              </article>
              <article className="workspace-settings-card reminders" id="settings-reminders">
                <header>
                  <span className="workspace-settings-card-icon">
                    <Bell size={19} />
                  </span>
                  <div>
                    <h2>Reminders</h2>
                    <p>Choose when items appear in the bell and Attention center.</p>
                  </div>
                </header>
                <label className="settings-switch">
                  <input
                    type="checkbox"
                    checked={preferences.notificationsEnabled}
                    onChange={(event) => update('notificationsEnabled', event.target.checked)}
                  />
                  <span>Enable workspace reminders</span>
                </label>
                {preferences.notificationsEnabled && (
                  <div className="settings-two-column">
                    <label>
                      <span>Invoice notice</span>
                      <select
                        value={preferences.invoiceReminderDays}
                        disabled={!preferences.notificationsEnabled}
                        onChange={(event) =>
                          update('invoiceReminderDays', Number(event.target.value))
                        }
                      >
                        <option value={3}>3 days before</option>
                        <option value={7}>7 days before</option>
                        <option value={14}>14 days before</option>
                      </select>
                    </label>
                    <label>
                      <span>Renewal notice</span>
                      <select
                        value={preferences.renewalReminderDays}
                        disabled={!preferences.notificationsEnabled}
                        onChange={(event) =>
                          update('renewalReminderDays', Number(event.target.value))
                        }
                      >
                        <option value={14}>14 days before</option>
                        <option value={30}>30 days before</option>
                        <option value={60}>60 days before</option>
                      </select>
                    </label>
                  </div>
                )}
                {preferences.notificationsEnabled && (
                  <label>
                    <span>Calendar notice</span>
                    <select
                      value={preferences.eventReminderDays}
                      disabled={!preferences.notificationsEnabled}
                      onChange={(event) => update('eventReminderDays', Number(event.target.value))}
                    >
                      <option value={1}>1 day before</option>
                      <option value={3}>3 days before</option>
                      <option value={7}>7 days before</option>
                    </select>
                  </label>
                )}
              </article>
            </div>
          </section>
          <section
            className="settings-users-embed"
            id="settings-access"
            aria-label="Users and roles settings"
          >
            <LocalOfficeModule
              section="users"
              clients={clients}
              projects={projects}
              expenses={expenses}
              rates={rates}
              preview={preview}
            />
          </section>
        </div>
      </section>
    </>
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
  children?: React.ReactNode;
}) {
  return (
    <section className="local-titlebar">
      <div>
        <span className="local-eyebrow">{eyebrow}</span>
        <PageTitle>{title}</PageTitle>
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
  onAdd: (type: 'project' | 'client' | 'expense' | 'invoice' | 'task') => void;
}) {
  const actions = [
    { id: 'project' as const, label: 'Project', hint: 'Start new work', icon: BriefcaseBusiness },
    { id: 'client' as const, label: 'Client', hint: 'Add contact', icon: Users },
    { id: 'expense' as const, label: 'Expense', hint: 'Record a cost', icon: ReceiptText },
    { id: 'invoice' as const, label: 'Invoice', hint: 'Create a bill', icon: CreditCard },
    { id: 'task' as const, label: 'Task', hint: 'Add to calendar', icon: ListTodo },
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

type GlobalSearchItem = {
  id: string;
  recordId: string;
  kind: string;
  title: string;
  subtitle: string;
  section: Section;
};

function GlobalSearch({
  items,
  onClose,
  onSelect,
}: {
  items: GlobalSearchItem[];
  onClose: () => void;
  onSelect: (item: GlobalSearchItem) => void;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? items
        .filter((item) =>
          `${item.kind} ${item.title} ${item.subtitle}`.toLowerCase().includes(normalized),
        )
        .slice(0, 12)
    : items.slice(0, 8);
  return (
    <div
      className="local-modal-layer global-search-layer"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="local-modal global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="local-modal-icon">
              <Search size={19} />
            </span>
            <div>
              <h2 id="global-search-title">Search workspace</h2>
              <p>Clients, projects, invoices, websites and tasks</p>
            </div>
          </div>
          <button aria-label="Close search" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <label className="global-search-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anything…"
          />
        </label>
        <div className="global-search-results">
          {results.length ? (
            results.map((item) => (
              <button key={item.id} type="button" onClick={() => onSelect(item)}>
                <span>{item.kind}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <div className="global-search-empty">
              <Search size={23} />
              <strong>No matching records</strong>
              <small>Try a client, project, invoice number or website.</small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProjectDetail({
  row,
  rates,
  client,
  invoices,
  payments,
  tasks,
  onClose,
  onInvoice,
}: {
  row: LocalRow;
  rates: Record<string, number>;
  client?: LocalClient;
  invoices: OfficeOverview['documents'];
  payments: OfficeOverview['payments'];
  tasks: OfficeOverview['events'];
  onClose: () => void;
  onInvoice: (row: LocalRow) => void;
}) {
  const value = localValue(row.value, row.exchangeRate);
  const received = row.receivedLkr ?? localValue(row.advance, row.exchangeRate);
  const work = localValue(row.workDue + row.workPaid, row.exchangeRate);
  const remaining = value - received - work;
  const projectRate = row.exchangeRate || rates[row.currency] || 1;
  const receivedOriginal = received / projectRate;
  const workOriginal = work / projectRate;
  const remainingOriginal = remaining / projectRate;
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const projectPayments = payments
    .filter(
      (payment) =>
        payment.projectId === row.id ||
        (payment.invoiceId ? invoiceIds.has(payment.invoiceId) : false),
    )
    .toSorted((left, right) => right.date.localeCompare(left.date));
  const timeline = [
    {
      id: `created-${row.id}`,
      date: row.createdAt,
      title: 'Project created',
      detail: row.status,
      tone: 'project',
    },
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      date: invoice.issueDate || invoice.dueDate,
      title: invoice.number,
      detail: `${invoice.kind} · ${invoice.status}`,
      tone: 'invoice',
    })),
    ...projectPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.date,
      title: payment.note || payment.receiptNumber || 'Payment recorded',
      detail: `${payment.currency} ${payment.amount.toLocaleString()} · ${payment.status}`,
      tone: 'payment',
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      date: task.date,
      title: task.title,
      detail: task.completed ? 'Task completed' : 'Task due',
      tone: 'task',
    })),
  ].toSorted((left, right) => left.date.localeCompare(right.date));
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
            <strong>{compactCurrency(row.value, row.currency)}</strong>
            <small>{compactMoney(value)}</small>
          </article>
          <article className="income">
            <span>Received</span>
            <strong>{compactCurrency(receivedOriginal, row.currency)}</strong>
            <small>{compactMoney(received)}</small>
          </article>
          <article className="outcome">
            <span>Work cost</span>
            <strong>{compactCurrency(workOriginal, row.currency)}</strong>
            <small>{compactMoney(work)}</small>
          </article>
          <article className="highlight">
            <span>For me</span>
            <strong>{compactCurrency(remainingOriginal, row.currency)}</strong>
            <small>{compactMoney(remaining)}</small>
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
            <span>Description</span>
            <p>{row.note}</p>
          </div>
        ) : null}
        <section className="project-timeline">
          <header>
            <strong>Project timeline</strong>
            <span>{timeline.length} milestones</span>
          </header>
          <div>
            {timeline.map((item) => (
              <article key={item.id}>
                <i className={item.tone} />
                <time dateTime={item.date}>{shortDate(item.date)}</time>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="local-project-workspace">
          <div>
            <header>
              <strong>Tasks</strong>
              <span>{tasks.filter((task) => !task.completed).length} open</span>
            </header>
            {tasks.length ? (
              <div className="local-project-task-list">
                {tasks
                  .toSorted((left, right) => left.date.localeCompare(right.date))
                  .map((task) => (
                    <article className={task.completed ? 'done' : ''} key={task.id}>
                      <i>{task.completed ? <Check size={12} /> : null}</i>
                      <span>
                        <strong>{task.title}</strong>
                        <small>{shortDate(task.date)}</small>
                      </span>
                    </article>
                  ))}
              </div>
            ) : (
              <p>No tasks linked to this project yet.</p>
            )}
          </div>
          <div>
            <header>
              <strong>Payment timeline</strong>
              <span>{projectPayments.length} records</span>
            </header>
            {projectPayments.length ? (
              <div className="local-project-payment-list">
                {projectPayments.map((payment) => (
                  <article key={payment.id}>
                    <span>
                      <strong>{payment.note || payment.receiptNumber || payment.category}</strong>
                      <small>
                        {shortDate(payment.date)} · {payment.status}
                      </small>
                    </span>
                    <b>
                      {payment.currency} {payment.amount.toLocaleString()}
                    </b>
                  </article>
                ))}
              </div>
            ) : (
              <p>
                No itemized payments linked yet. Recorded received: {row.currency}{' '}
                {compactNumber(row.advance)} · {money(received)}.
              </p>
            )}
          </div>
        </section>
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

function AttentionCenter({
  office,
  clients,
  preferences,
  onSection,
}: {
  office: OfficeOverview;
  clients: LocalClient[];
  preferences: WorkspacePreferences;
  onSection: (section: Section) => void;
}) {
  const [filter, setFilter] = useState<'All' | 'Urgent' | 'Upcoming'>('All');
  const [page, setPage] = useState(0);
  const [lastCloudSync, setLastCloudSync] = useState('');
  useEffect(() => {
    const refresh = (event?: Event) => {
      const detail = (event as CustomEvent<{ syncedAt?: string }> | undefined)?.detail;
      setLastCloudSync(detail?.syncedAt ?? localStorage.getItem(lastCloudSyncKey) ?? '');
    };
    refresh();
    window.addEventListener('infonits:sync-status', refresh);
    return () => window.removeEventListener('infonits:sync-status', refresh);
  }, []);
  const now = new Date(`${today()}T00:00:00`).getTime();
  const day = 86_400_000;
  const clientNames = new Map(clients.map((client) => [client.id, clientLabel(client)]));
  const invoicePaid = (invoiceId: string) =>
    office.payments
      .filter(
        (payment) =>
          payment.invoiceId === invoiceId && payment.type === 'Income' && payment.status === 'Paid',
      )
      .reduce((sum, payment) => sum + localValue(payment.amount, payment.exchangeRate), 0);
  const items = [
    ...office.documents
      .filter((item) => {
        if (!preferences.notificationsEnabled || item.kind !== 'Invoice' || item.status === 'Paid')
          return false;
        const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`).getTime() : now;
        return due - now <= preferences.invoiceReminderDays * day;
      })
      .map((item) => {
        const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`).getTime() : now;
        const balance = Math.max(
          0,
          localValue(item.amount, item.exchangeRate) - invoicePaid(item.id),
        );
        const urgent = due < now;
        return {
          id: `invoice-${item.id}`,
          title: urgent ? `${item.number} is overdue` : `${item.number} needs payment`,
          detail: `${clientNames.get(item.clientId ?? '') ?? 'Unknown client'} · ${compactMoney(balance)} balance`,
          date: due,
          dateLabel: urgent
            ? `${Math.ceil((now - due) / day)} days overdue`
            : `Due ${shortDate(item.dueDate)}`,
          priority: urgent ? ('Urgent' as const) : ('Upcoming' as const),
          section: 'invoices' as Section,
        };
      }),
    ...office.payments
      .filter((payment) => payment.status === 'Pending')
      .map((payment) => ({
        id: `payment-${payment.id}`,
        title: payment.note || 'Pending finance record',
        detail: `${payment.category} · ${payment.currency} ${payment.amount.toLocaleString()}`,
        date: payment.date ? new Date(`${payment.date}T00:00:00`).getTime() : now,
        dateLabel: `Scheduled ${shortDate(payment.date)}`,
        priority: 'Upcoming' as const,
        section: 'payments' as Section,
      })),
    ...office.recurringInvoices
      .filter((schedule) => {
        if (!schedule.active || !schedule.nextRun) return false;
        const due = new Date(`${schedule.nextRun}T00:00:00`).getTime();
        return due - now <= 7 * day;
      })
      .map((schedule) => {
        const due = new Date(`${schedule.nextRun}T00:00:00`).getTime();
        const overdue = due < now;
        return {
          id: `recurring-${schedule.id}`,
          title: schedule.description || 'Recurring invoice ready',
          detail: `${clientNames.get(schedule.clientId) ?? 'Unknown client'} · ${schedule.currency} ${schedule.amount.toLocaleString()}`,
          date: due,
          dateLabel: overdue ? 'Generation overdue' : `Runs ${shortDate(schedule.nextRun)}`,
          priority: overdue ? ('Urgent' as const) : ('Upcoming' as const),
          section: 'invoices' as Section,
        };
      }),
    ...office.renewals
      .filter((renewal) => renewal.siteStatus === 'Offline' || renewal.siteStatus === 'Issue')
      .map((renewal) => ({
        id: `website-health-${renewal.id}`,
        title: `${renewal.website} needs attention`,
        detail: renewal.monitorError || `Website status: ${renewal.siteStatus}`,
        date: now,
        dateLabel: renewal.siteStatus,
        priority: 'Urgent' as const,
        section: 'renewals' as Section,
      })),
    ...office.renewals.flatMap((renewal) =>
      [
        { label: 'Domain', date: renewal.domainDue },
        { label: 'Hosting', date: renewal.hostingDue },
      ]
        .filter(
          ({ date }) =>
            date &&
            preferences.notificationsEnabled &&
            new Date(`${date}T00:00:00`).getTime() - now <= preferences.renewalReminderDays * day,
        )
        .map(({ label, date }) => {
          const due = new Date(`${date}T00:00:00`).getTime();
          const urgent = due < now;
          return {
            id: `renewal-${renewal.id}-${label}`,
            title: `${renewal.website} ${label.toLowerCase()} renewal`,
            detail: urgent
              ? 'Renewal is overdue'
              : `Renew within ${preferences.renewalReminderDays} days`,
            date: due,
            dateLabel: urgent
              ? `${Math.ceil((now - due) / day)} days overdue`
              : `Due ${shortDate(date)}`,
            priority: urgent ? ('Urgent' as const) : ('Upcoming' as const),
            section: 'renewals' as Section,
          };
        }),
    ),
    ...office.events
      .filter((event) => {
        const time = new Date(`${event.date}T00:00:00`).getTime();
        return (
          preferences.notificationsEnabled &&
          time >= now &&
          time - now <= preferences.eventReminderDays * day
        );
      })
      .map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        detail: `${event.type} this week`,
        date: new Date(`${event.date}T00:00:00`).getTime(),
        dateLabel: shortDate(event.date),
        priority: 'Upcoming' as const,
        section: 'calendar' as Section,
      })),
  ].toSorted((left, right) => left.date - right.date);
  const visible = items.filter((item) => filter === 'All' || item.priority === filter);
  const pageCount = Math.max(1, Math.ceil(visible.length / 10));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(safePage * 10, safePage * 10 + 10);
  const urgentCount = items.filter((item) => item.priority === 'Urgent').length;
  const websiteIssues = office.renewals.filter(
    (renewal) => renewal.siteStatus === 'Offline' || renewal.siteStatus === 'Issue',
  ).length;
  const activeAutomations = office.recurringInvoices.filter((item) => item.active).length;
  const lastCloudSyncTime = lastCloudSync ? Date.parse(lastCloudSync) : 0;
  const cloudBackupHealthy = lastCloudSyncTime > 0 && lastCloudSyncTime >= now - day;
  return (
    <>
      <PageHeading
        eyebrow="PRIORITIES"
        title="Attention center"
        subtitle="Everything overdue, pending or coming up across your workspace."
      >
        <button className="button button-outline" onClick={() => onSection('assistant')}>
          <Sparkles size={16} /> Ask Nova
        </button>
      </PageHeading>
      <section className="attention-summary">
        <article className="urgent">
          <AlertTriangle size={19} />
          <span>
            <small>Urgent</small>
            <strong>{urgentCount}</strong>
          </span>
        </article>
        <article>
          <Clock3 size={19} />
          <span>
            <small>Upcoming</small>
            <strong>{items.length - urgentCount}</strong>
          </span>
        </article>
        <article>
          <ShieldCheck size={19} />
          <span>
            <small>Total attention</small>
            <strong>{items.length}</strong>
          </span>
        </article>
      </section>
      <section className="operations-health" aria-label="Workspace protection and automation">
        <button
          className={cloudBackupHealthy ? 'healthy' : 'warning'}
          onClick={() => window.dispatchEvent(new Event('infonits:sync-now'))}
        >
          <DatabaseBackup size={20} />
          <span>
            <small>Cloud backup</small>
            <strong>{cloudBackupHealthy ? 'Protected' : 'Check backup'}</strong>
            <em>
              {lastCloudSyncTime
                ? `Last saved ${new Date(lastCloudSyncTime).toLocaleString('en-GB')}`
                : 'Click to sync now'}
            </em>
          </span>
        </button>
        <button
          className={websiteIssues ? 'warning' : 'healthy'}
          onClick={() => onSection('renewals')}
        >
          <Globe2 size={20} />
          <span>
            <small>Website health</small>
            <strong>
              {websiteIssues ? `${websiteIssues} need attention` : 'All checked sites healthy'}
            </strong>
            <em>{office.renewals.length} websites tracked</em>
          </span>
        </button>
        <button className="automation" onClick={() => onSection('invoices')}>
          <Repeat2 size={20} />
          <span>
            <small>Invoice automation</small>
            <strong>{activeAutomations} active schedules</strong>
            <em>Next invoices appear automatically</em>
          </span>
        </button>
        <button className="trash" onClick={() => onSection('invoices')}>
          <Archive size={20} />
          <span>
            <small>Recoverable trash</small>
            <strong>{office.trashedDocuments.length} records</strong>
            <em>Available to restore for 30 days</em>
          </span>
        </button>
      </section>
      <section className="attention-center-card">
        <header>
          <div>
            <strong>Priority queue</strong>
            <small>Ordered by due date</small>
          </div>
          <div>
            {(['All', 'Urgent', 'Upcoming'] as const).map((item) => (
              <button
                key={item}
                className={filter === item ? 'active' : ''}
                onClick={() => {
                  setFilter(item);
                  setPage(0);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </header>
        {visible.length ? (
          <div className="attention-center-list">
            {pageItems.map((item) => (
              <button key={item.id} onClick={() => onSection(item.section)}>
                <i className={item.priority.toLowerCase()} />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
                <span>
                  {item.dateLabel}
                  <ArrowUpRight size={14} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="attention-center-empty">
            <ShieldCheck size={25} />
            <strong>Nothing needs attention</strong>
            <p>Your filtered queue is clear.</p>
          </div>
        )}
        {pageCount > 1 ? (
          <div className="local-invoice-pagination">
            <button disabled={safePage === 0} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              {safePage + 1} / {pageCount}
            </span>
            <button
              disabled={safePage + 1 >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function Dashboard({
  totals,
  rows,
  rates,
  clients,
  expenses,
  office,
  onAddProject,
  onSection,
  onInvoiceView,
  onInvoiceEdit,
  onInvoiceStatusChange,
  onInvoiceDelete,
}: {
  totals: { value: number; received: number; work: number; expenses: number; net: number };
  rows: LocalRow[];
  rates: Record<string, number>;
  clients: LocalClient[];
  expenses: LocalExpense[];
  office: OfficeOverview;
  onAddProject: () => void;
  onSection: (section: Section) => void;
  onInvoiceView: (id: string) => void;
  onInvoiceEdit: (id: string) => void;
  onInvoiceStatusChange: (id: string, status: string) => void;
  onInvoiceDelete: (id: string) => void;
}) {
  const [invoiceFilter, setInvoiceFilter] = useState('All');
  const [invoicePage, setInvoicePage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
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
  const invoiceReceived = (invoiceId: string) =>
    office.payments
      .filter(
        (payment) =>
          payment.invoiceId === invoiceId && payment.type === 'Income' && payment.status === 'Paid',
      )
      .reduce((sum, payment) => sum + localValue(payment.amount, payment.exchangeRate), 0);
  const outstandingTotal = outstandingInvoices.reduce(
    (sum, item) =>
      sum + Math.max(0, localValue(item.amount, item.exchangeRate) - invoiceReceived(item.id)),
    0,
  );
  const outstandingClientCount = new Set(
    outstandingInvoices.map((item) => item.clientId).filter(Boolean),
  ).size;
  const clientNames = new Map(clients.map((client) => [client.id, clientLabel(client)]));
  const invoiceDocuments = office.documents.filter((item) => item.kind === 'Invoice');
  const invoiceOverview = invoiceDocuments.map((item) => {
    const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`).getTime() : now;
    return {
      ...item,
      status: item.status !== 'Paid' && due < now ? 'Overdue' : item.status,
    };
  });
  const openInvoices = invoiceOverview.filter((item) => item.status !== 'Paid');
  const filteredInvoices = invoiceOverview.filter(
    (item) => invoiceFilter === 'All' || item.status === invoiceFilter,
  );
  const invoicePageCount = Math.max(1, Math.ceil(filteredInvoices.length / 3));
  const safeInvoicePage = Math.min(invoicePage, invoicePageCount - 1);
  const recentInvoices = filteredInvoices.slice(safeInvoicePage * 3, safeInvoicePage * 3 + 3);
  const activity = [
    ...rows.map((row) => ({
      id: `project-${row.id}`,
      title: row.project,
      meta: `${row.currency} ${compactNumber(row.value)}`,
      value: localValue(row.value, row.exchangeRate),
      date: row.createdAt,
      kind: 'income' as const,
      section: 'projects' as Section,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      title: expense.description,
      meta: expense.category,
      value: localValue(expense.amount, expense.exchangeRate),
      date: expense.date,
      kind: 'outcome' as const,
      section: 'expenses' as Section,
    })),
  ].toSorted((left, right) => right.date.localeCompare(left.date));
  const activityPageCount = Math.max(1, Math.ceil(activity.length / 4));
  const safeActivityPage = Math.min(activityPage, activityPageCount - 1);
  const visibleActivity = activity.slice(safeActivityPage * 4, safeActivityPage * 4 + 4);

  return (
    <div className="local-dashboard-page">
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
          <small>{rows.length} projects in the selected month</small>
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
            <button
              className="button button-outline local-attention-open"
              aria-label="Open attention center"
              title="Open attention center"
              onClick={() => onSection('attention')}
            >
              View <ArrowUpRight size={15} />
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
        <article className="local-recent-invoices-card">
          <div className="local-card-heading">
            <div>
              <FileText size={18} />
              <div>
                <strong>Recent invoices</strong>
                <small>Latest billing activity and payment status</small>
              </div>
            </div>
            <button className="local-card-link" onClick={() => onSection('invoices')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="local-invoice-filters">
            {['All', 'Paid', 'Partial', 'Sent', 'Pending', 'Overdue'].map((status) => (
              <button
                key={status}
                className={invoiceFilter === status ? 'active' : ''}
                onClick={() => {
                  setInvoiceFilter(status);
                  setInvoicePage(0);
                }}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="local-invoice-preview-list">
            {recentInvoices.length ? (
              recentInvoices.map((invoice) => (
                <div className="local-invoice-preview-row" key={invoice.id}>
                  <button
                    className="local-invoice-preview-main"
                    onClick={() => onInvoiceView(invoice.id)}
                  >
                    <span>
                      <strong>{invoice.number}</strong>
                      <small>
                        {(invoice.clientId && clientNames.get(invoice.clientId)) ??
                          'Unknown client'}{' '}
                        · {shortDate(invoice.dueDate)}
                      </small>
                    </span>
                  </button>
                  <StatusSelect
                    className={`office-status local-invoice-status ${invoice.status.toLowerCase()}`}
                    aria-label={`Status for ${invoice.number}`}
                    value={invoice.status}
                    onChange={(event) => onInvoiceStatusChange(invoice.id, event.target.value)}
                  >
                    {['Pending', 'Sent', 'Partial', 'Paid', 'Overdue'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </StatusSelect>
                  <b>
                    {invoice.currency} {compactNumber(invoice.amount)}
                  </b>
                  <span className="local-invoice-preview-actions">
                    <button
                      title="View invoice"
                      aria-label={`View ${invoice.number}`}
                      onClick={() => onInvoiceView(invoice.id)}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      title="Edit invoice"
                      aria-label={`Edit ${invoice.number}`}
                      onClick={() => onInvoiceEdit(invoice.id)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="delete"
                      title="Delete invoice"
                      aria-label={`Delete ${invoice.number}`}
                      onClick={() => onInvoiceDelete(invoice.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <p className="local-invoice-empty">No {invoiceFilter.toLowerCase()} invoices.</p>
            )}
          </div>
          {invoicePageCount > 1 && (
            <div className="local-invoice-pagination">
              <button
                disabled={safeInvoicePage === 0}
                onClick={() => setInvoicePage((page) => Math.max(0, page - 1))}
              >
                Previous
              </button>
              <span>
                {safeInvoicePage + 1} / {invoicePageCount}
              </span>
              <button
                disabled={safeInvoicePage + 1 >= invoicePageCount}
                onClick={() => setInvoicePage((page) => Math.min(invoicePageCount - 1, page + 1))}
              >
                Next
              </button>
            </div>
          )}
          <div className="local-invoice-summary">
            <span>
              <small>Total invoices</small>
              <strong>{invoiceDocuments.length}</strong>
            </span>
            <span>
              <small>Open</small>
              <strong>{openInvoices.length}</strong>
            </span>
            <span>
              <small>Outstanding</small>
              <strong>{compactMoney(outstandingTotal)}</strong>
            </span>
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
                <small>Current-month projects and profitability</small>
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
            {rows.slice(0, 4).map((row, index) => {
              const value = localValue(row.value, row.exchangeRate);
              const received = row.receivedLkr ?? localValue(row.advance, row.exchangeRate);
              const profit = value - localValue(row.workDue + row.workPaid, row.exchangeRate);
              const projectRate = row.exchangeRate || rates[row.currency] || 1;
              return (
                <button key={row.id} onClick={() => onSection('projects')}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <strong>{row.project}</strong>
                    <small>{clientNames.get(row.clientId) ?? 'No client'}</small>
                  </span>
                  <b title={money(value)}>
                    <span>{compactCurrency(row.value, row.currency)}</span>
                    <small>{compactMoney(value)}</small>
                  </b>
                  <b className="positive" title={money(received)}>
                    <span>{compactCurrency(received / projectRate, row.currency)}</span>
                    <small>{compactMoney(received)}</small>
                  </b>
                  <b className={profit < 0 ? 'negative' : 'positive'} title={money(profit)}>
                    <span>{compactCurrency(profit / projectRate, row.currency)}</span>
                    <small>{compactMoney(profit)}</small>
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
            {visibleActivity.map((item) => (
              <button key={item.id} onClick={() => onSection(item.section)}>
                <span className={item.kind}>
                  {item.kind === 'income' ? (
                    <BriefcaseBusiness size={15} />
                  ) : (
                    <ReceiptText size={15} />
                  )}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.meta}</small>
                </div>
                <b className={item.kind === 'outcome' ? 'negative' : ''} title={money(item.value)}>
                  {item.kind === 'outcome' ? '−' : ''}
                  {compactMoney(item.value)}
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
          {activityPageCount > 1 && (
            <div className="local-invoice-pagination">
              <button
                disabled={safeActivityPage === 0}
                onClick={() => setActivityPage((page) => Math.max(0, page - 1))}
              >
                Previous
              </button>
              <span>
                {safeActivityPage + 1} / {activityPageCount}
              </span>
              <button
                disabled={safeActivityPage + 1 >= activityPageCount}
                onClick={() => setActivityPage((page) => Math.min(activityPageCount - 1, page + 1))}
              >
                Next
              </button>
            </div>
          )}
        </article>
      </section>
    </div>
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
  const projectValue = Number(draft.value || 0) * rate;
  const discountValue = Number(draft.discount || 0) * rate;
  const advanceValue = Number(draft.advance || 0) * rate;
  return (
    <form className="local-entry-form modal-project-form" onSubmit={onSubmit}>
      <div className="project-template-picker" aria-label="Project templates">
        <span>Start with a template</span>
        <div>
          {projectTemplates.map((template) => (
            <button
              type="button"
              key={template.id}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  project: template.project,
                  note: template.note,
                  recurring: template.recurring,
                }))
              }
            >
              {template.id === 'website' ? (
                <Globe2 size={15} />
              ) : template.id === 'maintenance' ? (
                <RefreshCw size={15} />
              ) : (
                <MessagesSquare size={15} />
              )}
              {template.label}
            </button>
          ))}
        </div>
      </div>
      <fieldset className="form-section">
        <legend>
          <span>1</span> Project details
        </legend>
        <div className="form-section-grid">
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
                  {clientLabel(client)}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            <span>Project description</span>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="Scope, deliverables and important project details"
            />
            <DescriptionAssistant
              value={draft.note}
              context="project description for an invoice"
              onChange={(note) => setDraft({ ...draft, note })}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>
          <span>2</span> Finance &amp; schedule
        </legend>
        <div className="form-section-grid">
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
          <label>
            <span>Project discount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.discount}
              onChange={(event) => setDraft({ ...draft, discount: event.target.value })}
              placeholder="0.00"
            />
          </label>
          <label className="form-feature-field">
            <span>Advance payment</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.advance}
              onChange={(event) => setDraft({ ...draft, advance: event.target.value })}
              placeholder="0.00"
            />
          </label>
          <div className="local-rate-preview compact">
            <small>Converted project value</small>
            <strong>{money(projectValue)}</strong>
            <span>
              Discount {money(discountValue)} · Advance {money(advanceValue)} · 1 {draft.currency} ={' '}
              {rate.toFixed(4)} LKR
            </span>
          </div>
          <label className="settings-switch project-recurring-switch wide">
            <input
              type="checkbox"
              checked={draft.recurring}
              onChange={(event) => setDraft({ ...draft, recurring: event.target.checked })}
            />
            <span>Repeat this project every month</span>
          </label>
          <p className="project-carry-note wide">
            Incomplete projects automatically remain visible in the next month.
          </p>
        </div>
      </fieldset>
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
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * 10, safePage * 10 + 10);
  const totals = rows.reduce(
    (sum, row) => {
      const value = localValue(row.value, row.exchangeRate);
      const advance = row.receivedLkr ?? localValue(row.advance, row.exchangeRate);
      const workDue = localValue(row.workDue, row.exchangeRate);
      const workPaid = localValue(row.workPaid, row.exchangeRate);
      return {
        value: sum.value + value,
        advance: sum.advance + advance,
        workDue: sum.workDue + workDue,
        workPaid: sum.workPaid + workPaid,
        mine: sum.mine + value - advance - workDue - workPaid,
      };
    },
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
        {pageRows.map((row, index) => {
          const value = localValue(row.value, row.exchangeRate);
          const workCost = row.workDue + row.workPaid;
          const received = row.receivedLkr ?? localValue(row.advance, row.exchangeRate);
          const workCostLkr = localValue(workCost, row.exchangeRate);
          const balance = row.value - row.advance - workCost;
          const balanceLkr = value - received - workCostLkr;
          const progress =
            row.status === 'Paid'
              ? 100
              : value > 0
                ? Math.min(100, Math.max(0, Math.round((received / value) * 100)))
                : 0;
          const client = clients.find((item) => item.id === row.clientId);
          const clientName = client ? clientLabel(client) : '';
          const isEditing = editingId === row.id;
          return (
            <article className="local-project-record" key={row.id}>
              <span className="local-project-number">
                {String(safePage * 10 + index + 1).padStart(2, '0')}
              </span>
              <div className="local-project-main">
                <strong>{row.project}</strong>
                <small>
                  {clientName || 'No client'} · {shortDate(row.createdAt)}
                  {row.recurring ? ' · Monthly recurring' : ''}
                </small>
                <div
                  className="local-project-progress"
                  aria-label={`Project payment progress ${progress}%`}
                >
                  <span aria-hidden="true">
                    <i style={{ width: `${progress}%` }} />
                  </span>
                  <small>{progress}%</small>
                </div>
              </div>
              <div className="local-project-metrics">
                <div className="local-project-value">
                  <strong>
                    {row.currency} {compactNumber(row.value)}
                  </strong>
                  <small>{compactMoney(value)}</small>
                </div>
                <div className="local-project-value income">
                  <strong>
                    {row.currency} {compactNumber(row.advance)}
                  </strong>
                  <small>{compactMoney(received)}</small>
                </div>
                <div className="local-project-value outcome">
                  <strong>
                    {row.currency} {compactNumber(workCost)}
                  </strong>
                  <small>{compactMoney(workCostLkr)}</small>
                </div>
                <div className={`local-project-value ${balanceLkr < 0 ? 'negative' : 'profit'}`}>
                  <strong>
                    {row.currency} {compactNumber(balance)}
                  </strong>
                  <small>{compactMoney(balanceLkr)}</small>
                </div>
              </div>
              <div className="local-project-status">
                <StatusSelect
                  aria-label="Payment status"
                  className="local-project-status-select"
                  tone={row.status.toLowerCase()}
                  value={row.status}
                  onChange={(event) =>
                    onUpdate(row.id, { status: event.target.value as LocalRow['status'] })
                  }
                >
                  <option>Waiting</option>
                  <option>Partial</option>
                  <option>Paid</option>
                  <option>Overdue</option>
                </StatusSelect>
              </div>
              <div className="local-card-actions">
                <button
                  className={`local-row-action neutral ${isEditing ? 'active' : ''}`}
                  aria-label={`${isEditing ? 'Close editor for' : 'Edit'} ${row.project}`}
                  title={isEditing ? 'Close editor' : 'Edit project'}
                  onClick={() => setEditingId(isEditing ? null : row.id)}
                >
                  {isEditing ? <X size={16} /> : <Pencil size={16} />}
                  <span>{isEditing ? 'Close' : 'Edit'}</span>
                </button>
                <button
                  className="local-row-action neutral"
                  aria-label={`View ${row.project} details`}
                  title="Project details"
                  onClick={() => onView(row.id)}
                >
                  <Eye size={16} />
                  <span>View</span>
                </button>
                <button
                  className="local-row-action"
                  aria-label={`Create invoice for ${row.project}`}
                  title="Create invoice"
                  onClick={() => onInvoice(row)}
                >
                  <FilePlus2 size={16} />
                  <span>Invoice</span>
                </button>
                <button
                  className="local-delete"
                  aria-label={`Delete ${row.project}`}
                  onClick={() => onDelete(row.id)}
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
              {isEditing && (
                <div
                  className="local-modal-layer"
                  role="presentation"
                  onMouseDown={() => setEditingId(null)}
                >
                  <section
                    className="local-modal local-project-edit-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`edit-project-${row.id}`}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <header>
                      <div>
                        <span className="local-modal-icon">
                          <Pencil size={18} />
                        </span>
                        <div>
                          <h2 id={`edit-project-${row.id}`}>Edit project</h2>
                          <p>Update project details, recurrence and financial progress.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Close project editor"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={19} />
                      </button>
                    </header>
                    <div className="local-project-editor">
                      <fieldset className="form-section">
                        <legend>
                          <span>1</span> Project details
                        </legend>
                        <div className="form-section-grid">
                          <label>
                            <span>Project name</span>
                            <input
                              aria-label="Project name"
                              value={row.project}
                              onChange={(event) =>
                                onUpdate(row.id, { project: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Client</span>
                            <select
                              aria-label="Client"
                              value={row.clientId}
                              onChange={(event) =>
                                onUpdate(row.id, { clientId: event.target.value })
                              }
                            >
                              <option value="">No client</option>
                              {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                  {clientLabel(client)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="wide">
                            <span>Description</span>
                            <textarea
                              aria-label="Project description"
                              rows={3}
                              value={row.note}
                              onChange={(event) => onUpdate(row.id, { note: event.target.value })}
                              placeholder="Scope, deliverables and project details"
                            />
                            <DescriptionAssistant
                              value={row.note}
                              context="project description for an invoice"
                              onChange={(note) => onUpdate(row.id, { note })}
                            />
                          </label>
                        </div>
                      </fieldset>
                      <fieldset className="form-section">
                        <legend>
                          <span>2</span> Project finance
                        </legend>
                        <div className="form-section-grid project-finance-grid">
                          <label className="local-project-editor-amount">
                            <span>Project amount</span>
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
                              ['discount', 'Project discount'],
                              ['advance', 'Advance received'],
                              ['workDue', 'Work cost to pay'],
                              ['workPaid', 'Work cost paid'],
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
                          <label className="settings-switch project-recurring-switch wide">
                            <input
                              type="checkbox"
                              checked={row.recurring}
                              onChange={(event) =>
                                onUpdate(row.id, { recurring: event.target.checked })
                              }
                            />
                            <span>Repeat this project every month</span>
                          </label>
                        </div>
                      </fieldset>
                      <div className="local-project-edit-summary" aria-label="Project balance">
                        <span>Current balance</span>
                        <strong>
                          {compactCurrency(
                            row.value -
                              (row.receivedLkr
                                ? row.receivedLkr / (row.exchangeRate || 1)
                                : row.advance) -
                              row.workDue -
                              row.workPaid,
                            row.currency,
                          )}
                        </strong>
                        <small>
                          {money(
                            localValue(row.value, row.exchangeRate) -
                              (row.receivedLkr ?? localValue(row.advance, row.exchangeRate)) -
                              localValue(row.workDue + row.workPaid, row.exchangeRate),
                          )}
                        </small>
                      </div>
                      <div className="local-modal-actions">
                        <button
                          className="button button-outline"
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="button button-primary"
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {pageCount > 1 ? (
        <div className="local-invoice-pagination">
          <button disabled={safePage === 0} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button
            disabled={safePage + 1 >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
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
      <fieldset className="form-section client-details-section">
        <legend>
          <span>1</span> Client details
        </legend>
        <div className="form-section-grid">
          {(['name', 'company', 'email', 'phone'] as const).map((field) => (
            <label key={field}>
              <span>
                {field === 'name' ? 'Client name *' : field[0].toUpperCase() + field.slice(1)}
              </span>
              <input
                autoFocus={field === 'name'}
                required={field === 'name'}
                type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                autoComplete={
                  field === 'name'
                    ? 'name'
                    : field === 'company'
                      ? 'organization'
                      : field === 'email'
                        ? 'email'
                        : 'tel'
                }
                inputMode={field === 'email' ? 'email' : field === 'phone' ? 'tel' : undefined}
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
          <label className="wide">
            <span>Country</span>
            <select
              autoComplete="country-name"
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
          <label>
            <span>Next follow-up</span>
            <input
              type="date"
              value={draft.followUpDate}
              onChange={(event) => setDraft({ ...draft, followUpDate: event.target.value })}
            />
          </label>
          <label>
            <span>Client note</span>
            <input
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="Next step or useful context"
            />
          </label>
        </div>
      </fieldset>
      <button className="button button-primary" type="submit">
        <Plus size={16} /> Save client
      </button>
    </form>
  );
}

function ClientList({
  clients,
  rows,
  office,
  onAdd,
  onUpdate,
  onRemove,
}: {
  clients: LocalClient[];
  rows: LocalRow[];
  office: OfficeOverview;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<LocalClient>) => void;
  onRemove: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(clients.length / 10));
  const safePage = Math.min(page, pageCount - 1);
  const pageClients = clients.slice(safePage * 10, safePage * 10 + 10);
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'billing' | 'activity'>('overview');
  const selected = clients.find((client) => client.id === selectedId);
  const selectedRows = rows.filter((row) => row.clientId === selectedId);
  const selectedDocuments = office.documents.filter((item) => item.clientId === selectedId);
  const selectedInvoiceIds = new Set(selectedDocuments.map((item) => item.id));
  const selectedPayments = office.payments.filter(
    (item) => item.invoiceId && selectedInvoiceIds.has(item.invoiceId),
  );
  const selectedBilled = selectedDocuments
    .filter((item) => item.kind === 'Invoice')
    .reduce((sum, item) => sum + localValue(item.amount, item.exchangeRate), 0);
  const selectedReceived =
    selectedPayments
      .filter((item) => item.status === 'Paid')
      .reduce((sum, item) => sum + localValue(item.amount, item.exchangeRate), 0) +
    selectedDocuments
      .filter(
        (document) =>
          document.kind === 'Invoice' &&
          document.status === 'Paid' &&
          !selectedPayments.some((payment) => payment.invoiceId === document.id),
      )
      .reduce((sum, document) => sum + localValue(document.amount, document.exchangeRate), 0);
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
    <>
      <section className="local-client-grid">
        {pageClients.map((client) => {
          const clientRows = rows.filter((row) => row.clientId === client.id);
          const value = clientRows.reduce(
            (sum, row) => sum + localValue(row.value, row.exchangeRate),
            0,
          );
          return (
            <article className="local-client-card" key={client.id}>
              <div className="local-client-avatar">
                {(client.company.trim() || client.name).slice(0, 2).toUpperCase()}
              </div>
              <div className="local-client-details">
                <h2>{client.company.trim() || client.name}</h2>
                <div className="local-client-meta">
                  <span className="local-client-country-display">
                    {countryFlags[client.country] ?? '🌐'} {client.country || 'Country not set'}
                  </span>
                  {client.followUpDate ? (
                    <span
                      className={`local-client-follow-up ${client.followUpDate <= today() ? 'due' : ''}`}
                    >
                      <Clock3 size={12} /> {client.followUpDate <= today() ? 'Follow up' : 'Next'}{' '}
                      {shortDate(client.followUpDate, false)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="local-client-stats">
                <span>
                  <small>Projects</small>
                  <strong>{clientRows.length}</strong>
                </span>
                <span>
                  <small>Total value</small>
                  <strong title={money(value)}>{compactMoney(value)}</strong>
                </span>
              </div>
              <div className="local-client-actions">
                <button
                  className="local-row-action neutral"
                  aria-label={`View ${client.name}`}
                  onClick={() => {
                    setSelectedId(client.id);
                    setEditingId('');
                    setWorkspaceTab('overview');
                  }}
                >
                  <Eye size={16} />
                </button>
                <button
                  className="local-row-action neutral"
                  aria-label={`Edit ${client.name}`}
                  onClick={() => {
                    setSelectedId(client.id);
                    setEditingId(client.id);
                    setWorkspaceTab('overview');
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="local-delete"
                  aria-label={`Remove ${client.name}`}
                  onClick={() => onRemove(client.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </section>
      {pageCount > 1 ? (
        <div className="local-invoice-pagination standalone">
          <button disabled={safePage === 0} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button
            disabled={safePage + 1 >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
      {selected && (
        <div
          className="local-modal-layer"
          role="presentation"
          onMouseDown={() => setSelectedId('')}
        >
          <section
            className="local-modal local-client-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="local-modal-icon">
                  <Users size={19} />
                </span>
                <div>
                  <h2 id="client-detail-title">{selected.company || selected.name}</h2>
                  <p>{selected.name} · Company workspace</p>
                </div>
              </div>
              <button aria-label="Close client details" onClick={() => setSelectedId('')}>
                <X size={19} />
              </button>
            </header>
            {editingId === selected.id ? (
              <div className="local-client-editor modal-editor">
                <label>
                  <span>Name</span>
                  <input
                    value={selected.name}
                    onChange={(event) => onUpdate(selected.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Company / business</span>
                  <input
                    value={selected.company}
                    onChange={(event) => onUpdate(selected.id, { company: event.target.value })}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={selected.email}
                    onChange={(event) => onUpdate(selected.id, { email: event.target.value })}
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    value={selected.phone}
                    onChange={(event) => onUpdate(selected.id, { phone: event.target.value })}
                  />
                </label>
                <label>
                  <span>Country</span>
                  <select
                    value={selected.country}
                    onChange={(event) => onUpdate(selected.id, { country: event.target.value })}
                  >
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {countryFlags[country]} {country}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Next follow-up</span>
                  <input
                    type="date"
                    value={selected.followUpDate ?? ''}
                    onChange={(event) =>
                      onUpdate(selected.id, { followUpDate: event.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  <span>Client note</span>
                  <textarea
                    rows={3}
                    value={selected.notes ?? ''}
                    onChange={(event) => onUpdate(selected.id, { notes: event.target.value })}
                    placeholder="Next step or useful context"
                  />
                </label>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setEditingId('')}
                >
                  <Check size={16} /> Save changes
                </button>
              </div>
            ) : (
              <div className="local-client-profile">
                <div className="client-workspace-summary">
                  <span>
                    <small>Projects</small>
                    <strong>{selectedRows.length}</strong>
                  </span>
                  <span>
                    <small>Invoices</small>
                    <strong>
                      {selectedDocuments.filter((item) => item.kind === 'Invoice').length}
                    </strong>
                  </span>
                  <span>
                    <small>Billed</small>
                    <strong>{compactMoney(selectedBilled)}</strong>
                  </span>
                  <span>
                    <small>Received</small>
                    <strong>{compactMoney(selectedReceived)}</strong>
                  </span>
                </div>
                <div className="client-workspace-tabs" role="tablist">
                  {(['overview', 'billing', 'activity'] as const).map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={workspaceTab === tab}
                      className={workspaceTab === tab ? 'active' : ''}
                      onClick={() => setWorkspaceTab(tab)}
                    >
                      {tab[0].toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                {workspaceTab === 'overview' && (
                  <>
                    <div className="local-client-profile-facts">
                      <span>
                        <small>Contact</small>
                        <strong>{selected.name}</strong>
                      </span>
                      <span>
                        <small>Country</small>
                        <strong>
                          {countryFlags[selected.country] ?? '🌐'} {selected.country || 'Not set'}
                        </strong>
                      </span>
                      <span>
                        <small>Email</small>
                        <strong>{selected.email || 'Not added'}</strong>
                      </span>
                      <span>
                        <small>Phone</small>
                        <strong>{selected.phone || 'Not added'}</strong>
                      </span>
                      <span>
                        <small>Next follow-up</small>
                        <strong>
                          {selected.followUpDate
                            ? shortDate(selected.followUpDate)
                            : 'Not scheduled'}
                        </strong>
                      </span>
                    </div>
                    {selected.notes ? (
                      <div className="local-client-follow-up-note">
                        <small>Client note</small>
                        <p>{selected.notes}</p>
                      </div>
                    ) : null}
                    <div className="local-client-profile-projects">
                      <div>
                        <strong>Projects</strong>
                        <small>{selectedRows.length} connected</small>
                      </div>
                      {selectedRows.length ? (
                        selectedRows.map((row) => (
                          <button key={row.id}>
                            <span>
                              <b>{row.project}</b>
                              <small>{row.status}</small>
                            </span>
                            <strong>
                              {compactCurrency(row.value, row.currency)}
                              <small>{compactMoney(localValue(row.value, row.exchangeRate))}</small>
                            </strong>
                          </button>
                        ))
                      ) : (
                        <p>No projects connected.</p>
                      )}
                    </div>
                  </>
                )}
                {workspaceTab === 'billing' && (
                  <div className="client-workspace-ledger">
                    {selectedDocuments.length ? (
                      selectedDocuments.map((document) => {
                        const received = selectedPayments
                          .filter(
                            (payment) =>
                              payment.invoiceId === document.id && payment.status === 'Paid',
                          )
                          .reduce((sum, payment) => sum + payment.amount, 0);
                        return (
                          <article key={document.id}>
                            <div>
                              <strong>{document.number}</strong>
                              <small>
                                {document.kind} · {shortDate(document.dueDate)}
                              </small>
                            </div>
                            <span>
                              <b>
                                {document.currency} {document.amount.toLocaleString()}
                              </b>
                              <small>
                                {received > 0
                                  ? `${document.currency} ${received.toLocaleString()} received`
                                  : document.status}
                              </small>
                            </span>
                          </article>
                        );
                      })
                    ) : (
                      <p>No invoices or quotations connected.</p>
                    )}
                  </div>
                )}
                {workspaceTab === 'activity' && (
                  <div className="client-workspace-timeline">
                    {[
                      ...selectedPayments.map((payment) => ({
                        id: payment.id,
                        date: payment.date,
                        title: payment.receiptNumber || 'Payment received',
                        detail: `${payment.currency} ${payment.amount.toLocaleString()}`,
                      })),
                      ...selectedDocuments.map((document) => ({
                        id: document.id,
                        date: document.dueDate,
                        title: `${document.kind} ${document.number}`,
                        detail: document.status,
                      })),
                      ...selectedRows.map((row) => ({
                        id: row.id,
                        date: row.createdAt,
                        title: row.project,
                        detail: 'Project created',
                      })),
                    ]
                      .toSorted((left, right) => right.date.localeCompare(left.date))
                      .map((item) => (
                        <article key={`${item.id}-${item.title}`}>
                          <i />
                          <div>
                            <strong>{item.title}</strong>
                            <small>
                              {item.detail} · {shortDate(item.date)}
                            </small>
                          </div>
                        </article>
                      ))}
                    {!selectedRows.length &&
                    !selectedDocuments.length &&
                    !selectedPayments.length ? (
                      <p>No activity yet.</p>
                    ) : null}
                  </div>
                )}
                <button className="button button-primary" onClick={() => setEditingId(selected.id)}>
                  <Pencil size={16} /> Edit client
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
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
      <fieldset className="form-section expense-details-section">
        <legend>
          <span>
            <ReceiptText size={13} />
          </span>
          Expense details
        </legend>
        <div className="form-section-grid">
          <label>
            <span>Description *</span>
            <input
              autoFocus
              required
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Software subscription"
            />
            <DescriptionAssistant
              value={draft.description}
              context="expense description for finance records"
              targetWords={18}
              onChange={(description) => setDraft({ ...draft, description })}
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
              placeholder="0.00"
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
          <div className="local-rate-preview compact">
            <small>Converted value</small>
            <strong>{money(Number(draft.amount || 0) * rate)}</strong>
            <span>
              1 {draft.currency} = {rate.toFixed(4)} LKR
            </span>
          </div>
        </div>
      </fieldset>
      <button className="button button-primary" type="submit">
        <Plus size={16} /> Save expense
      </button>
    </form>
  );
}

function ExpenseList({
  expenses,
  rates,
  onAdd,
  onUpdate,
  onDelete,
}: {
  expenses: LocalExpense[];
  rates: Record<string, number>;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<LocalExpense>) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState('');
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(expenses.length / 10));
  const safePage = Math.min(page, pageCount - 1);
  const pageExpenses = expenses.slice(safePage * 10, safePage * 10 + 10);
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
        <strong title={money(total)}>−{compactMoney(total)}</strong>
      </div>
      {pageExpenses.map((expense) => (
        <article className={editingId === expense.id ? 'is-editing' : ''} key={expense.id}>
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
            <strong title={money(localValue(expense.amount, expense.exchangeRate))}>
              −{compactMoney(localValue(expense.amount, expense.exchangeRate))}
            </strong>
          </div>
          <button
            className="local-row-action neutral"
            aria-label={`Edit ${expense.description}`}
            title="Edit expense"
            onClick={() => setEditingId(editingId === expense.id ? '' : expense.id)}
          >
            {editingId === expense.id ? <X size={15} /> : <Pencil size={15} />}
          </button>
          <button
            className="local-delete"
            aria-label={`Delete ${expense.description}`}
            onClick={() => onDelete(expense.id)}
          >
            <Trash2 size={15} />
          </button>
          {editingId === expense.id && (
            <FormModal
              title="Edit expense"
              subtitle="Update the cost, currency, category or transaction date."
              icon={<Pencil size={18} />}
              onClose={() => setEditingId('')}
            >
              <div className="local-expense-editor modal-editor">
                <label>
                  <span>Description</span>
                  <input
                    value={expense.description}
                    onChange={(event) => onUpdate(expense.id, { description: event.target.value })}
                  />
                </label>
                <label>
                  <span>Category</span>
                  <input
                    value={expense.category}
                    onChange={(event) => onUpdate(expense.id, { category: event.target.value })}
                  />
                </label>
                <label>
                  <span>Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expense.amount}
                    onChange={(event) =>
                      onUpdate(expense.id, { amount: Number(event.target.value) || 0 })
                    }
                  />
                </label>
                <label>
                  <span>Currency</span>
                  <select
                    value={expense.currency}
                    onChange={(event) =>
                      onUpdate(expense.id, {
                        currency: event.target.value,
                        exchangeRate:
                          event.target.value === 'LKR' ? 1 : (rates[event.target.value] ?? 1),
                      })
                    }
                  >
                    {currencies.map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={expense.date}
                    onChange={(event) => onUpdate(expense.id, { date: event.target.value })}
                  />
                </label>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setEditingId('')}
                >
                  Done
                </button>
              </div>
            </FormModal>
          )}
        </article>
      ))}
      {pageCount > 1 ? (
        <div className="local-invoice-pagination standalone">
          <button disabled={safePage === 0} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            {safePage + 1} / {pageCount}
          </span>
          <button
            disabled={safePage + 1 >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
