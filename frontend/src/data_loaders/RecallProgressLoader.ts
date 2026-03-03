/**
 * RecallProgressLoader - Supplies progress data for Anchors, Actions, and Outcomes.
 *
 * Resource: ui-y5t3 (data_loader)
 * Path: 303-display-recall-state-with-record-button-and-progress-indicator
 *
 * Fetches progress from the Next.js API route /api/recall/progress.
 * On failure, returns neutral (zero) state and logs via frontendLogger.
 */

import { frontendLogger } from '@/logging/index';
import { UiErrors } from '@/server/error_definitions/UiErrors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecallProgress {
  anchors: number;
  actions: number;
  outcomes: number;
  incompleteSlots?: Array<'anchors' | 'actions' | 'outcomes'>;
}

// ---------------------------------------------------------------------------
// Neutral / empty state
// ---------------------------------------------------------------------------

export const NEUTRAL_PROGRESS: RecallProgress = {
  anchors: 0,
  actions: 0,
  outcomes: 0,
  incompleteSlots: ['anchors', 'actions', 'outcomes'],
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads recall progress data from the API.
 *
 * On success → returns parsed RecallProgress.
 * On error → logs UI_PROGRESS_LOAD_FAILED and returns neutral state.
 */
export async function loadRecallProgress(sessionId: string): Promise<RecallProgress> {
  try {
    const response = await fetch(`/api/recall/progress?sessionId=${encodeURIComponent(sessionId)}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      anchors: typeof data.anchors === 'number' ? data.anchors : 0,
      actions: typeof data.actions === 'number' ? data.actions : 0,
      outcomes: typeof data.outcomes === 'number' ? data.outcomes : 0,
      incompleteSlots: Array.isArray(data.incompleteSlots)
        ? data.incompleteSlots.filter((slot: unknown): slot is 'anchors' | 'actions' | 'outcomes' => (
          slot === 'anchors' || slot === 'actions' || slot === 'outcomes'
        ))
        : undefined,
    };
  } catch (error) {
    frontendLogger.error(
      'UI_PROGRESS_LOAD_FAILED',
      error instanceof Error ? error : UiErrors.ProgressLoadFailed(),
      { module: 'RecallProgressLoader', action: 'loadRecallProgress', sessionId },
    );
    return NEUTRAL_PROGRESS;
  }
}
