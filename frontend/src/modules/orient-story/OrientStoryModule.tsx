/**
 * OrientStoryModule - Frontend module managing story selection and confirmation.
 *
 * Displays the active question, job requirements, and available stories.
 * Allows user to select one story and confirm it.
 *
 * Resource: ui-v3n6 (module)
 * Paths: 313-confirm-aligned-story-selection, 314-prevent-confirmation-of-misaligned-story-selection
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadOrientStoryData } from '@/data_loaders/loadOrientStoryData';
import { StorySelection } from '@/components/StorySelection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { OrientStoryData, Story } from '@/server/data_structures/ConfirmStory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrientStoryModuleProps {
  questionId: string;
  jobId?: string;
  onConfirmed?: (confirmedStory: Story, excludedCount: number) => void;
}

type ModuleState =
  | { phase: 'loading' }
  | { phase: 'loaded'; data: OrientStoryData }
  | { phase: 'error'; message: string }
  | { phase: 'confirmed'; story: Story; excludedCount: number };

// ---------------------------------------------------------------------------
// Module Component
// ---------------------------------------------------------------------------

export function OrientStoryModule({ questionId, jobId, onConfirmed }: OrientStoryModuleProps) {
  const [state, setState] = useState<ModuleState>({ phase: 'loading' });

  const fetchData = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const data = await loadOrientStoryData(questionId);
      setState({ phase: 'loaded', data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setState({ phase: 'error', message });
    }
  }, [questionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (state.phase === 'loading') {
    return (
      <Card data-testid="orient-story-loading">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          <p>Loading story selection...</p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (state.phase === 'error') {
    return (
      <Card role="alert" data-testid="orient-story-error" className="border-destructive/40 bg-destructive/5">
        <CardHeader className="space-y-2">
          <Badge variant="destructive" className="w-fit">Unable to Load</Badge>
          <CardTitle className="text-base">Story selection is temporarily unavailable</CardTitle>
          <CardDescription className="text-destructive">{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Confirmed state
  if (state.phase === 'confirmed') {
    return (
      <Card data-testid="orient-story-confirmed" className="border-green-500/35 bg-green-500/5">
        <CardHeader className="space-y-2">
          <Badge variant="secondary" className="w-fit">Story Confirmed</Badge>
          <CardTitle className="text-base">{state.story.title}</CardTitle>
        </CardHeader>
        <CardContent data-testid="confirmed-story" className="text-sm leading-relaxed text-muted-foreground">
          {state.story.summary}
        </CardContent>
      </Card>
    );
  }

  // Loaded state - show selection UI
  const { question, jobRequirements, stories } = state.data;

  const handleConfirmed = (confirmedStory: Story, excludedCount: number) => {
    setState({ phase: 'confirmed', story: confirmedStory, excludedCount });
    onConfirmed?.(confirmedStory, excludedCount);
  };

  return (
    <div data-testid="orient-story-module" className="space-y-4">
      <Card data-testid="question-section" className="shadow-sm">
        <CardHeader className="pb-4">
          <Badge variant="outline" className="w-fit">Behavioral Question</Badge>
          <CardTitle className="text-base leading-relaxed md:text-lg">{question.text}</CardTitle>
        </CardHeader>
      </Card>

      <Card data-testid="requirements-section" className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Job Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {jobRequirements.map((req) => (
              <li
                key={req.id}
                className="rounded-md border bg-secondary/25 px-3 py-2 text-sm leading-relaxed text-secondary-foreground"
              >
                {req.description}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <section data-testid="stories-section" className="space-y-3">
        <StorySelection
          stories={stories}
          questionId={questionId}
          jobId={jobId}
          onConfirmed={handleConfirmed}
        />
      </section>
    </div>
  );
}
