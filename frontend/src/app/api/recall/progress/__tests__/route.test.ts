import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/data_access_objects/SessionDAO', () => ({
  SessionDAO: {
    findStoryRecordByVoiceSessionId: vi.fn(),
    findStoryRecordByPrepSessionId: vi.fn(),
    findStoryRecordByCanonicalSessionId: vi.fn(),
  },
}));

import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { GET } from '../route';

const mockSessionDAO = vi.mocked(SessionDAO);
type GetRequest = Parameters<typeof GET>[0];
type VoiceStoryRecord = NonNullable<Awaited<ReturnType<typeof SessionDAO.findStoryRecordByVoiceSessionId>>>;

describe('GET /api/recall/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid sessionId', async () => {
    const request = new Request('http://localhost:3000/api/recall/progress?sessionId=bad');
    const response = await GET(request as unknown as GetRequest);

    expect(response.status).toBe(400);
  });

  it('returns 400 when sessionSource is missing', async () => {
    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000',
    );
    const response = await GET(request as unknown as GetRequest);

    expect(response.status).toBe(400);
  });

  it('routes progress lookup via canonical resolver when sessionSource=session', async () => {
    mockSessionDAO.findStoryRecordByCanonicalSessionId.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=session',
    );
    const response = await GET(request as unknown as GetRequest);

    expect(response.status).toBe(200);
    expect(mockSessionDAO.findStoryRecordByCanonicalSessionId).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'session',
    );
  });

  it('routes progress lookup via canonical resolver when sessionSource=answer_session', async () => {
    mockSessionDAO.findStoryRecordByCanonicalSessionId.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=answer_session',
    );
    const response = await GET(request as unknown as GetRequest);

    expect(response.status).toBe(200);
    expect(mockSessionDAO.findStoryRecordByCanonicalSessionId).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'answer_session',
    );
  });

  it('returns neutral progress when story record does not exist', async () => {
    mockSessionDAO.findStoryRecordByCanonicalSessionId.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=answer_session',
    );
    const response = await GET(request as unknown as GetRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      anchors: 0,
      actions: 0,
      outcomes: 0,
    });
  });

  it('returns computed progress from persisted recall content', async () => {
    mockSessionDAO.findStoryRecordByCanonicalSessionId.mockResolvedValue({
      id: 'story-record-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'In this role, I led the migration and improved performance by 40%.',
      responses: ['I implemented retries and reduced errors by 25%.'],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    } as VoiceStoryRecord);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=answer_session',
    );
    const response = await GET(request as unknown as GetRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.anchors).toBeGreaterThan(0);
    expect(body.actions).toBeGreaterThan(0);
    expect(body.outcomes).toBeGreaterThan(0);
    expect(Array.isArray(body.incompleteSlots)).toBe(true);
  });

  it('keeps zero counts for missing dimensions in non-empty corpus', async () => {
    mockSessionDAO.findStoryRecordByCanonicalSessionId.mockResolvedValue({
      id: 'story-record-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'The context was a migration and the team had a clear objective.',
      responses: [],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    } as VoiceStoryRecord);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=answer_session',
    );
    const response = await GET(request as unknown as GetRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.anchors).toBeGreaterThan(0);
    expect(body.actions).toBe(0);
    expect(body.outcomes).toBe(0);
    expect(body.incompleteSlots).toContain('actions');
    expect(body.incompleteSlots).toContain('outcomes');
  });

  it('returns all incomplete slots for empty corpus', async () => {
    mockSessionDAO.findStoryRecordByCanonicalSessionId.mockResolvedValue({
      id: 'story-record-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: '   ',
      responses: [],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    } as VoiceStoryRecord);

    const request = new Request(
      'http://localhost:3000/api/recall/progress?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=answer_session',
    );
    const response = await GET(request as unknown as GetRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      anchors: 0,
      actions: 0,
      outcomes: 0,
      incompleteSlots: ['anchors', 'actions', 'outcomes'],
    });
  });
});
