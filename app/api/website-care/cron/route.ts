import { timingSafeEqual } from 'node:crypto';
import { checkWebsite } from '@/lib/website-monitor';
import { serviceDatabase, websitesFromWorkspace } from '@/lib/website-workspace';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(value: string | null, expected: string) {
  const supplied = value?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const vercelCron = request.headers.get('user-agent') === 'vercel-cron/1.0';
  if (
    (secret && !authorized(request.headers.get('authorization'), secret)) ||
    (!secret && !vercelCron)
  ) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const db = serviceDatabase();
    const { data: rows, error } = await db
      .from('local_workspaces')
      .select('user_id,data,updated_at')
      .limit(100);
    if (error) throw error;
    let checked = 0;
    let saved = 0;
    for (const row of rows ?? []) {
      const workspace = row.data as Record<string, unknown>;
      const office = (workspace.office ?? {}) as Record<string, unknown>;
      const allSites = websitesFromWorkspace(workspace);
      const sites = allSites.slice(0, 100);
      const nextSites = [...allSites];
      for (let start = 0; start < sites.length; start += 5) {
        const batch = sites.slice(start, start + 5);
        const results = await Promise.all(
          batch.map(async (site) => {
            if (typeof site.websiteUrl !== 'string' || !site.websiteUrl.trim()) return site;
            const lastChecked =
              typeof site.lastChecked === 'string' ? Date.parse(site.lastChecked) : Number.NaN;
            if (Number.isFinite(lastChecked) && Date.now() - lastChecked < 20 * 60 * 60 * 1000) {
              return site;
            }
            checked += 1;
            const result = await checkWebsite(site.websiteUrl);
            return {
              ...site,
              siteStatus: result.status,
              lastChecked: result.checkedAt,
              monitorHttpStatus: result.httpStatus,
              monitorResponseMs: result.responseMs,
              monitorFinalUrl: result.finalUrl,
              monitorError: result.error,
            };
          }),
        );
        nextSites.splice(start, results.length, ...results);
      }
      if (!sites.length) continue;
      const nextData = { ...workspace, office: { ...office, renewals: nextSites } };
      const { data: updated, error: updateError } = await db
        .from('local_workspaces')
        .update({ data: nextData })
        .eq('user_id', row.user_id)
        .eq('updated_at', row.updated_at)
        .select('user_id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (updated) saved += 1;
    }
    return Response.json({ ok: true, checked, workspacesUpdated: saved });
  } catch (error) {
    console.error('Scheduled website monitoring failed', error);
    return Response.json({ error: 'Scheduled monitoring failed.' }, { status: 500 });
  }
}
