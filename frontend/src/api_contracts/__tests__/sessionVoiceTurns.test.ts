import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SessionVoiceTurnsResponseSchema,
  advanceSessionQuestion,
  getSessionVoiceTurns,
  updateSessionWorkingAnswer,
} from '../sessionVoiceTurns';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('sessionVoiceTurns API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates response schema with questionProgress', () => {
    expect(
      SessionVoiceTurnsResponseSchema.safeParse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'answer_session',
        workingAnswer: 'Saved answer',
        turns: ['Turn 1'],
        questionProgress: {
          currentIndex: 0,
          total: 4,
          completed: [],
          activeQuestionId: 'q-default-1',
        },
      }).success,
    ).toBe(true);
  });

  it('applies default questionProgress when backend omits it', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'session',
        workingAnswer: '',
        turns: [],
      }),
    });

    const response = await getSessionVoiceTurns('550e8400-e29b-41d4-a716-446655440000', 'session');
    expect(response.questionProgress.total).toBeGreaterThan(0);
    expect(response.questionProgress.currentIndex).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/voice-turns?sessionId=550e8400-e29b-41d4-a716-446655440000&sessionSource=session',
      undefined,
    );
  });

  it('posts advance_question action for progression', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        sessionSource: 'answer_session',
        workingAnswer: '',
        turns: [],
        questionProgress: {
          currentIndex: 1,
          total: 4,
          completed: ['q-default-1'],
          activeQuestionId: 'q-default-2',
        },
      }),
    });

    const response = await advanceSessionQuestion('550e8400-e29b-41d4-a716-446655440000', 'answer_session');
    expect(response.questionProgress.currentIndex).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/voice-turns',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(mockFetch.mock.calls[0][1]?.body).toContain('"action":"advance_question"');
    expect(mockFetch.mock.calls[0][1]?.body).toContain('"sessionSource":"answer_session"');
  });

  it('validates source for update_working_answer request payload', async () => {
    await expect(
      updateSessionWorkingAnswer(
        '550e8400-e29b-41d4-a716-446655440000',
        'hello world',
        'bad-source' as 'session',
      ),
    ).rejects.toThrow(/sessionSource|Invalid enum/i);
  });
});
