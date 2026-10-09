'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';

type LocalRow = {
  id: string;
  project: string;
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
  value: 0,
  note: '',
  advance: 0,
  workDue: 0,
  workPaid: 0,
  status: 'Waiting',
});
const money = (value: number) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(value);

export function LocalFinance() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? (JSON.parse(saved) as { month?: string; rows?: LocalRow[] }) : null;
      setMonth(parsed?.month || new Date().toISOString().slice(0, 7));
      setRows(parsed?.rows?.length ? parsed.rows : [blankRow()]);
    } catch {
      setRows([blankRow()]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify({ month, rows }));
  }, [loaded, month, rows]);

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
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function exportCsv() {
    const header = [
      'Project details',
      'Project value (LKR)',
      'Note',
      'Advance received',
      'Pay for work',
      'Paid for work',
      'Payment status',
      'For me',
    ];
    const csv = [
      header,
      ...rows.map((row) => [
        row.project,
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

  if (!loaded) return <main className="local-loading">Opening your local finance sheet…</main>;

  return (
    <main className="local-page">
      <header className="local-header">
        <div>
          <img src="/infonits-logo.png" alt="infonits" width={154} height={36} />
          <span>finance</span>
        </div>
        <div className="local-actions">
          <button onClick={exportCsv} className="button button-outline">
            <Download size={16} /> Export CSV
          </button>
          <Link href="/login" className="button button-primary">
            Secure login
          </Link>
        </div>
      </header>

      <section className="local-titlebar">
        <div>
          <h1>Finance sheet</h1>
          <p>Temporary local mode · saved only in this browser</p>
        </div>
        <input
          aria-label="Finance month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </section>

      <section className="local-sheet-wrap">
        <table className="local-sheet">
          <thead>
            <tr className="local-month-row">
              <th colSpan={9}>
                {new Date(`${month}-02`).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                })}
              </th>
            </tr>
            <tr>
              <th>Project details</th>
              <th>Project value (LKR)</th>
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
                  {(['value', 'advance', 'workDue', 'workPaid'] as const).map((field) => (
                    <td key={field} className="local-money-cell">
                      <input
                        aria-label={field}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row[field] || ''}
                        placeholder="0.00"
                        onChange={(event) => update(row.id, field, Number(event.target.value))}
                      />
                    </td>
                  )).slice(0, 1)}
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
                        onChange={(event) => update(row.id, field, Number(event.target.value))}
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
      </section>

      <button className="local-add" onClick={() => setRows((current) => [...current, blankRow()])}>
        <Plus size={16} /> Add row
      </button>
      <p className="local-footnote">
        Local mode data is stored on this device. Use CSV export for backup. Sign in later to use the
        shared Supabase workspace.
      </p>
    </main>
  );
}
