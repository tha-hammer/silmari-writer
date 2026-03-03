import { NextRequest, NextResponse } from 'next/server';
import { LinkedinConnectCallbackRequestSchema } from '@/api_contracts/onboarding/linkedinContracts';
import { VoiceUxError, VoiceUxErrors } from '@/server/error_definitions/VoiceUxErrors';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { isVoiceUxFeatureEnabled } from '@/server/settings/voiceUxFeatureFlags';
import { LinkedinOnboardingService } from '@/server/services/LinkedinOnboardingService';
import { StoryError } from '@/server/error_definitions/StoryErrors';

async function handleCallback(body: unknown, authHeader: string | null) {
  if (!isVoiceUxFeatureEnabled('voiceUx342')) {
    throw VoiceUxErrors.featureDisabled('voiceUx342');
  }

  const auth = AuthAndValidationFilter.authenticate(authHeader);

  const parsed = LinkedinConnectCallbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw VoiceUxErrors.invalidRequest(
      `Request validation failed: ${parsed.error.issues.map(issue => issue.message).join(', ')}`,
    );
  }

  const result = await LinkedinOnboardingService.completeOauthConnect({
    userId: auth.userId,
    state: parsed.data.state,
    nonce: parsed.data.nonce,
    code: parsed.data.code,
  });

  return result;
}

function errorResponse(error: unknown) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => {
      throw VoiceUxErrors.invalidRequest('Invalid JSON payload');
    });

    const result = await handleCallback(body, request.headers.get('authorization'));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const body = {
      state: request.nextUrl.searchParams.get('state') ?? '',
      nonce: request.nextUrl.searchParams.get('nonce') ?? '',
      code: request.nextUrl.searchParams.get('code') ?? '',
    };

    const result = await handleCallback(body, request.headers.get('authorization'));
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
