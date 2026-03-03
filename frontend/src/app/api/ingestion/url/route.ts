import { NextRequest, NextResponse } from 'next/server';
import {
  StartSessionFromUrlRequestSchema,
  StartSessionFromUrlResponseSchema,
} from '@/api_contracts/startSessionFromUrl';
import { ChannelIngestionPipelineAdapter } from '@/server/services/ChannelIngestionPipelineAdapter';
import { ChannelIngestionService } from '@/server/services/ChannelIngestionService';
import {
  ChannelIngestionError,
} from '@/server/error_definitions/ChannelIngestionErrors';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { StoryError } from '@/server/error_definitions/StoryErrors';
import { VoiceUxError, VoiceUxErrors } from '@/server/error_definitions/VoiceUxErrors';
import { isVoiceUxFeatureEnabled } from '@/server/settings/voiceUxFeatureFlags';

export async function POST(request: NextRequest) {
  try {
    if (!isVoiceUxFeatureEnabled('voiceUx340')) {
      throw VoiceUxErrors.featureDisabled('voiceUx340');
    }

    const authHeader = request.headers.get('authorization');
    const auth = AuthAndValidationFilter.authenticate(authHeader);

    const body = await request.json().catch(() => {
      throw VoiceUxErrors.invalidRequest('Invalid JSON payload');
    });

    const parsed = StartSessionFromUrlRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw VoiceUxErrors.invalidRequest(
        `Request validation failed: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
      );
    }

    const canonicalUrl = ChannelIngestionService.extractCanonicalUrl(
      parsed.data.sourceUrl,
      auth.userId,
    );

    const initialized = await ChannelIngestionPipelineAdapter.initializeFromUrl({
      userId: auth.userId,
      sourceUrl: canonicalUrl,
      channel: 'direct',
    });

    const responsePayload = {
      sessionId: initialized.id,
      state: initialized.state,
      canonicalUrl,
      contextSummary: initialized.contextSummary,
    };

    const responseValidation = StartSessionFromUrlResponseSchema.safeParse(responsePayload);
    if (!responseValidation.success) {
      throw VoiceUxErrors.internal('Failed to construct valid response');
    }

    return NextResponse.json(responseValidation.data, { status: 200 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    if (error instanceof VoiceUxError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          ...(error.details ?? {}),
        },
        { status: error.statusCode },
      );
    }

    if (error instanceof ChannelIngestionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Unexpected internal error' },
      { status: 500 },
    );
  }
}
