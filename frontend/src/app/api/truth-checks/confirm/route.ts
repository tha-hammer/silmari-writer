/**
 * POST /api/truth-checks/confirm
 *
 * Resource: api-m5g7 (endpoint)
 * Path: 297-confirm-metric-claim-truth-check
 *
 * Validates the request body and delegates to ConfirmTruthCheckHandler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConfirmTruthCheckHandler } from '@/server/request_handlers/ConfirmTruthCheckHandler';
import { TruthCheckError } from '@/server/error_definitions/TruthCheckErrors';
import { z } from 'zod';

/**
 * Zod schema for validating the request body.
 */
const ConfirmTruthCheckRequestSchema = z.object({
  claim_id: z.string().min(1, 'claim_id is required'),
  status: z.enum(['confirmed', 'denied'], {
    error: 'status must be "confirmed" or "denied"',
  }),
  source: z.string().min(1, 'source is required'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate body
    const rawBody = await request.json();
    const validation = ConfirmTruthCheckRequestSchema.safeParse(rawBody);

    if (!validation.success) {
      const details = validation.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return NextResponse.json(
        { code: 'TRUTH_CHECK_VALIDATION_ERROR', message: `Invalid request: ${details}` },
        { status: 400 },
      );
    }

    // 2. Handle request → service → DAO
    const result = await ConfirmTruthCheckHandler.handle(validation.data);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof TruthCheckError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    console.error('[truth-checks/confirm] Unexpected error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}
