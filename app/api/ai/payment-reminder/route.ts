import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const requestSchema = z.object({
  tone: z.enum(['friendly', 'firm', 'final']),
  client: z.object({
    name: z.string().max(160),
    company: z.string().max(160),
  }),
  invoice: z.object({
    number: z.string().min(1).max(80),
    currency: z.string().min(1).max(12),
    balance: z.number().nonnegative(),
    dueDate: z.string().max(40),
  }),
});

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    }
    if (Number(request.headers.get('content-length') ?? 0) > 8_000) {
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    }
    await authorize();
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'AI reminders are not configured.' }, { status: 503 });
    }

    const input = requestSchema.parse(await request.json());
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      instructions:
        'Write one concise professional payment reminder for a service-business client. ' +
        'Use only the supplied facts. Do not invent bank details, payment promises or fees. ' +
        'Friendly is warm and helpful, firm is direct and professional, and final is urgent but respectful. ' +
        'Return only the message body in plain text, under 110 words. Never claim the message was sent.',
      prompt: JSON.stringify(input),
    });
    const message = text.trim();
    if (!message) throw new Error('Empty AI response.');
    return Response.json({ message });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'The invoice details are incomplete.'
        : error instanceof Error
          ? error.message
          : 'AI reminder generation failed.';
    return Response.json(
      { error: message === 'UNAUTHORIZED' ? 'Please sign in again.' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 400 },
    );
  }
}
