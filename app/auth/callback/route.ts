import { NextResponse, type NextRequest } from 'next/server';
import { configured, serverClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') === '/local' ? '/local' : '/auth/complete';

  if (configured() && code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL('/login?error=invitation', request.url));
}
