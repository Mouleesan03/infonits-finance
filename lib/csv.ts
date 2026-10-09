import Papa from 'papaparse';
export function parseCsv(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  if (!parsed.meta.fields?.length || parsed.data.length === 0)
    throw new Error('The CSV contains no data rows.');
  if (parsed.data.length > 500) throw new Error('Import at most 500 projects per file.');
  return { headers: parsed.meta.fields, rows: parsed.data };
}
export const safeCell = (value: unknown) => {
  const s = String(value ?? '');
  return /^[\s]*[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
export function exportCsv(rows: Record<string, unknown>[]) {
  return Papa.unparse(
    rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safeCell(v)]))),
  );
}
