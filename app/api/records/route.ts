import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';
import { tableSchema, validateRecord } from '@/lib/schemas';
const requestSchema = z.object({
  table: tableSchema,
  id: z.uuid().optional(),
  updated_at: z.string().optional(),
  values: z.unknown().optional(),
});
export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    if (Number(request.headers.get('content-length') ?? 0) > 100000)
      return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const { db } = await authorize();
    const { table, id, updated_at, values } = requestSchema.parse(await request.json());
    const record: Record<string, unknown> = validateRecord(table, values);
    if (id && !updated_at) throw new Error('Reload the record before editing.');
    const result = id
      ? await db
          .from(table)
          .update(record)
          .eq('id', id)
          .eq('updated_at', updated_at!)
          .select('id')
          .maybeSingle()
      : await db.from(table).insert(record).select('id').single();
    if (result.error)
      throw new Error(
        result.error.code === '23503'
          ? 'This record is linked to another record.'
          : result.error.code === '23505'
            ? 'This record already exists.'
            : result.error.message,
      );
    if (!result.data)
      return NextResponse.json(
        { error: 'The record was changed by another user. Refresh and retry.' },
        { status: 409 },
      );
    return NextResponse.json({ id: result.data.id });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    const { db } = await authorize();
    const { table, id, updated_at } = requestSchema.parse(await request.json());
    if (!id || !updated_at) throw new Error('A record ID and version are required.');
    const { data, error } = await db
      .from(table)
      .delete()
      .eq('id', id)
      .eq('updated_at', updated_at)
      .select('id')
      .maybeSingle();
    if (error)
      throw new Error(
        error.code === '23503'
          ? 'Remove dependent payments/costs first. Financial history cannot be silently deleted.'
          : error.message,
      );
    if (!data)
      return NextResponse.json(
        { error: 'The record changed or no longer exists. Refresh and retry.' },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
function failure(error: unknown) {
  const message =
    error instanceof z.ZodError
      ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      : error instanceof Error
        ? error.message
        : 'Unable to save';
  return NextResponse.json(
    { error: message },
    {
      status:
        message === 'UNAUTHORIZED'
          ? 401
          : ['FORBIDDEN', 'MFA_REQUIRED'].includes(message)
            ? 403
            : 400,
    },
  );
}
