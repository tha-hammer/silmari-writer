import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/data_access_objects/SessionDAO', () => ({
  SessionDAO: {
    findStoryRecordBySessionId: vi.fn(),
    updateStoryRecordWorkingAnswer: vi.fn(),
    replaceStoryRecordResponses: vi.fn(),
  },
}));

import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { GET, POST } from '../route';

const mockSessionDAO = vi.mocked(SessionDAO);

describe('/api/session/voice-turns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 400 for invalid sessionId', async () => {
    const request = new Request('http://localhost:3000/api/session/voice-turns?sessionId=bad');
    const response = await GET(request as any);

    expect(response.status).toBe(400);
  });

  it('GET returns persisted working answer and turns', async () => {
    mockSessionDAO.findStoryRecordBySessionId.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Saved answer',
      responses: ['Turn 1', 'Turn 2'],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    } as any);

    const request = new Request(
      'http://localhost:3000/api/session/voice-turns?sessionId=550e8400-e29b-41d4-a716-446655440000',
    );
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      workingAnswer: 'Saved answer',
      turns: ['Turn 1', 'Turn 2'],
    });
  });

  it('POST update_working_answer persists updated content', async () => {
    mockSessionDAO.updateStoryRecordWorkingAnswer.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Updated answer',
      responses: ['Turn 1'],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:02.000Z',
    } as any);

    const request = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'update_working_answer',
        content: 'Updated answer',
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSessionDAO.updateStoryRecordWorkingAnswer).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'Updated answer',
    );
    expect(body.workingAnswer).toBe('Updated answer');
  });

  it('POST reset_turns clears responses and working answer', async () => {
    mockSessionDAO.replaceStoryRecordResponses.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Old',
      responses: [],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:02.000Z',
    } as any);

    mockSessionDAO.updateStoryRecordWorkingAnswer.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: '',
      responses: [],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:03.000Z',
    } as any);

    const request = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'reset_turns',
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSessionDAO.replaceStoryRecordResponses).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      [],
    );
    expect(body).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      workingAnswer: '',
      turns: [],
    });
  });
});
