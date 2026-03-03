import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetVoiceUxMemoryStoreForTests, VoiceUxMemoryStore } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { POST } from '../route';

describe('POST /api/acceleration/contacts', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    process.env.VOICE_UX_343 = 'true';
  });

  it('returns contacts for authenticated user and selected company', async () => {
    const token = 'contacts1';
    const userId = `user-${token.substring(0, 8)}`;

    const shortlist = VoiceUxMemoryStore.saveShortlist(userId, [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);

    const request = new NextRequest('http://localhost:3000/api/acceleration/contacts', {
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
    expect(data.companyId).toBe('company-1');
    expect(Array.isArray(data.contacts)).toBe(true);
    expect(data.contacts.length).toBeGreaterThan(0);
  });

  it('returns 401 when auth header is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/acceleration/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortlistId: crypto.randomUUID(), companyId: 'company-1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
