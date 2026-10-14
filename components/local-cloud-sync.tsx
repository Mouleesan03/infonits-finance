'use client';

import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';

const financeKey = 'infonits-finance-local-v1';
const officeKey = 'infonits-finance-office-v1';
const cloudBaselineKey = 'infonits-cloud-baseline-v1';

export type CloudSnapshot = { finance: Record<string, unknown>; office: Record<string, unknown> };
type Snapshot = CloudSnapshot;
type SyncStatus = 'checking' | 'offline' | 'syncing' | 'synced' | 'error';

function parseStore(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function localSnapshot(): Snapshot {
  return { finance: parseStore(financeKey), office: parseStore(officeKey) };
}

function readBaseline(): Snapshot | null {
  try {
    const value = JSON.parse(localStorage.getItem(cloudBaselineKey) ?? 'null') as Snapshot | null;
    return value?.finance && value?.office ? value : null;
  } catch {
    return null;
  }
}

function rememberSynced(snapshot: Snapshot) {
  localStorage.setItem(cloudBaselineKey, JSON.stringify(snapshot));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function sameSnapshot(left: Snapshot, right: Snapshot) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeArrays(remote: unknown, local: unknown, baseline: unknown) {
  const remoteItems = Array.isArray(remote) ? remote : [];
  const localItems = Array.isArray(local) ? local : [];
  const baselineItems = Array.isArray(baseline) ? baseline : [];
  const allItems = [...remoteItems, ...localItems, ...baselineItems];
  if (!allItems.every((item) => isRecord(item) && 'id' in item)) {
    if (sameValue(remoteItems, localItems)) return localItems;
    if (sameValue(localItems, baselineItems)) return remoteItems;
    return localItems;
  }

  const byId = (items: unknown[]) =>
    new Map(items.map((item) => [String((item as Record<string, unknown>).id), item]));
  const remoteById = byId(remoteItems);
  const localById = byId(localItems);
  const baselineById = byId(baselineItems);
  const preferredOrder = baselineItems.length
    ? [...localById.keys(), ...remoteById.keys(), ...baselineById.keys()]
    : [...remoteById.keys(), ...localById.keys()];
  const ids = [...new Set(preferredOrder)];

  return ids.flatMap((id) => {
    const remoteItem = remoteById.get(id);
    const localItem = localById.get(id);
    const baselineItem = baselineById.get(id);
    const localChanged = !sameValue(localItem, baselineItem);
    const remoteChanged = !sameValue(remoteItem, baselineItem);
    let resolved: unknown;

    if (sameValue(remoteItem, localItem)) resolved = localItem;
    else if (localChanged && !remoteChanged) resolved = localItem;
    else if (remoteChanged && !localChanged) resolved = remoteItem;
    else if (!localChanged && !remoteChanged) resolved = localItem;
    else if (localItem === undefined || remoteItem === undefined) resolved = undefined;
    else resolved = mergeValue(remoteItem, localItem, baselineItem);

    return resolved === undefined ? [] : [resolved];
  });
}

function mergeValue(remote: unknown, local: unknown, baseline: unknown): unknown {
  if (sameValue(remote, local)) return local;
  if (sameValue(local, baseline)) return remote;
  if (sameValue(remote, baseline)) return local;
  if (Array.isArray(remote) || Array.isArray(local)) {
    return mergeArrays(remote, local, baseline);
  }
  if (isRecord(remote) && isRecord(local)) {
    const baselineRecord = isRecord(baseline) ? baseline : {};
    const merged: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(remote),
      ...Object.keys(local),
      ...Object.keys(baselineRecord),
    ]);
    for (const key of keys) {
      const resolved = mergeValue(remote[key], local[key], baselineRecord[key]);
      if (resolved !== undefined) merged[key] = resolved;
    }
    return merged;
  }
  return local;
}

function mergeSnapshots(
  remote: Partial<Snapshot>,
  local: Snapshot,
  baseline: Partial<Snapshot> = {},
): Snapshot {
  return {
    finance: mergeValue(remote.finance ?? {}, local.finance, baseline.finance ?? {}) as Record<
      string,
      unknown
    >,
    office: mergeValue(remote.office ?? {}, local.office, baseline.office ?? {}) as Record<
      string,
      unknown
    >,
  };
}

export function resolveCloudSnapshot(
  remote: CloudSnapshot | null,
  local: CloudSnapshot,
  baseline: CloudSnapshot | null,
) {
  if (!remote) return local;
  if (!baseline) return mergeSnapshots(remote, local);

  const localChanged = !sameSnapshot(local, baseline);
  const remoteChanged = !sameSnapshot(remote, baseline);
  if (remoteChanged && !localChanged) return remote;
  if (localChanged && !remoteChanged) return local;
  if (!localChanged && !remoteChanged) return local;
  if (sameSnapshot(remote, local)) return local;
  return mergeSnapshots(remote, local, baseline);
}

function saveSnapshot(snapshot: Snapshot) {
  localStorage.setItem(financeKey, JSON.stringify(snapshot.finance));
  localStorage.setItem(officeKey, JSON.stringify(snapshot.office));
}

export function LocalCloudSync() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const [status, setStatus] = useState<SyncStatus>('checking');
  const [message, setMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncNow = useRef<() => void>(() => undefined);
  const ready = useRef(false);
  const pulling = useRef(false);
  const pushing = useRef(false);
  const dirty = useRef(false);
  const changeVersion = useRef(0);

  useEffect(() => {
    if (!configured) {
      setStatus('offline');
      return;
    }
    const db = browserClient();
    let active = true;
    let realtimeChannel: ReturnType<typeof db.channel> | null = null;

    async function pushLocal() {
      if (pushing.current) return false;
      pushing.current = true;
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!active || !user) {
        pushing.current = false;
        return false;
      }
      setStatus('syncing');
      const pushVersion = changeVersion.current;
      const snapshot = localSnapshot();
      const { error } = await db
        .from('local_workspaces')
        .upsert({ user_id: user.id, data: snapshot }, { onConflict: 'user_id' });
      if (!active) {
        pushing.current = false;
        return false;
      }
      setStatus(error ? 'error' : 'synced');
      if (error) {
        setMessage('Cloud sync failed. Your changes are safe here and will retry automatically.');
      } else {
        dirty.current = changeVersion.current !== pushVersion;
        rememberSynced(snapshot);
        setMessage('');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      pushing.current = false;
      if (!error && dirty.current) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          void pushLocal();
        }, 150);
      }
      return !error;
    }

    async function pullAndMerge() {
      if (pulling.current) return;
      if (dirty.current && !(await pushLocal())) return;
      pulling.current = true;
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!active || !user) {
        if (active) setStatus('offline');
        pulling.current = false;
        return;
      }
      const { data, error } = await db
        .from('local_workspaces')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        setStatus('error');
        setMessage('Cloud table is not ready yet. Apply the latest Supabase migration.');
        pulling.current = false;
        return;
      }
      const local = localSnapshot();
      const remote = data?.data ? (data.data as Snapshot) : null;
      const resolved = resolveCloudSnapshot(remote, local, readBaseline());
      const localChanged = !sameSnapshot(resolved, local);
      const remoteChanged = !remote || !sameSnapshot(resolved, remote);
      const saved = remoteChanged
        ? await db
            .from('local_workspaces')
            .upsert({ user_id: user.id, data: resolved }, { onConflict: 'user_id' })
        : { error: null };
      if (!active) {
        pulling.current = false;
        return;
      }
      if (saved.error) {
        setStatus('error');
        setMessage('Unable to save to Supabase.');
        pulling.current = false;
        return;
      }
      rememberSynced(resolved);
      ready.current = true;
      setMessage('');
      setStatus('synced');
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      pulling.current = false;
      if (localChanged) {
        saveSnapshot(resolved);
        window.location.reload();
      }
    }

    const schedulePush = () => {
      if (!ready.current) return;
      dirty.current = true;
      changeVersion.current += 1;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void pushLocal();
      }, 150);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullAndMerge();
    };
    const onFocus = () => void pullAndMerge();
    const onOnline = () => void pullAndMerge();
    const onSyncNow = () => void pullAndMerge();
    syncNow.current = onSyncNow;
    void pullAndMerge();
    void db.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      realtimeChannel = db
        .channel(`local-workspace-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'local_workspaces',
            filter: `user_id=eq.${user.id}`,
          },
          () => void pullAndMerge(),
        )
        .subscribe();
    });
    window.addEventListener('infonits:local-change', schedulePush);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('infonits:sync-now', onSyncNow);
    document.addEventListener('visibilitychange', onVisible);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pullAndMerge();
    }, 15_000);
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void pullAndMerge();
      if (event === 'SIGNED_OUT') {
        ready.current = false;
        setStatus('offline');
      }
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('infonits:local-change', schedulePush);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('infonits:sync-now', onSyncNow);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(refresh);
      if (realtimeChannel) void db.removeChannel(realtimeChannel);
      subscription.unsubscribe();
    };
  }, [configured]);

  return (
    <button
      className={`local-cloud-button ${status}`}
      disabled={status === 'checking' || status === 'syncing'}
      title={message || (lastSyncedAt ? `Saved at ${lastSyncedAt}` : 'Supabase cloud status')}
      onClick={() => syncNow.current()}
    >
      {status === 'syncing' || status === 'checking' ? (
        <LoaderCircle size={15} className="spin" />
      ) : status === 'synced' ? (
        <Cloud size={15} />
      ) : (
        <CloudOff size={15} />
      )}
      <span>
        {status === 'synced'
          ? 'Saved to cloud'
          : status === 'syncing' || status === 'checking'
            ? 'Saving…'
            : 'Cloud unavailable'}
      </span>
    </button>
  );
}
