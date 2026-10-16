import { z } from 'zod';
import { authorize } from '@/lib/supabase/server';

const requestSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
});

const defaultVoiceId = 'JBFqnCBsd6RMkjVDRZzb';

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    ) {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    }
    if (Number(request.headers.get('content-length') ?? 0) > 10_000) {
      return Response.json({ error: 'Request too large.' }, { status: 413 });
    }

    await authorize();

    const apiKey = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'ElevenLabs is not configured.' }, { status: 503 });
    }

    const input = requestSchema.parse(await request.json());
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || defaultVoiceId;
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_22050_32&optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: input.text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      console.error('ElevenLabs speech request failed', response.status);
      return Response.json({ error: 'Nova voice is temporarily unavailable.' }, { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      },
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? 'The speech request was invalid.'
        : error instanceof Error && error.name === 'TimeoutError'
          ? 'Nova voice timed out.'
          : 'Nova voice is temporarily unavailable.';
    return Response.json({ error: message }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
