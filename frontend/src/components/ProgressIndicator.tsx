/**
 * ProgressIndicator - Displays progress for Anchors, Actions, and Outcomes.
 *
 * Resource: ui-w8p2 (component)
 * Path: 303-display-recall-state-with-record-button-and-progress-indicator
 *
 * Renders completion status for the three RECALL dimensions.
 */

'use client';

import type { RecallProgress } from '@/data_loaders/RecallProgressLoader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressIndicatorProps {
  progress: RecallProgress;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProgressIndicator({ progress }: ProgressIndicatorProps) {
  const incompleteSlots = new Set(progress.incompleteSlots ?? []);

  const helperCopy: Record<'anchors' | 'actions' | 'outcomes', string> = {
    anchors: 'Context, scope, and why this story matters.',
    actions: 'What you did specifically, with clear decisions.',
    outcomes: 'Impact, results, and measurable change.',
  };

  return (
    <div data-testid="progress-indicator" className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between" data-testid="progress-anchors">
        <div>
          <span className="text-sm font-medium text-gray-700">Anchors</span>
          <p className="text-xs text-muted-foreground" data-testid="progress-anchors-help">
            {helperCopy.anchors}
          </p>
        </div>
        <span className="text-lg font-bold text-gray-900">{progress.anchors}</span>
      </div>
      <div className="flex items-center justify-between" data-testid="progress-actions">
        <div>
          <span className="text-sm font-medium text-gray-700">Actions</span>
          <p className="text-xs text-muted-foreground" data-testid="progress-actions-help">
            {helperCopy.actions}
          </p>
        </div>
        <span className="text-lg font-bold text-gray-900">{progress.actions}</span>
      </div>
      <div className="flex items-center justify-between" data-testid="progress-outcomes">
        <div>
          <span className="text-sm font-medium text-gray-700">Outcomes</span>
          <p className="text-xs text-muted-foreground" data-testid="progress-outcomes-help">
            {helperCopy.outcomes}
          </p>
        </div>
        <span className="text-lg font-bold text-gray-900">{progress.outcomes}</span>
      </div>

      {incompleteSlots.size > 0 && (
        <div
          data-testid="progress-incomplete-hint"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          Incomplete now: {[...incompleteSlots].join(', ')}.
        </div>
      )}
    </div>
  );
}
