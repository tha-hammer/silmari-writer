import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NewPathEventSchemas, type NewPathEventName } from '@/server/data_structures/NewPathEvents';
import { newPathEventLogger } from '@/server/logging/newPathEventLogger';
import { logger } from '@/server/logging/logger';

const EVENT_NAMES = Object.keys(NewPathEventSchemas) as [NewPathEventName, ...NewPathEventName[]];
const PATH = '345-interstitial-overlay-orchestration';
const RESOURCE = 'cfg-r3d7';

const TelemetryEnvelopeSchema = z.object({
  event_name: z.enum(EVENT_NAMES),
  payload: z.unknown(),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Request body must be valid JSON' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const parsedEnvelope = TelemetryEnvelopeSchema.safeParse(rawBody);

    if (!parsedEnvelope.success) {
      return NextResponse.json(
        {
          code: 'INVALID_REQUEST',
          message: parsedEnvelope.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const { event_name: eventName, payload } = parsedEnvelope.data;

    const validatedPayload = newPathEventLogger.validate(eventName, payload);
    const emitResult = await newPathEventLogger.emit(eventName, validatedPayload);

    return NextResponse.json(
      {
        accepted: true,
        event_name: eventName,
        persisted: emitResult.ok,
      },
      { status: 202, headers: CORS_HEADERS },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: 'INVALID_EVENT_PAYLOAD',
          message: error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    logger.error('Unexpected new-path telemetry route error', error, {
      path: PATH,
      resource: RESOURCE,
    });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
