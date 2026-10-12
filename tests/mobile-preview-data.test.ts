import { describe, expect, it } from 'vitest';
import { buildMobilePreviewData } from '../lib/mobile-preview-data';

describe('mobile preview data', () => {
  it('provides three useful records for every data section', () => {
    const { finance, office } = buildMobilePreviewData(new Date('2026-10-12T00:00:00Z'));

    expect(finance.clients).toHaveLength(3);
    expect(finance.rows).toHaveLength(3);
    expect(finance.expenses).toHaveLength(3);
    expect(office.documents.filter((item) => item.kind === 'Invoice')).toHaveLength(3);
    expect(office.documents.filter((item) => item.kind === 'Quotation')).toHaveLength(3);

    for (const records of [
      office.payments,
      office.team,
      office.posts,
      office.renewals,
      office.letters,
      office.users,
      office.events,
      office.recurringInvoices,
    ]) {
      expect(records).toHaveLength(3);
    }
  });
});
