import { z } from 'zod';

export const SessionVoiceTurnsResponseSchema = z.object({
  sessionId: z.string().uuid(),
  workingAnswer: z.string(),
  turns: z.array(z.string()),
});

export type SessionVoiceTurnsResponse = z.infer<typeof SessionVoiceTurnsResponseSchema>;

const SessionVoiceTurnsRequestSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(['update_working_answer', 'reset_turns']),
  content: z.string().optional(),
});

interface VoiceTurnsRequest {
  sessionId: string;
  action: 'update_working_answer' | 'reset_turns';
  content?: string;
}

async function fetchVoiceTurns(
  endpoint: string,
  init?: RequestInit,
): Promise<SessionVoiceTurnsResponse> {
  const response = await fetch(endpoint, init);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Voice turns request failed with status ${response.status}`);
  }

  const data = await response.json();
  const parsed = SessionVoiceTurnsResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      `Invalid voice turns response: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }

  return parsed.data;
}

export async function getSessionVoiceTurns(sessionId: string): Promise<SessionVoiceTurnsResponse> {
  return fetchVoiceTurns(`/api/session/voice-turns?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function updateSessionWorkingAnswer(
  sessionId: string,
  content: string,
): Promise<SessionVoiceTurnsResponse> {
  const payload: VoiceTurnsRequest = {
    sessionId,
    action: 'update_working_answer',
    content,
  };

  const validated = SessionVoiceTurnsRequestSchema.safeParse(payload);
  if (!validated.success) {
    throw new Error(
      validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', '),
    );
  }

  return fetchVoiceTurns('/api/session/voice-turns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated.data),
  });
}

export async function resetSessionVoiceTurns(sessionId: string): Promise<SessionVoiceTurnsResponse> {
  const payload: VoiceTurnsRequest = {
    sessionId,
    action: 'reset_turns',
  };

  const validated = SessionVoiceTurnsRequestSchema.safeParse(payload);
  if (!validated.success) {
    throw new Error(
      validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', '),
    );
  }

  return fetchVoiceTurns('/api/session/voice-turns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated.data),
  });
}
