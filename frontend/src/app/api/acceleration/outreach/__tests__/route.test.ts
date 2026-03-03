import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests, VoiceUxMemoryStore } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { AccelerationService } from '@/server/services/AccelerationService';
import { POST } from '../route';

describe('POST /api/acceleration/outreach', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_343 = 'true';
  });

  it('returns completed outreach draft for selected company', async () => {
    const token = 'outreach1';
    const userId = `user-${token.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(userId, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const request = new NextRequest('http://localhost:3000/api/acceleration/outreach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shortlistId: shortlist.id,
        companyId: 'company-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.draft.status).toBe('completed');
    expect(typeof data.draft.content).toBe('string');
  });

  it('returns degraded timeout response while preserving existing draft context', async () => {
    const token = 'outreach2';
    const userId = `user-${token.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(userId, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const seeded = await AccelerationService.generateOutreachDraft({
      userId,
      shortlistId: shortlist.id,
      companyId: 'company-1',
      timeoutMs: 1000,
      simulateDelayMs: 0,
    });
    expect(seeded.draft).not.toBeNull();

    const request = new NextRequest('http://localhost:3000/api/acceleration/outreach', {
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
    expect(data.draft).not.toBeNull();
    expect(data.draft.content).toBe(seeded.draft!.content);
  });
});
