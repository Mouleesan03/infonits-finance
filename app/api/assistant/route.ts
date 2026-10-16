import { anthropic, type AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { streamText, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const atomicActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_client'),
    name: z.string().min(1),
    company: z.string(),
    email: z.string(),
    phone: z.string(),
    country: z.string(),
  }),
  z.object({
    type: z.literal('create_project'),
    project: z.string().min(1),
    clientName: z.string(),
    amount: z.number().positive(),
    currency: z.string(),
    note: z.string(),
  }),
  z.object({
    type: z.literal('create_expense'),
    description: z.string().min(1),
    category: z.string(),
    amount: z.number().positive(),
    currency: z.string(),
    date: z.string(),
  }),
  z.object({
    type: z.enum(['create_invoice', 'create_quotation']),
    clientName: z.string().min(1),
    projectName: z.string(),
    amount: z.number().positive(),
    currency: z.string(),
    description: z.string(),
    notes: z.string(),
    includeBankDetails: z.boolean(),
    bankDetails: z.string(),
  }),
  z.object({
    type: z.literal('create_payment'),
    paymentType: z.enum(['Income', 'Expense', 'Saving', 'Gold', 'Loan']),
    category: z.string(),
    note: z.string(),
    amount: z.number().positive(),
    currency: z.string(),
    date: z.string(),
  }),
  z.object({
    type: z.literal('create_event'),
    title: z.string().min(1),
    date: z.string().min(1),
    eventType: z.string(),
  }),
  z.object({
    type: z.literal('create_renewal'),
    website: z.string().min(1),
    domainDue: z.string(),
    hostingDue: z.string(),
  }),
  z.object({
    type: z.literal('create_letter'),
    clientName: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    preparedBy: z.string(),
    date: z.string(),
  }),
]);
const proposedActionSchema = z.union([
  atomicActionSchema,
  z.object({
    type: z.literal('batch'),
    title: z.string().min(1).max(120),
    actions: z.array(atomicActionSchema).min(2).max(10),
  }),
]);

const requestSchema = z.object({
  message: z.string().trim().min(1).max(800),
  language: z.enum(['auto', 'ta', 'en']).default('auto'),
  voiceMode: z.boolean().default(false),
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
        .array(
          z.object({
            website: z.string(),
            domainDue: z.string(),
            hostingDue: z.string(),
            siteStatus: z.string().optional(),
            monitorError: z.string().optional(),
          }),
        )
        .max(20)
        .default([]),
      events: z
        .array(
          z.object({
            title: z.string(),
            date: z.string(),
            type: z.string(),
            completed: z.boolean().optional(),
          }),
        )
        .max(20)
        .default([]),
      letters: z
        .array(z.object({ client: z.string(), subject: z.string(), date: z.string() }))
        .max(20)
        .default([]),
    })
    .strict(),
});

type AssistantAction = z.infer<typeof proposedActionSchema> | { type: 'none' };

function needsSmartModel(message: string) {
  const complexRequest =
    /\b(analy[sz]e|analysis|forecast|strategy|report|compare|research|investigate|recommend|proposal|quotation|invoice|letter|cash.?flow|all|batch|monthly)\b/i;
  const workspaceChange =
    /\b(create|add|record|prepare|draft|schedule|update)\b/i.test(message) &&
    /\b(client|project|expense|invoice|quotation|payment|event|renewal|letter|record)\b/i.test(
      message,
    );
  return complexRequest.test(message) || workspaceChange || message.split(/\s+/).length > 55;
}

function validWebSource(source: { title?: string; url: string }) {
  try {
    return ['http:', 'https:'].includes(new URL(source.url).protocol);
  } catch {
    return false;
  }
}

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
    const languageInstruction =
      input.language === 'ta'
        ? 'Reply in natural, easy-to-understand Tamil. Keep business names, invoice numbers and currencies unchanged. '
        : input.language === 'en'
          ? 'Reply in clear, concise English. '
          : 'Reply in the same language as the user. If the user mixes Tamil and English, respond in natural Tamil-English while keeping business terms clear. ';
    const wantsWebSearch =
      /\b(search|online|web|internet|latest|current|today|news|price|compare|research|find)\b/i.test(
        input.message,
      );
    const smartModel = needsSmartModel(input.message);
    const modelId = smartModel ? 'claude-sonnet-4-6' : 'claude-haiku-5-5';
    const proposalTool = tool({
      description:
        'Prepare one or more workspace changes for the user to review. This never applies the changes. Call it only when every required field is known.',
      inputSchema: proposedActionSchema,
    });
    const tools: ToolSet = { propose_workspace_action: proposalTool };
    if (wantsWebSearch) {
      tools.web_search = anthropic.tools.webSearch_20260318({
        maxUses: 3,
        responseInclusion: 'full',
      });
    }
    const result = streamText({
      model: anthropic(modelId),
      maxOutputTokens: smartModel ? 1_800 : 1_200,
      providerOptions: {
        anthropic: {
          effort: smartModel ? 'medium' : 'low',
          thinking: { type: 'disabled' },
        } satisfies AnthropicLanguageModelOptions,
      },
      tools,
      instructions:
        'You are Nova, the trusted personal operations assistant inside the Infonits Finance workspace. ' +
        languageInstruction +
        'Follow the responseStyle field exactly: spoken replies must be short, conversational and easy to understand aloud. ' +
        'Use the supplied workspace context for business records and conversation history for follow-up requests. ' +
        'When web search is available and the user asks for online, current, latest, research, comparison, or news information, use it and summarise the answer clearly. ' +
        'You may propose one supported workspace action or a batch of 2 to 10 actions when the user explicitly asks for several records or a monthly set. ' +
        'Use batch only when every item is ready to review, and give the batch a short descriptive title. Batch actions should use existing clients and projects so they can be applied safely. ' +
        'Never claim an action has already happened: the user must review and apply it in the UI. ' +
        'If required details such as amount, client, or date are missing, ask one focused question and do not call the action tool. ' +
        'Use YYYY-MM-DD dates and an existing client or project name when possible. ' +
        'For an invoice or quotation, write a useful service description and include bank details only when the user asks for them. ' +
        'For a letter, draft a complete professional body. Supported action fields are: create_client(name,company,email,phone,country); create_project(project,clientName,amount,currency,note); create_expense(description,category,amount,currency,date); create_invoice or create_quotation(clientName,projectName,amount,currency,description,notes,includeBankDetails,bankDetails); create_payment(paymentType,category,note,amount,currency,date); create_event(title,date,eventType); create_renewal(website,domainDue,hostingDue); create_letter(clientName,subject,body,preparedBy,date). Always include every listed field, using an empty string or false when a detail was not requested. ' +
        'Write the useful user-facing reply as normal text first. When a workspace change is fully specified, then call propose_workspace_action with the typed proposal. Do not output JSON in the reply. For questions that do not require a record change, answer normally and do not call the tool.',
      prompt: JSON.stringify({
        ...input,
        responseStyle: input.voiceMode
          ? 'Voice response: answer conversationally in no more than three short sentences unless essential details are required.'
          : 'Text response: stay concise and use short paragraphs.',
      }),
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: object) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        let reply = '';
        let action: AssistantAction = { type: 'none' };
        const seenSources = new Set<string>();
        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
              reply += part.text;
              emit({ type: 'text-delta', delta: part.text });
            } else if (part.type === 'tool-call' && part.toolName === 'propose_workspace_action') {
              const parsed = proposedActionSchema.safeParse(part.input);
              if (parsed.success) {
                action = parsed.data;
                emit({ type: 'action', action });
              }
            } else if (
              part.type === 'source' &&
              part.sourceType === 'url' &&
              validWebSource(part) &&
              !seenSources.has(part.url) &&
              seenSources.size < 5
            ) {
              seenSources.add(part.url);
              emit({
                type: 'source',
                source: { title: part.title || part.url, url: part.url },
              });
            } else if (part.type === 'error') {
              throw part.error;
            }
          }
          if (!reply.trim()) {
            const fallback =
              action.type === 'none'
                ? 'I could not complete that request. Please try again.'
                : 'I prepared that for your review.';
            emit({ type: 'text-delta', delta: fallback });
          }
          emit({ type: 'finish', model: smartModel ? 'smart' : 'fast' });
        } catch {
          emit({ type: 'error', error: 'Nova could not complete that request. Please try again.' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'Please rephrase that request with the needed details.'
        : error instanceof Error
          ? /No object generated|match schema|compiled grammar/i.test(error.message)
            ? 'Nova could not complete that request. Please try again.'
            : error.message
          : 'Nova is unavailable.';
    return Response.json(
      { error: message === 'UNAUTHORIZED' ? 'Please sign in again.' : message },
      { status: message === 'UNAUTHORIZED' ? 401 : 400 },
    );
  }
}
