/**
 * submitVoiceResponse - Typed API contract for the voice response submission endpoint.
 *
 * Resource: api-q7v1 (frontend_api_contract)
 * Path: 307-process-voice-input-and-progress-session
 *
 * Sends a POST request with session ID and transcript to the backend
 * for processing and session progression.
 */

import { z } from 'zod';
import { AnswerSessionSchema, AnswerStoryRecordSchema } from '@/server/data_structures/AnswerSession';

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

export const SubmitVoiceResponseRequestSchema = z.object({
  sessionId: z.string().uuid('sessionId must be a valid UUID'),
  transcript: z.string().min(1, 'transcript must be non-empty'),
});

export type SubmitVoiceResponseRequest = z.infer<typeof SubmitVoiceResponseRequestSchema>;

// ---------------------------------------------------------------------------
// Response Schema
// ---------------------------------------------------------------------------

export const SubmitVoiceResponseResponseSchema = z.object({
  session: AnswerSessionSchema,
  storyRecord: AnswerStoryRecordSchema,
});

export type SubmitVoiceResponseResponse = z.infer<typeof SubmitVoiceResponseResponseSchema>;

// ---------------------------------------------------------------------------
// API Function
// ---------------------------------------------------------------------------

function resolveClientAuthToken(): string | null {
  try {
    const maybeStorage = (globalThis as { localStorage?: { getItem?: (...args: [string]) => string | null } })
      .localStorage;
    const persistedToken = maybeStorage?.getItem?.('authToken')?.trim();
    if (persistedToken && persistedToken.length > 0) {
      return persistedToken;
    }
  } catch {
    // Ignore storage access issues and fall back to development token.
  }

  return 'dev-session-token';
}

/**
 * Typed function that submits a voice response for processing.
 * Validates response via Zod schema.
 */
export async function submitVoiceResponse(
  payload: SubmitVoiceResponseRequest,
): Promise<SubmitVoiceResponseResponse> {
  const authToken = resolveClientAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch('/api/session/voice-response', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));

    // Map specific HTTP status codes to SharedErrors
    if (response.status === 401) {
      throw new Error(errorBody.message || 'Authentication required');
    }

    throw new Error(
      errorBody.message || `Voice response submission failed with status ${response.status}`,
    );
  }

  const data = await response.json();
  const parsed = SubmitVoiceResponseResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      `Invalid response from session/voice-response: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  return parsed.data;
}
