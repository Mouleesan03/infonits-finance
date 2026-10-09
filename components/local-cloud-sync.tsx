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

function sameSnapshot(left: Snapshot, right: Snapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeArrays(remote: unknown, local: unknown) {
  const remoteItems = Array.isArray(remote) ? remote : [];
  const localItems = Array.isArray(local) ? local : [];
  const records = new Map<string, unknown>();
  for (const item of remoteItems) {
    if (item && typeof item === 'object' && 'id' in item) records.set(String(item.id), item);
  }
  for (const item of localItems) {
    if (item && typeof item === 'object' && 'id' in item) records.set(String(item.id), item);
  }
  return [...records.values()];
}

function mergeSection(remote: Record<string, unknown>, local: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...remote, ...local };
  for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    if (Array.isArray(remote[key]) || Array.isArray(local[key])) {
      merged[key] = mergeArrays(remote[key], local[key]);
    } else if (
      remote[key] &&
      local[key] &&
      typeof remote[key] === 'object' &&
      typeof local[key] === 'object'
    ) {
      merged[key] = {
        ...(remote[key] as Record<string, unknown>),
        ...(local[key] as Record<string, unknown>),
      };
    }
  }
  return merged;
}

function mergeSnapshots(remote: Partial<Snapshot>, local: Snapshot): Snapshot {
  return {
    finance: mergeSection(remote.finance ?? {}, local.finance),
    office: mergeSection(remote.office ?? {}, local.office),
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
  return mergeSnapshots(remote, local);
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

  useEffect(() => {
    if (!configured) {
      setStatus('offline');
      return;
    }
    const db = browserClient();
    let active = true;

    async function pullAndMerge() {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!active || !user) {
        if (active) setStatus('offline');
        return;
      }
      setStatus('syncing');
      const { data, error } = await db
        .from('local_workspaces')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        setStatus('error');
        setMessage('Cloud table is not ready yet. Apply the latest Supabase migration.');
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
      if (!active) return;
      if (saved.error) {
        setStatus('error');
        setMessage('Unable to save to Supabase.');
        return;
      }
      rememberSynced(resolved);
      ready.current = true;
      setMessage('');
      setStatus('synced');
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (localChanged) {
        saveSnapshot(resolved);
        window.location.reload();
      }
    }

    async function pushLocal() {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!active || !user) return;
      setStatus('syncing');
      const snapshot = localSnapshot();
      const { error } = await db
        .from('local_workspaces')
        .upsert({ user_id: user.id, data: snapshot }, { onConflict: 'user_id' });
      if (!active) return;
      setStatus(error ? 'error' : 'synced');
      if (error) {
        setMessage('Cloud sync failed. Your changes are safe here and will retry automatically.');
      } else {
        rememberSynced(snapshot);
        setMessage('');
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }

    const schedulePush = () => {
      if (!ready.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void pushLocal(), 250);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullAndMerge();
    };
    const onFocus = () => void pullAndMerge();
    const onOnline = () => void pullAndMerge();
    const onSyncNow = () => void pullAndMerge();
    syncNow.current = onSyncNow;
    void pullAndMerge();
    window.addEventListener('infonits:local-change', schedulePush);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('infonits:sync-now', onSyncNow);
    document.addEventListener('visibilitychange', onVisible);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pullAndMerge();
    }, 20_000);
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
