import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionWithStoryRecordSchema } from '../../data_structures/AnswerSession';
import type {
  AnswerSession,
  AnswerSessionState,
  SessionWithStoryRecord,
} from '../../data_structures/AnswerSession';

vi.mock('../../data_access_objects/SessionDAO', () => ({
  SessionDAO: {
    findAnswerSessionById: vi.fn(),
    findById: vi.fn(),
    findPrepSessionUserId: vi.fn(),
  },
}));

vi.mock('../../services/SessionProgressionService', () => ({
  SessionProgressionService: {
    progressSession: vi.fn(),
  },
}));

vi.mock('../../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { SessionDAO } from '../../data_access_objects/SessionDAO';
import { SessionProgressionService } from '../../services/SessionProgressionService';
import { logger } from '../../logging/logger';
import { ProcessVoiceResponseHandler } from '../ProcessVoiceResponseHandler';
import { SessionError } from '../../error_definitions/SessionErrors';

const mockDAO = vi.mocked(SessionDAO);
const mockService = vi.mocked(SessionProgressionService);
const mockLogger = vi.mocked(logger);

const validPayload = {
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  transcript: 'I led a cross-functional team that reduced deployment time by 40 percent.',
};
const authContext = { userId: 'user-123', authenticated: true };

const baseSession: Omit<AnswerSession, 'state'> = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  createdAt: '2026-02-28T00:00:00Z',
  updatedAt: '2026-02-28T00:00:00Z',
};

function makeSession(state: AnswerSessionState): AnswerSession {
  return { ...baseSession, state };
}

function makeServiceResult(state: AnswerSessionState): SessionWithStoryRecord {
  return {
    session: {
      ...makeSession(state),
      updatedAt: '2026-02-28T00:00:01Z',
    },
    storyRecord: {
      id: '660e8400-e29b-41d4-a716-446655440001',
      sessionId: baseSession.id,
      status: state,
      content: validPayload.transcript,
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:01Z',
    },
  };
}

describe('ProcessVoiceResponseHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['INIT', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'RECALL'],
    ['RECALL', 'COMPLETE'],
  ] as const)(
    'accepts %s session state and delegates to service',
    async (currentState, nextState) => {
      mockDAO.findAnswerSessionById.mockResolvedValue(makeSession(currentState));
      mockService.progressSession.mockResolvedValue(makeServiceResult(nextState));

      const result = await ProcessVoiceResponseHandler.handle(validPayload, authContext);

      expect(mockDAO.findAnswerSessionById).toHaveBeenCalledWith(validPayload.sessionId);
      expect(mockService.progressSession).toHaveBeenCalledWith(
        expect.objectContaining({ state: currentState }),
        validPayload.transcript,
      );
      expect(result.session.state).toBe(nextState);
      expect(result.storyRecord.content).toBe(validPayload.transcript);
    },
  );

  it('returns a result matching SessionWithStoryRecordSchema', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(makeSession('INIT'));
    mockService.progressSession.mockResolvedValue(makeServiceResult('IN_PROGRESS'));

    const result = await ProcessVoiceResponseHandler.handle(validPayload, authContext);
    const parsed = SessionWithStoryRecordSchema.safeParse(result);

    expect(parsed.success).toBe(true);
  });

  it('throws INVALID_STATE when session is in unsupported state', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(makeSession('COMPLETE'));

    try {
      await ProcessVoiceResponseHandler.handle(validPayload, authContext);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SessionError);
      expect((e as SessionError).code).toBe('INVALID_STATE');
    }
  });

  it('throws INVALID_PAYLOAD when sessionId is missing', async () => {
    try {
      await ProcessVoiceResponseHandler.handle({
        sessionId: '',
        transcript: 'Some transcript',
      }, authContext);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SessionError);
      expect((e as SessionError).code).toBe('INVALID_PAYLOAD');
    }
  });

  it('throws INVALID_PAYLOAD when transcript is empty', async () => {
    try {
      await ProcessVoiceResponseHandler.handle({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        transcript: '',
      }, authContext);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SessionError);
      expect((e as SessionError).code).toBe('INVALID_PAYLOAD');
    }
  });

  it('throws INVALID_STATE when session is not found', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(null);
    mockDAO.findById.mockResolvedValue(null);

    try {
      await ProcessVoiceResponseHandler.handle(validPayload, authContext);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SessionError);
      expect((e as SessionError).code).toBe('SESSION_NOT_FOUND');
    }
  });

  it('throws explicit mismatch message when owned id exists only in sessions', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(null);
    mockDAO.findById.mockResolvedValue({
      id: validPayload.sessionId,
      state: 'DRAFT',
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:00Z',
    });
    mockDAO.findPrepSessionUserId.mockResolvedValue(authContext.userId);

    await expect(
      ProcessVoiceResponseHandler.handle(validPayload, authContext),
    ).rejects.toMatchObject({
      code: 'INVALID_STATE',
      message: expect.stringContaining('prep/session workflow'),
    });
  });

  it('returns not-found semantics when legacy id exists but caller is not owner', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(null);
    mockDAO.findById.mockResolvedValue({
      id: validPayload.sessionId,
      state: 'DRAFT',
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:00Z',
    });
    mockDAO.findPrepSessionUserId.mockResolvedValue('user-other');

    await expect(
      ProcessVoiceResponseHandler.handle(validPayload, authContext),
    ).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
    });
  });

  it('rethrows SessionError from service as-is', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(makeSession('INIT'));
    const { SessionErrors } = await import('../../error_definitions/SessionErrors');
    mockService.progressSession.mockRejectedValue(
      SessionErrors.InvalidTransition('Cannot transition from INIT'),
    );

    try {
      await ProcessVoiceResponseHandler.handle(validPayload, authContext);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SessionError);
      expect((e as SessionError).code).toBe('INVALID_TRANSITION');
    }
  });

  it('wraps unexpected errors and logs them', async () => {
    mockDAO.findAnswerSessionById.mockResolvedValue(makeSession('INIT'));
    mockService.progressSession.mockRejectedValue(new TypeError('unexpected'));

    try {
      await ProcessVoiceResponseHandler.handle(validPayload, authContext);
      expect.fail('Should have thrown');
    } catch {
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });
});
