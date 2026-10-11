'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browser';
import { LocalFinance } from './local-finance';

export function LocalCloudWorkspace() {
  const router = useRouter();

  useEffect(() => {
    const db = browserClient();
    let active = true;
    void db.auth.getUser().then(({ data }) => {
      if (active && !data.user) router.replace('/login');
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (active && (event === 'SIGNED_OUT' || !session?.user)) router.replace('/login');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return <LocalFinance />;
}
