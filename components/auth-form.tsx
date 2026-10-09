'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LockKeyhole, ArrowRight, LoaderCircle, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { Button } from './ui/button';
export function AuthForm({
  configured,
  initialStep,
  initialError,
  complete = false,
}: {
  configured: boolean;
  initialStep?: string;
  initialError?: string;
  complete?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(
    initialError === 'membership'
      ? 'Your account has no active workspace membership. Contact the workspace administrator.'
      : initialError
        ? 'This invitation could not be verified. Request a new invitation.'
        : '',
  );
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(complete ? 'complete' : initialStep === 'mfa' ? 'mfa' : 'login');
  const [factor, setFactor] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    if (!configured) return;
    let active = true;
    void browserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setSessionReady(!!data.user);
      });
    return () => {
      active = false;
    };
  }, [configured]);
  async function prepareMfa() {
    setError('');
    setBusy(true);
    try {
      const db = browserClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error('Sign in before setting up your authenticator.');
      const { data, error } = await db.auth.mfa.listFactors();
      if (error) throw error;
      const existing = data.totp.find((f) => f.status === 'verified');
      if (existing) {
        setFactor(existing.id);
        setQr('');
        setSecret('');
      } else {
        // Clear incomplete enrollments, leaving verified factors intact.
        for (const pending of data.all.filter(
          (f) => f.factor_type === 'totp' && f.status === 'unverified',
        )) {
          const { error } = await db.auth.mfa.unenroll({ factorId: pending.id });
          if (error) throw error;
        }
        const result = await db.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Infonits Finance',
          issuer: 'Infonits Finance',
        });
        if (result.error) throw result.error;
        setFactor(result.data.id);
        setQr(result.data.totp.qr_code);
        setSecret(result.data.totp.secret);
      }
      setStep('mfa');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!configured) throw new Error('Supabase is not connected yet.');
      const db = browserClient();
      if (step === 'login') {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw new Error('Unable to sign in. Check your email and password.');
        setSessionReady(true);
        const {
          data: { user },
        } = await db.auth.getUser();
        const { data: profile } = await db
          .from('profiles')
          .select('role,active')
          .eq('id', user!.id)
          .single();
        if (!profile?.active)
          throw new Error(
            'Your account has no active workspace membership. Contact the administrator.',
          );
        const { data: assurance } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        if (profile.role === 'admin' && assurance?.currentLevel !== 'aal2') {
          setStep('mfa');
          return;
        }
      } else if (step === 'complete') {
        if (password.length < 12) throw new Error('Use at least 12 characters for your password.');
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
      } else {
        if (!factor) throw new Error('Choose “Prepare authenticator” first.');
        const { data: challenge, error } = await db.auth.mfa.challenge({ factorId: factor });
        if (error) throw error;
        const verified = await db.auth.mfa.verify({
          factorId: factor,
          challengeId: challenge.id,
          code,
        });
        if (verified.error)
          throw new Error('That code could not be verified. Try the current six-digit code.');
      }
      router.push('/');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link className="brand official-brand light" href="/" aria-label="Infonits Finance home">
          <img src="/infonits-logo.png" alt="infonits" width={154} height={36} />
          <span className="brand-finance">finance</span>
        </Link>
        <div>
          <span className="eyebrow">A CLEARER FINANCIAL PICTURE</span>
          <h1>
            Good work.
            <br />
            Clear numbers.
            <br />
            <span>Confident decisions.</span>
          </h1>
          <p>
            Your projects, payments and profit.
            <br />
            One simple, private workspace.
          </p>
          <div className="auth-formula">
            <span>Project value</span>
            <b>−</b>
            <span>Direct costs</span>
            <b>=</b>
            <strong>For Me ↗</strong>
          </div>
        </div>
        <span className="auth-footer">Built for the way Infonits works.</span>
      </aside>
      <main className="auth-main">
        <div className="auth-box">
          <span className="auth-lock">
            <LockKeyhole size={24} />
          </span>
          <h2>
            {step === 'mfa'
              ? 'Secure your workspace'
              : step === 'complete'
                ? 'Make yourself at home'
                : 'Welcome back.'}
          </h2>
          <p>
            {step === 'mfa'
              ? 'Administrators verify with an authenticator before accessing financial records.'
              : step === 'complete'
                ? 'Set a strong password to finish accepting your invitation.'
                : 'Sign in to your Infonits Finance workspace.'}
          </p>
          {!configured && (
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                Connect Supabase to enable secure sign-in. <Link href="/settings">View setup</Link>
              </span>
            </div>
          )}
          <form onSubmit={submit}>
            {step === 'login' && (
              <>
                <label className="field">
                  <span>Email address</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@infonits.io"
                    required
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
            {step === 'complete' && (
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            )}
            {step === 'mfa' && (
              <>
                {!factor && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !configured}
                    onClick={() => void prepareMfa()}
                  >
                    Prepare authenticator
                  </Button>
                )}
                {qr && (
                  <div className="qr-setup">
                    <img
                      src={qr}
                      alt="Scan this QR code with your authenticator app"
                      width={200}
                      height={200}
                    />
                    <p>Scan with your authenticator app, or enter this setup key:</p>
                    <code>{secret}</code>
                  </div>
                )}
                {factor && (
                  <label className="field">
                    <span>Six-digit authenticator code</span>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </label>
                )}
              </>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <Button
              className="auth-submit"
              type="submit"
              disabled={busy || !configured || (step === 'mfa' && !factor)}
            >
              {busy ? <LoaderCircle size={17} className="spin" /> : null}
              {step === 'login'
                ? 'Sign in'
                : step === 'complete'
                  ? 'Set password & continue'
                  : 'Verify & continue'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="invite-note">
            <ShieldCheck size={14} />
            Invitation-only access. Contact your administrator for an invitation or password reset.
          </p>
          {sessionReady && (
            <button
              className="text-link"
              onClick={async () => {
                await browserClient().auth.signOut();
                setStep('login');
                setSessionReady(false);
                setFactor('');
                setQr('');
                setSecret('');
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
