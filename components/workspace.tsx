'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import {
  BriefcaseBusiness,
  Users,
  Building2,
  Settings as SettingsIcon,
  Plus,
  Menu,
  X,
  CalendarDays,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
} from 'lucide-react';
import { SummaryCards } from './summary-cards';
import { ProjectTable } from './project-table';
import { ProjectDetail } from './project-detail';
import { Clients } from './clients';
import { Entries } from './entries';
import { Settings } from './settings';
import { RecordForm, type FormTarget } from './record-form';
import { CsvImport } from './csv-import';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { browserClient } from '@/lib/supabase/browser';
import type { WorkspaceData, Row } from '@/lib/types';
import type { TableName } from '@/lib/schemas';
import { today, inPeriod } from '@/lib/finance';
const navigation = [
  { path: 'dashboard', label: 'Finance sheet', icon: BriefcaseBusiness, href: '/' },
  { path: 'clients', label: 'Clients', icon: Users },
  { path: 'expenses', label: 'Expenses', icon: Building2 },
  { path: 'settings', label: 'Settings', icon: SettingsIcon },
];
const pageCopy: Record<
  string,
  { title: string; subtitle: string; action?: string; table?: TableName }
> = {
  dashboard: {
    title: 'Finance sheet',
    subtitle: 'Projects, payments, costs and profit in one view.',
    action: 'Add project',
    table: 'projects',
  },
  projects: {
    title: 'Finance sheet',
    subtitle: 'Projects, payments, costs and profit in one view.',
    action: 'Add project',
    table: 'projects',
  },
  clients: {
    title: 'Clients',
    subtitle: 'The people and businesses behind your projects.',
    action: 'Add client',
    table: 'clients',
  },
  payments: {
    title: 'Client payments',
    subtitle: 'Advances, installments and final payments — all accounted for.',
    action: 'Record payment',
    table: 'client_payments',
  },
  costs: {
    title: 'Project costs',
    subtitle: 'Freelancers, contractors and every cost of getting work done.',
    action: 'Add cost',
    table: 'project_costs',
  },
  expenses: {
    title: 'Operating expenses',
    subtitle: 'The everyday costs of running Infonits.',
    action: 'Add expense',
    table: 'operating_expenses',
  },
  settings: { title: 'Settings', subtitle: 'Your workspace, security and financial preferences.' },
};
export function Workspace({
  data,
  section,
  detailId,
}: {
  data: WorkspaceData;
  section: string;
  detailId?: string;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [yearly, setYearly] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [deletion, setDeletion] = useState<{ table: TableName; row: Row } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [costTab, setCostTab] = useState<'obligations' | 'payments'>('obligations');
  const activePeriod = yearly ? period.slice(0, 4) : period;
  const { ledger } = data;
  const copy = pageCopy[section];
  const showPeriod = !['settings', 'clients'].includes(section) && !detailId;
  const onNotice = useCallback((text: string) => setNotice(text), []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!mobileMenu) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenu(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileMenu]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 761px)');
    const resize = () => {
      if (media.matches) setMobileMenu(false);
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  const openForm = useCallback((target: FormTarget) => {
    setForm(target);
  }, []);
  const onDelete = useCallback((table: TableName, row: Row) => {
    setDeleteError('');
    setDeletion({ table, row });
  }, []);
  async function remove() {
    if (!deletion) return;
    setDeleteBusy(true);
    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: deletion.table,
          id: deletion.row.id,
          updated_at: deletion.row.updated_at,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onNotice('Record deleted. The change remains in audit history.');
      setDeletion(null);
      if (detailId === deletion.row.id) router.push(`/${section}`);
      router.refresh();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleteBusy(false);
    }
  }
  const projects = ledger.projects.filter((p) => inPeriod(p.reporting_month, activePeriod));
  const selectedProject = ledger.projects.find((p) => p.id === detailId);
  const selectedClient = ledger.clients.find((c) => c.id === detailId);
  const clientProjects = ledger.projects.filter((p) => p.client_id === detailId);
  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <Link className="brand official-brand" href="/" aria-label="Infonits Finance home">
          <img src="/infonits-logo.png" alt="infonits" width={154} height={36} />
          <span className="brand-finance">finance</span>
        </Link>
        <nav>
          {navigation.map((item) => (
            <Link
              onClick={() => setMobileMenu(false)}
              className={
                section === item.path || (item.path === 'dashboard' && section === 'projects')
                  ? 'nav-item active'
                  : 'nav-item'
              }
              key={item.path}
              href={item.href ?? `/${item.path}`}
            >
              <item.icon size={18} />
              {item.label}
              {item.path === 'dashboard' && ledger.projects.length > 0 && (
                <b>{ledger.projects.length}</b>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <span className="profile-avatar">
              {data.email ? data.email.slice(0, 2).toUpperCase() : 'IN'}
            </span>
            <div>
              <strong>{data.email ? data.email.split('@')[0] : 'Infonits team'}</strong>
              <small>{data.role || 'Finance workspace'}</small>
            </div>
            {data.configured ? (
              <button
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await browserClient().auth.signOut();
                  router.push('/login');
                  router.refresh();
                }}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <span className="status-dot" />
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={mobileMenu}>
        <header className="topbar">
          <div>
            <button
              className="mobile-menu-button icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={19} />
            </button>
            <span className="topbar-title">Infonits Finance</span>
          </div>
          <div>
            <span className="profile-avatar small">IN</span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <h1>
                {detailId
                  ? (selectedProject?.name ?? String(selectedClient?.name ?? copy.title))
                  : copy.title}
              </h1>
              <p>{copy.subtitle}</p>
            </div>
            <div className="heading-actions">
              {showPeriod && (
                <div className="period-controls">
                  <select
                    aria-label="Reporting view"
                    value={yearly ? 'year' : 'month'}
                    onChange={(e) => setYearly(e.target.value === 'year')}
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                  <div className="period-input">
                    <CalendarDays size={15} />
                    {yearly ? (
                      <input
                        aria-label="Reporting year"
                        type="number"
                        min="1900"
                        max="2200"
                        value={period.slice(0, 4)}
                        onChange={(e) => {
                          if (
                            /^\d{4}$/.test(e.target.value) &&
                            Number(e.target.value) >= 1900 &&
                            Number(e.target.value) <= 2200
                          )
                            setPeriod(`${e.target.value}-${period.slice(5)}`);
                        }}
                      />
                    ) : (
                      <input
                        aria-label="Reporting month"
                        type="month"
                        value={period}
                        min="1900-01"
                        max="2200-12"
                        onChange={(e) => {
                          if (e.target.value) setPeriod(e.target.value);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
              {copy.action && !detailId && (
                <Button
                  onClick={() =>
                    openForm({
                      table: copy.table!,
                      defaults:
                        copy.table === 'projects' ? { reporting_month: period + '-01' } : undefined,
                    })
                  }
                >
                  <Plus size={16} />
                  {copy.action}
                </Button>
              )}
            </div>
          </div>
          {data.error ? (
            <div className="notice warning" role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Financial data could not be loaded.</strong>
                <p>{data.error} Totals are hidden to avoid showing misleading balances.</p>
                <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <>
              {section === 'dashboard' && (
                <>
                  <SummaryCards projects={projects} />
                  <ProjectTable
                    projects={projects}
                    openForm={openForm}
                    openImport={() => setImportOpen(true)}
                    onNotice={onNotice}
                  />
                </>
              )}
              {section === 'projects' && !detailId && (
                <>
                  <SummaryCards projects={projects} />
                  <ProjectTable
                    projects={projects}
                    openForm={openForm}
                    openImport={() => setImportOpen(true)}
                    onNotice={onNotice}
                  />
                </>
              )}
              {section === 'projects' && selectedProject && (
                <ProjectDetail
                  project={selectedProject}
                  ledger={ledger}
                  openForm={openForm}
                  onDelete={onDelete}
                />
              )}
              {section === 'clients' && !detailId && (
                <Clients ledger={ledger} openForm={openForm} onDelete={onDelete} />
              )}
              {section === 'clients' && selectedClient && (
                <>
                  <div className="panel client-detail-contact">
                    <div>
                      <strong>{String(selectedClient.company || selectedClient.name)}</strong>
                      <p>
                        {[selectedClient.country, selectedClient.email, selectedClient.phone]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {selectedClient.notes && <p>{String(selectedClient.notes)}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openForm({ table: 'clients', record: selectedClient })}
                    >
                      Edit client
                    </Button>
                  </div>
                  <SummaryCards projects={clientProjects} />
                  <ProjectTable
                    projects={clientProjects}
                    openForm={openForm}
                    openImport={() => setImportOpen(true)}
                    onNotice={onNotice}
                  />
                  <Entries
                    title="Client payments · all time"
                    table="client_payments"
                    rows={ledger.client_payments.filter((p) =>
                      clientProjects.some((project) => project.id === p.project_id),
                    )}
                    ledger={ledger}
                    openForm={openForm}
                    onDelete={onDelete}
                  />
                </>
              )}
              {section === 'payments' && (
                <Entries
                  table="client_payments"
                  rows={ledger.client_payments.filter((p) =>
                    inPeriod(String(p.date), activePeriod),
                  )}
                  ledger={ledger}
                  openForm={openForm}
                  onDelete={onDelete}
                />
              )}
              {section === 'costs' && (
                <>
                  <div className="segmented">
                    <button
                      className={costTab === 'obligations' ? 'active' : ''}
                      onClick={() => setCostTab('obligations')}
                    >
                      Cost obligations
                    </button>
                    <button
                      className={costTab === 'payments' ? 'active' : ''}
                      onClick={() => setCostTab('payments')}
                    >
                      Cost payments
                    </button>
                  </div>
                  {costTab === 'obligations' ? (
                    <Entries
                      table="project_costs"
                      rows={ledger.project_costs.filter((p) =>
                        inPeriod(String(p.date), activePeriod),
                      )}
                      ledger={ledger}
                      openForm={openForm}
                      onDelete={onDelete}
                    />
                  ) : (
                    <Entries
                      title="Actual cost payments"
                      table="project_cost_payments"
                      rows={ledger.project_cost_payments.filter((p) =>
                        inPeriod(String(p.date), activePeriod),
                      )}
                      ledger={ledger}
                      openForm={openForm}
                      onDelete={onDelete}
                    />
                  )}
                </>
              )}
              {section === 'expenses' && (
                <Entries
                  table="operating_expenses"
                  rows={ledger.operating_expenses.filter((p) =>
                    inPeriod(String(p.date), activePeriod),
                  )}
                  ledger={ledger}
                  openForm={openForm}
                  onDelete={onDelete}
                />
              )}
              {section === 'settings' && (
                <Settings data={data} openForm={openForm} onDelete={onDelete} />
              )}
            </>
          )}
        </main>
      </div>
      {form && (
        <RecordForm
          key={`${form.table}-${form.record?.id ?? 'new'}`}
          target={form}
          onClose={() => setForm(null)}
          ledger={ledger}
          configured={data.configured && !data.error}
          onNotice={onNotice}
        />
      )}
      {importOpen && (
        <CsvImport
          clients={ledger.clients}
          configured={data.configured && !data.error}
          onClose={() => setImportOpen(false)}
          onNotice={onNotice}
        />
      )}
      {deletion && (
        <Dialog
          open
          onOpenChange={(v) => !v && !deleteBusy && setDeletion(null)}
          title="Delete this record?"
          description="The deletion will remain in audit history. Records with dependent financial entries cannot be deleted."
        >
          <div className="delete-content">
            <strong>
              {String(deletion.row.name ?? deletion.row.description ?? 'Payment record')}
            </strong>
            {deleteError && (
              <p className="error-message" role="alert">
                {deleteError}
              </p>
            )}
          </div>
          <div className="dialog-footer">
            <Button variant="outline" disabled={deleteBusy} onClick={() => setDeletion(null)}>
              Keep record
            </Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={() => void remove()}>
              {deleteBusy && <LoaderCircle size={15} className="spin" />}Delete record
            </Button>
          </div>
        </Dialog>
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
