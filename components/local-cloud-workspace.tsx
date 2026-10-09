'use client';

import { useEffect, useState } from 'react';
import { Cloud, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { LocalFinance } from './local-finance';

type AccessState = 'checking' | 'signed-out' | 'signed-in';

export function LocalCloudWorkspace({ initialEmail }: { initialEmail?: string }) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const [state, setState] = useState<AccessState>(initialEmail ? 'signed-in' : 'checking');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!configured) {
      setState('signed-out');
      return;
    }
    const db = browserClient();
    let active = true;
    void db.auth.getUser().then(({ data }) => {
      if (active) setState(data.user ? 'signed-in' : 'signed-out');
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => {
      if (active) setState(session?.user ? 'signed-in' : 'signed-out');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  async function sendLoginLink(event: React.FormEvent) {
    event.preventDefault();
    if (!configured || !email.trim()) return;
    setBusy(true);
    setMessage('');
    const { error } = await browserClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/local`,
      },
    });
    setBusy(false);
    setMessage(
      error
        ? 'Login link could not be sent. Check the email address.'
        : 'Login link sent. Open the newest email on this device.',
    );
  }

  if (state === 'checking') {
    return (
      <main className="cloud-access-loading">
        <LoaderCircle className="spin" size={24} />
        <span>Opening your cloud workspace…</span>
      </main>
    );
  }

  if (state === 'signed-out') {
    return (
      <main className="cloud-access-page">
        <section className="cloud-access-card">
          <img src="/infonits-logo.png" alt="infonits" width={154} height={36} />
          <span className="cloud-access-icon">
            <LockKeyhole size={25} />
          </span>
          <h1>Your private workspace</h1>
          <p>
            Sign in once on this device. Your session stays active and every record saves to
            Supabase.
          </p>
          <div className="cloud-access-benefits">
            <span>
              <Cloud size={16} /> Always saved to cloud
            </span>
            <span>
              <ShieldCheck size={16} /> Only your account can open it
            </span>
          </div>
          <form onSubmit={sendLoginLink}>
            <label htmlFor="workspace-email">Email address</label>
            <div>
              <Mail size={18} />
              <input
                id="workspace-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="button button-primary" disabled={busy || !configured} type="submit">
              {busy ? <LoaderCircle className="spin" size={17} /> : <Mail size={17} />}
              Send login link
            </button>
          </form>
          {message ? <p className="cloud-access-message">{message}</p> : null}
          {!configured ? <p className="cloud-access-error">Supabase is not configured.</p> : null}
          <small>No password to remember. Login remains active on this device.</small>
        </section>
      </main>
    );
  }

  return <LocalFinance />;
}
