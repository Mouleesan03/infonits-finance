import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const requestSchema = z.object({
  text: z.string().trim().min(2).max(1200),
  context: z.string().trim().min(2).max(80),
  targetWords: z.number().int().min(15).max(80),
});

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    await authorize();
    if (!process.env.ANTHROPIC_API_KEY)
      return Response.json({ error: 'AI rewrite is not configured.' }, { status: 503 });

    const input = requestSchema.parse(await request.json());
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      instructions:
        'Rewrite short business descriptions for invoices and workspace records. Preserve every fact, amount, name and commitment. Do not invent details. Use clear professional plain text, one compact paragraph, no heading, bullets, quotation marks or markdown.',
      prompt: `Context: ${input.context}\nTarget: ${input.targetWords}-${input.targetWords + 12} words\nDraft: ${input.text}`,
    });
    return Response.json({ text: text.trim() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? 'Add a little more detail before rewriting.'
            : 'AI rewrite is temporarily unavailable.',
      },
      { status: 400 },
    );
  }
}
