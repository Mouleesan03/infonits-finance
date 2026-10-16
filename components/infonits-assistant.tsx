'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ArrowUp,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Globe2,
  Gauge,
  History,
  ListChecks,
  LoaderCircle,
  MessageCircle,
  MicOff,
  PhoneOff,
  Plus,
  RefreshCw,
  Square,
  Sparkles,
  Volume2,
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
type AssistantInsight = {
  kind: 'finance';
  title: string;
  subtitle: string;
  status: string;
  facts: Array<{ label: string; value: string }>;
  origin: string;
};

type AssistantStreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'action'; action: AssistantAction }
  | { type: 'source'; source: AssistantSource }
  | { type: 'insight'; insight: AssistantInsight }
  | { type: 'finish'; model: 'fast' | 'smart'; mode: NovaResponseMode }
  | { type: 'error'; error: string };

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  action?: AssistantAction;
  sources?: AssistantSource[];
  insight?: AssistantInsight;
  model?: 'fast' | 'smart';
  mode?: NovaResponseMode;
  applied?: boolean;
  appliedAt?: string;
  applyResult?: string;
  reviewing?: boolean;
  dismissed?: boolean;
};

const approvalPreviewPattern =
  /(?:\bpreview\b.*\b(?:create|save|add|apply)\b|\b(?:create|save|add)\b.*\bpreview\b|(?:preview|முன்னோட்டம்).*(?:create|உருவாக்கு|சேர்)|(?:create|உருவாக்கு|சேர்).*(?:preview|முன்னோட்டம்))/i;

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

function actionDetails(action: AssistantAtomicAction) {
  const money = (amount: number, currency: string) =>
    `${currency || 'USD'} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  let details: Array<{ label: string; value: string }>;

  switch (action.type) {
    case 'create_client':
      details = [
        { label: 'Name', value: action.name },
        { label: 'Company', value: action.company },
        { label: 'Email', value: action.email },
        { label: 'Phone', value: action.phone },
        { label: 'Country', value: action.country },
      ];
      break;
    case 'create_project':
      details = [
        { label: 'Project', value: action.project },
        { label: 'Client', value: action.clientName },
        { label: 'Value', value: money(action.amount, action.currency) },
        { label: 'Note', value: action.note },
      ];
      break;
    case 'create_expense':
      details = [
        { label: 'Description', value: action.description },
        { label: 'Category', value: action.category },
        { label: 'Amount', value: money(action.amount, action.currency) },
        { label: 'Date', value: action.date },
      ];
      break;
    case 'create_invoice':
    case 'create_quotation':
      details = [
        { label: 'Client', value: action.clientName },
        { label: 'Project', value: action.projectName },
        { label: 'Amount', value: money(action.amount, action.currency) },
        { label: 'Description', value: action.description },
        { label: 'Notes', value: action.notes },
        { label: 'Bank details', value: action.includeBankDetails ? 'Included' : 'Not included' },
      ];
      break;
    case 'create_payment':
      details = [
        { label: 'Type', value: action.paymentType },
        { label: 'Category', value: action.category },
        { label: 'Amount', value: money(action.amount, action.currency) },
        { label: 'Date', value: action.date },
        { label: 'Note', value: action.note },
      ];
      break;
    case 'create_event':
      details = [
        { label: 'Title', value: action.title },
        { label: 'Date', value: action.date },
        { label: 'Type', value: action.eventType },
      ];
      break;
    case 'create_renewal':
      details = [
        { label: 'Website', value: action.website },
        { label: 'Domain due', value: action.domainDue },
        { label: 'Hosting due', value: action.hostingDue },
      ];
      break;
    case 'create_letter':
      details = [
        { label: 'Client', value: action.clientName },
        { label: 'Subject', value: action.subject },
        { label: 'Date', value: action.date },
        { label: 'Prepared by', value: action.preparedBy },
        { label: 'Body', value: action.body },
      ];
      break;
  }

  return details.filter(({ value }) => String(value).trim());
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
const novaModeKey = 'infonits-nova-response-mode-v1';
const novaMemoryKey = 'infonits-nova-memory-v1';
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
  {
    title: 'Risk and anomaly scan',
    detail: 'Unusual expenses, stalled collections and urgent operational risks.',
    prompt:
      'Scan the workspace for unusual expenses, stalled collections, overdue commitments and operational anomalies. Rank only the important risks and recommend the next action for each.',
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

type NovaTab = 'chat' | 'briefing' | 'actions' | 'approvals' | 'knowledge';
type NovaLanguage = 'auto' | 'ta' | 'en';
type NovaResponseMode = 'quick' | 'deep';
type VoiceSessionPhase = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'muted' | 'error';

function speechLanguage(text: string, language: NovaLanguage, fallback: string) {
  if (language === 'ta') return 'ta-IN';
  if (language === 'en') return 'en-US';
  return /[\u0B80-\u0BFF]/.test(text) ? 'ta-IN' : fallback;
}

function plainSpeechText(text: string) {
  return text
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .trim();
}

function sourceConfidence(sources: AssistantSource[]) {
  if (!sources.length) return null;
  const official = sources.every((source) => {
    try {
      return ['infonits.io', 'www.infonits.io'].includes(new URL(source.url).hostname);
    } catch {
      return false;
    }
  });
  return official ? 'Official web' : 'External web';
}

function FinanceInsightCard({ insight }: { insight: AssistantInsight }) {
  return (
    <section className="nova-finance-insight" aria-label={`${insight.title} finance summary`}>
      <header>
        <span>
          <strong>{insight.title}</strong>
          <small>{insight.subtitle}</small>
        </span>
        <i>{insight.status}</i>
      </header>
      <div>
        {insight.facts.map((fact) => (
          <span key={fact.label}>
            <small>{fact.label}</small>
            <strong>{fact.value}</strong>
          </span>
        ))}
      </div>
      <footer>{insight.origin}</footer>
    </section>
  );
}

export function InfonitsAssistant({
  context,
  dailyBriefing = false,
  voiceStartSignal = 0,
  onApply,
  onClose,
  voice,
}: {
  context: object;
  dailyBriefing?: boolean;
  voiceStartSignal?: number;
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
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [historyReady, setHistoryReady] = useState(false);
  const [language, setLanguage] = useState<NovaLanguage>('auto');
  const [responseMode, setResponseMode] = useState<NovaResponseMode>('quick');
  const [memory, setMemory] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingCancelledRef = useRef(false);
  const startingRecordingRef = useRef(false);
  const voiceSessionActiveRef = useRef(false);
  const voiceMutedRef = useRef(false);
  const voiceActivityFrameRef = useRef<number | null>(null);
  const voiceActivitySourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dailyBriefingStartedRef = useRef(false);

  const stopVoiceActivityDetection = useCallback(() => {
    if (voiceActivityFrameRef.current !== null) {
      cancelAnimationFrame(voiceActivityFrameRef.current);
      voiceActivityFrameRef.current = null;
    }
    voiceActivitySourceRef.current?.disconnect();
    voiceActivitySourceRef.current = null;
    setVoiceLevel(0);
  }, []);

  const stopSpeaking = useCallback(() => {
    speechRequestRef.current?.abort();
    speechRequestRef.current = null;
    if (audioSourceRef.current) {
      audioSourceRef.current.onended = null;
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
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

  const stopRecording = useCallback(
    (cancel = false) => {
      if (cancel) recordingCancelledRef.current = true;
      if (startingRecordingRef.current) recordingCancelledRef.current = true;
      const recorder = mediaRecorderRef.current;
      stopVoiceActivityDetection();
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      else {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      }
      setListening(false);
    },
    [stopVoiceActivityDetection],
  );

  const unlockAudio = useCallback(async () => {
    const audioWindow = window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    if (context.state === 'suspended') await context.resume();
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.onended = () => source.disconnect();
    source.start();
  }, []);

  const startVoiceActivityDetection = useCallback(
    (stream: MediaStream, recorder: MediaRecorder) => {
      const context = audioContextRef.current;
      if (!context || context.state === 'closed') return;
      stopVoiceActivityDetection();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      voiceActivitySourceRef.current = source;
      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = performance.now();
      let lastSpeechAt = startedAt;
      let lastPaintAt = 0;
      let heardSpeech = false;

      const sample = () => {
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sampleValue of samples) {
          const amplitude = (sampleValue - 128) / 128;
          energy += amplitude * amplitude;
        }
        const rms = Math.sqrt(energy / samples.length);
        const now = performance.now();
        if (now - lastPaintAt > 70) {
          setVoiceLevel(Math.min(1, Math.max(0.08, (rms - 0.012) * 14)));
          lastPaintAt = now;
        }
        if (rms > 0.035) {
          heardSpeech = true;
          lastSpeechAt = now;
        }
        if (heardSpeech && now - lastSpeechAt > 680 && now - startedAt > 650) {
          stopVoiceActivityDetection();
          if (recorder.state === 'recording') recorder.stop();
          return;
        }
        voiceActivityFrameRef.current = requestAnimationFrame(sample);
      };
      voiceActivityFrameRef.current = requestAnimationFrame(sample);
    },
    [stopVoiceActivityDetection],
  );

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
      const savedMode = localStorage.getItem(novaModeKey);
      if (savedMode === 'quick' || savedMode === 'deep') setResponseMode(savedMode);
      setMemory(localStorage.getItem(novaMemoryKey) ?? '');
    } catch {
      localStorage.removeItem(novaHistoryKey);
    }
    setHistoryReady(true);
    return () => {
      voiceSessionActiveRef.current = false;
      stopRecording(true);
      stopSpeaking();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [stopRecording, stopSpeaking]);

  const speak = useCallback(
    async (text: string) => {
      const spokenText = plainSpeechText(text);
      stopSpeaking();
      const controller = new AbortController();
      speechRequestRef.current = controller;
      setSpeaking(true);

      const browserVoiceFallback = () => {
        if (controller.signal.aborted || !('speechSynthesis' in window)) {
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utteranceRef.current = utterance;
        utterance.lang = speechLanguage(spokenText, language, voice.language);
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
          body: JSON.stringify({ text: spokenText }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('ElevenLabs speech is unavailable.');

        const audioBlob = await response.blob();
        if (controller.signal.aborted || speechRequestRef.current !== controller) {
          return;
        }

        const context = audioContextRef.current;
        if (context && context.state !== 'closed') {
          if (context.state === 'suspended') await context.resume();
          const buffer = await context.decodeAudioData(await audioBlob.arrayBuffer());
          if (controller.signal.aborted) return;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = voice.rate;
          source.connect(context.destination);
          audioSourceRef.current = source;
          source.onended = () => {
            if (audioSourceRef.current !== source) return;
            source.disconnect();
            audioSourceRef.current = null;
            setSpeaking(false);
          };
          speechRequestRef.current = null;
          source.start();
          return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
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
        speechRequestRef.current = null;
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
        if (audioSourceRef.current) {
          audioSourceRef.current.onended = null;
          audioSourceRef.current.stop();
          audioSourceRef.current.disconnect();
          audioSourceRef.current = null;
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

  const endVoiceSession = useCallback(() => {
    voiceSessionActiveRef.current = false;
    voiceMutedRef.current = false;
    setVoiceSessionActive(false);
    setVoiceMuted(false);
    stopRecording(true);
    stopSpeaking();
  }, [stopRecording, stopSpeaking]);

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(novaHistoryKey, JSON.stringify(messages.slice(-40)));
  }, [historyReady, messages]);

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(novaLanguageKey, language);
  }, [historyReady, language]);

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(novaModeKey, responseMode);
  }, [historyReady, responseMode]);

  useEffect(() => {
    if (!historyReady) return;
    localStorage.setItem(novaMemoryKey, memory);
  }, [historyReady, memory]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [input]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (voiceSessionActiveRef.current) endVoiceSession();
        else onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [endVoiceSession, onClose]);

  const send = useCallback(
    async (
      message = input,
      options: { speak?: boolean; silentUser?: boolean; voiceSession?: boolean } = {},
    ) => {
      const clean = message.trim();
      if (!clean || busy) return;
      const wantsApprovalPreview = approvalPreviewPattern.test(clean);
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
        const assistantId = crypto.randomUUID();
        let reply = '';
        let action: AssistantAction = { type: 'none' };
        let sources: AssistantSource[] = [];
        let insight: AssistantInsight | undefined;
        let responseModel: 'fast' | 'smart' | undefined;
        let completedMode: NovaResponseMode | undefined;
        let finished = false;
        const updateAssistant = () => {
          const nextMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            text: reply,
            action,
            sources,
            insight,
            model: responseModel,
            mode: completedMode,
            reviewing: action.type !== 'none' && wantsApprovalPreview,
          };
          setMessages((current) => {
            const exists = current.some((item) => item.id === assistantId);
            return exists
              ? current.map((item) => (item.id === assistantId ? nextMessage : item))
              : [...current, nextMessage];
          });
        };
        const handleEvent = (event: AssistantStreamEvent) => {
          if (event.type === 'text-delta') {
            reply += event.delta;
            updateAssistant();
          } else if (event.type === 'action') {
            action = event.action;
            updateAssistant();
          } else if (event.type === 'source') {
            if (!sources.some((source) => source.url === event.source.url)) {
              sources = [...sources, event.source];
              updateAssistant();
            }
          } else if (event.type === 'insight') {
            insight = event.insight;
            updateAssistant();
          } else if (event.type === 'finish') {
            finished = true;
            responseModel = event.model;
            completedMode = event.mode;
            updateAssistant();
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        };
        const response = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            language,
            responseMode,
            memory,
            voiceMode: Boolean(options.speak || voice.autoSpeak),
            context,
            history: messages
              .filter((item) => item.id !== 'welcome')
              .slice(-10)
              .map((item) => ({ role: item.role, text: item.text })),
          }),
        });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/x-ndjson')) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Nova could not answer right now.');
        }
        if (!response.body) throw new Error('Nova returned an empty response.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = '';
        while (true) {
          const { done, value } = await reader.read();
          buffered += decoder.decode(value, { stream: !done });
          const lines = buffered.split('\n');
          buffered = done ? '' : (lines.pop() ?? '');
          for (const line of lines) {
            if (!line.trim()) continue;
            handleEvent(JSON.parse(line) as AssistantStreamEvent);
          }
          if (done) {
            if (buffered.trim()) handleEvent(JSON.parse(buffered) as AssistantStreamEvent);
            break;
          }
        }
        if (!finished || !reply.trim()) throw new Error('Nova could not finish that response.');
        if (action.type !== 'none' && wantsApprovalPreview) {
          setActiveTab('approvals');
        }
        if (
          (voice.autoSpeak || options.speak) &&
          (!options.voiceSession || voiceSessionActiveRef.current)
        ) {
          void speak(reply);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Nova is unavailable.');
      } finally {
        setBusy(false);
      }
    },
    [busy, context, input, language, memory, messages, responseMode, speak, voice.autoSpeak],
  );

  useEffect(() => {
    if (!dailyBriefing || !historyReady || dailyBriefingStartedRef.current) return;
    dailyBriefingStartedRef.current = true;
    setActiveTab('chat');
    void send(dailyBriefingPrompt, { silentUser: true });
  }, [dailyBriefing, historyReady, send]);

  const startListening = useCallback(async () => {
    if (listening || busy || transcribing || startingRecordingRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setError(
        'Voice recording is not supported by this browser. You can still type your request.',
      );
      return;
    }
    recordingCancelledRef.current = false;
    startingRecordingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      startingRecordingRef.current = false;
      if (recordingCancelledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
        stopVoiceActivityDetection();
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;
        setListening(false);
        setError('The microphone stopped unexpectedly. Please try again.');
      };
      recorder.onstop = async () => {
        stopVoiceActivityDetection();
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;
        setListening(false);
        if (recordingCancelledRef.current) return;

        const mimeType = recorder.mimeType || preferredType || 'audio/webm';
        const recording = new Blob(chunks, { type: mimeType });
        if (!recording.size) {
          setError('Nova did not hear any speech. Tap Try again when you are ready.');
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
          if (!voiceSessionActiveRef.current) return;
          await send(data.text, { speak: true, voiceSession: true });
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Nova could not hear that clearly.');
        } finally {
          setTranscribing(false);
        }
      };
      setError('');
      setListening(true);
      recorder.start(250);
      startVoiceActivityDetection(stream, recorder);
    } catch (caught) {
      startingRecordingRef.current = false;
      const denied = caught instanceof DOMException && caught.name === 'NotAllowedError';
      setError(
        denied
          ? 'Microphone access is blocked. Allow microphone access in your browser settings and try again.'
          : 'No microphone was found. Check your device microphone and try again.',
      );
      setListening(false);
    }
  }, [
    busy,
    language,
    listening,
    send,
    startVoiceActivityDetection,
    stopVoiceActivityDetection,
    transcribing,
  ]);

  const beginVoiceSession = useCallback(() => {
    if (voiceSessionActiveRef.current) return;
    voiceSessionActiveRef.current = true;
    voiceMutedRef.current = false;
    setVoiceSessionActive(true);
    setVoiceMuted(false);
    setActiveTab('chat');
    setError('');
    void unlockAudio();
    void startListening();
  }, [startListening, unlockAudio]);

  useEffect(() => {
    if (!voiceStartSignal || voiceSessionActiveRef.current) return;
    beginVoiceSession();
  }, [beginVoiceSession, voiceStartSignal]);

  const toggleVoiceMute = useCallback(() => {
    const nextMuted = !voiceMutedRef.current;
    voiceMutedRef.current = nextMuted;
    setVoiceMuted(nextMuted);
    if (nextMuted) stopRecording(true);
    else {
      setError('');
      void startListening();
    }
  }, [startListening, stopRecording]);

  useEffect(() => {
    if (
      !voiceSessionActive ||
      !voiceSessionActiveRef.current ||
      voiceMuted ||
      voiceMutedRef.current ||
      listening ||
      transcribing ||
      busy ||
      speaking ||
      error ||
      startingRecordingRef.current
    ) {
      return;
    }
    const timer = window.setTimeout(() => void startListening(), 260);
    return () => window.clearTimeout(timer);
  }, [
    busy,
    error,
    listening,
    speaking,
    startListening,
    transcribing,
    voiceMuted,
    voiceSessionActive,
  ]);

  function apply(message: ChatMessage) {
    if (!message.action || message.action.type === 'none') return;
    const result = onApply(message.action);
    setMessages((current) => [
      ...current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              applied: true,
              appliedAt: new Date().toISOString(),
              applyResult: result,
            }
          : item,
      ),
      { id: crypto.randomUUID(), role: 'assistant', text: result },
    ]);
  }

  function review(message: ChatMessage) {
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, reviewing: true } : item)),
    );
  }

  function editProposal(message: ChatMessage) {
    if (!message.action || message.action.type === 'none') return;
    const actions = message.action.type === 'batch' ? message.action.actions : [message.action];
    const subject =
      actions.length === 1 ? actionLabel(actions[0]).toLowerCase() : `${actions.length} changes`;
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, dismissed: true, reviewing: false } : item,
      ),
    );
    setActiveTab('chat');
    setInput(`Revise this ${subject}. Change: `);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function discardProposal(message: ChatMessage) {
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, dismissed: true, reviewing: false } : item,
      ),
    );
  }

  function startPrompt(prompt: string) {
    setActiveTab('chat');
    void send(prompt);
  }

  function resetConversation() {
    endVoiceSession();
    setMessages([novaWelcome]);
    setInput('');
    setError('');
    setActiveTab('chat');
  }

  const pendingApprovals = messages.filter(
    (message) =>
      message.action && message.action.type !== 'none' && !message.applied && !message.dismissed,
  );
  const appliedActions = messages
    .filter((message) => message.action && message.action.type !== 'none' && message.applied)
    .slice(-8)
    .reverse();
  const latestMessage = messages.at(-1);
  const voiceSessionPhase: VoiceSessionPhase = error
    ? 'error'
    : voiceMuted
      ? 'muted'
      : speaking
        ? 'speaking'
        : listening
          ? 'listening'
          : transcribing || busy
            ? 'thinking'
            : 'connecting';
  const voiceStatus: Record<VoiceSessionPhase, { title: string; hint: string }> = {
    connecting: { title: 'Connecting', hint: 'Getting Nova ready…' },
    listening: { title: 'Listening', hint: 'Speak naturally. Nova sends when you pause.' },
    thinking: { title: 'Thinking', hint: 'Nova is preparing a response…' },
    speaking: { title: 'Speaking', hint: 'Tap the orb to interrupt and speak.' },
    muted: { title: 'Microphone muted', hint: 'Unmute when you are ready.' },
    error: { title: 'Voice paused', hint: error || 'Try the microphone again.' },
  };

  const followUpsFor = (message: ChatMessage) => {
    if (message.role !== 'assistant' || message.id === 'welcome') return [];
    if (message.insight?.kind === 'finance') {
      return [
        {
          label: 'Explain conversion',
          prompt: `Explain the recorded currency conversion for ${message.insight.title} clearly.`,
        },
        {
          label: 'Draft reminder',
          prompt: `Draft a polite payment reminder for ${message.insight.title}. Do not apply or send anything.`,
        },
      ];
    }
    if (message.sources?.length) {
      return [
        {
          label: 'Verify key facts',
          prompt:
            'Verify the key facts using primary or official sources and flag any uncertainty.',
        },
      ];
    }
    if (message.applied) {
      return [
        {
          label: 'Review change',
          prompt:
            'Summarise the workspace change that was just applied and tell me what to check next.',
        },
      ];
    }
    return [
      { label: 'Best next step', prompt: 'Based on that answer, what is the best next step?' },
    ];
  };

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
              <section className="assistant-action-detail-group" key={`${action.type}-${index}`}>
                <span>
                  <CheckCircle2 size={13} /> {actionLabel(action)}
                </span>
                <dl>
                  {actionDetails(action).map((detail) => (
                    <div key={detail.label}>
                      <dt>{detail.label}</dt>
                      <dd>{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : null}
        <div className="assistant-action-buttons">
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
                : 'Preview & approve'}
          </button>
          {message.reviewing && !message.applied ? (
            <>
              <button type="button" className="secondary" onClick={() => editProposal(message)}>
                <RefreshCw size={14} /> Edit request
              </button>
              <button type="button" className="ghost" onClick={() => discardProposal(message)}>
                <X size={14} /> Discard
              </button>
            </>
          ) : null}
        </div>
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
      {voiceSessionActive ? (
        <div
          className={`nova-live-voice nova-live-voice-${voiceSessionPhase}`}
          role="dialog"
          aria-modal="true"
          aria-label="Nova voice conversation"
        >
          <header>
            <span>
              <Sparkles size={18} />
              <b>Nova Voice</b>
            </span>
            <button type="button" onClick={endVoiceSession} aria-label="End voice conversation">
              <X size={19} />
            </button>
          </header>
          <div className="nova-live-voice-main">
            <button
              type="button"
              className="nova-live-orb"
              aria-label={speaking ? 'Interrupt Nova' : voiceStatus[voiceSessionPhase].title}
              onClick={() => {
                if (speaking) stopSpeaking();
                else if (voiceSessionPhase === 'error') {
                  setError('');
                  void startListening();
                }
              }}
            >
              <span className="nova-live-rings" aria-hidden="true" />
              <span className="nova-live-wave" aria-hidden="true">
                {[0.72, 1, 0.82, 1.12, 0.76].map((weight, index) => (
                  <i
                    key={weight + index}
                    style={{ height: `${14 + voiceLevel * 38 * weight}px` }}
                  />
                ))}
              </span>
            </button>
            <strong>{voiceStatus[voiceSessionPhase].title}</strong>
            <small>{voiceStatus[voiceSessionPhase].hint}</small>
            <div className="nova-live-transcript">
              <FormattedMessage
                text={
                  voiceSessionPhase === 'error'
                    ? error
                    : latestMessage?.id === 'welcome'
                      ? 'Start talking whenever you’re ready.'
                      : (latestMessage?.text ?? '')
                }
              />
            </div>
          </div>
          <footer>
            <button
              type="button"
              className={voiceMuted ? 'active' : ''}
              onClick={toggleVoiceMute}
              aria-label={voiceMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {voiceMuted ? <MicOff size={20} /> : <AudioLines size={20} />}
              <span>{voiceMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            {voiceSessionPhase === 'error' ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  voiceMutedRef.current = false;
                  setVoiceMuted(false);
                  void startListening();
                }}
              >
                <RefreshCw size={20} />
                <span>Try again</span>
              </button>
            ) : null}
            <button type="button" className="end" onClick={endVoiceSession}>
              <PhoneOff size={20} />
              <span>End</span>
            </button>
          </footer>
        </div>
      ) : null}
      <header className="assistant-header">
        <span>
          <Sparkles size={22} />
        </span>
        <div>
          <h1 id="nova-title">Nova</h1>
        </div>
        <div className="nova-header-actions">
          <label className="nova-mode-select" title="Nova response depth">
            <Gauge size={13} aria-hidden="true" />
            <select
              aria-label="Nova response mode"
              value={responseMode}
              onChange={(event) => setResponseMode(event.target.value as NovaResponseMode)}
            >
              <option value="quick">Quick</option>
              <option value="deep">Deep</option>
            </select>
          </label>
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
          <i
            className={`nova-agent-status ${listening || transcribing || speaking ? 'is-working' : ''}`}
          >
            <span aria-hidden="true" />
            {listening
              ? 'Listening'
              : transcribing
                ? 'Understanding'
                : speaking
                  ? 'Nova speaking'
                  : voice.enabled
                    ? 'Hey Nova · ready'
                    : 'Nova connected'}
          </i>
          <button type="button" onClick={resetConversation} title="Start a new conversation">
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              endVoiceSession();
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
            ['knowledge', Brain, 'Knowledge'],
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
                    {message.insight ? <FinanceInsightCard insight={message.insight} /> : null}
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
                    {message.role === 'assistant' && message.id !== 'welcome' ? (
                      <div className="nova-answer-meta" aria-label="Answer confidence">
                        {message.insight ? <span>Workspace data</span> : null}
                        {sourceConfidence(message.sources ?? []) ? (
                          <span>{sourceConfidence(message.sources ?? [])}</span>
                        ) : null}
                        {message.model ? (
                          <span>{message.model === 'smart' ? 'Smart model' : 'Fast model'}</span>
                        ) : null}
                        {message.mode ? (
                          <span>{message.mode === 'deep' ? 'Deep' : 'Quick'}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {actionReview(message)}
                    {message.id === latestMessage?.id && !busy ? (
                      <div className="nova-follow-ups" aria-label="Suggested follow-up actions">
                        {followUpsFor(message).map((followUp) => (
                          <button
                            type="button"
                            key={followUp.label}
                            onClick={() => startPrompt(followUp.prompt)}
                          >
                            {followUp.label}
                            <ArrowUp size={12} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {message.role === 'assistant' && message.id !== 'welcome' ? (
                      <button
                        type="button"
                        className="assistant-speak-button"
                        onClick={() => {
                          void unlockAudio();
                          void speak(message.text);
                        }}
                      >
                        <Volume2 size={13} /> Hear Nova
                      </button>
                    ) : null}
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
                void unlockAudio();
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
                    if (!busy && input.trim()) {
                      void unlockAudio();
                      void send();
                    }
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
                  className="assistant-mic-button"
                  aria-label="Start Nova voice mode"
                  disabled={busy || transcribing}
                  onClick={beginVoiceSession}
                >
                  <AudioLines size={18} />
                  <span className="assistant-mic-label">Voice mode</span>
                </button>
              ) : null}
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send message"
                onPointerDown={() => void unlockAudio()}
              >
                <ArrowUp size={18} />
              </button>
            </form>
            <small className="assistant-footnote">
              {transcribing
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
            {appliedActions.length ? (
              <section className="nova-action-history">
                <header>
                  <History size={16} />
                  <strong>Recent Nova activity</strong>
                </header>
                {appliedActions.map((message) => (
                  <article key={`history-${message.id}`}>
                    <span>
                      <strong>{message.applyResult || 'Workspace change applied'}</strong>
                      <small>
                        {message.appliedAt
                          ? new Intl.DateTimeFormat('en-GB', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(message.appliedAt))
                          : 'Applied by Nova'}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        startPrompt(
                          `Review this previously applied change and prepare a safe reversal plan. Do not change anything yet: ${message.applyResult || message.text}`,
                        )
                      }
                    >
                      Prepare reversal
                    </button>
                  </article>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'knowledge' ? (
          <div className="nova-panel-view nova-knowledge">
            <div className="nova-panel-intro">
              <Brain size={22} />
              <div>
                <strong>Nova knowledge</strong>
                <p>Save business context Nova should remember across conversations.</p>
              </div>
            </div>
            <label>
              <span>Business memory</span>
              <textarea
                value={memory}
                onChange={(event) => setMemory(event.target.value.slice(0, 4000))}
                placeholder="Example: Preferred payment terms are 50% advance. Use a professional Tamil-English tone for local clients."
                rows={10}
              />
              <small>
                {memory.length.toLocaleString()} / 4,000 characters · Saved automatically
              </small>
            </label>
            <div className="nova-knowledge-cards">
              <span>
                <strong>Built-in company profile</strong>
                <small>
                  Infonits services, public company facts and official website grounding.
                </small>
              </span>
              <span>
                <strong>Live workspace context</strong>
                <small>Current clients, projects, invoices, payments, renewals and tasks.</small>
              </span>
              <span>
                <strong>Internet research</strong>
                <small>Official sources first, with external sources clearly identified.</small>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
