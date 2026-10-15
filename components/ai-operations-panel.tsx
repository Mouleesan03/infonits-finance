'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, Bot, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';

type AssistantResponse = {
  reply?: string;
  error?: string;
};

const briefingPrompt =
  'Give me a concise daily operations briefing using only the workspace data. List the most urgent payments, tasks, renewals or website issues first, then give the three best actions for today. This is read-only: do not propose record changes.';

const quickQuestions = [
  'Which clients need a payment follow-up?',
  'What renewals need attention next?',
  'Where is my biggest cash-flow risk?',
];

export function AiOperationsPanel({ context }: { context: object }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `infonits-ai-briefing-${today}`;

  useEffect(() => {
    setAnswer(sessionStorage.getItem(cacheKey) ?? '');
  }, [cacheKey]);

  async function ask(prompt: string, cache = false) {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Read-only workspace analysis. Do not propose or apply changes. ${prompt}`,
          context,
          history: [],
        }),
      });
      const data = (await response.json()) as AssistantResponse;
      if (!response.ok || !data.reply) throw new Error(data.error || 'AI analysis is unavailable.');
      setAnswer(data.reply);
      if (cache) sessionStorage.setItem(cacheKey, data.reply);
      setQuestion('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI analysis is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-operations-panel" aria-label="AI operations assistant">
      <header>
        <span>
          <Sparkles size={19} />
        </span>
        <div>
          <small>AI OPERATIONS</small>
          <strong>Ask your workspace</strong>
          <p>Read-only analysis of payments, projects, tasks and renewals.</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={busy}
          onClick={() => void ask(briefingPrompt, true)}
        >
          {busy ? <LoaderCircle className="spin" size={15} /> : <Bot size={15} />}
          {answer ? 'Refresh briefing' : 'Daily briefing'}
        </button>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask: Which clients have overdue invoices?"
          aria-label="Ask a workspace question"
        />
        <button type="submit" disabled={busy || !question.trim()} aria-label="Ask AI">
          <ArrowUp size={16} />
        </button>
      </form>

      <div className="ai-operations-prompts" aria-label="Suggested AI questions">
        {quickQuestions.map((prompt) => (
          <button type="button" disabled={busy} key={prompt} onClick={() => void ask(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="ai-operations-answer">
          <span>
            <Bot size={16} /> AI insight
          </span>
          <p>{answer}</p>
          <button type="button" onClick={() => void ask(briefingPrompt, true)} disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      ) : null}
      {error ? <p className="ai-operations-error">{error}</p> : null}
    </section>
  );
}
