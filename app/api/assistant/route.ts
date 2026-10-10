import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('create_client'),
    name: z.string().min(1),
    company: z.string().default(''),
    email: z.string().default(''),
    phone: z.string().default(''),
    country: z.string().default('Sri Lanka'),
  }),
  z.object({
    type: z.literal('create_project'),
    project: z.string().min(1),
    clientName: z.string().default(''),
    amount: z.number().positive(),
    currency: z.string().default('LKR'),
    note: z.string().default(''),
  }),
  z.object({
    type: z.literal('create_expense'),
    description: z.string().min(1),
    category: z.string().default('Office'),
    amount: z.number().positive(),
    currency: z.string().default('LKR'),
    date: z.string().default(''),
  }),
  z.object({
    type: z.enum(['create_invoice', 'create_quotation']),
    clientName: z.string().min(1),
    projectName: z.string().default(''),
    amount: z.number().positive(),
    currency: z.string().default('LKR'),
    notes: z.string().default(''),
  }),
  z.object({
    type: z.literal('create_payment'),
    paymentType: z.enum(['Income', 'Expense', 'Saving', 'Gold', 'Loan']),
    category: z.string().default('General'),
    note: z.string().default(''),
    amount: z.number().positive(),
    currency: z.string().default('LKR'),
    date: z.string().default(''),
  }),
  z.object({
    type: z.literal('create_event'),
    title: z.string().min(1),
    date: z.string().min(1),
    eventType: z.string().default('Task'),
  }),
  z.object({
    type: z.literal('create_renewal'),
    website: z.string().min(1),
    domainDue: z.string().default(''),
    hostingDue: z.string().default(''),
  }),
]);

const requestSchema = z.object({
  message: z.string().trim().min(1).max(800),
  context: z
    .object({
      today: z.string(),
      totals: z.record(z.string(), z.number()).optional(),
      clients: z.array(z.object({ id: z.string(), name: z.string() })).max(100),
      projects: z.array(z.object({ id: z.string(), name: z.string() })).max(100),
      recentInvoices: z
        .array(
          z.object({
            number: z.string(),
            client: z.string(),
            status: z.string(),
            amount: z.number(),
            currency: z.string(),
          }),
        )
        .max(20),
    })
    .strict(),
});

const responseSchema = z.object({
  reply: z.string().min(1).max(700),
  action: actionSchema,
});

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    }
    if (Number(request.headers.get('content-length') ?? 0) > 30_000) {
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    }
    await authorize();
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Claude is not configured.' }, { status: 503 });
    }

    const input = requestSchema.parse(await request.json());
    const { output } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      output: Output.object({ schema: responseSchema }),
      instructions:
        'You are Infonits GPT, an operations assistant inside a small finance workspace. ' +
        'Answer briefly and use only the supplied workspace context. You may propose exactly one supported action. ' +
        'Never claim an action has already happened: the user must review and apply it in the UI. ' +
        'If required details such as amount, client, or date are missing, ask one focused question and return action type none. ' +
        'Use YYYY-MM-DD dates and an existing client or project name when possible. ' +
        'For questions that do not require a record change, return action type none.',
      prompt: JSON.stringify(input),
    });

    return Response.json(output);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'Please rephrase that request with the needed details.'
        : error instanceof Error
          ? error.message
          : 'Infonits GPT is unavailable.';
    return Response.json(
      { error: message === 'UNAUTHORIZED' ? 'Please sign in again.' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 400 },
    );
  }
}
