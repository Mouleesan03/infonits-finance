import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export const configured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export async function serverClient() {
  if (!configured())
    throw new Error('Supabase is not configured. Add the two variables in .env.example.');
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server components are read-only; proxy refreshes cookies. */
          }
        },
      },
    },
  );
}
export async function authorize() {
  const db = await serverClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED');
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id,organization_id,role,active')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.active) throw new Error('FORBIDDEN');
  if (profile.role === 'admin') {
    const { data: assurance, error: assuranceError } =
      await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== 'aal2') throw new Error('MFA_REQUIRED');
  }
  return { db, user, profile };
}
