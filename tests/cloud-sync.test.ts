import { describe, expect, it } from 'vitest';
import { resolveCloudSnapshot, type CloudSnapshot } from '@/components/local-cloud-sync';

function snapshot(rows: Array<{ id: string; name: string }>): CloudSnapshot {
  return { finance: { rows }, office: {} };
}

describe('cloud workspace conflict resolution', () => {
  it('accepts a newer cloud copy when this device has not changed', () => {
    const baseline = snapshot([{ id: '1', name: 'Original' }]);
    const remote = snapshot([{ id: '1', name: 'Edited on phone' }]);

    expect(resolveCloudSnapshot(remote, baseline, baseline)).toEqual(remote);
  });

  it('keeps an unsaved device change when the cloud still matches the baseline', () => {
    const baseline = snapshot([{ id: '1', name: 'Original' }]);
    const local = snapshot([{ id: '1', name: 'Edited on laptop' }]);

    expect(resolveCloudSnapshot(baseline, local, baseline)).toEqual(local);
  });

  it('combines records on a first connection without losing either device', () => {
    const remote = snapshot([{ id: '1', name: 'Phone project' }]);
    const local = snapshot([{ id: '2', name: 'Laptop project' }]);

    expect(resolveCloudSnapshot(remote, local, null).finance.rows).toEqual([
      { id: '1', name: 'Phone project' },
      { id: '2', name: 'Laptop project' },
    ]);
  });
});
