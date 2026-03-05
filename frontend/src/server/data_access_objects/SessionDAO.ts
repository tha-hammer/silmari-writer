/**
 * SessionDAO - Handles database persistence for session state transitions
 * and voice-assisted answer session creation.
 *
 * Resource: db-d3w8 (data_access_object)
 * Paths:
 *   - 299-approve-draft-and-transition-to-finalize
 *   - 306-initiate-voice-assisted-answer-session
 *   - 307-process-voice-input-and-progress-session
 *   - 318-complete-voice-answer-advances-workflow
 *
 * In production, each method performs Supabase queries against
 * the sessions table. For TDD, methods are designed to be mockable.
 */

import type { Session, SessionState } from '@/server/data_structures/Session';
import type { AnswerSession, AnswerSessionState, AnswerStoryRecord } from '@/server/data_structures/AnswerSession';
import type { SlotState } from '@/server/data_structures/VoiceInteractionContext';
import {
  DEFAULT_RECALL_QUESTIONS,
  initializeQuestionProgress,
  QuestionProgressStateSchema,
  type QuestionProgressState,
} from '@/lib/recallQuestions';
import { supabase } from '@/lib/supabase';
import { SessionErrors, SessionError } from '@/server/error_definitions/SessionErrors';
import { randomUUID } from 'node:crypto';

const DEFAULT_BOOTSTRAP_QUESTION = {
  text: 'Tell me about a time you led a cross-functional effort that delivered meaningful business impact.',
  category: 'behavioral',
} as const;

const DEFAULT_BOOTSTRAP_REQUIREMENTS = [
  {
    description: 'Demonstrates clear ownership and leadership across teammates or functions',
    priority: 'REQUIRED' as const,
  },
  {
    description: 'Shows measurable impact with concrete outcomes and metrics',
    priority: 'REQUIRED' as const,
  },
  {
    description: 'Reflects strong communication and stakeholder management',
    priority: 'PREFERRED' as const,
  },
] as const;

const DEFAULT_BOOTSTRAP_STORIES = [
  {
    title: 'Led delivery of a high-impact cross-functional project',
    summary: 'Coordinated engineering, product, and operations to deliver a critical initiative under a tight deadline, balancing tradeoffs and maintaining alignment.',
  },
  {
    title: 'Resolved execution risk through leadership and prioritization',
    summary: 'Identified a major delivery risk, reset priorities with partners, and guided the team to a successful launch with measurable customer impact.',
  },
  {
    title: 'Drove measurable outcomes through collaboration',
    summary: 'Partnered across teams to improve a core workflow, resulting in clear performance gains and better user outcomes.',
  },
] as const;

export interface BootstrapQuestionContext {
  questionId: string;
}
type SessionSource = 'answer_session' | 'session';

function normalizeResponsesForContent(content: string): string[] {
  const normalizedContent = content.trim();
  if (normalizedContent.length === 0) {
    return [];
  }
  return [normalizedContent];
}

function isMissingQuestionProgressColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('question_progress')
    && (normalized.includes('schema cache') || normalized.includes('column'));
}

function mapSession(data: Record<string, unknown>): Session {
  const createdAt = data.created_at as string;
  return {
    id: data.id as string,
    state: data.state as Session['state'],
    createdAt,
    updatedAt: (data.updated_at ?? createdAt) as string,
  };
}

function mapAnswerSession(data: Record<string, unknown>): AnswerSession {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    state: data.state as AnswerSession['state'],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function mapStoryRecord(data: Record<string, unknown>): AnswerStoryRecord {
  const rawResponses = data.responses;
  const responses = Array.isArray(rawResponses)
    ? rawResponses.filter((value): value is string => typeof value === 'string')
    : undefined;
  const questionProgress = QuestionProgressStateSchema.safeParse(data.question_progress);

  return {
    id: data.id as string,
    // Voice workflow records are linked via voice_session_id.
    // Keep session_id as legacy fallback for older rows.
    sessionId: (data.voice_session_id ?? data.session_id) as string,
    questionId: (data.question_id as string | null | undefined) ?? null,
    status: data.status as AnswerStoryRecord['status'],
    content: data.content as string | undefined,
    responses,
    questionProgress: questionProgress.success ? questionProgress.data : undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export const SessionDAO = {
  /**
   * Find a session by its ID.
   * Returns null if not found.
   */
  async findById(id: string): Promise<Session | null> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to find session: ${error.message}`);
      }

      if (!data) return null;
      return mapSession(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  async findPrepSessionUserId(id: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to find prep session owner: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const prepSessionUserId = typeof data.user_id === 'string'
        ? data.user_id.trim()
        : '';
      return prepSessionUserId.length > 0 ? prepSessionUserId : null;
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Update session state and return the updated entity.
   * Throws PersistenceError on database failure.
   */
  async updateState(id: string, newState: SessionState): Promise<Session> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({ state: newState, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to update session state: ${error.message}`);
      }
      if (!data) {
        throw SessionErrors.PersistenceFailure('No data returned from session state update');
      }
      return mapSession(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  // -------------------------------------------------------------------------
  // Path 306: initiate-voice-assisted-answer-session
  // -------------------------------------------------------------------------

  /**
   * Create a new AnswerSession in INIT state.
   * Returns the persisted entity with generated ID and timestamps.
   */
  async createSession(userId: string): Promise<AnswerSession> {
    try {
      const { data, error } = await supabase
        .from('answer_sessions')
        .insert({ user_id: userId, state: 'INIT' })
        .select()
        .single();

      if (error) {
        throw SessionErrors.SessionPersistenceError(`Failed to create answer session: ${error.message}`);
      }
      if (!data) {
        throw SessionErrors.SessionPersistenceError('No data returned from answer session creation');
      }
      return mapAnswerSession(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.SessionPersistenceError(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Create a new StoryRecord linked to an AnswerSession in INIT status.
   * Returns the persisted entity with generated ID and timestamps.
   */
  async createStoryRecord(
    sessionId: string,
    userId: string,
    questionId: string,
  ): Promise<AnswerStoryRecord> {
    try {
      const { data, error } = await supabase
        .from('story_records')
        .insert({
          voice_session_id: sessionId,
          question_id: questionId,
          user_id: userId,
          status: 'INIT',
        })
        .select()
        .single();

      if (error) {
        throw SessionErrors.StoryPersistenceError(`Failed to create story record: ${error.message}`);
      }
      if (!data) {
        throw SessionErrors.StoryPersistenceError('No data returned from story record creation');
      }
      return mapStoryRecord(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.StoryPersistenceError(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Create baseline question context required by ORIENT:
   * - one question
   * - job requirements linked to that question
   * - available stories linked to that question
   */
  async createBootstrapQuestionContext(): Promise<BootstrapQuestionContext> {
    let questionId: string | null = null;

    try {
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .insert(DEFAULT_BOOTSTRAP_QUESTION)
        .select('id')
        .single();

      if (questionError) {
        throw SessionErrors.SessionPersistenceError(
          `Failed to create bootstrap question: ${questionError.message}`,
        );
      }
      if (!questionData?.id) {
        throw SessionErrors.SessionPersistenceError(
          'No question id returned during bootstrap context creation',
        );
      }

      questionId = questionData.id as string;

      const jobRequirementRows = DEFAULT_BOOTSTRAP_REQUIREMENTS.map((req) => ({
        id: `jr-${randomUUID()}`,
        description: req.description,
        priority: req.priority,
        question_id: questionId,
      }));

      const { error: requirementsError } = await supabase
        .from('job_requirements')
        .insert(jobRequirementRows);

      if (requirementsError) {
        throw SessionErrors.SessionPersistenceError(
          `Failed to create bootstrap job requirements: ${requirementsError.message}`,
        );
      }

      const storyRows = DEFAULT_BOOTSTRAP_STORIES.map((story) => ({
        id: `story-${randomUUID()}`,
        title: story.title,
        summary: story.summary,
        status: 'AVAILABLE',
        question_id: questionId,
      }));

      const { error: storiesError } = await supabase
        .from('stories')
        .insert(storyRows);

      if (storiesError) {
        throw SessionErrors.SessionPersistenceError(
          `Failed to create bootstrap stories: ${storiesError.message}`,
        );
      }

      return { questionId };
    } catch (err) {
      if (questionId) {
        try {
          await SessionDAO.deleteBootstrapQuestionContext(questionId);
        } catch {
          // Best-effort cleanup for partial bootstrap context.
        }
      }

      if (err instanceof SessionError) throw err;
      throw SessionErrors.SessionPersistenceError(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Delete bootstrap question context in FK-safe order.
   */
  async deleteBootstrapQuestionContext(questionId: string): Promise<void> {
    try {
      const { error: storiesError } = await supabase
        .from('stories')
        .delete()
        .eq('question_id', questionId);

      if (storiesError) {
        throw SessionErrors.PersistenceFailure(
          `Failed to delete bootstrap stories: ${storiesError.message}`,
        );
      }

      const { error: requirementsError } = await supabase
        .from('job_requirements')
        .delete()
        .eq('question_id', questionId);

      if (requirementsError) {
        throw SessionErrors.PersistenceFailure(
          `Failed to delete bootstrap job requirements: ${requirementsError.message}`,
        );
      }

      const { error: questionError } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (questionError) {
        throw SessionErrors.PersistenceFailure(
          `Failed to delete bootstrap question: ${questionError.message}`,
        );
      }
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Delete an AnswerSession by ID (used for rollback on failure).
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('answer_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to delete answer session: ${error.message}`);
      }
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  // -------------------------------------------------------------------------
  // Path 307: process-voice-input-and-progress-session
  // -------------------------------------------------------------------------

  /**
   * Find an AnswerSession by its ID.
   * Returns null if not found.
   */
  async findAnswerSessionById(id: string): Promise<AnswerSession | null> {
    try {
      const { data, error } = await supabase
        .from('answer_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to find answer session: ${error.message}`);
      }

      if (!data) return null;
      return mapAnswerSession(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  async findStoryRecordByVoiceSessionId(sessionId: string): Promise<AnswerStoryRecord | null> {
    try {
      const { data, error } = await supabase
        .from('story_records')
        .select('*')
        .eq('voice_session_id', sessionId)
        .maybeSingle();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to find story record: ${error.message}`);
      }

      if (!data) return null;
      return mapStoryRecord(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  async findStoryRecordByPrepSessionId(sessionId: string): Promise<AnswerStoryRecord | null> {
    try {
      const { data, error } = await supabase
        .from('story_records')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to find prep story record: ${error.message}`);
      }

      if (!data) return null;
      return mapStoryRecord(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Backward-compatible alias for voice-session story lookup.
   */
  async findStoryRecordBySessionId(sessionId: string): Promise<AnswerStoryRecord | null> {
    return this.findStoryRecordByCanonicalSessionId(sessionId, 'answer_session');
  },

  async findStoryRecordByCanonicalSessionId(
    sessionId: string,
    preferredSource: SessionSource = 'answer_session',
  ): Promise<AnswerStoryRecord | null> {
    const preferred = preferredSource === 'session'
      ? await this.findStoryRecordByPrepSessionId(sessionId)
      : await this.findStoryRecordByVoiceSessionId(sessionId);
    if (preferred) {
      return preferred;
    }

    return preferredSource === 'session'
      ? await this.findStoryRecordByVoiceSessionId(sessionId)
      : await this.findStoryRecordByPrepSessionId(sessionId);
  },

  async upsertPrepStoryRecordWorkingAnswer(
    prepSessionId: string,
    content: string,
  ): Promise<AnswerStoryRecord | null> {
    try {
      const { data: prepSession, error: prepSessionError } = await supabase
        .from('sessions')
        .select('id, user_id')
        .eq('id', prepSessionId)
        .maybeSingle();

      if (prepSessionError) {
        throw SessionErrors.PersistenceFailure(
          `Failed to resolve prep session ownership: ${prepSessionError.message}`,
        );
      }

      if (!prepSession) {
        throw SessionErrors.NotFound(`Session ${prepSessionId} not found`);
      }

      const prepSessionUserId = typeof prepSession.user_id === 'string'
        ? prepSession.user_id.trim()
        : '';

      if (!prepSessionUserId) {
        throw SessionErrors.PersistenceFailure(
          `Prep session ${prepSessionId} is missing user_id required for durable story record writes`,
        );
      }

      const existingStoryRecord = await this.findStoryRecordByCanonicalSessionId(prepSessionId, 'session');
      if (existingStoryRecord) {
        const { data, error } = await supabase
          .from('story_records')
          .update({
            content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStoryRecord.id)
          .select()
          .single();

        if (error) {
          throw SessionErrors.PersistenceFailure(
            `Failed to update prep story record content: ${error.message}`,
          );
        }

        if (!data) {
          throw SessionErrors.PersistenceFailure(
            'No data returned from prep story record content update',
          );
        }

        return mapStoryRecord(data);
      }

      const initialQuestionProgress = initializeQuestionProgress(DEFAULT_RECALL_QUESTIONS);
      const createWithQuestionProgressPayload = {
        session_id: prepSessionId,
        user_id: prepSessionUserId,
        status: 'RECALL',
        content,
        responses: normalizeResponsesForContent(content),
        question_progress: initialQuestionProgress,
      };

      const firstInsert = await supabase
        .from('story_records')
        .insert(createWithQuestionProgressPayload)
        .select()
        .single();

      if (!firstInsert.error && firstInsert.data) {
        return mapStoryRecord(firstInsert.data);
      }

      if (
        firstInsert.error
        && isMissingQuestionProgressColumnError(firstInsert.error.message)
      ) {
        const fallbackInsert = await supabase
          .from('story_records')
          .insert({
            session_id: prepSessionId,
            user_id: prepSessionUserId,
            status: 'RECALL',
            content,
            responses: normalizeResponsesForContent(content),
          })
          .select()
          .single();

        if (fallbackInsert.error) {
          throw SessionErrors.PersistenceFailure(
            `Failed to create prep story record content: ${fallbackInsert.error.message}`,
          );
        }

        if (!fallbackInsert.data) {
          throw SessionErrors.PersistenceFailure(
            'No data returned from prep story record creation',
          );
        }

        return mapStoryRecord(fallbackInsert.data);
      }

      if (firstInsert.error) {
        throw SessionErrors.PersistenceFailure(
          `Failed to create prep story record content: ${firstInsert.error.message}`,
        );
      }

      throw SessionErrors.PersistenceFailure(
        'No data returned from prep story record creation',
      );
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Sequentially update both the AnswerSession state and AnswerStoryRecord content.
   * Returns the updated entities.
   * Throws on database failure.
   */
  async updateSessionAndStoryRecord(
    sessionId: string,
    newState: AnswerSessionState,
    storyRecordId: string,
    storyContent: string,
    responses?: string[],
  ): Promise<{ session: AnswerSession; storyRecord: AnswerStoryRecord }> {
    try {
      // Step 1: Update the answer session
      const { data: sessionData, error: sessionError } = await supabase
        .from('answer_sessions')
        .update({ state: newState, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (sessionError) {
        throw SessionErrors.PersistenceFailed(`Failed to update answer session: ${sessionError.message}`);
      }
      if (!sessionData) {
        throw SessionErrors.PersistenceFailed('No data returned from answer session update');
      }

      // Step 2: Update the story record
      const storyRecordUpdatePayload: Record<string, unknown> = {
        status: newState,
        content: storyContent,
        updated_at: new Date().toISOString(),
      };

      if (responses) {
        storyRecordUpdatePayload.responses = responses;
      }

      const { data: storyData, error: storyError } = await supabase
        .from('story_records')
        .update(storyRecordUpdatePayload)
        .eq('id', storyRecordId)
        .select()
        .single();

      if (storyError) {
        throw SessionErrors.PersistenceFailed(`Failed to update story record (session already updated): ${storyError.message}`);
      }
      if (!storyData) {
        throw SessionErrors.PersistenceFailed('No data returned from story record update');
      }

      return {
        session: mapAnswerSession(sessionData),
        storyRecord: mapStoryRecord(storyData),
      };
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailed(`Unexpected: ${(err as Error).message}`);
    }
  },

  // -------------------------------------------------------------------------
  // Path 318: complete-voice-answer-advances-workflow
  // -------------------------------------------------------------------------

  /**
   * Save completed slot values for a session and question type.
   * Marks the question_type as complete.
   */
  async saveSlots(
    sessionId: string,
    questionTypeId: string,
    slotState: SlotState,
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('session_slots')
        .upsert({
          session_id: sessionId,
          question_type_id: questionTypeId,
          slots: slotState.slots,
          status: 'COMPLETE',
        });

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to save slots: ${error.message}`);
      }
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  /**
   * Update AnswerSession state for workflow advancement.
   */
  async updateAnswerSessionState(
    sessionId: string,
    newState: AnswerSessionState,
  ): Promise<AnswerSession> {
    try {
      const { data, error } = await supabase
        .from('answer_sessions')
        .update({ state: newState, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to update answer session state: ${error.message}`);
      }
      if (!data) {
        throw SessionErrors.PersistenceFailure('No data returned from answer session state update');
      }
      return mapAnswerSession(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  async updateStoryRecordWorkingAnswer(
    sessionId: string,
    content: string,
    sessionSource: SessionSource = 'answer_session',
  ): Promise<AnswerStoryRecord | null> {
    try {
      const storyRecord = await this.findStoryRecordByCanonicalSessionId(sessionId, sessionSource);
      if (!storyRecord) {
        return null;
      }

      const { data, error } = await supabase
        .from('story_records')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyRecord.id)
        .select()
        .single();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to update story record content: ${error.message}`);
      }

      if (!data) {
        throw SessionErrors.PersistenceFailure('No data returned from story record content update');
      }

      return mapStoryRecord(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  async replaceStoryRecordResponses(
    sessionId: string,
    responses: string[],
    sessionSource: SessionSource = 'answer_session',
  ): Promise<AnswerStoryRecord | null> {
    try {
      const storyRecord = await this.findStoryRecordByCanonicalSessionId(sessionId, sessionSource);
      if (!storyRecord) {
        return null;
      }

      const { data, error } = await supabase
        .from('story_records')
        .update({
          responses,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyRecord.id)
        .select()
        .single();

      if (error) {
        throw SessionErrors.PersistenceFailure(`Failed to update story record responses: ${error.message}`);
      }

      if (!data) {
        throw SessionErrors.PersistenceFailure('No data returned from story record responses update');
      }

      return mapStoryRecord(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },

  async updateStoryRecordQuestionProgress(
    sessionId: string,
    questionProgress: QuestionProgressState,
    sessionSource: SessionSource = 'answer_session',
  ): Promise<AnswerStoryRecord | null> {
    try {
      const storyRecord = await this.findStoryRecordByCanonicalSessionId(sessionId, sessionSource);
      if (!storyRecord) {
        return null;
      }

      const { data, error } = await supabase
        .from('story_records')
        .update({
          question_progress: questionProgress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storyRecord.id)
        .select()
        .single();

      if (error) {
        if (isMissingQuestionProgressColumnError(error.message)) {
          return {
            ...storyRecord,
            questionProgress,
          };
        }
        throw SessionErrors.PersistenceFailure(`Failed to update story record question progress: ${error.message}`);
      }

      if (!data) {
        throw SessionErrors.PersistenceFailure('No data returned from story record question progress update');
      }

      return mapStoryRecord(data);
    } catch (err) {
      if (err instanceof SessionError) throw err;
      throw SessionErrors.PersistenceFailure(`Unexpected: ${(err as Error).message}`);
    }
  },
} as const;
