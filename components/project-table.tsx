'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Plus,
  Download,
  Upload,
  Wallet,
  ReceiptText,
  Pencil,
  ArrowUpRight,
  Check,
  X,
} from 'lucide-react';
import type { Project } from '@/lib/types';
import { formatMoney, d, sum } from '@/lib/finance';
import { exportCsv } from '@/lib/csv';
import { currencies } from '@/lib/schemas';
import { Button } from './ui/button';
import { Badge, EmptyState } from './ui/common';
import type { FormTarget } from './record-form';
export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
function InlineName({ project, onNotice }: { project: Project; onNotice: (s: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'projects',
          id: project.id,
          updated_at: project.updated_at,
          values: { ...project, name: value },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEditing(false);
      onNotice('Project name updated.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <div className="inline-edit">
        <input
          aria-label="Project name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <button onClick={() => void save()} disabled={busy} aria-label="Save project name">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} disabled={busy} aria-label="Cancel edit">
          <X size={14} />
        </button>
        {error && <small role="alert">{error}</small>}
      </div>
    );
  return (
    <div className="project-name-cell">
      <span className="project-avatar">{project.name.slice(0, 1)}</span>
      <div>
        <Link href={`/projects/${project.id}`}>{project.name}</Link>
        <small>{project.client_name}</small>
      </div>
      <button
        className="cell-edit"
        aria-label={`Edit ${project.name} inline`}
        onClick={() => setEditing(true)}
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
export function ProjectTable({
  projects,
  openForm,
  openImport,
  onNotice,
}: {
  projects: Project[];
  openForm: (f: FormTarget) => void;
  openImport: () => void;
  onNotice: (s: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const [status, setStatus] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({
    currency: false,
    notes: false,
    status: false,
  });
  const filtered = useMemo(
    () =>
      projects.filter(
        (p) => (!currency || p.currency === currency) && (!status || p.payment_status === status),
      ),
    [projects, currency, status],
  );
  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Project',
        cell: ({ row }) => <InlineName project={row.original} onNotice={onNotice} />,
      },
      { accessorKey: 'client_name', header: 'Client' },
      {
        accessorKey: 'amount_lkr',
        header: 'Project value',
        sortingFn: (a, b) => d(a.original.amount_lkr).cmp(b.original.amount_lkr),
        cell: ({ row: p }) => (
          <div className="money-cell">
            {formatMoney(p.original.amount_lkr)}
            {p.original.currency !== 'LKR' && (
              <small>{formatMoney(p.original.amount, p.original.currency)}</small>
            )}
          </div>
        ),
      },
      { accessorKey: 'currency', header: 'Currency' },
      {
        accessorKey: 'received',
        header: 'Received',
        sortingFn: (a, b) => d(a.original.received).cmp(b.original.received),
        cell: ({ getValue }) => (
          <span className="money-cell">{formatMoney(String(getValue()))}</span>
        ),
      },
      {
        accessorKey: 'outstanding',
        header: 'Outstanding',
        sortingFn: (a, b) => d(a.original.outstanding).cmp(b.original.outstanding),
        cell: ({ getValue }) => (
          <span className="money-cell">{formatMoney(String(getValue()))}</span>
        ),
      },
      {
        accessorKey: 'costs',
        header: 'Direct costs',
        sortingFn: (a, b) => d(a.original.costs).cmp(b.original.costs),
        cell: ({ getValue }) => (
          <span className="money-cell">{formatMoney(String(getValue()))}</span>
        ),
      },
      {
        accessorKey: 'profit',
        header: 'For Me · Profit',
        sortingFn: (a, b) => d(a.original.profit).cmp(b.original.profit),
        cell: ({ getValue }) => (
          <strong className={`money-cell ${d(String(getValue())).lt(0) ? 'negative' : 'positive'}`}>
            {formatMoney(String(getValue()))}
          </strong>
        ),
      },
      {
        accessorKey: 'payment_status',
        header: 'Payment status',
        cell: ({ getValue }) => (
          <Badge
            tone={
              getValue() === 'Paid' ? 'green' : getValue() === 'Partially paid' ? 'blue' : 'amber'
            }
          >
            {String(getValue())}
          </Badge>
        ),
      },
      { accessorKey: 'status', header: 'Project status' },
      { accessorKey: 'notes', header: 'Notes' },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="row-actions">
            <button
              aria-label={`Record payment for ${row.original.name}`}
              title="Add payment"
              onClick={() =>
                openForm({
                  table: 'client_payments',
                  defaults: {
                    project_id: row.original.id,
                    currency: row.original.currency,
                    exchange_rate: row.original.exchange_rate,
                  },
                })
              }
            >
              <Wallet size={15} />
            </button>
            <button
              aria-label={`Add cost for ${row.original.name}`}
              title="Add cost"
              onClick={() =>
                openForm({ table: 'project_costs', defaults: { project_id: row.original.id } })
              }
            >
              <ReceiptText size={15} />
            </button>
            <button
              aria-label={`Edit ${row.original.name}`}
              title="Edit project"
              onClick={() => openForm({ table: 'projects', record: row.original })}
            >
              <Pencil size={14} />
            </button>
          </div>
        ),
      },
    ],
    [openForm, onNotice],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: search, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const visible = table.getRowModel().rows.map((r) => r.original);
  return (
    <section className="panel project-panel">
      <div className="table-filters">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search projects"
            placeholder="Search projects or clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="">All currencies</option>
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter by payment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Payment status</option>
          {['Unpaid', 'Partially paid', 'Paid'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <details className="column-picker">
          <summary>
            <SlidersHorizontal size={15} /> Columns
          </summary>
          <div>
            {table
              .getAllLeafColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={c.getIsVisible()}
                    onChange={c.getToggleVisibilityHandler()}
                  />
                  {String(c.columnDef.header)}
                </label>
              ))}
          </div>
        </details>
        <Button variant="outline" size="sm" onClick={openImport}>
          <Upload size={15} />
          Import
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            download(
              'infonits-projects.csv',
              exportCsv(
                visible.map((p) => ({
                  Project: p.name,
                  Client: p.client_name,
                  'Original amount': p.amount,
                  Currency: p.currency,
                  'Exchange rate': p.exchange_rate,
                  'Value LKR': p.amount_lkr,
                  'Received LKR': p.received,
                  'Outstanding LKR': p.outstanding,
                  'Direct costs LKR': p.costs,
                  'For Me LKR': p.profit,
                  Status: p.payment_status,
                  Notes: p.notes,
                })),
              ),
            )
          }
        >
          <Download size={15} />
          Export
        </Button>
      </div>
      <div className="desktop-table table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id}>
                    <button
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown size={11} />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr>
                {table.getVisibleLeafColumns().map((col) => (
                  <td key={col.id}>
                    {col.id === 'name'
                      ? `${visible.length} projects`
                      : ['amount_lkr', 'received', 'outstanding', 'costs', 'profit'].includes(
                            col.id,
                          )
                        ? formatMoney(sum(visible.map((p) => String(p[col.id]))))
                        : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="mobile-projects">
        {visible.map((p) => (
          <article key={p.id} className="mobile-project">
            <div>
              <Link href={`/projects/${p.id}`}>
                <strong>{p.name}</strong>
                <ArrowUpRight size={15} />
              </Link>
              <small>{p.client_name}</small>
              <Badge tone={p.payment_status === 'Paid' ? 'green' : 'amber'}>
                {p.payment_status}
              </Badge>
            </div>
            <dl>
              <div>
                <dt>Value</dt>
                <dd>{formatMoney(p.amount_lkr)}</dd>
              </div>
              <div>
                <dt>Expected profit</dt>
                <dd className={d(p.profit).lt(0) ? 'negative' : 'positive'}>
                  {formatMoney(p.profit)}
                </dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatMoney(p.received)}</dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd>{formatMoney(p.outstanding)}</dd>
              </div>
            </dl>
            <div className="mobile-actions">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  openForm({ table: 'client_payments', defaults: { project_id: p.id } })
                }
              >
                <Plus size={13} />
                Payment
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openForm({ table: 'project_costs', defaults: { project_id: p.id } })}
              >
                <Plus size={13} />
                Cost
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit project"
                onClick={() => openForm({ table: 'projects', record: p })}
              >
                <Pencil size={15} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <EmptyState
          title={projects.length ? 'No matching projects' : 'Your next project starts here'}
          description={
            projects.length
              ? 'Try another search or clear your filters.'
              : 'Add a project to track its value, client payments, work costs and expected profit.'
          }
          action={
            projects.length
              ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setCurrency('');
                    setStatus('');
                  },
                }
              : { label: 'Add a project', onClick: () => openForm({ table: 'projects' }) }
          }
        />
      )}
      <div className="table-footer">
        <span>
          {visible.length} of {projects.length} projects
        </span>
        <span>All totals in LKR · Profit includes committed costs</span>
      </div>
    </section>
  );
}
