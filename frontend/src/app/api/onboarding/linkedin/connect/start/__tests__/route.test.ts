import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { POST } from '../route';

describe('POST /api/onboarding/linkedin/connect/start', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_342 = 'true';
  });

  it('returns oauth authorization URL with state and nonce', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding/linkedin/connect/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer oauth-start-1',
      },
      body: JSON.stringify({ redirectUri: 'https://app.example.com/callback' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.authorizationUrl).toContain('linkedin.com/oauth');
    expect(data.state).toBeTruthy();
    expect(data.nonce).toBeTruthy();
  });
});
