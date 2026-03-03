/**
 * Tests for InitializeSessionDAO
 *
 * Resource: db-d3w8 (data_access_object)
 * Path: 310-initialize-new-session-with-provided-objects
 *
 * TLA+ properties tested:
 * - Reachability: persist(session) → returned session has non-null id, DB row exists
 * - TypeInvariant: returned object matches InitializedSession type and preserves embedded objects
 * - ErrorConsistency: DB failure → SessionErrors.PersistenceFailure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionError } from '../../error_definitions/SessionErrors';
import { InitializedSessionSchema } from '../../data_structures/InitializedSession';
import type { ResumeObject, JobObject, QuestionObject } from '../../data_structures/SessionObjects';

// Mock the Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase';
import { InitializeSessionDAO } from '../InitializeSessionDAO';

const mockSupabase = vi.mocked(supabase);

describe('InitializeSessionDAO — Step 4: Persist session to storage', () => {
  const validResume: ResumeObject = {
    content: 'Experienced software engineer with 10 years of expertise in TypeScript.',
    name: 'John Doe Resume',
    wordCount: 10,
  };

  const validJob: JobObject = {
    title: 'Senior Software Engineer',
    description: 'We are looking for a senior engineer to lead our TypeScript team.',
    sourceType: 'text',
    sourceValue: 'We are looking for a senior engineer to lead our TypeScript team.',
  };

  const validQuestion: QuestionObject = {
    text: 'Tell me about a time you led a complex technical project.',
  };

  const sessionToPersist = {
    resume: validResume,
    job: validJob,
    question: validQuestion,
    state: 'initialized' as const,
    createdAt: new Date().toISOString(),
  };

  const mockPersistedRow = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    resume: validResume,
    job: validJob,
    question: validQuestion,
    state: 'initialized',
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reachability: persist(session) → returned session has non-null id', () => {
    it('should insert session and return persisted record with generated UUID', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPersistedRow,
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);

      const result = await InitializeSessionDAO.persist(sessionToPersist);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPersistedRow.id);
      expect(result.id).toBeTruthy();
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    });

    it('should include updated_at in insert payload', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPersistedRow,
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);

      await InitializeSessionDAO.persist(sessionToPersist);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: sessionToPersist.createdAt,
          updated_at: sessionToPersist.createdAt,
        }),
      );
    });

    it('should include user_id in insert payload when provided', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPersistedRow,
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);

      await InitializeSessionDAO.persist(sessionToPersist, 'user-1');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
        }),
      );
    });
  });

  describe('Active session lookup', () => {
    it('scopes active session lookup by user_id when provided', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEqUser = vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      });
      const mockEqState = vi.fn().mockReturnValue({
        eq: mockEqUser,
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEqState,
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect } as any);

      await InitializeSessionDAO.getActiveSession('user-1');

      expect(mockEqState).toHaveBeenCalledWith('state', 'initialized');
      expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('TypeInvariant: returned object matches InitializedSession type and preserves embedded objects', () => {
    it('should return object conforming to InitializedSession schema', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPersistedRow,
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);

      const result = await InitializeSessionDAO.persist(sessionToPersist);

      const parsed = InitializedSessionSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should preserve embedded ResumeObject exactly', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockPersistedRow,
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);

      const result = await InitializeSessionDAO.persist(sessionToPersist);

      expect(result.resume).toEqual(validResume);
      expect(result.job).toEqual(validJob);
      expect(result.question).toEqual(validQuestion);
    });
  });

  describe('ErrorConsistency: DB failure → SessionErrors.PersistenceFailure', () => {
    it('should throw PERSISTENCE_FAILURE when Supabase returns error', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection refused', code: 'PGRST301' },
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);

      try {
        await InitializeSessionDAO.persist(sessionToPersist);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('PERSISTENCE_FAILURE');
        expect((e as SessionError).retryable).toBe(true);
      }
    });

    it('should throw PERSISTENCE_FAILURE when Supabase client throws', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      try {
        await InitializeSessionDAO.persist(sessionToPersist);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('PERSISTENCE_FAILURE');
      }
    });
  });
});
