import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { POST } from '../route';

describe('POST /api/onboarding/linkedin/parse', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_342 = 'true';
  });

  it('persists URL mode baseline for authenticated user', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding/linkedin/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-url-1',
      },
      body: JSON.stringify({
        mode: 'url',
        url: 'https://www.linkedin.com/in/test-user',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mode).toBe('url');
    expect(data.profile.sourceUrl).toContain('linkedin.com');
  });

  it('returns 401 when auth header is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding/linkedin/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'skip' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });
});
