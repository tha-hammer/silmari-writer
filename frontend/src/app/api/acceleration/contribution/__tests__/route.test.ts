import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests, VoiceUxMemoryStore } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { POST } from '../route';

describe('POST /api/acceleration/contribution', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_343 = 'true';
  });

  it('denies cross-user company contribution access', async () => {
    const tokenA = 'contribA1';
    const tokenB = 'contribB1';
    const userA = `user-${tokenA.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(userA, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const request = new NextRequest('http://localhost:3000/api/acceleration/contribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ shortlistId: shortlist.id, companyId: 'company-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('returns degraded timeout response and preserves shape', async () => {
    const token = 'contribC1';
    const user = `user-${token.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(user, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const request = new NextRequest('http://localhost:3000/api/acceleration/contribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shortlistId: shortlist.id,
        companyId: 'company-1',
        timeoutMs: 10,
        simulateDelayMs: 150,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.degraded).toBe(true);
    expect(data.reason).toBe('timeout');
    expect(Array.isArray(data.contributionAreas)).toBe(true);
  });
});
