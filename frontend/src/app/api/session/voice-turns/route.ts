import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { SessionError, SessionErrors } from '@/server/error_definitions/SessionErrors';
import {
  DEFAULT_RECALL_QUESTIONS,
  advanceQuestionProgress,
  initializeQuestionProgress,
  type QuestionProgressState,
} from '@/lib/recallQuestions';

const SessionIdSchema = z.string().uuid();
const SessionSourceSchema = z.enum(['answer_session', 'session']);
const DEFAULT_QUESTION_PROGRESS = initializeQuestionProgress(DEFAULT_RECALL_QUESTIONS);
type SessionSource = z.infer<typeof SessionSourceSchema>;
type StoryRecord = Awaited<ReturnType<typeof SessionDAO.findStoryRecordBySessionId>>;

const PostBodySchema = z.discriminatedUnion('action', [
  z.object({
    sessionId: z.string().uuid(),
    sessionSource: SessionSourceSchema,
    action: z.literal('update_working_answer'),
    content: z.string(),
  }),
  z.object({
    sessionId: z.string().uuid(),
    sessionSource: SessionSourceSchema,
    action: z.literal('reset_turns'),
  }),
  z.object({
    sessionId: z.string().uuid(),
    sessionSource: SessionSourceSchema,
    action: z.literal('advance_question'),
  }),
]);

function buildResponse(
  sessionId: string,
  sessionSource: SessionSource,
  workingAnswer: string,
  turns: string[],
  questionProgress: QuestionProgressState,
) {
  return {
    sessionId,
    sessionSource,
    workingAnswer,
    turns,
    questionProgress,
  };
}

function normalizeStoryRecordData(storyRecord: Awaited<ReturnType<typeof SessionDAO.findStoryRecordBySessionId>>) {
  return {
    workingAnswer: storyRecord?.content ?? '',
    turns: storyRecord?.responses ?? [],
    questionProgress: storyRecord?.questionProgress ?? DEFAULT_QUESTION_PROGRESS,
  };
}

async function resolveStoryRecordBySource(
  sessionId: string,
  sessionSource: SessionSource,
): Promise<StoryRecord> {
  return SessionDAO.findStoryRecordByCanonicalSessionId(sessionId, sessionSource);
}

function ensureDurableWrite(storyRecord: StoryRecord, sessionId: string, sessionSource: SessionSource) {
  if (storyRecord) {
    return;
  }

  throw SessionErrors.PersistenceFailure(
    `Working answer was not durably persisted for session ${sessionId} (source=${sessionSource})`,
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionIdParam = url.searchParams.get('sessionId');
  const sessionSourceParam = url.searchParams.get('sessionSource');
  const parsedSessionId = SessionIdSchema.safeParse(sessionIdParam);
  const parsedSessionSource = SessionSourceSchema.safeParse(sessionSourceParam);

  if (!parsedSessionId.success) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'sessionId must be a valid UUID' },
      { status: 400 },
    );
  }
  if (!parsedSessionSource.success) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'sessionSource must be answer_session or session' },
      { status: 400 },
    );
  }

  try {
    const sessionId = parsedSessionId.data;
    const sessionSource = parsedSessionSource.data;
    const storyRecord = await resolveStoryRecordBySource(sessionId, sessionSource);
    const {
      workingAnswer,
      turns,
      questionProgress,
    } = normalizeStoryRecordData(storyRecord);

    return NextResponse.json(
      buildResponse(sessionId, sessionSource, workingAnswer, turns, questionProgress),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    console.error('[session/voice-turns] Unexpected GET error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsedBody = PostBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          code: 'INVALID_REQUEST',
          message: parsedBody.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
        },
        { status: 400 },
      );
    }

    const body = parsedBody.data;

    if (body.action === 'update_working_answer') {
      const updated = body.sessionSource === 'session'
        ? await SessionDAO.upsertPrepStoryRecordWorkingAnswer(body.sessionId, body.content)
        : await SessionDAO.updateStoryRecordWorkingAnswer(body.sessionId, body.content);
      ensureDurableWrite(updated, body.sessionId, body.sessionSource);
      const { turns, questionProgress } = normalizeStoryRecordData(updated);

      return NextResponse.json(
        buildResponse(body.sessionId, body.sessionSource, body.content, turns, questionProgress),
        { status: 200 },
      );
    }

    if (body.action === 'advance_question') {
      const existingStoryRecord = await resolveStoryRecordBySource(body.sessionId, body.sessionSource);
      const {
        workingAnswer,
        turns,
        questionProgress,
      } = normalizeStoryRecordData(existingStoryRecord);
      const advancedQuestionProgress = advanceQuestionProgress(
        DEFAULT_RECALL_QUESTIONS,
        questionProgress,
      );

      const updatedStoryRecord = await SessionDAO.updateStoryRecordQuestionProgress(
        body.sessionId,
        advancedQuestionProgress,
        body.sessionSource,
      );
      const resolvedQuestionProgress = updatedStoryRecord?.questionProgress ?? advancedQuestionProgress;

      return NextResponse.json(
        buildResponse(
          body.sessionId,
          body.sessionSource,
          workingAnswer,
          turns,
          resolvedQuestionProgress,
        ),
        { status: 200 },
      );
    }

    const resetRecord = await SessionDAO.replaceStoryRecordResponses(
      body.sessionId,
      [],
      body.sessionSource,
    );
    if (!resetRecord) {
      return NextResponse.json(
        buildResponse(body.sessionId, body.sessionSource, '', [], DEFAULT_QUESTION_PROGRESS),
        { status: 200 },
      );
    }

    const updated = await SessionDAO.updateStoryRecordWorkingAnswer(
      body.sessionId,
      '',
      body.sessionSource,
    );
    const { workingAnswer, turns, questionProgress } = normalizeStoryRecordData(updated);

    return NextResponse.json(
      buildResponse(body.sessionId, body.sessionSource, workingAnswer, turns, questionProgress),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    console.error('[session/voice-turns] Unexpected POST error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
