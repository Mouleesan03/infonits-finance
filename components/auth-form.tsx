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

type AuthStep = 'login' | 'complete' | 'mfa';
type LoginMode = 'pin' | 'password';
const rememberedEmailKey = 'infonits-finance-login-email';

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
  const [credential, setCredential] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCredential, setShowCredential] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('pin');
  const [code, setCode] = useState('');
  const [error, setError] = useState(
    initialError === 'membership'
      ? 'Your account has no active workspace membership. Contact the workspace administrator.'
      : initialError
        ? 'This secure link could not be verified. Request a new PIN link.'
        : '',
  );
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<AuthStep>(
    complete ? 'complete' : initialStep === 'mfa' ? 'mfa' : 'login',
  );
  const [factor, setFactor] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
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

  async function prepareMfa() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const db = browserClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error('Sign in before setting up your authenticator.');
      const { data, error } = await db.auth.mfa.listFactors();
      if (error) throw error;
      const existing = data.totp.find((item) => item.status === 'verified');
      if (existing) {
        setFactor(existing.id);
        setQr('');
        setSecret('');
      } else {
        for (const pending of data.all.filter(
          (item) => item.factor_type === 'totp' && item.status === 'unverified',
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
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
        if (loginMode === 'pin' && !isSixDigitPin(credential)) {
          throw new Error('Enter your 6-digit PIN.');
        }
        const password =
          loginMode === 'pin' ? await pinCredential(normalizedEmail, credential) : credential;
        const { error } = await db.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          throw new Error(
            loginMode === 'pin'
              ? 'Email or PIN is incorrect. You can reset the PIN below.'
              : 'Email or password is incorrect.',
          );
        }
        window.localStorage.setItem(rememberedEmailKey, normalizedEmail);
        setSessionReady(true);
        const {
          data: { user },
        } = await db.auth.getUser();
        const { data: profile } = await db
          .from('profiles')
          .select('role,active')
          .eq('id', user!.id)
          .single();
        if (!profile?.active) {
          await db.auth.signOut();
          throw new Error(
            'Your account has no active workspace membership. Contact the administrator.',
          );
        }
        const { data: assurance } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        if (profile.role === 'admin' && assurance?.currentLevel !== 'aal2') {
          await prepareMfa();
          return;
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
      } else {
        if (!factor) throw new Error('Choose “Prepare authenticator” first.');
        const { data: challenge, error } = await db.auth.mfa.challenge({ factorId: factor });
        if (error) throw error;
        const verified = await db.auth.mfa.verify({
          factorId: factor,
          challengeId: challenge.id,
          code,
        });
        if (verified.error) {
          throw new Error('That code could not be verified. Try the current six-digit code.');
        }
      }
      router.push('/');
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === 'mfa'
      ? 'One last security check'
      : step === 'complete'
        ? 'Create your PIN'
        : 'Welcome back';
  const description =
    step === 'mfa'
      ? 'Enter the current code from your authenticator app.'
      : step === 'complete'
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
                  <span>{loginMode === 'pin' ? '6-digit PIN' : 'Current password'}</span>
                  <span className="auth-input-wrap">
                    <KeyRound size={17} aria-hidden="true" />
                    <input
                      type={showCredential ? 'text' : 'password'}
                      inputMode={loginMode === 'pin' ? 'numeric' : 'text'}
                      autoComplete="current-password"
                      pattern={loginMode === 'pin' ? '[0-9]{6}' : undefined}
                      maxLength={loginMode === 'pin' ? 6 : undefined}
                      value={credential}
                      onChange={(event) =>
                        setCredential(
                          loginMode === 'pin'
                            ? event.target.value.replace(/\D/g, '').slice(0, 6)
                            : event.target.value,
                        )
                      }
                      placeholder={loginMode === 'pin' ? '••••••' : 'Enter current password'}
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
                  <button
                    type="button"
                    onClick={() => {
                      setCredential('');
                      setError('');
                      setNotice('');
                      setLoginMode((value) => (value === 'pin' ? 'password' : 'pin'));
                    }}
                  >
                    {loginMode === 'pin' ? 'Use existing password' : 'Use 6-digit PIN'}
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
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      required
                    />
                  </label>
                )}
              </>
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

            <Button
              className="auth-submit"
              type="submit"
              disabled={busy || !configured || (step === 'mfa' && !factor)}
            >
              {busy ? <LoaderCircle size={17} className="spin" /> : null}
              {step === 'login'
                ? loginMode === 'pin'
                  ? 'Open workspace'
                  : 'Sign in'
                : step === 'complete'
                  ? 'Save PIN & continue'
                  : 'Verify & continue'}
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
