/**
 * AnswerFinalizeService - Validates and locks an answer by setting
 * finalized=true and editable=false.
 *
 * Resource: db-h2s4 (service)
 * Path: 333-finalize-answer-locks-editing
 *
 * 1. Retrieve answer via DAO
 * 2. Verify eligibility via AnswerFinalizeVerifier
 * 3. Update via DAO with { finalized: true, editable: false, status: 'FINALIZED' }
 * 4. Return finalized result
 *
 * Throws FinalizeAnswerErrors on failure.
 */

import { AnswerDAO } from '@/server/data_access_objects/AnswerDAO';
import { AnswerFinalizeVerifier } from '@/server/verifiers/AnswerFinalizeVerifier';
import { FinalizeAnswerErrors } from '@/server/error_definitions/FinalizeAnswerErrors';
import type { FinalizeAnswerResult } from '@/server/data_structures/Answer';

export const AnswerFinalizeService = {
  /**
   * Finalize an answer, locking it from further edits.
   *
   * 1. Load answer via DAO
   * 2. Validate eligibility (completed, not already finalized)
   * 3. Update via DAO with finalized=true, editable=false
   * 4. Return finalize result { id, finalized: true, editable: false }
   *
   * Throws FinalizeAnswerErrors.AnswerNotFound if answer doesn't exist.
   * Throws FinalizeAnswerErrors.AnswerNotCompleted if not in COMPLETED status.
   * Throws FinalizeAnswerErrors.AnswerAlreadyFinalized if already finalized.
   */
  async finalize(answerId: string): Promise<FinalizeAnswerResult> {
    // Step 1: Load answer
    const answer = await AnswerDAO.findById(answerId);

    if (!answer) {
      throw FinalizeAnswerErrors.AnswerNotFound(
        `Answer '${answerId}' not found`,
      );
    }

    // Step 2: Validate eligibility
    AnswerFinalizeVerifier.assertEligible(answer);

    // Step 3: Update via DAO
    const updated = await AnswerDAO.update(answerId, {
      finalized: true,
      editable: false,
      status: 'FINALIZED',
    });

    // Step 4: Return finalize result
    return {
      id: updated.id,
      finalized: true,
      editable: false,
    };
  },
} as const;
