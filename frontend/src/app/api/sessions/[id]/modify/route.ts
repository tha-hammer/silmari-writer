/**
 * POST /api/sessions/[id]/modify
 *
 * Resource: api-m5g7 (endpoint)
 * Path: 309-reject-modifications-to-finalized-session
 *
 * Validates request body shape via Zod, then delegates to
 * ModifySessionRequestHandler for session modification flow:
 * handler → service → verifier → response.
 *
 * Returns 409 with SESSION_ALREADY_FINALIZED when modification is rejected.
 * Returns 400 with INVALID_REQUEST for malformed request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ModifySessionRequestHandler } from '@/server/request_handlers/ModifySessionRequestHandler';
import { SessionError } from '@/server/error_definitions/SessionErrors';

// ---------------------------------------------------------------------------
// Request Schema
// ---------------------------------------------------------------------------

const ModifySessionBodySchema = z.object({
  sessionId: z.string().min(1),
  action: z.enum(['ADD_VOICE', 'FINALIZE']),
});

export type ModifySessionCommand = z.infer<typeof ModifySessionBodySchema>;

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;

    // Validate request body
    const body = await request.json();
    const parsed = ModifySessionBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'INVALID_REQUEST',
          message: `Invalid request body: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Delegate to handler
    const result = await ModifySessionRequestHandler.handle(sessionId, parsed.data.action);

    if (!result.success) {
      return NextResponse.json(
        { code: result.error.code, message: result.error.message },
        { status: result.error.statusCode },
      );
    }

    return NextResponse.json(result.record, { status: 200 });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    console.error('[sessions/modify] Unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
