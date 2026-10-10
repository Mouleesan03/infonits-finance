import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const financeSnapshotSchema = z.object({
  projectValue: z.number().finite().nonnegative(),
  received: z.number().finite().nonnegative(),
  workCost: z.number().finite().nonnegative(),
  expenses: z.number().finite().nonnegative(),
  profit: z.number().finite(),
  projectCount: z.number().int().nonnegative(),
  outstandingInvoices: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    }
    if (Number(request.headers.get('content-length') ?? 0) > 5000) {
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    }
    await authorize();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: 'Add OPENAI_API_KEY to the server environment to enable AI insights.' },
        { status: 503 },
      );
    }

    const snapshot = financeSnapshotSchema.parse(await request.json());
    const { text } = await generateText({
      model: openai('gpt-5.6-luna'),
      instructions:
        'You are a concise finance operations assistant for a small service business. ' +
        'Use only the supplied aggregate figures. Give one clear observation and one practical next action. ' +
        'Do not invent forecasts, tax advice, or missing facts. Keep the answer under 55 words.',
      prompt: `Finance snapshot in LKR: ${JSON.stringify(snapshot)}`,
      providerOptions: {
        openai: {
          store: false,
          reasoningEffort: 'low',
        },
      },
    });

    return Response.json({ insight: text.trim() });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'Invalid finance snapshot.'
        : error instanceof Error
          ? error.message
          : 'AI insight is unavailable.';
    return Response.json(
      { error: message === 'UNAUTHORIZED' ? 'Please sign in again.' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 400 },
    );
  }
}
