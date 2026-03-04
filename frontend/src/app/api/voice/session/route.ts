import { NextRequest, NextResponse } from 'next/server';
import { MODEL_MAP, SESSION_LIMIT_MINUTES, DEFAULT_VOICE } from '@/lib/voice-types';
import type { VoiceMode } from '@/lib/voice-types';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice chat not configured' },
      { status: 500 },
    );
  }

  const body = await request.json();
  const mode: VoiceMode = body.mode in MODEL_MAP ? body.mode : 'read_aloud';
  const model = MODEL_MAP[mode];
  const sdp = body.sdp;

  if (!sdp || typeof sdp !== 'string') {
    return NextResponse.json(
      { error: 'Missing SDP offer' },
      { status: 400 },
    );
  }

  // Build session config — transcription is configured via data channel session.update
  const sessionConfig: Record<string, unknown> = {
    type: 'realtime',
    model,
  };

  if (body.instructions) {
    sessionConfig.instructions = body.instructions;
  }
  if (body.tools) {
    sessionConfig.tools = body.tools;
  }

  // Proxy the SDP exchange to OpenAI using our API key
  // See: https://platform.openai.com/docs/api-reference/realtime/create-call
  const formData = new FormData();
  formData.set('sdp', sdp);
  formData.set('session', JSON.stringify(sessionConfig));

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Network error connecting to OpenAI', detail: String(error) },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    return NextResponse.json(
      { error: 'OpenAI rejected the session', detail: errBody },
      { status: response.status },
    );
  }

  // Return the SDP answer from OpenAI
  const answerSdp = await response.text();

  return NextResponse.json({
    sdp: answerSdp,
    model,
    sessionLimitMinutes: SESSION_LIMIT_MINUTES,
  });
}
