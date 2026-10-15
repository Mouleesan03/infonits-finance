import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';
import { createAgentToken } from '@/lib/website-monitor';
import { updateWorkspaceWebsite, websitesFromWorkspace } from '@/lib/website-workspace';

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
    if (!site) {
      return Response.json({ error: 'Website not found.' }, { status: 404 });
    }
    const tokenVersion =
      typeof site.agentTokenVersion === 'string' && site.agentTokenVersion
        ? site.agentTokenVersion
        : randomUUID();
    if (site.agentTokenVersion !== tokenVersion) {
      await updateWorkspaceWebsite(user.id, siteId, { agentTokenVersion: tokenVersion });
    }
    return Response.json({
      ok: true,
      appUrl: new URL(request.url).origin,
      siteId,
      tokenVersion,
      token: createAgentToken(user.id, siteId, tokenVersion),
      pluginUrl: `${new URL(request.url).origin}/downloads/infonits-site-agent.zip`,
    });
  } catch (error) {
    console.error('Website agent pairing failed', error);
    const message = error instanceof Error ? error.message : 'Unable to create an agent token.';
    return Response.json(
      { error: message },
      { status: message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400 },
    );
  }
}
