import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests, VoiceUxMemoryStore } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { POST } from '../route';

describe('POST /api/linkedin/drafts', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_344 = 'true';
  });

  it('returns manual-post-only linkedin draft response', async () => {
    const token = 'linkedin1';
    const userId = `user-${token.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(userId, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const request = new NextRequest('http://localhost:3000/api/linkedin/drafts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ shortlistId: shortlist.id, companyId: 'company-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.draft.manualPostOnly).toBe(true);
    expect(data.manualPostReminder).toMatch(/manual post only/i);
  });

  it('denies cross-user linkedin draft generation access', async () => {
    const userAToken = 'alpha3333';
    const userA = `user-${userAToken.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(userA, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const request = new NextRequest('http://localhost:3000/api/linkedin/drafts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer beta4444',
      },
      body: JSON.stringify({ shortlistId: shortlist.id, companyId: 'company-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });
});
