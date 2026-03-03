/**
 * InitializeSessionDAO - Persists initialized session entities with
 * embedded ResumeObject, JobObject, and QuestionObject.
 *
 * Resource: db-d3w8 (data_access_object)
 * Paths:
 *   - 310-initialize-new-session-with-provided-objects
 *   - 311-reject-duplicate-session-initialization
 *
 * Uses Supabase to insert into the sessions table with JSONB columns
 * for resume, job, and question objects.
 */

import { supabase } from '@/lib/supabase';
import { SessionErrors } from '@/server/error_definitions/SessionErrors';
import type { InitializedSession } from '@/server/data_structures/InitializedSession';

interface SessionToPersist {
  resume: InitializedSession['resume'];
  job: InitializedSession['job'];
  question: InitializedSession['question'];
  state: 'initialized';
  createdAt: string;
}

export const InitializeSessionDAO = {
  /**
   * Check if an active (non-finalized) session exists.
   * Returns the active session if found, null otherwise.
   *
   * An "active" session is one whose state is 'initialized' (not yet completed/finalized).
   *
   * On DB failure → throws SessionErrors.PersistenceFailure
   *
   * Path: 311-reject-duplicate-session-initialization
   */
  async getActiveSession(userId?: string): Promise<InitializedSession | null> {
    try {
      let query = supabase
        .from('sessions')
        .select()
        .eq('state', 'initialized');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query
        .limit(1)
        .maybeSingle();

      if (error) {
        throw SessionErrors.PersistenceFailure(
          `Failed to check for active session: ${error.message}`,
        );
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        resume: data.resume,
        job: data.job,
        question: data.question,
        state: data.state,
        createdAt: data.created_at,
      };
    } catch (error) {
      // If already a SessionError, rethrow
      if (error instanceof Error && error.name === 'SessionError') {
        throw error;
      }

      throw SessionErrors.PersistenceFailure(
        `Failed to check for active session: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  },

  /**
   * Persist a new session entity with embedded objects.
   * Returns the persisted session with its generated UUID.
   *
   * On DB failure → throws SessionErrors.PersistenceFailure
   */
  async persist(session: SessionToPersist, userId?: string): Promise<InitializedSession> {
    try {
      const insertPayload: Record<string, unknown> = {
        resume: session.resume,
        job: session.job,
        question: session.question,
        state: session.state,
        created_at: session.createdAt,
        updated_at: session.createdAt,
      };

      if (userId) {
        insertPayload.user_id = userId;
      }

      const { data, error } = await supabase
        .from('sessions')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        throw SessionErrors.PersistenceFailure(
          `Failed to persist session: ${error.message}`,
        );
      }

      return {
        id: data.id,
        resume: data.resume,
        job: data.job,
        question: data.question,
        state: data.state,
        createdAt: data.created_at,
      };
    } catch (error) {
      // If already a SessionError, rethrow
      if (error instanceof Error && error.name === 'SessionError') {
        throw error;
      }

      throw SessionErrors.PersistenceFailure(
        `Failed to persist session: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  },

  async supersedeInitializedSession(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          state: 'FINALIZE',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        throw SessionErrors.PersistenceFailure(
          `Failed to supersede stale session: ${error.message}`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'SessionError') {
        throw error;
      }

      throw SessionErrors.PersistenceFailure(
        `Failed to supersede stale session: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  },
} as const;
