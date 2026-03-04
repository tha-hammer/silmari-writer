/**
 * InitializeSessionService - Validates required domain objects, constructs a
 * new session entity with embedded ResumeObject, JobObject, and QuestionObject,
 * sets state to "initialized", and delegates persistence to the DAO.
 *
 * Resource: db-h2s4 (service)
 * Paths:
 *   - 310-initialize-new-session-with-provided-objects
 *   - 311-reject-duplicate-session-initialization
 *   - 312-reject-session-initialization-when-required-objects-missing-or-invalid
 */

import type { ResumeObject, JobObject, QuestionObject } from '@/server/data_structures/SessionObjects';
import type { InitializedSession } from '@/server/data_structures/InitializedSession';
import { InitializeSessionDAO } from '@/server/data_access_objects/InitializeSessionDAO';
import { SessionUniquenessVerifier } from '@/server/verifiers/SessionUniquenessVerifier';
import { SessionObjectVerifier } from '@/server/verifiers/SessionObjectVerifier';
import { ObjectSchemaVerifier } from '@/server/verifiers/ObjectSchemaVerifier';
import { SessionError, SessionErrors } from '@/server/error_definitions/SessionErrors';

interface CreateSessionInput {
  resume: ResumeObject;
  job: JobObject;
  question: QuestionObject;
  userId?: string;
}

const STALE_INITIALIZED_MS = 30 * 60 * 1000;

function isInitializedSessionStale(createdAt: string, nowMs = Date.now()): boolean {
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) {
    return false;
  }

  return nowMs - createdMs >= STALE_INITIALIZED_MS;
}

export const InitializeSessionService = {
  /**
   * Validate required domain objects for presence and structural correctness.
   * Returns an array of error descriptions (empty array = valid).
   *
   * Uses:
   *   - SessionObjectVerifier.verifyPresence (db-j6x9) for presence checks
   *   - ObjectSchemaVerifier.validate (cfg-g1u4) for Zod structural validation
   *
   * Path: 312-reject-session-initialization-when-required-objects-missing-or-invalid
   */
  validateInput(input: CreateSessionInput): string[] {
    const errors: string[] = [];

    // Step 1: Presence checks (are objects null/undefined?)
    const presenceResult = SessionObjectVerifier.verifyPresence({
      resume: input.resume,
      job: input.job,
      question: input.question,
    });

    if (!presenceResult.valid) {
      errors.push(...presenceResult.errors);
      // Return early — no point checking structure of missing objects
      return errors;
    }

    // Step 2: Structural validation (do objects conform to Zod schemas?)
    const structureResult = ObjectSchemaVerifier.validate({
      resume: input.resume,
      job: input.job,
      question: input.question,
    });

    if (!structureResult.valid) {
      errors.push(...structureResult.errors);
    }

    return errors;
  },

  /**
   * Defense-in-depth guard: prevents DAO invocation when validation errors exist.
   * Should never trigger in normal flow (validation returns early), but acts as
   * a safety net against programming errors.
   *
   * Path: 312-reject-session-initialization-when-required-objects-missing-or-invalid
   */
  guardPersistence(validationErrors: string[]): void {
    if (validationErrors.length > 0) {
      throw SessionErrors.InternalPersistenceViolation(
        `Cannot persist session: validation errors exist (${validationErrors.join('; ')})`,
      );
    }
  },

  /**
   * Create a new session entity:
   * 1. Validate required domain objects (Path 312)
   * 2. Check if an active session already exists (Path 311)
   * 3. Verify uniqueness constraint — reject if active session found
   * 4. Guard persistence (Path 312 defense-in-depth)
   * 5. Construct session with embedded objects, state = "initialized"
   * 6. Delegate persistence to InitializeSessionDAO
   * 7. Return persisted session
   *
   * Known SessionErrors (e.g., PERSISTENCE_FAILURE, SESSION_ALREADY_ACTIVE,
   * MISSING_REQUIRED_OBJECT) are rethrown as-is.
   * Unknown errors are wrapped in SessionErrors.ServiceError.
   */
  async createSession(input: CreateSessionInput): Promise<InitializedSession> {
    // Step 1 (Path 312): Validate required domain objects
    const validationErrors = InitializeSessionService.validateInput(input);

    if (validationErrors.length > 0) {
      throw SessionErrors.MissingRequiredObject(
        `Validation failed: ${validationErrors.join('; ')}`,
      );
    }

    try {
      // Step 2 (Path 311): Check for existing active session
      const activeSession = await InitializeSessionDAO.getActiveSession(input.userId);

      // Step 3 (Path 311): Verify uniqueness — supersede stale initialized sessions
      // A session stuck in 'initialized' never progressed (previous attempt failed),
      // so always supersede it. Only block if a non-initialized session is active.
      if (activeSession && input.userId) {
        await InitializeSessionDAO.supersedeInitializedSession(activeSession.id);
      } else {
        SessionUniquenessVerifier.verify(activeSession !== null);
      }

      // Step 4 (Path 312): Defense-in-depth persistence guard
      InitializeSessionService.guardPersistence(validationErrors);

      // Step 5: Construct the session entity
      const sessionEntity = {
        resume: input.resume,
        job: input.job,
        question: input.question,
        state: 'initialized' as const,
        createdAt: new Date().toISOString(),
      };

      // Step 6: Delegate persistence to DAO
      const persisted = await InitializeSessionDAO.persist(sessionEntity, input.userId);

      return persisted;
    } catch (error) {
      // Known session errors → rethrow
      if (error instanceof SessionError) {
        throw error;
      }

      // Unknown errors → wrap in ServiceError
      throw SessionErrors.ServiceError(
        `Failed to create session: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  },
} as const;
