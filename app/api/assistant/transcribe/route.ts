import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const transcriptSchema = z.object({
  text: z.string().trim().min(1),
});

const languageCodes = {
  en: 'eng',
  ta: 'tam',
} as const;

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    }
    if (Number(request.headers.get('content-length') ?? 0) > 15_000_000) {
      return Response.json({ error: 'Voice recording is too large.' }, { status: 413 });
    }

    await authorize();

    const apiKey = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'ElevenLabs is not configured.' }, { status: 503 });
    }

    const input = await request.formData();
    const file = input.get('file');
    const language = input.get('language');
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: 'No voice recording was received.' }, { status: 400 });
    }
    if (file.size > 15_000_000) {
      return Response.json({ error: 'Voice recording is too large.' }, { status: 413 });
    }

    const body = new FormData();
    body.append('file', file, file.name || 'nova-voice.webm');
    body.append('model_id', 'scribe_v2');
    if (language === 'en' || language === 'ta')
      body.append('language_code', languageCodes[language]);

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body,
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      console.error('ElevenLabs transcription request failed', response.status);
      return Response.json({ error: 'Nova could not transcribe that recording.' }, { status: 502 });
    }

    const transcript = transcriptSchema.parse(await response.json());
    return Response.json({ text: transcript.text });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'No speech was detected. Please try again.'
        : error instanceof Error && error.name === 'TimeoutError'
          ? 'Voice transcription timed out. Please try again.'
          : 'Nova could not transcribe that recording.';
    return Response.json({ error: message }, { status: error instanceof z.ZodError ? 422 : 500 });
  }
}
