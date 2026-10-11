'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  FilePlus2,
  Globe2,
  LoaderCircle,
  Mic,
  Search,
  Square,
  Sparkles,
  Volume2,
} from 'lucide-react';

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type AssistantAction =
  | { type: 'none' }
  | {
      type: 'create_client';
      name: string;
      company: string;
      email: string;
      phone: string;
      country: string;
    }
  | {
      type: 'create_project';
      project: string;
      clientName: string;
      amount: number;
      currency: string;
      note: string;
    }
  | {
      type: 'create_expense';
      description: string;
      category: string;
      amount: number;
      currency: string;
      date: string;
    }
  | {
      type: 'create_invoice' | 'create_quotation';
      clientName: string;
      projectName: string;
      amount: number;
      currency: string;
      description: string;
      notes: string;
      includeBankDetails: boolean;
      bankDetails: string;
    }
  | {
      type: 'create_payment';
      paymentType: 'Income' | 'Expense' | 'Saving' | 'Gold' | 'Loan';
      category: string;
      note: string;
      amount: number;
      currency: string;
      date: string;
    }
  | { type: 'create_event'; title: string; date: string; eventType: string }
  | { type: 'create_renewal'; website: string; domainDue: string; hostingDue: string }
  | {
      type: 'create_letter';
      clientName: string;
      subject: string;
      body: string;
      preparedBy: string;
      date: string;
    };

type AssistantSource = { title: string; url: string };

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  action?: AssistantAction;
  sources?: AssistantSource[];
  applied?: boolean;
};

function InlineMessage({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text
    .replace(/\s+(?=[📁💰📊👥🧾⏳⚠️✅] \*\*)/g, '\n')
    .replace(/\s+•\s+/g, '\n• ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <div className="assistant-message-copy">
      {lines.map((line, index) => {
        const bullet = line.startsWith('• ') || line.startsWith('- ');
        return (
          <p className={bullet ? 'bullet' : ''} key={`${line}-${index}`}>
            {bullet && <i aria-hidden="true" />}
            <span>
              <InlineMessage text={bullet ? line.slice(2) : line} />
            </span>
          </p>
        );
      })}
    </div>
  );
}

export function InfonitsAssistant({
  context,
  onApply,
  voice,
}: {
  context: object;
  onApply: (action: Exclude<AssistantAction, { type: 'none' }>) => string;
  voice: { enabled: boolean; autoSpeak: boolean; rate: number; language: string };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I can analyse your workspace, search the live web with sources, and prepare clients, projects, invoices, quotations, service letters, expenses, payments, events and renewals.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  function speak(text: string) {
    if (!voice.enabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      text.replace(/\*\*/g, '').replace(/[📁💰📊👥🧾⏳⚠️✅•]/g, ' '),
    );
    utterance.lang = voice.language;
    utterance.rate = voice.rate;
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Voice input is not supported by this browser. You can still type your request.');
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = voice.language;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        setInput(transcript);
        void send(transcript);
      }
    };
    recognition.onerror = () => {
      setError('I could not hear that clearly. Tap the microphone and try again.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError('');
    setListening(true);
    recognition.start();
  }

  async function send(message = input) {
    const clean = message.trim();
    if (!clean || busy) return;
    setInput('');
    setError('');
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: clean }]);
    setBusy(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          context,
          history: messages
            .filter((item) => item.id !== 'welcome')
            .slice(-10)
            .map((item) => ({ role: item.role, text: item.text })),
        }),
      });
      const data = (await response.json()) as {
        reply?: string;
        action?: AssistantAction;
        sources?: AssistantSource[];
        error?: string;
      };
      if (!response.ok || !data.reply || !data.action) {
        throw new Error(data.error || 'Infonits GPT could not answer right now.');
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.reply!,
          action: data.action,
          sources: data.sources,
        },
      ]);
      if (voice.autoSpeak) speak(data.reply);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Infonits GPT is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  function apply(message: ChatMessage) {
    if (!message.action || message.action.type === 'none') return;
    const result = onApply(message.action);
    setMessages((current) => [
      ...current.map((item) => (item.id === message.id ? { ...item, applied: true } : item)),
      { id: crypto.randomUUID(), role: 'assistant', text: result },
    ]);
  }

  return (
    <section className="assistant-page" aria-label="Infonits GPT">
      <header className="assistant-header">
        <span>
          <Sparkles size={22} />
        </span>
        <div>
          <small>INFONITS AI</small>
          <h1>Infonits GPT</h1>
          <p>Analyse, create, research and manage your workspace.</p>
        </div>
        <i>{voice.enabled ? 'Voice assistant ready' : 'Claude connected'}</i>
      </header>
      <div className="assistant-body">
        <div className="assistant-messages" aria-live="polite">
          {messages.map((message) => (
            <article className={message.role} key={message.id}>
              {message.role === 'assistant' && (
                <span>
                  <Bot size={17} />
                </span>
              )}
              <div>
                <FormattedMessage text={message.text} />
                {message.role === 'assistant' && voice.enabled && (
                  <button
                    type="button"
                    className="assistant-speak-button"
                    aria-label="Read this reply aloud"
                    onClick={() => speak(message.text)}
                  >
                    <Volume2 size={14} /> Listen
                  </button>
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="assistant-sources" aria-label="Web sources">
                    <strong>Sources</strong>
                    {message.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                        <Globe2 size={12} /> {source.title}
                      </a>
                    ))}
                  </div>
                )}
                {message.action && message.action.type !== 'none' && (
                  <button type="button" disabled={message.applied} onClick={() => apply(message)}>
                    {message.applied ? <CheckCircle2 size={15} /> : <Sparkles size={15} />}
                    {message.applied ? 'Applied' : 'Review & apply'}
                  </button>
                )}
              </div>
            </article>
          ))}
          {busy && (
            <article className="assistant assistant-thinking">
              <span>
                <Bot size={17} />
              </span>
              <div>
                <LoaderCircle className="spin" size={17} /> Thinking…
              </div>
            </article>
          )}
          {error && <p className="assistant-error">{error}</p>}
        </div>
        <div className="assistant-capabilities" aria-label="Assistant capabilities">
          <span>
            <Sparkles size={15} />
            <b>Workspace</b>
            <small>Analyse finance and records</small>
          </span>
          <span>
            <FilePlus2 size={15} />
            <b>Create</b>
            <small>Invoices, quotes and letters</small>
          </span>
          <span>
            <Search size={15} />
            <b>Web search</b>
            <small>Current answers with sources</small>
          </span>
        </div>
        <div className="assistant-prompts">
          {[
            'Summarise my finance',
            'Create an invoice',
            'Create a quotation',
            'Draft a service letter',
            'Search the web',
            'What needs attention?',
          ].map((prompt) => (
            <button type="button" key={prompt} onClick={() => void send(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!busy && input.trim()) void send();
              }
            }}
            placeholder="Ask Infonits GPT or describe a task…"
            rows={2}
          />
          {voice.enabled && (
            <button
              type="button"
              className={`assistant-mic-button ${listening ? 'listening' : ''}`}
              aria-label={listening ? 'Stop listening' : 'Speak to Infonits GPT'}
              onClick={toggleListening}
            >
              {listening ? <Square size={15} /> : <Mic size={18} />}
            </button>
          )}
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
            <ArrowUp size={18} />
          </button>
        </form>
        <small className="assistant-footnote">
          Workspace changes happen only after you select Review &amp; apply. Web answers include
          source links.
        </small>
      </div>
    </section>
  );
}
