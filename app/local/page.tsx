import { redirect } from 'next/navigation';
import { LocalCloudWorkspace } from '@/components/local-cloud-workspace';
import { LocalFinance } from '@/components/local-finance';
import { configured, serverClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LocalPage({
  searchParams,
}: {
  searchParams: Promise<{ 'mobile-preview'?: string; 'ui-preview'?: string }>;
}) {
  const query = await searchParams;
  const localUiPreview =
    process.env.NODE_ENV === 'development' &&
    (query['mobile-preview'] === '1' || query['ui-preview'] === '1');
  if (localUiPreview) return <LocalFinance />;

  if (!configured()) redirect('/login');
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) redirect('/login');
  return <LocalCloudWorkspace />;
}
