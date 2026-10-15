'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { isSixDigitPin, normalizeEmail, pinCredential } from '@/lib/auth';
import { Button } from './ui/button';

type AuthStep = 'login' | 'complete';
const rememberedEmailKey = 'infonits-finance-login-email';

export function AuthForm({
  configured,
  initialError,
  complete = false,
}: {
  configured: boolean;
  initialError?: string;
  complete?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCredential, setShowCredential] = useState(false);
  const [error, setError] = useState(
    initialError === 'membership'
      ? 'Your account has no active workspace membership. Contact the workspace administrator.'
      : initialError === 'session-expired'
        ? 'For your security, your 2-hour session ended. Sign in again to continue.'
        : initialError
          ? 'This secure link could not be verified. Request a new PIN link.'
          : '',
  );
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<AuthStep>(complete ? 'complete' : 'login');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const remembered = window.localStorage.getItem(rememberedEmailKey);
    if (remembered) setEmail(remembered);
  }, []);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accountSetupFromUrl = ['invite', 'recovery'].includes(params.get('type') ?? '');
    const db = browserClient();
    const finishAccountSetup = (hasUser: boolean) => {
      if (!active) return;
      setSessionReady(hasUser);
      if (hasUser && accountSetupFromUrl) {
        setStep('complete');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
    void db.auth.getUser().then(({ data }) => finishAccountSetup(!!data.user));
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => finishAccountSetup(!!session?.user));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  async function sendPinLink() {
    setError('');
    setNotice('');
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await browserClient().auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/complete`,
      });
      if (error) throw error;
      window.localStorage.setItem(rememberedEmailKey, normalizedEmail);
      setNotice('Check your email for a secure link to create a new 6-digit PIN.');
    } catch {
      setError('The PIN email could not be sent right now. Wait a moment and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!configured) throw new Error('Supabase is not connected yet.');
      const db = browserClient();
      if (step === 'login') {
        const normalizedEmail = normalizeEmail(email);
        if (!isSixDigitPin(credential)) {
          throw new Error('Enter your 6-digit PIN.');
        }
        const password = await pinCredential(normalizedEmail, credential);
        const { error } = await db.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          throw new Error('Email or PIN is incorrect. You can reset the PIN below.');
        }
        window.localStorage.setItem(rememberedEmailKey, normalizedEmail);
        setSessionReady(true);
        const {
          data: { user },
        } = await db.auth.getUser();
        const { data: profile } = await db
          .from('profiles')
          .select('active')
          .eq('id', user!.id)
          .single();
        if (!profile?.active) {
          await db.auth.signOut();
          throw new Error(
            'Your account has no active workspace membership. Contact the administrator.',
          );
        }
      } else if (step === 'complete') {
        if (!isSixDigitPin(credential)) throw new Error('Choose exactly 6 numbers for your PIN.');
        if (credential !== confirmPin) throw new Error('The two PIN entries do not match.');
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user?.email) throw new Error('Your recovery session expired. Request a new PIN link.');
        const password = await pinCredential(user.email, credential);
        const { error } = await db.auth.updateUser({ password });
        if (error) {
          throw new Error(
            error.message.toLowerCase().includes('session')
              ? 'Your recovery session expired. Request a new PIN link.'
              : 'Unable to save this PIN right now. Wait a moment and try again.',
          );
        }
      }
      router.push('/local');
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = step === 'complete' ? 'Create your PIN' : 'Welcome back';
  const description =
    step === 'complete'
      ? 'Choose six numbers you can enter quickly on any device.'
      : 'Use your email and 6-digit PIN to open your workspace.';

  return (
    <div className="auth-page auth-page-v2">
      <aside className="auth-story">
        <Link className="auth-brand" href="/" aria-label="Infonits Finance home">
          <img src="/infonits-white-logo.png" alt="infonits" width={154} height={36} />
          <span>FINANCE</span>
        </Link>
        <div className="auth-story-copy">
          <span className="eyebrow">YOUR PRIVATE FINANCE WORKSPACE</span>
          <h1>
            Quick access.
            <br />
            Clear numbers.
            <br />
            <span>Less friction.</span>
          </h1>
          <p>Projects, payments, invoices and profit in one secure workspace.</p>
          <div className="auth-benefits">
            <span>
              <KeyRound size={17} /> Simple 6-digit PIN
            </span>
            <span>
              <ShieldCheck size={17} /> Protected cloud session
            </span>
            <span>
              <CheckCircle2 size={17} /> Works smoothly on mobile
            </span>
          </div>
        </div>
        <span className="auth-footer">Infonits Finance · Private workspace</span>
      </aside>

      <main className="auth-main">
        <div className="auth-box auth-box-v2">
          <span className="auth-lock">
            <KeyRound size={23} />
          </span>
          <span className="auth-kicker">SECURE SIGN IN</span>
          <h2>{title}</h2>
          <p>{description}</p>

          {!configured && (
            <div className="notice">
              <ShieldCheck size={18} />
              <span>Connect Supabase to enable secure sign-in.</span>
            </div>
          )}

          <form onSubmit={submit}>
            {step === 'login' && (
              <>
                <label className="field auth-icon-field">
                  <span>Email address</span>
                  <span className="auth-input-wrap">
                    <Mail size={17} aria-hidden="true" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@infonits.io"
                      required
                    />
                  </span>
                </label>
                <label className="field auth-icon-field">
                  <span>6-digit PIN</span>
                  <span className="auth-input-wrap">
                    <KeyRound size={17} aria-hidden="true" />
                    <input
                      type={showCredential ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="current-password"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={credential}
                      onChange={(event) =>
                        setCredential(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
                      required
                    />
                    <button
                      className="auth-reveal"
                      type="button"
                      aria-label={showCredential ? 'Hide credential' : 'Show credential'}
                      onClick={() => setShowCredential((value) => !value)}
                    >
                      {showCredential ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </label>
                <div className="auth-login-options">
                  <button type="button" onClick={() => void sendPinLink()} disabled={busy}>
                    Set or reset PIN
                  </button>
                </div>
              </>
            )}

            {step === 'complete' && (
              <div className="auth-pin-grid">
                <label className="field">
                  <span>New 6-digit PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={credential}
                    onChange={(event) =>
                      setCredential(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="••••••"
                    required
                  />
                </label>
                <label className="field">
                  <span>Confirm PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={confirmPin}
                    onChange={(event) =>
                      setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="••••••"
                    required
                  />
                </label>
              </div>
            )}

            {notice && (
              <p className="auth-success" role="status">
                <CheckCircle2 size={17} />
                {notice}
              </p>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            <Button className="auth-submit" type="submit" disabled={busy || !configured}>
              {busy ? <LoaderCircle size={17} className="spin" /> : null}
              {step === 'login' ? 'Open workspace' : 'Save PIN & continue'}
              <ArrowRight size={16} />
            </Button>
          </form>

          <p className="auth-security-note">
            <ShieldCheck size={15} /> Your PIN is handled by Supabase authentication and never
            stored in this app.
          </p>

          {sessionReady && (
            <button
              className="text-link"
              onClick={async () => {
                await browserClient().auth.signOut();
                setStep('login');
                setSessionReady(false);
              }}
            >
              Sign out and use another account
            </button>
          )}
          <Link className="auth-site" href="https://infonits.io/" target="_blank" rel="noreferrer">
            infonits.io <ArrowUpRight size={13} />
          </Link>
        </div>
      </main>
    </div>
  );
}
