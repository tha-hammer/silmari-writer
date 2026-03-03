/**
 * Tests for InitializeSessionService - active session check
 *
 * Resource: db-h2s4 (service)
 * Path: 311-reject-duplicate-session-initialization
 *
 * TLA+ properties tested:
 * - Reachability: Service calls DAO.getActiveSession() during initialization
 * - TypeInvariant: getActiveSession() returns InitializedSession | null
 * - ErrorConsistency: DB failure → SYSTEM_ERROR (SERVICE_ERROR); no session creation attempted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InitializedSession } from '@/server/data_structures/InitializedSession';
import type { ResumeObject, JobObject, QuestionObject } from '@/server/data_structures/SessionObjects';
import { SessionError } from '@/server/error_definitions/SessionErrors';

// Mock ONLY the DAO layer
vi.mock('@/server/data_access_objects/InitializeSessionDAO', () => ({
  InitializeSessionDAO: {
    getActiveSession: vi.fn(),
    persist: vi.fn(),
    supersedeInitializedSession: vi.fn(),
  },
}));

// Mock logger to avoid noisy output
vi.mock('@/server/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { InitializeSessionDAO } from '@/server/data_access_objects/InitializeSessionDAO';
import { InitializeSessionService } from '@/server/services/InitializeSessionService';

const mockDAO = vi.mocked(InitializeSessionDAO);

describe('InitializeSessionService — Step 2: Check for existing active session', () => {
  const validResume: ResumeObject = {
    content: 'Experienced software engineer with expertise in TypeScript.',
    name: 'Test Resume',
    wordCount: 8,
  };

  const validJob: JobObject = {
    title: 'Senior Engineer',
    description: 'Lead engineering team.',
    sourceType: 'text',
    sourceValue: 'Lead engineering team.',
  };

  const validQuestion: QuestionObject = {
    text: 'Tell me about a time you led a complex project.',
  };

  const validInput = {
    resume: validResume,
    job: validJob,
    question: validQuestion,
  };

  const mockActiveSession: InitializedSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    resume: validResume,
    job: validJob,
    question: validQuestion,
    state: 'initialized',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reachability: DAO.getActiveSession() is called during initialization', () => {
    it('should call getActiveSession before attempting to persist', async () => {
      mockDAO.getActiveSession.mockResolvedValue(null);
      mockDAO.persist.mockResolvedValue({
        id: '660e8400-e29b-41d4-a716-446655440000',
        ...validInput,
        state: 'initialized',
        createdAt: new Date().toISOString(),
      });

      await InitializeSessionService.createSession({ ...validInput, userId: 'user-1' });

      expect(mockDAO.getActiveSession).toHaveBeenCalledTimes(1);
      expect(mockDAO.getActiveSession).toHaveBeenCalledWith('user-1');
    });

    it('should call getActiveSession when active session exists (and throw)', async () => {
      mockDAO.getActiveSession.mockResolvedValue(mockActiveSession);

      await expect(
        InitializeSessionService.createSession(validInput),
      ).rejects.toThrow();

      expect(mockDAO.getActiveSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('TypeInvariant: getActiveSession returns Session | null', () => {
    it('should allow session creation when another user has an active initialized session', async () => {
      mockDAO.getActiveSession.mockResolvedValue(null);
      mockDAO.persist.mockResolvedValue({
        id: '770e8400-e29b-41d4-a716-446655440000',
        ...validInput,
        state: 'initialized',
        createdAt: new Date().toISOString(),
      });

      const result = await InitializeSessionService.createSession({
        ...validInput,
        userId: 'user-2',
      });

      expect(result.state).toBe('initialized');
      expect(mockDAO.getActiveSession).toHaveBeenCalledWith('user-2');
      expect(mockDAO.persist).toHaveBeenCalledTimes(1);
    });

    it('should proceed to persist when getActiveSession returns null', async () => {
      mockDAO.getActiveSession.mockResolvedValue(null);
      mockDAO.persist.mockResolvedValue({
        id: '660e8400-e29b-41d4-a716-446655440000',
        ...validInput,
        state: 'initialized',
        createdAt: new Date().toISOString(),
      });

      const result = await InitializeSessionService.createSession(validInput);

      expect(result.state).toBe('initialized');
      expect(mockDAO.persist).toHaveBeenCalledTimes(1);
    });

    it('should NOT call persist when getActiveSession returns a session', async () => {
      mockDAO.getActiveSession.mockResolvedValue(mockActiveSession);

      await expect(
        InitializeSessionService.createSession(validInput),
      ).rejects.toThrow();

      expect(mockDAO.persist).not.toHaveBeenCalled();
    });
  });

  describe('ErrorConsistency: correct error codes for each failure branch', () => {
    it('should throw SESSION_ALREADY_ACTIVE when active session exists', async () => {
      mockDAO.getActiveSession.mockResolvedValue(mockActiveSession);

      try {
        await InitializeSessionService.createSession(validInput);
        expect.unreachable('Expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        const sessionError = error as SessionError;
        expect(sessionError.code).toBe('SESSION_ALREADY_ACTIVE');
        expect(sessionError.statusCode).toBe(409);
      }
    });

    it('should throw SERVICE_ERROR when DAO.getActiveSession fails', async () => {
      mockDAO.getActiveSession.mockRejectedValue(
        new Error('Connection refused'),
      );

      try {
        await InitializeSessionService.createSession(validInput);
        expect.unreachable('Expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        const sessionError = error as SessionError;
        expect(sessionError.code).toBe('SERVICE_ERROR');
      }
    });

    it('should NOT attempt session creation when DAO.getActiveSession fails', async () => {
      mockDAO.getActiveSession.mockRejectedValue(
        new Error('Connection refused'),
      );

      try {
        await InitializeSessionService.createSession(validInput);
      } catch {
        // expected
      }

      expect(mockDAO.persist).not.toHaveBeenCalled();
    });
  });
});
