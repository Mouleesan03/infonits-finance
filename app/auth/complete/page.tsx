import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { serverClient, configured } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function Complete() {
  if (!configured()) redirect('/login');
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/login');
  return <AuthForm configured complete />;
}
