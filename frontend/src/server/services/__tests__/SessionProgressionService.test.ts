/**
 * Tests for SessionProgressionService
 *
 * Resource: db-h2s4 (service)
 * Path: 307-process-voice-input-and-progress-session
 *
 * TLA+ properties tested:
 * - Reachability: given INIT session + transcript →
 *   - processor returns next state
 *   - DAO persists updated session + StoryRecord
 *   - expect returned updated entities
 * - TypeInvariant: returned object matches SessionWithStoryRecord type
 * - ErrorConsistency:
 *   - Invalid transition → SessionErrors.INVALID_TRANSITION
 *   - DAO throws → service logs via backend logger and throws SessionErrors.PERSISTENCE_FAILED
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionWithStoryRecordSchema } from '../../data_structures/AnswerSession';
import type { AnswerSession, AnswerStoryRecord, SessionWithStoryRecord } from '../../data_structures/AnswerSession';
import { SessionError } from '../../error_definitions/SessionErrors';

// Mock VoiceResponseProcessor
vi.mock('../../processors/VoiceResponseProcessor', () => ({
  VoiceResponseProcessor: {
    process: vi.fn(),
  },
}));

// Mock SessionDAO
vi.mock('../../data_access_objects/SessionDAO', () => ({
  SessionDAO: {
    findStoryRecordBySessionId: vi.fn(),
    updateSessionAndStoryRecord: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { VoiceResponseProcessor } from '../../processors/VoiceResponseProcessor';
import { SessionDAO } from '../../data_access_objects/SessionDAO';
import { logger } from '../../logging/logger';
import { SessionProgressionService } from '../SessionProgressionService';

const mockProcessor = vi.mocked(VoiceResponseProcessor);
const mockDAO = vi.mocked(SessionDAO);
const mockLogger = vi.mocked(logger);

describe('SessionProgressionService', () => {
  const initSession: AnswerSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: 'user-123',
    state: 'INIT',
    createdAt: '2026-02-28T00:00:00Z',
    updatedAt: '2026-02-28T00:00:00Z',
  };

  const transcript = 'I led a cross-functional team that reduced deployment time by 40 percent.';

  const existingStoryRecord: AnswerStoryRecord = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    sessionId: initSession.id,
    status: 'INIT',
    createdAt: '2026-02-28T00:00:00Z',
    updatedAt: '2026-02-28T00:00:00Z',
  };

  const updatedEntities: SessionWithStoryRecord = {
    session: {
      ...initSession,
      state: 'IN_PROGRESS',
      updatedAt: '2026-02-28T00:00:01Z',
    },
    storyRecord: {
      id: existingStoryRecord.id,
      sessionId: initSession.id,
      status: 'IN_PROGRESS',
      content: transcript,
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:01Z',
    },
  };

  function setupSuccessfulMocks() {
    mockProcessor.process.mockReturnValue({
      nextState: 'IN_PROGRESS',
      updatedContent: transcript,
    });
    mockDAO.findStoryRecordBySessionId.mockResolvedValue(existingStoryRecord);
    mockDAO.updateSessionAndStoryRecord.mockResolvedValue(updatedEntities);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability', () => {
    it('should process transcript and persist updated session and story record', async () => {
      setupSuccessfulMocks();

      const result = await SessionProgressionService.progressSession(initSession, transcript);

      // Processor called with transcript and session
      expect(mockProcessor.process).toHaveBeenCalledWith(transcript, initSession);

      // DAO called to find story record
      expect(mockDAO.findStoryRecordBySessionId).toHaveBeenCalledWith(initSession.id);

      // DAO called to persist
      expect(mockDAO.updateSessionAndStoryRecord).toHaveBeenCalledWith(
        initSession.id,
        'IN_PROGRESS',
        existingStoryRecord.id,
        transcript,
        [transcript],
      );

      // Returns updated entities
      expect(result.session.state).toBe('IN_PROGRESS');
      expect(result.storyRecord.content).toBe(transcript);
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should return result matching SessionWithStoryRecordSchema', async () => {
      setupSuccessfulMocks();

      const result = await SessionProgressionService.progressSession(initSession, transcript);

      const parsed = SessionWithStoryRecordSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should throw INVALID_TRANSITION when state transition is not valid', async () => {
      // Processor returns a state transition that's not in VALID_STATE_TRANSITIONS
      mockProcessor.process.mockReturnValue({
        nextState: 'INIT', // INIT → INIT is not a valid transition
        updatedContent: transcript,
      });

      try {
        await SessionProgressionService.progressSession(initSession, transcript);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('INVALID_TRANSITION');
      }
    });

    it('should throw INVALID_STATE when no story record is found', async () => {
      mockProcessor.process.mockReturnValue({
        nextState: 'IN_PROGRESS',
        updatedContent: transcript,
      });
      mockDAO.findStoryRecordBySessionId.mockResolvedValue(null);

      try {
        await SessionProgressionService.progressSession(initSession, transcript);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('INVALID_STATE');
      }
    });

    it('should throw PERSISTENCE_FAILED and log when DAO throws', async () => {
      mockProcessor.process.mockReturnValue({
        nextState: 'IN_PROGRESS',
        updatedContent: transcript,
      });
      mockDAO.findStoryRecordBySessionId.mockResolvedValue(existingStoryRecord);
      mockDAO.updateSessionAndStoryRecord.mockRejectedValue(
        new Error('Database connection failed'),
      );

      try {
        await SessionProgressionService.progressSession(initSession, transcript);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('PERSISTENCE_FAILED');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to persist session progression',
          expect.any(Error),
          expect.objectContaining({
            path: '307-process-voice-input-and-progress-session',
            resource: 'db-h2s4',
          }),
        );
      }
    });

    it('should rethrow known SessionError from DAO as-is', async () => {
      const { SessionErrors } = await import('../../error_definitions/SessionErrors');

      mockProcessor.process.mockReturnValue({
        nextState: 'IN_PROGRESS',
        updatedContent: transcript,
      });
      mockDAO.findStoryRecordBySessionId.mockResolvedValue(existingStoryRecord);
      mockDAO.updateSessionAndStoryRecord.mockRejectedValue(
        SessionErrors.SessionPersistenceError('Session already modified'),
      );

      try {
        await SessionProgressionService.progressSession(initSession, transcript);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('SESSION_PERSISTENCE_ERROR');
      }
    });
  });
});
