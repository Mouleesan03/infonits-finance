import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const runtime = 'nodejs';

const leadSchema = z
  .object({
    name: z.string().trim().max(160).default(''),
    email: z.union([z.email(), z.literal('')]).default(''),
    phone: z.string().trim().max(80).default(''),
    message: z.string().trim().max(5000).default(''),
    source: z.string().trim().max(160).default('infonits.io agent'),
    pageUrl: z
      .union([
        z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
          message: 'Page URL must use HTTP or HTTPS.',
        }),
        z.literal(''),
      ])
      .default(''),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((lead) => Boolean(lead.email || lead.phone), {
    message: 'An email address or phone number is required.',
  });

function authorized(header: string | null, expected: string) {
  const supplied = header?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 20_000) {
      return Response.json({ error: 'Request too large' }, { status: 413 });
    }

    const secret = process.env.INFONITS_AGENT_WEBHOOK_SECRET;
    const organizationId = process.env.INFONITS_AGENT_ORGANIZATION_ID;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret || !organizationId || !supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: 'Lead webhook is not configured.' }, { status: 503 });
    }
    if (!authorized(request.headers.get('authorization'), secret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lead = leadSchema.parse(await request.json());
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db
      .from('agent_leads')
      .insert({
        organization_id: organizationId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        message: lead.message,
        source: lead.source,
        page_url: lead.pageUrl,
        metadata: lead.metadata,
      })
      .select('id,status,created_at')
      .single();
    if (error) throw error;
    return Response.json({ ok: true, lead: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(' ')
        : error instanceof Error
          ? error.message
          : 'Unable to receive lead.';
    return Response.json({ error: message }, { status: 400 });
  }
}
