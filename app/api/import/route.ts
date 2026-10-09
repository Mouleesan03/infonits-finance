import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';
import { validateRecord } from '@/lib/schemas';
const schema = z.object({
  reviewed: z.literal(true),
  rows: z
    .array(z.object({ values: z.unknown(), source: z.record(z.string(), z.string()) }))
    .min(1)
    .max(500),
});
export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      throw new Error('Invalid origin');
    const { db } = await authorize();
    const raw = await request.text();
    if (raw.length > 2000000) throw new Error('CSV is too large');
    const payload = schema.parse(JSON.parse(raw));
    const records = payload.rows.map((row) => ({
      ...validateRecord('projects', row.values),
      source_record: row.source,
      import_key: createHash('sha256')
        .update(JSON.stringify(Object.entries(row.source).sort()))
        .digest('hex'),
    }));
    const { data, error } = await db.rpc('import_projects', { records });
    if (error)
      throw new Error(
        error.code === '23505'
          ? 'A row was already imported. Nothing in this batch was saved.'
          : error.message,
      );
    return NextResponse.json({ count: data });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { error: message },
      {
        status:
          message === 'UNAUTHORIZED'
            ? 401
            : message === 'FORBIDDEN' || message === 'MFA_REQUIRED'
              ? 403
              : 400,
      },
    );
  }
}
