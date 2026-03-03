/**
 * StorySelection - UI component for selecting and confirming a story.
 *
 * Displays a list of available stories with radio-button selection.
 * Validates that exactly one story is selected before allowing confirmation.
 * Performs client-side alignment validation before submitting to the API.
 *
 * Resource: ui-w8p2 (component)
 * Paths: 313-confirm-aligned-story-selection, 314-prevent-confirmation-of-misaligned-story-selection
 */

'use client';

import { useState, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import type { Story } from '@/server/data_structures/ConfirmStory';
import { StorySelectionVerifier } from '@/verifiers/StorySelectionVerifier';
import { AlignmentVerifier } from '@/verifiers/AlignmentVerifier';
import type { AlignmentRules } from '@/verifiers/AlignmentVerifier';
import { AlignmentErrors } from '@/server/error_definitions/AlignmentErrors';
import type { AlignmentErrorKey } from '@/server/error_definitions/AlignmentErrors';
import { frontendLogger } from '@/logging/index';
import { confirmStory } from '@/api_contracts/confirmStory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorySelectionProps {
  stories: Story[];
  questionId: string;
  jobId?: string;
  onConfirmed?: (_confirmedStory: Story, _excludedCount: number) => void;
  /** @internal Test-only prop to force alignment banner render error */
  _testForceRenderError?: boolean;
}

// ---------------------------------------------------------------------------
// AlignmentErrorBanner - renders the alignment error message
// ---------------------------------------------------------------------------

function AlignmentErrorBanner({
  message,
  forceError,
}: {
  message: string;
  forceError?: boolean;
}) {
  if (forceError) {
    throw new Error('Forced render error for testing');
  }

  return (
    <div
      role="alert"
      data-testid="alignment-error"
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlignmentErrorBoundary - catches render failures in the banner
// ---------------------------------------------------------------------------

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

class AlignmentErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    frontendLogger.error(
      'AlignmentErrorBanner render failure',
      error,
      {
        component: 'StorySelection',
        action: 'renderAlignmentError',
      },
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          data-testid="alignment-error-fallback"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          An error occurred while displaying validation feedback.
        </div>
      );
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StorySelection({
  stories,
  questionId,
  jobId,
  onConfirmed,
  _testForceRenderError,
}: StorySelectionProps) {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [alignmentError, setAlignmentError] = useState<string | null>(null);

  const handleSelect = (storyId: string) => {
    setSelectedStoryId(storyId);
    setValidationError(null);
    setAlignmentError(null);
    setError(null);
  };

  const handleConfirm = async () => {
    // Frontend validation: exactly one story selected
    const verification = StorySelectionVerifier.verify(selectedStoryId, stories);
    if (!verification.valid) {
      setValidationError(verification.errors[0]);
      return;
    }

    // Alignment validation: story meets alignment criteria (path 314)
    const alignmentRules: AlignmentRules = {
      activeQuestionId: questionId,
      stories: stories.map((s) => ({ id: s.id, questionId: s.questionId, status: s.status })),
    };

    const alignmentResult = AlignmentVerifier.validate(
      { storyId: selectedStoryId!, questionId, jobId: jobId ?? '' },
      alignmentRules,
    );

    if (alignmentResult.status === 'misaligned') {
      const messageKey = alignmentResult.messageKey as AlignmentErrorKey | undefined;
      const message =
        (messageKey && AlignmentErrors[messageKey]) || AlignmentErrors.STORY_MISALIGNED;
      setAlignmentError(message);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await confirmStory({
        questionId,
        storyId: selectedStoryId!,
      });

      onConfirmed?.(response.story, response.excludedCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm story';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card data-testid="story-selection">
      <CardHeader>
        <CardTitle>Select a Story</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div role="radiogroup" aria-label="Available stories" className="space-y-2">
          {stories.map((story) => (
            <label
              key={story.id}
              data-testid={`story-option-${story.id}`}
              className={cn(
                'block cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/35',
                selectedStoryId === story.id
                  ? 'selected border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-background',
              )}
            >
              <input
                type="radio"
                name="story-selection"
                value={story.id}
                checked={selectedStoryId === story.id}
                onChange={() => handleSelect(story.id)}
                aria-label={story.title}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div className="ml-6 -mt-5 space-y-1">
                <strong className="block text-sm text-foreground">{story.title}</strong>
                <p className="text-sm leading-relaxed text-muted-foreground">{story.summary}</p>
              </div>
            </label>
          ))}
        </div>

        {validationError && (
          <p
            role="alert"
            data-testid="validation-error"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {validationError}
          </p>
        )}

        {alignmentError && (
          <AlignmentErrorBoundary>
            <AlignmentErrorBanner
              message={alignmentError}
              forceError={_testForceRenderError}
            />
          </AlignmentErrorBoundary>
        )}

        {error && (
          <p
            role="alert"
            data-testid="submission-error"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleConfirm}
          disabled={!selectedStoryId || isSubmitting}
          data-testid="confirm-button"
          className="w-full md:w-auto"
        >
          {isSubmitting ? 'Confirming...' : 'Confirm Selection'}
        </Button>
      </CardFooter>
    </Card>
  );
}
