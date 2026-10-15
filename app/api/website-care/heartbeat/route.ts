import { z } from 'zod';
import { verifyAgentToken } from '@/lib/website-monitor';
import { updateWorkspaceWebsite } from '@/lib/website-workspace';

export const runtime = 'nodejs';

const schema = z.object({
  siteId: z.string().min(1).max(160),
  siteUrl: z.url().max(2048),
  health: z.object({
    agentVersion: z.string().max(30),
    wordpressVersion: z.string().max(30),
    phpVersion: z.string().max(30),
    activeTheme: z.string().max(160),
    pluginUpdates: z.number().int().min(0).max(10000),
    themeUpdates: z.number().int().min(0).max(10000),
    debugEnabled: z.boolean(),
    httpsEnabled: z.boolean(),
  }),
});

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 30_000) {
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    }
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const identity = verifyAgentToken(token);
    const payload = schema.parse(await request.json());
    if (payload.siteId !== identity.siteId) {
      return Response.json({ error: 'Site identity does not match.' }, { status: 403 });
    }
    await updateWorkspaceWebsite(
      identity.userId,
      identity.siteId,
      {
        agentConnected: true,
        agentLastSeen: new Date().toISOString(),
        agentSiteUrl: payload.siteUrl,
        ...payload.health,
      },
      identity.tokenVersion,
    );
    return Response.json({ ok: true, receivedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Website agent heartbeat failed', error);
    const message = error instanceof Error ? error.message : 'Heartbeat failed.';
    return Response.json(
      { error: message },
      {
        status: /token|identity/i.test(message)
          ? 401
          : message === 'Website not found.'
            ? 404
            : 400,
      },
    );
  }
}
