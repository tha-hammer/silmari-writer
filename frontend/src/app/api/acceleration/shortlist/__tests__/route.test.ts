import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests, VoiceUxMemoryStore } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { POST } from '../route';

describe('POST /api/acceleration/shortlist', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_343 = 'true';
  });

  it('generates shortlist for authenticated user with baseline', async () => {
    const token = 'shortlistA1';
    const userId = `user-${token.substring(0, 8)}`;

    const baseline = VoiceUxMemoryStore.saveBaseline(userId, 'manual', {
      headline: 'Staff Engineer',
      summary: 'Platform + reliability',
      positions: ['Engineer'],
    });

    const request = new NextRequest('http://localhost:3000/api/acceleration/shortlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'generate', baselineId: baseline.id }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.generated).toBe(true);
    expect(data.saved).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('denies cross-user shortlist save attempts', async () => {
    const tokenA = 'alpha1111';
    const tokenB = 'beta2222';

    const requestA = new NextRequest('http://localhost:3000/api/acceleration/shortlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        action: 'save',
        items: [{ companyId: 'c1', companyName: 'Acme', rank: 1 }],
      }),
    });

    const responseA = await POST(requestA);
    const dataA = await responseA.json();

    const requestB = new NextRequest('http://localhost:3000/api/acceleration/shortlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        action: 'save',
        shortlistId: dataA.shortlistId,
        items: [{ companyId: 'c2', companyName: 'Other', rank: 1 }],
      }),
    });

    const responseB = await POST(requestB);
    const dataB = await responseB.json();

    expect(responseB.status).toBe(403);
    expect(dataB.code).toBe('FORBIDDEN');
  });

  it('returns 401 when auth header is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/acceleration/shortlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'generate' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
