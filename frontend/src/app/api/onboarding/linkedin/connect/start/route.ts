import { NextRequest, NextResponse } from 'next/server';
import { LinkedinConnectStartRequestSchema } from '@/api_contracts/onboarding/linkedinContracts';
import { VoiceUxError, VoiceUxErrors } from '@/server/error_definitions/VoiceUxErrors';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { isVoiceUxFeatureEnabled } from '@/server/settings/voiceUxFeatureFlags';
import { LinkedinOnboardingService } from '@/server/services/LinkedinOnboardingService';
import { StoryError } from '@/server/error_definitions/StoryErrors';

export async function POST(request: NextRequest) {
  try {
    if (!isVoiceUxFeatureEnabled('voiceUx342')) {
      throw VoiceUxErrors.featureDisabled('voiceUx342');
    }

    const authHeader = request.headers.get('authorization');
    const auth = AuthAndValidationFilter.authenticate(authHeader);

    const body = await request.json().catch(() => {
      throw VoiceUxErrors.invalidRequest('Invalid JSON payload');
    });

    const parsed = LinkedinConnectStartRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw VoiceUxErrors.invalidRequest(
        `Request validation failed: ${parsed.error.issues.map(issue => issue.message).join(', ')}`,
      );
    }

    const result = await LinkedinOnboardingService.startOauthConnect(
      auth.userId,
      parsed.data.redirectUri,
    );

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
