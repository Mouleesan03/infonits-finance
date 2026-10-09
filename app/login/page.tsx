import { AuthForm } from '@/components/auth-form';
import { configured } from '@/lib/supabase/server';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const query = await searchParams;
  return <AuthForm configured={configured()} initialStep={query.step} initialError={query.error} />;
}
