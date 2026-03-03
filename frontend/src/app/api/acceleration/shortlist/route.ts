import { NextRequest, NextResponse } from 'next/server';
import { ShortlistRequestSchema } from '@/api_contracts/acceleration/shortlistContracts';
import { VoiceUxError, VoiceUxErrors } from '@/server/error_definitions/VoiceUxErrors';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { isVoiceUxFeatureEnabled } from '@/server/settings/voiceUxFeatureFlags';
import { AccelerationService } from '@/server/services/AccelerationService';
import { StoryError } from '@/server/error_definitions/StoryErrors';

export async function POST(request: NextRequest) {
  try {
    if (!isVoiceUxFeatureEnabled('voiceUx343')) {
      throw VoiceUxErrors.featureDisabled('voiceUx343');
    }

    const authHeader = request.headers.get('authorization');
    const auth = AuthAndValidationFilter.authenticate(authHeader);

    const body = await request.json().catch(() => {
      throw VoiceUxErrors.invalidRequest('Invalid JSON payload');
    });

    const parsed = ShortlistRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw VoiceUxErrors.invalidRequest(
        `Request validation failed: ${parsed.error.issues.map(issue => issue.message).join(', ')}`,
      );
    }

    if (parsed.data.action === 'generate') {
      const generated = await AccelerationService.generateShortlist({
        userId: auth.userId,
        baselineId: parsed.data.baselineId,
        timeoutMs: parsed.data.timeoutMs,
        simulateDelayMs: parsed.data.simulateDelayMs,
        signal: request.signal,
      });

      return NextResponse.json(generated, { status: 200 });
    }

    const saved = await AccelerationService.saveShortlist({
      userId: auth.userId,
      shortlistId: parsed.data.shortlistId,
      items: parsed.data.items ?? [],
    });

    return NextResponse.json(saved, { status: 200 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    if (error instanceof VoiceUxError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Unexpected internal error' },
      { status: 500 },
    );
  }
}
