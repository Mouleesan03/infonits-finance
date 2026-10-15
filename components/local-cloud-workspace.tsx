'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { isSessionExpired, sessionExpiresAt } from '@/lib/session-security';
import { browserClient } from '@/lib/supabase/browser';
import { LocalFinance } from './local-finance';

export function LocalCloudWorkspace() {
  const router = useRouter();

  useEffect(() => {
    const db = browserClient();
    let active = true;
    let expirationTimer: ReturnType<typeof setTimeout> | undefined;
    let signingOut = false;

    const goToLogin = (expired = false) => {
      router.replace(expired ? '/login?error=session-expired' : '/login');
      router.refresh();
    };

    const expireSession = async () => {
      if (!active || signingOut) return;
      signingOut = true;
      await db.auth.signOut({ scope: 'local' });
      if (active) goToLogin(true);
    };

    const watchSession = (user: User | null) => {
      if (expirationTimer) clearTimeout(expirationTimer);
      if (!user) {
        goToLogin();
        return;
      }
      if (isSessionExpired(user.last_sign_in_at)) {
        void expireSession();
        return;
      }
      expirationTimer = setTimeout(
        () => void expireSession(),
        sessionExpiresAt(user.last_sign_in_at) - Date.now(),
      );
    };

    const verifySession = () => {
      void db.auth.getUser().then(({ data }) => {
        if (active) watchSession(data.user);
      });
    };

    verifySession();
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        if (!signingOut) goToLogin();
        return;
      }
      if (session?.user) watchSession(session.user);
    });

    const verifyVisibleSession = () => {
      if (document.visibilityState === 'visible') verifySession();
    };
    window.addEventListener('focus', verifySession);
    document.addEventListener('visibilitychange', verifyVisibleSession);

    return () => {
      active = false;
      if (expirationTimer) clearTimeout(expirationTimer);
      window.removeEventListener('focus', verifySession);
      document.removeEventListener('visibilitychange', verifyVisibleSession);
      subscription.unsubscribe();
    };
  }, [router]);

  return <LocalFinance />;
}
