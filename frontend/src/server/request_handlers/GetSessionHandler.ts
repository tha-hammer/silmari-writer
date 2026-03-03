import { SessionDAO } from '@/server/data_access_objects/SessionDAO';
import { SessionError, SessionErrors } from '@/server/error_definitions/SessionErrors';
import type { SessionView } from '@/server/data_structures/SessionView';
import { logger } from '@/server/logging/logger';

export const GetSessionHandler = {
  async handle(id: string): Promise<SessionView> {
    try {
      const answerSession = await SessionDAO.findAnswerSessionById(id);
      if (answerSession) {
        const storyRecord = await SessionDAO.findStoryRecordBySessionId(answerSession.id);
        return {
          id: answerSession.id,
          state: answerSession.state,
          source: 'answer_session',
          questionId: storyRecord?.questionId ?? null,
          storyContent: storyRecord?.content ?? null,
          responses: storyRecord?.responses ?? [],
          createdAt: answerSession.createdAt,
          updatedAt: answerSession.updatedAt,
        };
      }

      const session = await SessionDAO.findById(id);
      if (session) {
        return {
          id: session.id,
          state: session.state,
          source: 'session',
          storyContent: null,
          responses: [],
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };
      }

      throw SessionErrors.NotFound(`Session ${id} not found`);
    } catch (error) {
      if (error instanceof SessionError) {
        throw error;
      }

      logger.error(
        'Unexpected error while loading session view',
        error,
        { handler: 'GetSessionHandler', sessionId: id },
      );

      throw SessionErrors.PersistenceFailure(
        `Failed to load session: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  },
} as const;
