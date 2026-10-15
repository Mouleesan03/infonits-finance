import 'server-only';

import { createClient } from '@supabase/supabase-js';

export type WebsiteRecord = Record<string, unknown> & {
  id: string;
  website?: string;
  websiteUrl?: string;
};

type WorkspaceData = Record<string, unknown> & {
  office?: Record<string, unknown> & { renewals?: WebsiteRecord[] };
};

export function serviceDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Website monitoring is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function websitesFromWorkspace(data: unknown): WebsiteRecord[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const office = (data as WorkspaceData).office;
  if (!office || typeof office !== 'object' || !Array.isArray(office.renewals)) return [];
  return office.renewals.filter(
    (item): item is WebsiteRecord =>
      Boolean(item) && typeof item === 'object' && typeof item.id === 'string',
  );
}

export async function updateWorkspaceWebsite(
  userId: string,
  siteId: string,
  patch: Record<string, unknown>,
  expectedAgentTokenVersion?: string,
) {
  const db = serviceDatabase();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error: readError } = await db
      .from('local_workspaces')
      .select('data,updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!row) throw new Error('Workspace not found.');
    const workspace = row.data as WorkspaceData;
    const sites = websitesFromWorkspace(workspace);
    const site = sites.find((item) => item.id === siteId);
    if (!site) throw new Error('Website not found.');
    if (expectedAgentTokenVersion && site.agentTokenVersion !== expectedAgentTokenVersion) {
      throw new Error('Agent token has been replaced.');
    }
    const nextData: WorkspaceData = {
      ...workspace,
      office: {
        ...(workspace.office ?? {}),
        renewals: sites.map((item) => (item.id === siteId ? { ...item, ...patch } : item)),
      },
    };
    const { data: updated, error: updateError } = await db
      .from('local_workspaces')
      .update({ data: nextData })
      .eq('user_id', userId)
      .eq('updated_at', row.updated_at)
      .select('user_id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return;
  }
  throw new Error('Workspace changed while monitoring. The next check will retry.');
}
