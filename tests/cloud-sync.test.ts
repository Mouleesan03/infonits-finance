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

  it('does not treat JSON object key order as a data change', () => {
    const baseline: CloudSnapshot = {
      finance: { rows: [], month: '2026-10' },
      office: { documents: [], users: [] },
    };
    const remote: CloudSnapshot = {
      office: { users: [], documents: [] },
      finance: { month: '2026-10', rows: [] },
    };

    expect(resolveCloudSnapshot(remote, baseline, baseline)).toEqual(baseline);
  });

  it('keeps a local deletion when the cloud copy is unchanged', () => {
    const baseline = snapshot([
      { id: '1', name: 'Keep' },
      { id: '2', name: 'Delete me' },
    ]);
    const local = snapshot([{ id: '1', name: 'Keep' }]);

    expect(resolveCloudSnapshot(baseline, local, baseline)).toEqual(local);
  });

  it('accepts a deletion made on another device when local data is unchanged', () => {
    const baseline = snapshot([
      { id: '1', name: 'Keep' },
      { id: '2', name: 'Delete on phone' },
    ]);
    const remote = snapshot([{ id: '1', name: 'Keep' }]);

    expect(resolveCloudSnapshot(remote, baseline, baseline)).toEqual(remote);
  });

  it('preserves independent edits to different records', () => {
    const baseline = snapshot([
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ]);
    const remote = snapshot([
      { id: '1', name: 'Phone edit' },
      { id: '2', name: 'Second' },
    ]);
    const local = snapshot([
      { id: '1', name: 'First' },
      { id: '2', name: 'Laptop edit' },
    ]);

    expect(resolveCloudSnapshot(remote, local, baseline).finance.rows).toEqual([
      { id: '1', name: 'Phone edit' },
      { id: '2', name: 'Laptop edit' },
    ]);
  });
});
