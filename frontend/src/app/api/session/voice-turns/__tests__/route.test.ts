import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/data_access_objects/SessionDAO', () => ({
  SessionDAO: {
    findStoryRecordByVoiceSessionId: vi.fn(),
    findStoryRecordByPrepSessionId: vi.fn(),
    updateStoryRecordWorkingAnswer: vi.fn(),
    upsertPrepStoryRecordWorkingAnswer: vi.fn(),
    replaceStoryRecordResponses: vi.fn(),
    updateStoryRecordQuestionProgress: vi.fn(),
  },
}));

import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { GET, POST } from '../route';

const mockSessionDAO = vi.mocked(SessionDAO);
type GetRequest = Parameters<typeof GET>[0];
type PostRequest = Parameters<typeof POST>[0];

describe('/api/session/voice-turns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 400 for invalid sessionId', async () => {
    const request = new Request('http://localhost:3000/api/session/voice-turns?sessionId=bad');
    const response = await GET(request as unknown as GetRequest);

    expect(response.status).toBe(400);
  });

  it('GET returns persisted working answer and turns', async () => {
    mockSessionDAO.findStoryRecordByVoiceSessionId.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Saved answer',
      responses: ['Turn 1', 'Turn 2'],
      questionProgress: {
        currentIndex: 1,
        total: 4,
        completed: ['q-default-1'],
        activeQuestionId: 'q-default-2',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    });

    const request = new Request(
      'http://localhost:3000/api/session/voice-turns?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=answer_session',
    );
    const response = await GET(request as unknown as GetRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      sessionSource: 'answer_session',
      workingAnswer: 'Saved answer',
      turns: ['Turn 1', 'Turn 2'],
      questionProgress: {
        currentIndex: 1,
        total: 4,
        completed: ['q-default-1'],
        activeQuestionId: 'q-default-2',
      },
    });
  });

  it('POST update_working_answer persists updated content', async () => {
    mockSessionDAO.updateStoryRecordWorkingAnswer.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Updated answer',
      responses: ['Turn 1'],
      questionProgress: {
        currentIndex: 0,
        total: 4,
        completed: [],
        activeQuestionId: 'q-default-1',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:02.000Z',
    });

    const request = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'answer_session',
        action: 'update_working_answer',
        content: 'Updated answer',
      }),
    });

    const response = await POST(request as unknown as PostRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSessionDAO.updateStoryRecordWorkingAnswer).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'Updated answer',
    );
    expect(body.workingAnswer).toBe('Updated answer');
    expect(body.sessionSource).toBe('answer_session');
    expect(body.questionProgress).toEqual({
      currentIndex: 0,
      total: 4,
      completed: [],
      activeQuestionId: 'q-default-1',
    });
  });

  it('creates legacy story record on first write for source=session and returns durable value', async () => {
    const persistedStoryRecord = {
      id: 'story-legacy-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL' as const,
      content: 'Legacy answer',
      responses: ['Legacy answer'],
      questionProgress: {
        currentIndex: 0,
        total: 4,
        completed: [],
        activeQuestionId: 'q-default-1',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    };

    mockSessionDAO.upsertPrepStoryRecordWorkingAnswer.mockResolvedValue(persistedStoryRecord);
    mockSessionDAO.findStoryRecordByPrepSessionId.mockResolvedValue(persistedStoryRecord);

    const postRequest = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'session',
        action: 'update_working_answer',
        content: 'Legacy answer',
      }),
    });

    const postResponse = await POST(postRequest as unknown as PostRequest);
    const postBody = await postResponse.json();
    expect(postResponse.status).toBe(200);
    expect(postBody).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      sessionSource: 'session',
      workingAnswer: 'Legacy answer',
      turns: ['Legacy answer'],
      questionProgress: {
        currentIndex: 0,
        total: 4,
        completed: [],
        activeQuestionId: 'q-default-1',
      },
    });

    const getRequest = new Request(
      'http://localhost:3000/api/session/voice-turns?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=session',
    );
    const getResponse = await GET(getRequest as unknown as GetRequest);
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.workingAnswer).toBe('Legacy answer');
    expect(mockSessionDAO.findStoryRecordByPrepSessionId).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('does not report success when no durable write occurred', async () => {
    mockSessionDAO.upsertPrepStoryRecordWorkingAnswer.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'session',
        action: 'update_working_answer',
        content: 'Attempted write',
      }),
    });

    const response = await POST(request as unknown as PostRequest);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('PERSISTENCE_FAILURE');
  });

  it('POST reset_turns clears responses and working answer', async () => {
    mockSessionDAO.replaceStoryRecordResponses.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Old',
      responses: [],
      questionProgress: {
        currentIndex: 2,
        total: 4,
        completed: ['q-default-1', 'q-default-2'],
        activeQuestionId: 'q-default-3',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:02.000Z',
    });

    mockSessionDAO.updateStoryRecordWorkingAnswer.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: '',
      responses: [],
      questionProgress: {
        currentIndex: 2,
        total: 4,
        completed: ['q-default-1', 'q-default-2'],
        activeQuestionId: 'q-default-3',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:03.000Z',
    });

    const request = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'answer_session',
        action: 'reset_turns',
      }),
    });

    const response = await POST(request as unknown as PostRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSessionDAO.replaceStoryRecordResponses).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      [],
      'answer_session',
    );
    expect(body).toEqual({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      sessionSource: 'answer_session',
      workingAnswer: '',
      turns: [],
      questionProgress: {
        currentIndex: 2,
        total: 4,
        completed: ['q-default-1', 'q-default-2'],
        activeQuestionId: 'q-default-3',
      },
    });
  });

  it('POST advance_question increments question progress', async () => {
    mockSessionDAO.findStoryRecordByVoiceSessionId.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Saved answer',
      responses: ['Turn 1'],
      questionProgress: {
        currentIndex: 0,
        total: 4,
        completed: [],
        activeQuestionId: 'q-default-1',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:01.000Z',
    });

    mockSessionDAO.updateStoryRecordQuestionProgress.mockResolvedValue({
      id: 'story-1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'RECALL',
      content: 'Saved answer',
      responses: ['Turn 1'],
      questionProgress: {
        currentIndex: 1,
        total: 4,
        completed: ['q-default-1'],
        activeQuestionId: 'q-default-2',
      },
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:03.000Z',
    });

    const request = new Request('http://localhost:3000/api/session/voice-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'answer_session',
        action: 'advance_question',
      }),
    });

    const response = await POST(request as unknown as PostRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSessionDAO.updateStoryRecordQuestionProgress).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        currentIndex: 1,
        activeQuestionId: 'q-default-2',
      }),
      'answer_session',
    );
    expect(body.questionProgress).toEqual({
      currentIndex: 1,
      total: 4,
      completed: ['q-default-1'],
      activeQuestionId: 'q-default-2',
    });
  });
});
