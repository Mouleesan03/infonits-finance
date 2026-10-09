'use client';

import { formatMoney, sum } from '@/lib/finance';
import type { Project } from '@/lib/types';

const totals = [
  { label: 'Project value', key: 'amount_lkr' },
  { label: 'Received', key: 'received' },
  { label: 'Outstanding', key: 'outstanding' },
  { label: 'Direct costs', key: 'costs' },
  { label: 'For Me', key: 'profit', accent: true },
] as const;

export function SummaryCards({ projects }: { projects: Project[] }) {
  return (
    <section className="sheet-summary" aria-label="Project totals">
      {totals.map((item) => (
        <div
          key={item.key}
          className={'accent' in item && item.accent ? 'sheet-total profit' : 'sheet-total'}
        >
          <span>{item.label}</span>
          <strong>{formatMoney(sum(projects.map((project) => project[item.key])))}</strong>
        </div>
      ))}
    </section>
  );
}
