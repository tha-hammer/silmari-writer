import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/data_access_objects/SessionDAO', () => ({
  SessionDAO: {
    findStoryRecordBySessionId: vi.fn(),
  },
}));

import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { GET } from '../route';

const mockSessionDAO = vi.mocked(SessionDAO);

describe('GET /api/recall/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid sessionId', async () => {
    const request = new Request('http://localhost:3000/api/recall/progress?sessionId=bad');
    const response = await GET(request as any);

    expect(response.status).toBe(400);
  });

  it('returns neutral progress when story record does not exist', async () => {
    mockSessionDAO.findStoryRecordBySessionId.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000',
    );
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      anchors: 0,
      actions: 0,
      outcomes: 0,
    });
  });

  it('returns computed progress from persisted recall content', async () => {
    mockSessionDAO.findStoryRecordBySessionId.mockResolvedValue({
      id: 'story-record-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'In this role, I led the migration and improved performance by 40%.',
      responses: ['I implemented retries and reduced errors by 25%.'],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    } as any);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000',
    );
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.anchors).toBeGreaterThan(0);
    expect(body.actions).toBeGreaterThan(0);
    expect(body.outcomes).toBeGreaterThan(0);
    expect(Array.isArray(body.incompleteSlots)).toBe(true);
  });
});
