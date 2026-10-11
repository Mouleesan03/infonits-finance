import { redirect } from 'next/navigation';
import { LocalCloudWorkspace } from '@/components/local-cloud-workspace';
import { configured, serverClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LocalPage() {
  if (!configured()) redirect('/login');
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) redirect('/login');
  return <LocalCloudWorkspace />;
}
