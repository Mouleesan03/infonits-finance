'use client';

import { useEffect } from 'react';

export function DeploymentRefresh({ version }: { version: string }) {
  useEffect(() => {
    let checking = false;
    let active = true;

    async function checkForDeployment() {
      if (checking || !active || version === 'local') return;
      checking = true;
      try {
        const response = await fetch(`/api/version?time=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { version?: string };
        if (!payload.version || payload.version === version) return;
        const url = new URL(window.location.href);
        url.searchParams.set('build', payload.version.slice(0, 7));
        window.location.replace(url.toString());
      } catch {
        // A temporary network failure should not interrupt the active workspace.
      } finally {
        checking = false;
      }
    }

    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkForDeployment();
    };
    const checkRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) void checkForDeployment();
    };

    void checkForDeployment();
    window.addEventListener('focus', checkForDeployment);
    window.addEventListener('pageshow', checkRestoredPage);
    document.addEventListener('visibilitychange', checkWhenVisible);
    const interval = window.setInterval(checkForDeployment, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkForDeployment);
      window.removeEventListener('pageshow', checkRestoredPage);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [version]);

  return null;
}
