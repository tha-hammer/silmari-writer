import { z } from 'zod';
import {
  DEFAULT_RECALL_QUESTIONS,
  initializeQuestionProgress,
  QuestionProgressStateSchema,
  type QuestionProgressState,
} from '@/lib/recallQuestions';

export const SessionVoiceTurnsSourceSchema = z.enum(['answer_session', 'session']);
export type SessionVoiceTurnsSource = z.infer<typeof SessionVoiceTurnsSourceSchema>;

export const SessionVoiceTurnsResponseSchema = z.object({
  sessionId: z.string().uuid(),
  sessionSource: SessionVoiceTurnsSourceSchema,
  workingAnswer: z.string(),
  turns: z.array(z.string()),
  questionProgress: QuestionProgressStateSchema.optional(),
});

type SessionVoiceTurnsResponseRaw = z.infer<typeof SessionVoiceTurnsResponseSchema>;

export interface SessionVoiceTurnsResponse {
  sessionId: string;
  sessionSource: SessionVoiceTurnsSource;
  workingAnswer: string;
  turns: string[];
  questionProgress: QuestionProgressState;
}

const UpdateWorkingAnswerRequestSchema = z.object({
  sessionId: z.string().uuid(),
  sessionSource: SessionVoiceTurnsSourceSchema,
  action: z.literal('update_working_answer'),
  content: z.string(),
});

const ResetTurnsRequestSchema = z.object({
  sessionId: z.string().uuid(),
  sessionSource: SessionVoiceTurnsSourceSchema,
  action: z.literal('reset_turns'),
});

const AdvanceQuestionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  sessionSource: SessionVoiceTurnsSourceSchema,
  action: z.literal('advance_question'),
});

const SessionVoiceTurnsRequestSchema = z.discriminatedUnion('action', [
  UpdateWorkingAnswerRequestSchema,
  ResetTurnsRequestSchema,
  AdvanceQuestionRequestSchema,
]);

interface VoiceTurnsRequest {
  sessionId: string;
  sessionSource: SessionVoiceTurnsSource;
  action: 'update_working_answer' | 'reset_turns' | 'advance_question';
  content?: string;
}

function withDefaultQuestionProgress(
  response: SessionVoiceTurnsResponseRaw,
): SessionVoiceTurnsResponse {
  const fallbackQuestionProgress = initializeQuestionProgress(DEFAULT_RECALL_QUESTIONS);
  return {
    sessionId: response.sessionId,
    sessionSource: response.sessionSource,
    workingAnswer: response.workingAnswer,
    turns: response.turns,
    questionProgress: response.questionProgress ?? fallbackQuestionProgress,
  };
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

  return withDefaultQuestionProgress(parsed.data);
}

export async function getSessionVoiceTurns(
  sessionId: string,
  sessionSource: SessionVoiceTurnsSource,
): Promise<SessionVoiceTurnsResponse> {
  return fetchVoiceTurns(
    `/api/session/voice-turns?sessionId=${encodeURIComponent(sessionId)}&sessionSource=${sessionSource}`,
  );
}

export async function updateSessionWorkingAnswer(
  sessionId: string,
  content: string,
  sessionSource: SessionVoiceTurnsSource,
): Promise<SessionVoiceTurnsResponse> {
  const payload: VoiceTurnsRequest = {
    sessionId,
    sessionSource,
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

export async function resetSessionVoiceTurns(
  sessionId: string,
  sessionSource: SessionVoiceTurnsSource,
): Promise<SessionVoiceTurnsResponse> {
  const payload: VoiceTurnsRequest = {
    sessionId,
    sessionSource,
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

export async function advanceSessionQuestion(
  sessionId: string,
  sessionSource: SessionVoiceTurnsSource,
): Promise<SessionVoiceTurnsResponse> {
  const payload: VoiceTurnsRequest = {
    sessionId,
    sessionSource,
    action: 'advance_question',
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
