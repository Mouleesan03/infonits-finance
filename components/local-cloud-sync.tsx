'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Cloud, CloudOff, LoaderCircle, LogOut, Mail, X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';

const financeKey = 'infonits-finance-local-v1';
const officeKey = 'infonits-finance-office-v1';

type Snapshot = { finance: Record<string, unknown>; office: Record<string, unknown> };
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

function saveSnapshot(snapshot: Snapshot) {
  localStorage.setItem(financeKey, JSON.stringify(snapshot.finance));
  localStorage.setItem(officeKey, JSON.stringify(snapshot.office));
}

export function LocalCloudSync() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const [status, setStatus] = useState<SyncStatus>('checking');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setConnectedEmail(user.email ?? 'Connected');
      setStatus('syncing');
      const { data, error } = await db
        .from('local_workspaces')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        setStatus('error');
        setMessage('Cloud table is not ready yet. Apply the latest Supabase migration.');
        return;
      }
      const local = localSnapshot();
      const merged = mergeSnapshots((data?.data as Partial<Snapshot>) ?? {}, local);
      const localChanged = JSON.stringify(merged) !== JSON.stringify(local);
      const saved = await db
        .from('local_workspaces')
        .upsert({ user_id: user.id, data: merged }, { onConflict: 'user_id' });
      if (saved.error) {
        setStatus('error');
        setMessage('Unable to save to Supabase.');
        return;
      }
      setStatus('synced');
      if (localChanged) {
        saveSnapshot(merged);
        window.location.reload();
      }
    }

    async function pushLocal() {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!active || !user) return;
      setStatus('syncing');
      const { error } = await db
        .from('local_workspaces')
        .upsert({ user_id: user.id, data: localSnapshot() }, { onConflict: 'user_id' });
      if (!active) return;
      setStatus(error ? 'error' : 'synced');
      if (error) setMessage('Cloud sync failed. Your changes are still saved on this device.');
    }

    const schedulePush = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void pushLocal(), 900);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullAndMerge();
    };
    void pullAndMerge();
    window.addEventListener('infonits:local-change', schedulePush);
    document.addEventListener('visibilitychange', onVisible);
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void pullAndMerge();
      if (event === 'SIGNED_OUT') {
        setConnectedEmail('');
        setStatus('offline');
      }
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('infonits:local-change', schedulePush);
      document.removeEventListener('visibilitychange', onVisible);
      subscription.unsubscribe();
    };
  }, [configured]);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    if (!configured || !email.trim()) return;
    setStatus('syncing');
    setMessage('');
    const db = browserClient();
    const { error } = await db.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/local`,
      },
    });
    if (error) {
      setStatus('offline');
      setMessage('Unable to send the sign-in link. Check the email and try again.');
      return;
    }
    setStatus('offline');
    setMessage('Sign-in link sent. Open it on this device to start cloud sync.');
  }

  async function signOut() {
    await browserClient().auth.signOut();
    setOpen(false);
  }

  return (
    <>
      <button className={`local-cloud-button ${status}`} onClick={() => setOpen(true)}>
        {status === 'syncing' || status === 'checking' ? (
          <LoaderCircle size={15} className="spin" />
        ) : status === 'synced' ? (
          <Cloud size={15} />
        ) : (
          <CloudOff size={15} />
        )}
        <span>
          {status === 'synced'
            ? 'Cloud synced'
            : status === 'syncing' || status === 'checking'
              ? 'Syncing'
              : 'Connect cloud'}
        </span>
      </button>
      {open && (
        <div className="local-modal-layer" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="local-modal local-sync-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-sync-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="local-modal-icon">
                  <Cloud size={19} />
                </span>
                <div>
                  <h2 id="cloud-sync-title">Cloud sync</h2>
                  <p>Use the same email on mobile and laptop to share records.</p>
                </div>
              </div>
              <button aria-label="Close cloud sync" onClick={() => setOpen(false)}>
                <X size={19} />
              </button>
            </header>
            {status === 'synced' ? (
              <div className="local-sync-connected">
                <span>
                  <Check size={20} />
                </span>
                <div>
                  <strong>Supabase connected</strong>
                  <p>{connectedEmail}</p>
                </div>
                <button className="button button-outline" onClick={() => void signOut()}>
                  <LogOut size={15} /> Disconnect
                </button>
              </div>
            ) : (
              <form className="local-sync-form" onSubmit={sendLink}>
                <div className="local-sync-callout">
                  <Cloud size={17} />
                  <p>
                    Records are currently stored only on this device. Connect once on each device
                    for automatic Supabase sync.
                  </p>
                </div>
                <label>
                  <span>Email address</span>
                  <div>
                    <Mail size={17} />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </label>
                {message && (
                  <p className={status === 'error' ? 'local-sync-error' : 'local-sync-message'}>
                    {message}
                  </p>
                )}
                <button
                  className="button button-primary"
                  disabled={status === 'syncing'}
                  type="submit"
                >
                  {status === 'syncing' ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Mail size={16} />
                  )}{' '}
                  Email sign-in link
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
