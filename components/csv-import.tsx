'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, Check, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { parseCsv } from '@/lib/csv';
import { validateRecord, currencies } from '@/lib/schemas';
import type { Row } from '@/lib/types';
import { today } from '@/lib/finance';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { download } from './project-table';
const fields = [
  ['name', 'Project name'],
  ['amount', 'Original contract amount'],
  ['currency', 'Original currency'],
  ['exchange_rate', 'Historical LKR rate'],
  ['client', 'Client name'],
  ['reporting_month', 'Reporting month (YYYY-MM-01)'],
  ['notes', 'Notes'],
];
export function CsvImport({
  clients,
  configured,
  onClose,
  onNotice,
}: {
  clients: Row[];
  configured: boolean;
  onClose: () => void;
  onNotice: (s: string) => void;
}) {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultClient, setDefaultClient] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('LKR');
  const [defaultRate, setDefaultRate] = useState('1');
  const [defaultMonth, setDefaultMonth] = useState(today().slice(0, 7) + '-01');
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<
    { values: Record<string, unknown>; source: Record<string, string> }[]
  >([]);
  async function load(file?: File) {
    if (!file) return;
    setError('');
    setPreview([]);
    setReviewed(false);
    if (file.size > 2000000) {
      setError('Use a CSV smaller than 2 MB.');
      return;
    }
    try {
      const result = parseCsv(await file.text());
      setHeaders(result.headers);
      setRows(result.rows);
      setMapping(
        Object.fromEntries(fields.map(([key]) => [key, result.headers.includes(key) ? key : ''])),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function review() {
    setError('');
    setPreview([]);
    setReviewed(false);
    try {
      if (!mapping.name || !mapping.amount)
        throw new Error('Map project name and original contract amount.');
      const parsed = rows.map((source, index) => {
        const value = (key: string, fallback = '') =>
          mapping[key] ? source[mapping[key]] : fallback;
        let client = defaultClient;
        if (mapping.client) {
          const found = clients.filter(
            (c) => String(c.name).trim().toLowerCase() === value('client').trim().toLowerCase(),
          );
          if (found.length !== 1)
            throw new Error(`Row ${index + 2}: client name must match exactly one saved client.`);
          client = found[0].id;
        }
        try {
          return {
            source,
            values: validateRecord('projects', {
              name: value('name'),
              amount: value('amount').replace(/,/g, ''),
              currency: value('currency', defaultCurrency),
              exchange_rate: value('exchange_rate', defaultRate),
              client_id: client,
              reporting_month: value('reporting_month', defaultMonth),
              status: 'In progress',
              notes: value('notes'),
            }) as Record<string, unknown>,
          };
        } catch {
          throw new Error(
            `Row ${index + 2}: check amount, currency, rate, client and reporting month. Use plain numeric values.`,
          );
        }
      });
      setPreview(parsed);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function commit() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed, rows: preview }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onNotice(`${result.count} projects imported. Original CSV rows preserved.`);
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title="Bring your projects over"
      description="Map, review, then import. Nothing is saved until you confirm."
      wide
    >
      <div className="import-body">
        <div className="notice warning">
          <AlertTriangle size={18} />
          <span>
            <strong>Contracts only — no guessed financial history.</strong> Legacy “Adv Received”,
            “Pay for work”, “Paid for work (A)” and “For Me” are preserved in the source record but
            not imported as transactions. Confirm what each cost/payment field means before entering
            those records separately.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            download(
              'infonits-import-template.csv',
              'name,amount,currency,exchange_rate,client,reporting_month,notes\n',
            )
          }
        >
          <Download size={14} />
          Download blank template
        </Button>
        <label className="file-drop">
          <FileSpreadsheet size={28} />
          <strong>Choose a CSV file</strong>
          <span>Up to 500 projects · 2 MB maximum</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void load(e.target.files?.[0])}
          />
        </label>
        {rows.length > 0 && (
          <>
            <div className="section-actions">
              <h3>Map your columns</h3>
              <span className="pill">{rows.length} rows found</span>
            </div>
            <div className="form-grid">
              {fields.map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => {
                      setMapping({ ...mapping, [key]: e.target.value });
                      setPreview([]);
                      setReviewed(false);
                    }}
                  >
                    <option value="">
                      {['name', 'amount'].includes(key)
                        ? 'Choose a column'
                        : 'Use default / leave blank'}
                    </option>
                    {headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
              {!mapping.client && (
                <label className="field">
                  <span>Default client</span>
                  <select
                    value={defaultClient}
                    onChange={(e) => {
                      setDefaultClient(e.target.value);
                      setPreview([]);
                    }}
                  >
                    <option value="">Choose an existing client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {String(c.name)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!mapping.currency && (
                <label className="field">
                  <span>Default original currency</span>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => {
                      setDefaultCurrency(e.target.value);
                      setPreview([]);
                    }}
                  >
                    {currencies.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              {!mapping.exchange_rate && (
                <label className="field">
                  <span>Default recorded exchange rate</span>
                  <input
                    value={defaultRate}
                    onChange={(e) => {
                      setDefaultRate(e.target.value);
                      setPreview([]);
                    }}
                  />
                </label>
              )}
              {!mapping.reporting_month && (
                <label className="field">
                  <span>Default reporting month</span>
                  <input
                    type="date"
                    value={defaultMonth}
                    onChange={(e) => {
                      setDefaultMonth(e.target.value);
                      setPreview([]);
                    }}
                  />
                </label>
              )}
            </div>
            <Button variant="outline" onClick={review}>
              <Check size={15} />
              Validate & preview all rows
            </Button>
          </>
        )}
        {preview.length > 0 && (
          <>
            <div className="import-preview table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Original value</th>
                    <th>Rate</th>
                    <th>Month</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td>{String(row.values.name)}</td>
                      <td>
                        {String(row.values.currency)} {String(row.values.amount)}
                      </td>
                      <td>{String(row.values.exchange_rate)}</td>
                      <td>{String(row.values.reporting_month)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              <span>
                I reviewed all {preview.length} contracts, their client mapping and historical
                rates. I understand no payments or costs will be imported.
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {!configured && <p className="muted">Connect Supabase before importing records.</p>}
      </div>
      <div className="dialog-footer">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={!reviewed || !preview.length || busy || !configured}
          onClick={() => void commit()}
        >
          <Upload size={15} />
          {busy ? 'Importing…' : `Import ${preview.length || ''} projects`}
        </Button>
      </div>
    </Dialog>
  );
}
