/**
 * SessionProgressionService - Orchestrates session progression by coordinating
 * VoiceResponseProcessor and SessionDAO for state transitions and StoryRecord updates.
 *
 * Resource: db-h2s4 (service)
 * Path: 307-process-voice-input-and-progress-session
 *
 * Given an INIT session + transcript:
 * 1. VoiceResponseProcessor determines next state
 * 2. Validates state transition
 * 3. SessionDAO persists updated session + StoryRecord (transactional)
 * 4. Returns updated entities
 */

import type { AnswerSession, SessionWithStoryRecord } from '@/server/data_structures/AnswerSession';
import { VALID_STATE_TRANSITIONS } from '@/server/data_structures/AnswerSession';
import { VoiceResponseProcessor } from '@/server/processors/VoiceResponseProcessor';
import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { SessionErrors } from '@/server/error_definitions/SessionErrors';
import { SessionError } from '@/server/error_definitions/SessionErrors';
import { logger } from '@/server/logging/logger';

export const SessionProgressionService = {
  /**
   * Progress an AnswerSession from INIT to the next state based on voice transcript.
   *
   * @param session - The current AnswerSession (must be in INIT state)
   * @param transcript - The user's voice transcript content
   * @returns SessionWithStoryRecord with updated session and story record
   * @throws SessionError with INVALID_TRANSITION if state transition is invalid
   * @throws SessionError with PERSISTENCE_FAILED if DAO persistence fails
   */
  async progressSession(
    session: AnswerSession,
    transcript: string,
  ): Promise<SessionWithStoryRecord> {
    // Step 1: Process voice response to determine next state
    const processorResult = VoiceResponseProcessor.process(transcript, session);

    // Step 2: Validate state transition
    const validNextStates = VALID_STATE_TRANSITIONS[session.state];
    if (!validNextStates || !validNextStates.includes(processorResult.nextState)) {
      throw SessionErrors.InvalidTransition(
        `Cannot transition from ${session.state} to ${processorResult.nextState}`,
      );
    }

    // Step 3: Find associated story record
      const storyRecord = await SessionDAO.findStoryRecordBySessionId(session.id);
      if (!storyRecord) {
        throw SessionErrors.InvalidState('No story record found for session');
      }

      const existingResponses = Array.isArray(storyRecord.responses) ? storyRecord.responses : [];
      const nextResponses =
        existingResponses.at(-1) === transcript
          ? existingResponses
          : [...existingResponses, transcript];

      // Step 4: Persist updated session + story record (transactional)
      try {
        const updatedEntities = await SessionDAO.updateSessionAndStoryRecord(
          session.id,
          processorResult.nextState,
          storyRecord.id,
          processorResult.updatedContent,
          nextResponses,
        );

        return updatedEntities;
      } catch (error) {
      // Known session errors → rethrow
      if (error instanceof SessionError) {
        throw error;
      }

      // Unknown errors → log and wrap
      logger.error(
        'Failed to persist session progression',
        error,
        { path: '307-process-voice-input-and-progress-session', resource: 'db-h2s4' },
      );

      throw SessionErrors.PersistenceFailed(
        `Failed to persist session progression: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  },
} as const;
