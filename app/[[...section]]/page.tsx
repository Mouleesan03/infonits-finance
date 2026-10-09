import { notFound, redirect } from 'next/navigation';
import { getWorkspace } from '@/lib/data';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string }>;
}) {
  const { section = [] } = await params;
  const query = await searchParams;
  if (query.code) redirect(`/auth/callback?code=${encodeURIComponent(query.code)}`);
  if (query.token_hash && (query.type === 'invite' || query.type === 'recovery')) {
    redirect(
      `/auth/confirm?token_hash=${encodeURIComponent(query.token_hash)}&type=${query.type}`,
    );
  }
  const allowed = ['dashboard', 'projects', 'clients', 'payments', 'costs', 'expenses', 'settings'];
  if (
    section.length > 2 ||
    (section[0] && !allowed.includes(section[0])) ||
    (section.length === 2 && !['projects', 'clients'].includes(section[0]))
  )
    notFound();
  const data = await getWorkspace();
  if (
    section.length === 2 &&
    !data.error &&
    !data.ledger[section[0] as 'projects' | 'clients'].some((row) => row.id === section[1])
  )
    notFound();
  return <Workspace data={data} section={section[0] ?? 'dashboard'} detailId={section[1]} />;
}
