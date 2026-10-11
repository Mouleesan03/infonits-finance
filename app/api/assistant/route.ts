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
    description: z.string().default('Professional services'),
    notes: z.string().default(''),
    includeBankDetails: z.boolean().default(false),
    bankDetails: z.string().default(''),
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
  z.object({
    type: z.literal('create_letter'),
    clientName: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    preparedBy: z.string().default('Infonits (Pvt) Ltd'),
    date: z.string().default(''),
  }),
]);

const requestSchema = z.object({
  message: z.string().trim().min(1).max(800),
  history: z
    .array(
      z.object({
        role: z.enum(['assistant', 'user']),
        text: z.string().min(1).max(1400),
      }),
    )
    .max(10)
    .default([]),
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
            project: z.string().optional(),
            dueDate: z.string().optional(),
          }),
        )
        .max(20),
      recentExpenses: z
        .array(
          z.object({
            description: z.string(),
            category: z.string(),
            amount: z.number(),
            currency: z.string(),
            date: z.string(),
          }),
        )
        .max(20)
        .default([]),
      recentPayments: z
        .array(
          z.object({
            type: z.string(),
            category: z.string(),
            note: z.string(),
            amount: z.number(),
            currency: z.string(),
            date: z.string(),
            status: z.string(),
          }),
        )
        .max(20)
        .default([]),
      renewals: z
        .array(z.object({ website: z.string(), domainDue: z.string(), hostingDue: z.string() }))
        .max(20)
        .default([]),
      events: z
        .array(z.object({ title: z.string(), date: z.string(), type: z.string() }))
        .max(20)
        .default([]),
      letters: z
        .array(z.object({ client: z.string(), subject: z.string(), date: z.string() }))
        .max(20)
        .default([]),
    })
    .strict(),
});

const responseSchema = z.object({
  reply: z.string().min(1).max(1400),
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
    const wantsWebSearch =
      /\b(search|online|web|internet|latest|current|today|news|price|compare|research|find)\b/i.test(
        input.message,
      );
    const { output, sources } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      tools: wantsWebSearch
        ? {
            web_search: anthropic.tools.webSearch_20260318({
              maxUses: 3,
              responseInclusion: 'full',
              userLocation: {
                type: 'approximate',
                country: 'LK',
                timezone: 'Asia/Colombo',
              },
            }),
          }
        : undefined,
      output: Output.object({ schema: responseSchema }),
      instructions:
        'You are Infonits GPT, an advanced operations assistant inside a small finance workspace. ' +
        'Use the supplied workspace context for business records and conversation history for follow-up requests. ' +
        'When web search is available and the user asks for online, current, latest, research, comparison, or news information, use it and summarise the answer clearly. ' +
        'You may propose exactly one supported workspace action. ' +
        'Never claim an action has already happened: the user must review and apply it in the UI. ' +
        'If required details such as amount, client, or date are missing, ask one focused question and return action type none. ' +
        'Use YYYY-MM-DD dates and an existing client or project name when possible. ' +
        'For an invoice or quotation, write a useful service description and include bank details only when the user asks for them. ' +
        'For a letter, draft a complete professional body. For questions that do not require a record change, return action type none.',
      prompt: JSON.stringify(input),
    });

    return Response.json({
      ...output,
      sources: sources
        .filter((source) => source.sourceType === 'url')
        .map((source) => ({ title: source.title || source.url, url: source.url }))
        .filter(
          (source, index, list) => list.findIndex((item) => item.url === source.url) === index,
        )
        .slice(0, 5),
    });
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
