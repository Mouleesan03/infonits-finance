import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';
import { checkWebsite } from '@/lib/website-monitor';
import { websitesFromWorkspace } from '@/lib/website-workspace';

export const runtime = 'nodejs';

const schema = z.object({ siteId: z.string().min(1).max(160) });

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    }
    const { db, user } = await authorize();
    const { siteId } = schema.parse(await request.json());
    const { data, error } = await db
      .from('local_workspaces')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    const site = websitesFromWorkspace(data?.data).find((item) => item.id === siteId);
    if (!site) return Response.json({ error: 'Website not found.' }, { status: 404 });
    if (typeof site.websiteUrl !== 'string' || !site.websiteUrl.trim()) {
      return Response.json({ error: 'Add the website URL before checking.' }, { status: 400 });
    }
    return Response.json({ ok: true, check: await checkWebsite(site.websiteUrl) });
  } catch (error) {
    console.error('Website check failed', error);
    const message = error instanceof Error ? error.message : 'Website check failed.';
    return Response.json(
      { error: message },
      { status: message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400 },
    );
  }
}
