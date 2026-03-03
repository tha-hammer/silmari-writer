import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { SessionError } from '@/server/error_definitions/SessionErrors';

const SessionIdSchema = z.string().uuid();

const ACTION_PATTERNS = [
  /\bi\s+(led|built|implemented|designed|launched|created|improved|drove|delivered|reduced|increased|shipped)\b/gi,
  /\b(actions?|steps?)\b/gi,
];

const OUTCOME_PATTERNS = [
  /\b(result|outcome|impact|improved|reduced|increased|saved|grew)\b/gi,
  /\b\d+(?:\.\d+)?%\b/g,
  /\b\d+\b\s*(users|customers|ms|seconds|minutes|hours|days|months|years|dollars|k|m|million|billion)\b/gi,
];

const ANCHOR_PATTERNS = [
  /\b(context|situation|challenge|problem|objective|goal|scope|team|company|role)\b/gi,
  /\bwhen\s+i\s+(joined|started|was|worked)\b/gi,
];

function countPatternHits(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    return total + (matches?.length ?? 0);
  }, 0);
}

function computeRecallProgress(corpus: string) {
  const trimmed = corpus.trim();

  if (trimmed.length === 0) {
    return {
      anchors: 0,
      actions: 0,
      outcomes: 0,
      incompleteSlots: ['anchors', 'actions', 'outcomes'] as Array<'anchors' | 'actions' | 'outcomes'>,
    };
  }

  const anchors = Math.max(1, countPatternHits(trimmed, ANCHOR_PATTERNS));
  const actions = Math.max(1, countPatternHits(trimmed, ACTION_PATTERNS));
  const outcomes = Math.max(1, countPatternHits(trimmed, OUTCOME_PATTERNS));

  const incompleteSlots: Array<'anchors' | 'actions' | 'outcomes'> = [];
  if (anchors <= 0) incompleteSlots.push('anchors');
  if (actions <= 0) incompleteSlots.push('actions');
  if (outcomes <= 0) incompleteSlots.push('outcomes');

  return { anchors, actions, outcomes, incompleteSlots };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionIdParam = url.searchParams.get('sessionId');
  const parsedSessionId = SessionIdSchema.safeParse(sessionIdParam);

  if (!parsedSessionId.success) {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'sessionId must be a valid UUID' },
      { status: 400 },
    );
  }

  try {
    const sessionId = parsedSessionId.data;
    const storyRecord = await SessionDAO.findStoryRecordBySessionId(sessionId);

    if (!storyRecord) {
      return NextResponse.json(
        {
          anchors: 0,
          actions: 0,
          outcomes: 0,
          incompleteSlots: ['anchors', 'actions', 'outcomes'],
        },
        { status: 200 },
      );
    }

    const responsesText = Array.isArray(storyRecord.responses)
      ? storyRecord.responses.join('\n')
      : '';
    const corpus = [storyRecord.content ?? '', responsesText]
      .filter((part) => part.trim().length > 0)
      .join('\n');

    return NextResponse.json(computeRecallProgress(corpus), { status: 200 });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    console.error('[recall/progress] Unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
