/**
 * AnswerSession - Zod schema and TypeScript types for the voice-assisted
 * Answer Session entity with INIT and IN_PROGRESS states.
 *
 * Resource: db-f8n5 (data_structure)
 * Paths:
 *   - 306-initiate-voice-assisted-answer-session
 *   - 307-process-voice-input-and-progress-session
 *   - 318-complete-voice-answer-advances-workflow
 *
 * An AnswerSession represents a user's voice-assisted answer session.
 * Created in INIT state, transitions to IN_PROGRESS when voice input is processed.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// AnswerSession State Enum
// ---------------------------------------------------------------------------

export const AnswerSessionState = {
  INIT: 'INIT',
  IN_PROGRESS: 'IN_PROGRESS',
  RECALL: 'RECALL',
  COMPLETE: 'COMPLETE',
  VERIFY: 'VERIFY',
} as const;

export type AnswerSessionState = (typeof AnswerSessionState)[keyof typeof AnswerSessionState];

// ---------------------------------------------------------------------------
// Valid State Transitions
// ---------------------------------------------------------------------------

export const VALID_STATE_TRANSITIONS: Record<AnswerSessionState, AnswerSessionState[]> = {
  INIT: ['IN_PROGRESS'],
  IN_PROGRESS: ['RECALL'],
  RECALL: ['COMPLETE'],
  COMPLETE: ['VERIFY'],
  VERIFY: [],
};

// ---------------------------------------------------------------------------
// AnswerSession Zod Schema
// ---------------------------------------------------------------------------

export const AnswerSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  state: z.enum(['INIT', 'IN_PROGRESS', 'RECALL', 'COMPLETE', 'VERIFY']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AnswerSession = z.infer<typeof AnswerSessionSchema>;

// ---------------------------------------------------------------------------
// AnswerStoryRecord Zod Schema
// ---------------------------------------------------------------------------

export const AnswerStoryRecordSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  questionId: z.string().uuid().nullable().optional(),
  status: z.enum(['INIT', 'IN_PROGRESS', 'RECALL', 'COMPLETE', 'VERIFY']),
  content: z.string().optional(),
  responses: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AnswerStoryRecord = z.infer<typeof AnswerStoryRecordSchema>;

// ---------------------------------------------------------------------------
// SessionWithStoryRecord - Aggregated response from session progression
// Path: 307-process-voice-input-and-progress-session
// ---------------------------------------------------------------------------

export const SessionWithStoryRecordSchema = z.object({
  session: AnswerSessionSchema,
  storyRecord: AnswerStoryRecordSchema,
});

export type SessionWithStoryRecord = z.infer<typeof SessionWithStoryRecordSchema>;

// ---------------------------------------------------------------------------
// Session Initialization Result
// ---------------------------------------------------------------------------

export const SessionInitializationResultSchema = z.object({
  sessionId: z.string().uuid(),
  storyRecordId: z.string().uuid(),
  state: z.literal('INIT'),
});

export type SessionInitializationResult = z.infer<typeof SessionInitializationResultSchema>;

// ---------------------------------------------------------------------------
// CreateSession Request Schema
// ---------------------------------------------------------------------------

export const CreateSessionRequestSchema = z.object({
  // No additional payload required; userId is extracted from auth context
});

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

// ---------------------------------------------------------------------------
// CreateSession Response Schema
// ---------------------------------------------------------------------------

export const CreateSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  state: z.literal('INIT'),
});

export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;
