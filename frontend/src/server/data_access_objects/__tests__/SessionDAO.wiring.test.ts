/**
 * SessionDAO Wiring Tests
 *
 * TLA+ properties per method:
 * - Reachability: Supabase mock returns data → DAO returns mapped entity
 * - TypeInvariant: Returned entity conforms to Zod schema
 * - ErrorConsistency: Supabase error → domain error with expected code
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionSchema } from '@/server/data_structures/Session';
import { AnswerSessionSchema, AnswerStoryRecordSchema } from '@/server/data_structures/AnswerSession';
import { SessionError } from '@/server/error_definitions/SessionErrors';

const UUID1 = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';
const UUID3 = '00000000-0000-4000-8000-000000000003';

const { mockSingle, mockMaybeSingle, mockSelect, mockInsert, mockUpdate,
        mockDelete, mockUpsert, mockEq, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockSelect = vi.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ select: mockSelect })) }));
  const mockDelete = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockEq = vi.fn(() => ({ select: mockSelect, single: mockSingle, maybeSingle: mockMaybeSingle }));
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({ eq: mockEq })),
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
  }));
  return { mockSingle, mockMaybeSingle, mockSelect, mockInsert, mockUpdate,
           mockDelete, mockUpsert, mockEq, mockFrom };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom, rpc: vi.fn() } }));

import { SessionDAO } from '../SessionDAO';

describe('SessionDAO — Supabase Wiring', () => {
  beforeEach(() => vi.clearAllMocks());

  // --- findById ---
  describe('findById', () => {
    describe('Reachability', () => {
      it('returns session when found', async () => {
        const row = { id: 'uuid-1', state: 'ACTIVE', created_at: '2026-01-01', updated_at: '2026-01-01' };
        mockMaybeSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.findById('uuid-1');
        expect(result).not.toBeNull();
        expect(result!.id).toBe('uuid-1');
        expect(mockFrom).toHaveBeenCalledWith('sessions');
      });

      it('falls back to created_at when updated_at is null', async () => {
        const row = { id: 'uuid-legacy', state: 'ACTIVE', created_at: '2026-01-01', updated_at: null };
        mockMaybeSingle.mockResolvedValue({ data: row, error: null });

        const result = await SessionDAO.findById('uuid-legacy');

        expect(result).not.toBeNull();
        expect(result!.updatedAt).toBe('2026-01-01');
      });

      it('returns null when not found', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });
        const result = await SessionDAO.findById('nonexistent');
        expect(result).toBeNull();
      });
    });
    describe('TypeInvariant', () => {
      it('returned object conforms to SessionSchema', async () => {
        const row = { id: UUID1, state: 'ACTIVE', created_at: '2026-01-01', updated_at: '2026-01-01' };
        mockMaybeSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.findById(UUID1);
        expect(SessionSchema.safeParse(result).success).toBe(true);
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError on DB failure', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'fail' } });
        await expect(SessionDAO.findById('x')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- updateState ---
  describe('updateState', () => {
    describe('Reachability', () => {
      it('updates and returns session with new state', async () => {
        const row = { id: 'uuid-1', state: 'FINALIZE', created_at: '2026-01-01', updated_at: '2026-01-02' };
        mockSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.updateState('uuid-1', 'FINALIZE');
        expect(result.state).toBe('FINALIZE');
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError on DB failure', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } });
        await expect(SessionDAO.updateState('x', 'FINALIZE')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- createSession ---
  describe('createSession', () => {
    describe('Reachability', () => {
      it('inserts into answer_sessions and returns entity', async () => {
        const row = { id: 'as-1', user_id: 'u-1', state: 'INIT', created_at: '2026-01-01', updated_at: '2026-01-01' };
        mockSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.createSession('u-1');
        expect(result.id).toBe('as-1');
        expect(result.state).toBe('INIT');
      });
    });
    describe('TypeInvariant', () => {
      it('conforms to AnswerSessionSchema', async () => {
        const row = { id: UUID1, user_id: 'u-1', state: 'INIT', created_at: '2026-01-01', updated_at: '2026-01-01' };
        mockSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.createSession('u-1');
        expect(AnswerSessionSchema.safeParse(result).success).toBe(true);
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError on failure', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } });
        await expect(SessionDAO.createSession('u-1')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- createStoryRecord ---
  describe('createStoryRecord', () => {
    describe('Reachability', () => {
      it('inserts into story_records and returns entity', async () => {
        const row = {
          id: 'sr-1',
          voice_session_id: 'as-1',
          question_id: UUID3,
          user_id: 'u-1',
          status: 'INIT',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        };
        mockSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.createStoryRecord('as-1', 'u-1', UUID3);
        expect(result.id).toBe('sr-1');
      });
    });
    describe('TypeInvariant', () => {
      it('conforms to AnswerStoryRecordSchema', async () => {
        const row = {
          id: UUID1,
          voice_session_id: UUID2,
          question_id: UUID3,
          user_id: 'u-1',
          status: 'INIT',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        };
        mockSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.createStoryRecord(UUID2, 'u-1', UUID3);
        expect(AnswerStoryRecordSchema.safeParse(result).success).toBe(true);
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError on failure', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } });
        await expect(SessionDAO.createStoryRecord('as-1', 'u-1', UUID3)).rejects.toThrow(SessionError);
      });
    });
  });

  // --- createBootstrapQuestionContext ---
  describe('createBootstrapQuestionContext', () => {
    describe('Reachability', () => {
      it('creates question context and returns questionId', async () => {
        mockSingle.mockResolvedValue({ data: { id: UUID1 }, error: null });
        mockInsert
          .mockReturnValueOnce({ select: mockSelect })
          .mockReturnValueOnce({ select: mockSelect }) // job_requirements insert
          .mockReturnValueOnce({ select: mockSelect }); // stories insert

        const result = await SessionDAO.createBootstrapQuestionContext();
        expect(result.questionId).toBe(UUID1);
      });
    });

    describe('ErrorConsistency', () => {
      it('throws SessionError if question insert fails', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'question fail' } });

        await expect(
          SessionDAO.createBootstrapQuestionContext(),
        ).rejects.toThrow(SessionError);
      });
    });
  });

  // --- deleteBootstrapQuestionContext ---
  describe('deleteBootstrapQuestionContext', () => {
    describe('Reachability', () => {
      it('deletes stories, requirements, and question by question id', async () => {
        const result = await SessionDAO.deleteBootstrapQuestionContext(UUID1);
        expect(result).toBeUndefined();
      });
    });
  });

  // --- deleteSession ---
  describe('deleteSession', () => {
    describe('Reachability', () => {
      it('calls delete on answer_sessions', async () => {
        const result = await SessionDAO.deleteSession('as-1');
        expect(result).toBeUndefined();
        expect(mockFrom).toHaveBeenCalledWith('answer_sessions');
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError on failure', async () => {
        mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: 'fail' } }) });
        await expect(SessionDAO.deleteSession('as-1')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- findAnswerSessionById ---
  describe('findAnswerSessionById', () => {
    describe('Reachability', () => {
      it('returns answer session when found', async () => {
        const row = { id: 'as-1', user_id: 'u-1', state: 'IN_PROGRESS', created_at: '2026-01-01', updated_at: '2026-01-01' };
        mockMaybeSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.findAnswerSessionById('as-1');
        expect(result).not.toBeNull();
      });
    });
    describe('ErrorConsistency', () => {
      it('throws on DB error', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'fail' } });
        await expect(SessionDAO.findAnswerSessionById('x')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- findStoryRecordBySessionId ---
  describe('findStoryRecordBySessionId', () => {
    describe('Reachability', () => {
      it('returns story record when found', async () => {
        const row = { id: 'sr-1', voice_session_id: 'as-1', status: 'IN_PROGRESS', content: 'text', created_at: '2026-01-01', updated_at: '2026-01-01' };
        mockMaybeSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.findStoryRecordBySessionId('as-1');
        expect(result).not.toBeNull();
      });
    });
  });

  // --- updateSessionAndStoryRecord ---
  describe('updateSessionAndStoryRecord', () => {
    describe('Reachability', () => {
      it('updates both entities and returns them', async () => {
        const sessionRow = { id: 'as-1', user_id: 'u-1', state: 'RECALL', created_at: '2026-01-01', updated_at: '2026-01-02' };
        const storyRow = { id: 'sr-1', voice_session_id: 'as-1', status: 'RECALL', content: 'new', created_at: '2026-01-01', updated_at: '2026-01-02' };
        // First call returns session, second returns story record
        mockSingle.mockResolvedValueOnce({ data: sessionRow, error: null })
                  .mockResolvedValueOnce({ data: storyRow, error: null });
        const result = await SessionDAO.updateSessionAndStoryRecord('as-1', 'RECALL', 'sr-1', 'new');
        expect(result.session.state).toBe('RECALL');
        expect(result.storyRecord.content).toBe('new');
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError if first update fails', async () => {
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
        await expect(
          SessionDAO.updateSessionAndStoryRecord('as-1', 'RECALL', 'sr-1', 'new')
        ).rejects.toThrow(SessionError);
      });
      it('throws SessionError if second update fails (partial state)', async () => {
        const sessionRow = { id: 'as-1', user_id: 'u-1', state: 'RECALL', created_at: '2026-01-01', updated_at: '2026-01-02' };
        mockSingle.mockResolvedValueOnce({ data: sessionRow, error: null })
                  .mockResolvedValueOnce({ data: null, error: { message: 'story record update failed' } });
        await expect(
          SessionDAO.updateSessionAndStoryRecord('as-1', 'RECALL', 'sr-1', 'new')
        ).rejects.toThrow(SessionError);
      });
    });
  });

  // --- saveSlots ---
  describe('saveSlots', () => {
    describe('Reachability', () => {
      it('upserts to session_slots without error', async () => {
        mockUpsert.mockResolvedValue({ error: null });
        const result = await SessionDAO.saveSlots('as-1', 'qt-1', { slots: [] });
        expect(result).toBeUndefined();
        expect(mockFrom).toHaveBeenCalledWith('session_slots');
      });
    });
    describe('ErrorConsistency', () => {
      it('throws on upsert failure', async () => {
        mockUpsert.mockResolvedValue({ error: { message: 'fail' } });
        await expect(
          SessionDAO.saveSlots('as-1', 'qt-1', { slots: [] })
        ).rejects.toThrow(SessionError);
      });
    });
  });

  // --- updateAnswerSessionState ---
  describe('updateAnswerSessionState', () => {
    describe('Reachability', () => {
      it('updates state and returns answer session', async () => {
        const row = { id: 'as-1', user_id: 'u-1', state: 'COMPLETE', created_at: '2026-01-01', updated_at: '2026-01-02' };
        mockSingle.mockResolvedValue({ data: row, error: null });
        const result = await SessionDAO.updateAnswerSessionState('as-1', 'COMPLETE');
        expect(result.state).toBe('COMPLETE');
      });
    });
    describe('ErrorConsistency', () => {
      it('throws SessionError on failure', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } });
        await expect(SessionDAO.updateAnswerSessionState('as-1', 'COMPLETE')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- findStoryRecordByPrepSessionId ---
  describe('findStoryRecordByPrepSessionId', () => {
    describe('Reachability', () => {
      it('returns prep-linked story record when found', async () => {
        const row = {
          id: 'sr-prep-1',
          session_id: 'sess-1',
          status: 'RECALL',
          content: 'legacy',
          responses: ['legacy'],
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        };
        mockMaybeSingle.mockResolvedValue({ data: row, error: null });

        const result = await SessionDAO.findStoryRecordByPrepSessionId('sess-1');
        expect(result).not.toBeNull();
        expect(result?.sessionId).toBe('sess-1');
      });
    });

    describe('ErrorConsistency', () => {
      it('throws SessionError on DB error', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'prep find failed' } });

        await expect(SessionDAO.findStoryRecordByPrepSessionId('sess-1')).rejects.toThrow(SessionError);
      });
    });
  });

  // --- upsertPrepStoryRecordWorkingAnswer ---
  describe('upsertPrepStoryRecordWorkingAnswer', () => {
    describe('Reachability', () => {
      it('creates prep-linked story record when one does not exist', async () => {
        mockMaybeSingle
          .mockResolvedValueOnce({
            data: {
              id: 'sess-1',
              state: 'initialized',
              user_id: 'user-1',
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
            },
            error: null,
          })
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: null, error: null });

        mockSingle.mockResolvedValue({
          data: {
            id: 'sr-prep-1',
            session_id: 'sess-1',
            user_id: 'user-1',
            status: 'RECALL',
            content: 'legacy answer',
            responses: ['legacy answer'],
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        });

        const result = await SessionDAO.upsertPrepStoryRecordWorkingAnswer('sess-1', 'legacy answer');

        expect(result).not.toBeNull();
        expect(result?.sessionId).toBe('sess-1');
        expect(result?.content).toBe('legacy answer');
      });

      it('retries prep story-record create without question_progress when schema cache is stale', async () => {
        mockMaybeSingle
          .mockResolvedValueOnce({
            data: {
              id: 'sess-1',
              state: 'initialized',
              user_id: 'user-1',
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
            },
            error: null,
          })
          .mockResolvedValueOnce({ data: null, error: null })
          .mockResolvedValueOnce({ data: null, error: null });

        mockSingle
          .mockResolvedValueOnce({
            data: null,
            error: { message: "Could not find the 'question_progress' column of 'story_records' in the schema cache" },
          })
          .mockResolvedValueOnce({
            data: {
              id: 'sr-prep-1',
              session_id: 'sess-1',
              user_id: 'user-1',
              status: 'RECALL',
              content: 'legacy answer',
              responses: ['legacy answer'],
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
            },
            error: null,
          });

        const result = await SessionDAO.upsertPrepStoryRecordWorkingAnswer('sess-1', 'legacy answer');

        expect(result).not.toBeNull();
        expect(result?.content).toBe('legacy answer');
        expect(mockInsert).toHaveBeenCalledTimes(2);

        const insertCalls = mockInsert.mock.calls as unknown as Array<[Record<string, unknown>]>;
        const firstInsertPayload = insertCalls[0]?.[0];
        const secondInsertPayload = insertCalls[1]?.[0];
        expect(firstInsertPayload).toBeDefined();
        expect(secondInsertPayload).toBeDefined();
        expect(firstInsertPayload).toHaveProperty('question_progress');
        expect(secondInsertPayload).not.toHaveProperty('question_progress');
      });

      it('updates prep-linked story record when one already exists', async () => {
        mockMaybeSingle
          .mockResolvedValueOnce({
            data: {
              id: 'sess-1',
              state: 'initialized',
              user_id: 'user-1',
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
            },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: 'sr-prep-1',
              session_id: 'sess-1',
              user_id: 'user-1',
              status: 'RECALL',
              content: 'old',
              responses: ['old'],
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
            },
            error: null,
          });

        mockSingle.mockResolvedValue({
          data: {
            id: 'sr-prep-1',
            session_id: 'sess-1',
            user_id: 'user-1',
            status: 'RECALL',
            content: 'new answer',
            responses: ['old'],
            created_at: '2026-01-01',
            updated_at: '2026-01-02',
          },
          error: null,
        });

        const result = await SessionDAO.upsertPrepStoryRecordWorkingAnswer('sess-1', 'new answer');

        expect(result).not.toBeNull();
        expect(result?.id).toBe('sr-prep-1');
        expect(result?.content).toBe('new answer');
      });
    });

    describe('ErrorConsistency', () => {
      it('fails explicitly when prep session has no user_id', async () => {
        mockMaybeSingle.mockResolvedValue({
          data: {
            id: 'sess-1',
            state: 'initialized',
            user_id: null,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
          error: null,
        });

        await expect(
          SessionDAO.upsertPrepStoryRecordWorkingAnswer('sess-1', 'legacy answer'),
        ).rejects.toThrow(SessionError);
      });
    });
  });
});
