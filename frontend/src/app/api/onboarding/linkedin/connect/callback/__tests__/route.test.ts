import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { LinkedinOnboardingService } from '@/server/services/LinkedinOnboardingService';
import { POST } from '../route';

describe('POST /api/onboarding/linkedin/connect/callback', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    LinkedinOnboardingService.resetLinkedInAuthClientForTests();
    process.env.VOICE_UX_342 = 'true';
  });

  it('accepts valid state+nonce callback and does not leak tokens in response', async () => {
    const token = 'oauthuser1234';
    const userId = `user-${token.substring(0, 8)}`;

    const started = await LinkedinOnboardingService.startOauthConnect(
      userId,
      'https://app.example.com/callback',
    );

    const request = new NextRequest('http://localhost:3000/api/onboarding/linkedin/connect/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        state: started.state,
        nonce: started.nonce,
        code: 'valid-code',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.connectionStatus).toBe('connected');
    expect(data.tokenStored).toBe(true);
    expect(JSON.stringify(data)).not.toContain('accessToken');
    expect(JSON.stringify(data)).not.toContain('refreshToken');
  });

  it('rejects callback when state is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding/linkedin/connect/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer oauthuser1234',
      },
      body: JSON.stringify({
        state: 'bad-state',
        nonce: 'nonce',
        code: 'valid-code',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('OAUTH_STATE_MISMATCH');
  });
});
