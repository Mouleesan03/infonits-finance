'use client';

import { useEffect } from 'react';

const versionKey = 'infonits-finance-deployment';

export function DeploymentRefresh() {
  useEffect(() => {
    let checking = false;
    const checkVersion = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        if (!response.ok) return;
        const { version } = (await response.json()) as { version?: string };
        if (!version || version === 'local') return;
        const previous = window.localStorage.getItem(versionKey);
        window.localStorage.setItem(versionKey, version);
        if (previous && previous !== version) window.location.reload();
      } catch {
        // A temporary offline state should never block the workspace.
      } finally {
        checking = false;
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
      else void checkVersion();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', checkVersion);
    document.addEventListener('visibilitychange', onVisibility);
    void checkVersion();
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', checkVersion);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
