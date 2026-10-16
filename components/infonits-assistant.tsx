'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Globe2,
  ListChecks,
  LoaderCircle,
  MessageCircle,
  Mic,
  Plus,
  RefreshCw,
  Square,
  Sparkles,
  X,
} from 'lucide-react';

export type AssistantAtomicAction =
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
export type AssistantAction =
  | { type: 'none' }
  | AssistantAtomicAction
  | { type: 'batch'; title: string; actions: AssistantAtomicAction[] };

type AssistantSource = { title: string; url: string };

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  action?: AssistantAction;
  sources?: AssistantSource[];
  applied?: boolean;
  reviewing?: boolean;
};

function actionLabel(action: AssistantAtomicAction) {
  const labels: Record<AssistantAtomicAction['type'], string> = {
    create_client: 'Create client',
    create_project: 'Create project',
    create_expense: 'Add expense',
    create_invoice: 'Create invoice',
    create_quotation: 'Create quotation',
    create_payment: 'Add finance record',
    create_event: 'Add calendar event',
    create_renewal: 'Add renewal',
    create_letter: 'Create service letter',
  };
  return labels[action.type];
}

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

const novaHistoryKey = 'infonits-nova-history-v1';
const novaLanguageKey = 'infonits-nova-language-v1';
const dailyBriefingPrompt =
  'Give me a short morning briefing using the live workspace data. Start with a friendly greeting, then list overdue payments, today tasks, renewals and website issues in priority order. Finish with the three best actions for today.';
const novaWelcome: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hello, I’m Nova — your personal business assistant. I can analyse your workspace, research the live web and prepare safe, reviewable actions for you.',
};

const briefingPrompts = [
  {
    title: 'Daily operations briefing',
    detail: 'Payments, tasks, renewals and website issues in priority order.',
    prompt:
      'Give me a concise daily operations briefing. Put overdue payments, tasks, renewals and website issues first, then recommend the three best actions for today.',
  },
  {
    title: 'Cash-flow watch',
    detail: 'Outstanding income, upcoming costs and the biggest risk.',
    prompt:
      'Analyse my current cash-flow position using the workspace data. Highlight outstanding income, upcoming costs and my biggest cash-flow risk.',
  },
  {
    title: 'Client follow-ups',
    detail: 'Clients who need contact and the reason for each follow-up.',
    prompt:
      'Which clients should I follow up with today? Prioritise overdue invoices and upcoming commitments and explain why.',
  },
];

const quickActions = [
  {
    icon: FilePlus2,
    title: 'Create invoice',
    detail: 'Prepare a complete invoice draft.',
    prompt: 'Help me create an invoice. Ask only for the missing essential details.',
  },
  {
    icon: ClipboardCheck,
    title: 'Create quotation',
    detail: 'Draft a client quotation for review.',
    prompt: 'Help me create a quotation. Ask only for the missing essential details.',
  },
  {
    icon: Plus,
    title: 'Add project',
    detail: 'Prepare a new project record.',
    prompt: 'Help me add a new project. Ask only for the missing essential details.',
  },
  {
    icon: CalendarClock,
    title: 'Schedule task',
    detail: 'Add a task or calendar reminder.',
    prompt: 'Help me schedule a task. Ask for the title and due date if they are missing.',
  },
];

type NovaTab = 'chat' | 'briefing' | 'actions' | 'approvals';
type NovaLanguage = 'auto' | 'ta' | 'en';

function speechLanguage(text: string, language: NovaLanguage, fallback: string) {
  if (language === 'ta') return 'ta-IN';
  if (language === 'en') return 'en-US';
  return /[\u0B80-\u0BFF]/.test(text) ? 'ta-IN' : fallback;
}

export function InfonitsAssistant({
  context,
  dailyBriefing = false,
  onApply,
  onClose,
  voice,
}: {
  context: object;
  dailyBriefing?: boolean;
  onApply: (action: Exclude<AssistantAction, { type: 'none' }>) => string;
  onClose: () => void;
  voice: { enabled: boolean; autoSpeak: boolean; rate: number; language: string };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([novaWelcome]);
  const [activeTab, setActiveTab] = useState<NovaTab>('chat');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [language, setLanguage] = useState<NovaLanguage>('auto');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingCancelledRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dailyBriefingStartedRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const stopRecording = useCallback((cancel = false) => {
    if (cancel) recordingCancelledRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
    setListening(false);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(novaHistoryKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed.slice(-40));
      }
      const savedLanguage = localStorage.getItem(novaLanguageKey);
      if (savedLanguage === 'auto' || savedLanguage === 'ta' || savedLanguage === 'en') {
        setLanguage(savedLanguage);
      }
    } catch {
      localStorage.removeItem(novaHistoryKey);
    }
    setHistoryReady(true);
    return () => {
      stopRecording(true);
      stopSpeaking();
    };
  }, [stopRecording, stopSpeaking]);

  const speak = useCallback(
    async (text: string) => {
      stopSpeaking();
      const controller = new AbortController();
      speechRequestRef.current = controller;
      setSpeaking(true);

      const browserVoiceFallback = () => {
        if (controller.signal.aborted || !('speechSynthesis' in window)) {
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;
        utterance.lang = speechLanguage(text, language, voice.language);
        utterance.rate = voice.rate;
        utterance.onend = () => {
          if (utteranceRef.current !== utterance) return;
          utteranceRef.current = null;
          setSpeaking(false);
        };
        utterance.onerror = utterance.onend;
        window.speechSynthesis.speak(utterance);
      };

      try {
        const response = await fetch('/api/assistant/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('ElevenLabs speech is unavailable.');

        const audioUrl = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted || speechRequestRef.current !== controller) {
          URL.revokeObjectURL(audioUrl);
          return;
        }
        speechRequestRef.current = null;
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.playbackRate = voice.rate;
        const finish = () => {
          if (audioRef.current !== audio) return;
          audioRef.current = null;
          if (audioUrlRef.current === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrlRef.current = null;
          }
          setSpeaking(false);
        };
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play();
      } catch (speechError) {
        if (speechError instanceof Error && speechError.name === 'AbortError') return;
        if (speechRequestRef.current === controller) speechRequestRef.current = null;
        if (audioRef.current) {
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        browserVoiceFallback();
      }
    },
    [language, stopSpeaking, voice.language, voice.rate],
  );

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(novaHistoryKey, JSON.stringify(messages.slice(-40)));
  }, [historyReady, messages]);

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(novaLanguageKey, language);
  }, [historyReady, language]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [input]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stopRecording(true);
        stopSpeaking();
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, stopRecording, stopSpeaking]);

  const send = useCallback(
    async (message = input, options: { speak?: boolean; silentUser?: boolean } = {}) => {
      const clean = message.trim();
      if (!clean || busy) return;
      setInput('');
      setError('');
      if (!options.silentUser) {
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: 'user', text: clean },
        ]);
      }
      setBusy(true);
      try {
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            language,
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
          throw new Error(data.error || 'Nova could not answer right now.');
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
        if (voice.autoSpeak || options.speak) void speak(data.reply);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Nova is unavailable.');
      } finally {
        setBusy(false);
      }
    },
    [busy, context, input, language, messages, speak, voice.autoSpeak],
  );

  useEffect(() => {
    if (!dailyBriefing || !historyReady || dailyBriefingStartedRef.current) return;
    dailyBriefingStartedRef.current = true;
    setActiveTab('chat');
    void send(dailyBriefingPrompt, { silentUser: true });
  }, [dailyBriefing, historyReady, send]);

  async function toggleListening() {
    if (listening) {
      stopRecording();
      return;
    }
    if (busy || transcribing) return;
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setError(
        'Voice recording is not supported by this browser. You can still type your request.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const preferredType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : {});
      const chunks: Blob[] = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingCancelledRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        recordingCancelledRef.current = true;
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;
        setListening(false);
        setError('The microphone stopped unexpectedly. Please try again.');
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;
        setListening(false);
        if (recordingCancelledRef.current) return;

        const mimeType = recorder.mimeType || preferredType || 'audio/webm';
        const recording = new Blob(chunks, { type: mimeType });
        if (!recording.size) {
          setError('No speech was recorded. Tap the microphone and try again.');
          return;
        }

        setTranscribing(true);
        setError('');
        try {
          const form = new FormData();
          const extension = mimeType.includes('mp4')
            ? 'm4a'
            : mimeType.includes('ogg')
              ? 'ogg'
              : 'webm';
          form.append('file', recording, `nova-voice.${extension}`);
          form.append('language', language);
          const response = await fetch('/api/assistant/transcribe', { method: 'POST', body: form });
          const data = (await response.json()) as { text?: string; error?: string };
          if (!response.ok || !data.text) {
            throw new Error(data.error || 'Nova could not transcribe that recording.');
          }
          setInput(data.text);
          await send(data.text, { speak: true });
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Nova could not hear that clearly.');
        } finally {
          setTranscribing(false);
        }
      };
      setError('');
      setListening(true);
      recorder.start();
    } catch (caught) {
      const denied = caught instanceof DOMException && caught.name === 'NotAllowedError';
      setError(
        denied
          ? 'Microphone access is blocked. Allow microphone access in your browser settings and try again.'
          : 'No microphone was found. Check your device microphone and try again.',
      );
      setListening(false);
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

  function review(message: ChatMessage) {
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, reviewing: true } : item)),
    );
  }

  function startPrompt(prompt: string) {
    setActiveTab('chat');
    void send(prompt);
  }

  function resetConversation() {
    stopRecording(true);
    stopSpeaking();
    setMessages([novaWelcome]);
    setInput('');
    setError('');
    setActiveTab('chat');
  }

  const pendingApprovals = messages.filter(
    (message) => message.action && message.action.type !== 'none' && !message.applied,
  );

  const actionReview = (message: ChatMessage) => {
    if (!message.action || message.action.type === 'none') return null;
    const actions = message.action.type === 'batch' ? message.action.actions : [message.action];
    return (
      <div className="assistant-action-review">
        {message.reviewing ? (
          <div className="assistant-action-list">
            <strong>
              {message.action.type === 'batch' ? message.action.title : 'Proposed workspace change'}
            </strong>
            {actions.map((action, index) => (
              <span key={`${action.type}-${index}`}>
                <CheckCircle2 size={13} /> {actionLabel(action)}
              </span>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          disabled={message.applied}
          onClick={() => (message.reviewing ? apply(message) : review(message))}
        >
          {message.applied ? <CheckCircle2 size={15} /> : <Sparkles size={15} />}
          {message.applied
            ? 'Applied'
            : message.reviewing
              ? `Apply ${actions.length} change${actions.length === 1 ? '' : 's'}`
              : 'Review changes'}
        </button>
      </div>
    );
  };

  return (
    <section
      className="assistant-page nova-modal"
      aria-label="Nova personal assistant"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nova-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="assistant-header">
        <span>
          <Sparkles size={22} />
        </span>
        <div>
          <small>PERSONAL BUSINESS ASSISTANT</small>
          <h1 id="nova-title">Nova</h1>
          <p>Ask, analyse and prepare safe workspace actions.</p>
        </div>
        <div className="nova-header-actions">
          <label className="nova-language-select">
            <Globe2 size={13} aria-hidden="true" />
            <select
              aria-label="Nova response language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as NovaLanguage)}
            >
              <option value="auto">Auto</option>
              <option value="ta">தமிழ்</option>
              <option value="en">English</option>
            </select>
          </label>
          <i>
            {speaking
              ? 'Nova speaking'
              : voice.enabled
                ? 'ElevenLabs voice ready'
                : 'Claude connected'}
          </i>
          <button type="button" onClick={resetConversation} title="Start a new conversation">
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              stopRecording(true);
              stopSpeaking();
              onClose();
            }}
            aria-label="Close Nova"
          >
            <X size={19} />
          </button>
        </div>
      </header>
      <nav className="nova-tabs" aria-label="Nova sections">
        {(
          [
            ['chat', MessageCircle, 'Chat'],
            ['briefing', CalendarClock, 'Briefing'],
            ['actions', ListChecks, 'Quick actions'],
            [
              'approvals',
              ClipboardCheck,
              `Approvals${pendingApprovals.length ? ` (${pendingApprovals.length})` : ''}`,
            ],
          ] as const
        ).map(([tab, Icon, label]) => (
          <button
            type="button"
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => setActiveTab(tab)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div className="assistant-body">
        {activeTab === 'chat' ? (
          <>
            <div className="assistant-messages" aria-live="polite">
              {messages.map((message) => (
                <article className={message.role} key={message.id}>
                  {message.role === 'assistant' ? (
                    <span>
                      <Bot size={17} />
                    </span>
                  ) : null}
                  <div>
                    <FormattedMessage text={message.text} />
                    {message.sources && message.sources.length > 0 ? (
                      <div className="assistant-sources" aria-label="Web sources">
                        <strong>Sources</strong>
                        {message.sources.map((source) => (
                          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                            <Globe2 size={12} /> {source.title}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {actionReview(message)}
                  </div>
                </article>
              ))}
              {busy ? (
                <article className="assistant assistant-thinking">
                  <span>
                    <Bot size={17} />
                  </span>
                  <div>
                    <LoaderCircle className="spin" size={17} /> Nova is thinking…
                  </div>
                </article>
              ) : null}
              {error ? <p className="assistant-error">{error}</p> : null}
            </div>
            <form
              className="assistant-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <textarea
                autoFocus
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (!busy && input.trim()) void send();
                  }
                }}
                placeholder="Ask Nova or describe a task…"
                rows={1}
              />
              {speaking ? (
                <button
                  type="button"
                  className="assistant-voice-stop-button"
                  aria-label="Stop Nova speaking"
                  title="Stop voice"
                  onClick={stopSpeaking}
                >
                  <Square size={15} fill="currentColor" />
                </button>
              ) : voice.enabled ? (
                <button
                  type="button"
                  className={`assistant-mic-button ${listening ? 'listening' : ''}`}
                  aria-label={
                    transcribing
                      ? 'Transcribing voice'
                      : listening
                        ? 'Stop and send recording'
                        : 'Speak to Nova'
                  }
                  disabled={busy || transcribing}
                  onClick={() => void toggleListening()}
                >
                  {transcribing ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : listening ? (
                    <span className="assistant-voice-wave" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <Mic size={18} />
                  )}
                </button>
              ) : null}
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
                <ArrowUp size={18} />
              </button>
            </form>
            <small className="assistant-footnote">
              {listening
                ? 'Listening… tap the microphone again when you finish speaking.'
                : transcribing
                  ? 'Nova is transcribing your voice with ElevenLabs…'
                  : 'Nova only applies workspace changes after your review and approval.'}
            </small>
          </>
        ) : null}

        {activeTab === 'briefing' ? (
          <div className="nova-panel-view">
            <div className="nova-panel-intro">
              <CalendarClock size={22} />
              <div>
                <strong>Daily intelligence</strong>
                <p>Turn live workspace data into a focused plan for today.</p>
              </div>
            </div>
            <div className="nova-choice-grid">
              {briefingPrompts.map((item) => (
                <button
                  type="button"
                  key={item.title}
                  disabled={busy}
                  onClick={() => startPrompt(item.prompt)}
                >
                  <span>{item.title}</span>
                  <small>{item.detail}</small>
                  <ArrowUp size={15} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'actions' ? (
          <div className="nova-panel-view">
            <div className="nova-panel-intro">
              <ListChecks size={22} />
              <div>
                <strong>Quick actions</strong>
                <p>Nova prepares drafts; you review every change before it is applied.</p>
              </div>
            </div>
            <div className="nova-choice-grid nova-action-grid">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.title}
                    disabled={busy}
                    onClick={() => startPrompt(item.prompt)}
                  >
                    <Icon size={18} />
                    <span>{item.title}</span>
                    <small>{item.detail}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === 'approvals' ? (
          <div className="nova-panel-view nova-approvals">
            <div className="nova-panel-intro">
              <ClipboardCheck size={22} />
              <div>
                <strong>Approval queue</strong>
                <p>Nothing changes until you inspect and approve it here.</p>
              </div>
            </div>
            {pendingApprovals.length ? (
              pendingApprovals.map((message) => (
                <article key={message.id}>
                  <FormattedMessage text={message.text} />
                  {actionReview(message)}
                </article>
              ))
            ) : (
              <div className="nova-empty-state">
                <CheckCircle2 size={27} />
                <strong>No changes waiting</strong>
                <p>Actions prepared by Nova will appear here for approval.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
