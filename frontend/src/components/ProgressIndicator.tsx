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
    <div data-testid="progress-indicator" className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <div data-testid="progress-anchors" className="rounded-md border bg-muted/40 p-2 text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Anchors</span>
          <p className="text-lg font-semibold leading-tight text-foreground">{progress.anchors}</p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block" data-testid="progress-anchors-help">
            {helperCopy.anchors}
          </p>
        </div>

        <div data-testid="progress-actions" className="rounded-md border bg-muted/40 p-2 text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Actions</span>
          <p className="text-lg font-semibold leading-tight text-foreground">{progress.actions}</p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block" data-testid="progress-actions-help">
            {helperCopy.actions}
          </p>
        </div>

        <div data-testid="progress-outcomes" className="rounded-md border bg-muted/40 p-2 text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Outcomes</span>
          <p className="text-lg font-semibold leading-tight text-foreground">{progress.outcomes}</p>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block" data-testid="progress-outcomes-help">
            {helperCopy.outcomes}
          </p>
        </div>
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
