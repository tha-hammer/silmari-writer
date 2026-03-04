/**
 * WritingFlowModule - Manages writing flow step navigation between RECALL and REVIEW.
 *
 * Resource: ui-v3n6 (module)
 * Path: 331-return-to-recall-from-review
 *
 * Manages:
 * - Active step state (RECALL or REVIEW)
 * - Navigation intent handling from child components
 * - Conditional rendering of step components
 * - Error boundary for Recall rendering failures
 * - Error logging via frontendLogger (cfg-r3d7)
 */

'use client';

import { useState, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import ReviewScreen from '@/components/review/ReviewScreen';
import RecallScreen from '@/components/RecallScreen';
import type { SessionVoiceTurnsSource } from '@/api_contracts/sessionVoiceTurns';
import { frontendLogger } from '@/logging/index';
import type { Story } from '@/server/data_structures/ConfirmStory';
import type {
  WritingFlowStep,
  WritingFlowState,
  NavigationIntent,
} from './writingFlow';
import { isValidFlowState, createInitialFlowState } from './writingFlow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WritingFlowModuleProps {
  initialStep?: WritingFlowStep | string;
  selectedStory?: Story | null;
  sessionId?: string;
  sessionSource?: SessionVoiceTurnsSource;
  initialWorkingAnswer?: string | null;
  initialResponses?: string[];
  onVoiceResponseSaved?: () => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Error Boundary for Recall rendering (Step 3)
// ---------------------------------------------------------------------------

interface RecallErrorBoundaryState {
  hasError: boolean;
}

class RecallRenderErrorBoundary extends Component<
  { children: ReactNode },
  RecallErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): RecallErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    frontendLogger.error(
      'Recall render failure',
      error,
      {
        module: 'WritingFlowModule',
        action: 'RecallRenderErrorBoundary',
        componentStack: errorInfo.componentStack,
      },
    );
  }

  render() {
    if (this.state.hasError) {
      return <FallbackRecallError />;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Fallback Error Component
// ---------------------------------------------------------------------------

function FallbackRecallError() {
  return (
    <div
      data-testid="recall-fallback-error"
      className="flex flex-col items-center justify-center p-8 text-center"
      role="alert"
    >
      <p className="text-lg font-medium text-red-600">
        Unable to load Recall step
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Please try refreshing the page.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Valid steps validation
// ---------------------------------------------------------------------------

const VALID_STEPS = new Set<string>(['RECALL', 'REVIEW']);

function resolveInitialStep(input: string | undefined): WritingFlowStep {
  if (input && VALID_STEPS.has(input)) {
    return input as WritingFlowStep;
  }
  return 'REVIEW';
}

// ---------------------------------------------------------------------------
// Module Component
// ---------------------------------------------------------------------------

export function WritingFlowModule({
  initialStep,
  selectedStory = null,
  sessionId,
  sessionSource,
  initialWorkingAnswer = null,
  initialResponses = [],
  onVoiceResponseSaved,
}: WritingFlowModuleProps) {
  const [state, setState] = useState<WritingFlowState>(() => {
    const resolved = resolveInitialStep(initialStep);

    // Log error if initial step was invalid (only fires once on init)
    if (initialStep !== undefined && !VALID_STEPS.has(initialStep)) {
      frontendLogger.error(
        'Invalid flow state',
        new Error(`Invalid initial step: ${String(initialStep)}`),
        { module: 'WritingFlowModule', action: 'init' },
      );
    }

    return createInitialFlowState(resolved);
  });

  // Handle navigation intent from child components
  const handleNavigation = (intent: NavigationIntent) => {
    if (!isValidFlowState(state)) {
      frontendLogger.error(
        'Invalid flow state',
        new Error('Cannot navigate: current state is invalid'),
        { module: 'WritingFlowModule', action: 'handleNavigation' },
      );
      return;
    }

    setState({ activeStep: intent.targetStep });
  };

  return (
    <div data-testid="writing-flow-module" className="flex flex-col gap-4">
      {state.activeStep === 'REVIEW' && (
        <ReviewScreen onNavigate={handleNavigation} />
      )}

      {state.activeStep === 'RECALL' && (
        <RecallRenderErrorBoundary>
          <RecallScreen
            selectedStory={selectedStory}
            sessionId={sessionId}
            sessionSource={sessionSource}
            initialWorkingAnswer={initialWorkingAnswer}
            initialResponses={initialResponses}
            onVoiceResponseSaved={onVoiceResponseSaved}
            onAdvanceToReview={() => setState({ activeStep: 'REVIEW' })}
          />
        </RecallRenderErrorBoundary>
      )}
    </div>
  );
}
