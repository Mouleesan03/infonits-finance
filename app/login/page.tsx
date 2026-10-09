import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { configured } from '@/lib/supabase/server';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    step?: string;
    error?: string;
    code?: string;
    token_hash?: string;
    type?: string;
  }>;
}) {
  const query = await searchParams;
  if (query.code) redirect(`/auth/callback?code=${encodeURIComponent(query.code)}`);
  if (query.token_hash && (query.type === 'invite' || query.type === 'recovery')) {
    redirect(
      `/auth/confirm?token_hash=${encodeURIComponent(query.token_hash)}&type=${query.type}`,
    );
  }
  return <AuthForm configured={configured()} initialStep={query.step} initialError={query.error} />;
}
