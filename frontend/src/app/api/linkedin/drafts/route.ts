import { NextRequest, NextResponse } from 'next/server';
import { LinkedinDraftRequestSchema } from '@/api_contracts/linkedin/draftsContracts';
import { VoiceUxError, VoiceUxErrors } from '@/server/error_definitions/VoiceUxErrors';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { isVoiceUxFeatureEnabled } from '@/server/settings/voiceUxFeatureFlags';
import { AccelerationService } from '@/server/services/AccelerationService';
import { StoryError } from '@/server/error_definitions/StoryErrors';

export async function POST(request: NextRequest) {
  try {
    if (!isVoiceUxFeatureEnabled('voiceUx344')) {
      throw VoiceUxErrors.featureDisabled('voiceUx344');
    }

    const authHeader = request.headers.get('authorization');
    const auth = AuthAndValidationFilter.authenticate(authHeader);

    const body = await request.json().catch(() => {
      throw VoiceUxErrors.invalidRequest('Invalid JSON payload');
    });

    const parsed = LinkedinDraftRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw VoiceUxErrors.invalidRequest(
        `Request validation failed: ${parsed.error.issues.map(issue => issue.message).join(', ')}`,
      );
    }

    const result = await AccelerationService.generateLinkedinDraft({
      userId: auth.userId,
      shortlistId: parsed.data.shortlistId,
      companyId: parsed.data.companyId,
      contributionAreaId: parsed.data.contributionAreaId,
      timeoutMs: parsed.data.timeoutMs,
      simulateDelayMs: parsed.data.simulateDelayMs,
      signal: request.signal,
    });

    return NextResponse.json(result, { status: 200 });
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
