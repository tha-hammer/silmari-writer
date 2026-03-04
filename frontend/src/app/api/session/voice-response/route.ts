/**
 * POST /api/session/voice-response
 *
 * Resource: api-m5g7 (endpoint)
 * Path: 307-process-voice-input-and-progress-session
 *
 * Receives voice response payload (sessionId + transcript),
 * delegates to ProcessVoiceResponseHandler, and returns
 * the updated session and story record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProcessVoiceResponseHandler } from '@/server/request_handlers/ProcessVoiceResponseHandler';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { SessionError } from '@/server/error_definitions/SessionErrors';
import { GenericError } from '@/server/error_definitions/GenericErrors';
import { StoryError } from '@/server/error_definitions/StoryErrors';

export async function POST(request: NextRequest) {
  try {
    const auth = AuthAndValidationFilter.authenticate(request.headers.get('authorization'));

    // 1. Parse request body
    const rawBody = await request.json();

    // 2. Delegate to handler (validates payload + session state + processes)
    const result = await ProcessVoiceResponseHandler.handle(rawBody, auth);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    // Known session errors → use their status code
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    // Known generic errors → use their status code
    if (error instanceof GenericError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    // Completely unexpected errors → 500
    console.error('[session/voice-response] Unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
