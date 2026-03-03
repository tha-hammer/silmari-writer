'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrientStoryModule } from '@/modules/orient-story/OrientStoryModule';
import { WritingFlowModule } from '@/modules/WritingFlowModule';
import { ReviewWorkflowModule } from '@/modules/review/ReviewWorkflowModule';
import AnswerModule, { type AnswerState } from '@/modules/answer/AnswerModule';
import FinalizedAnswerModule, {
  type FinalizedAnswerState,
} from '@/modules/finalizedAnswer/FinalizedAnswerModule';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Story } from '@/server/data_structures/ConfirmStory';
import type { SessionView } from '@/server/data_structures/SessionView';
import InterstitialController from './interstitial/InterstitialController';
import {
  mapWorkflowTransitionToInterstitial,
  type InterstitialTransition,
} from './interstitial/interstitialMapper';
import { mapSessionStateToStage, type WorkflowStage } from './stageMapper';

export interface SessionWorkflowShellProps {
  session: SessionView;
  onVoiceResponseSaved?: () => Promise<void> | void;
}

function createDraftContentItems(sessionId: string) {
  return [{ id: `content-${sessionId}`, title: 'Drafted answer content' }];
}

function createInitialAnswer(sessionId: string): AnswerState {
  return {
    id: sessionId,
    status: 'COMPLETED',
    finalized: false,
    editable: true,
    content: 'Your approved draft is ready to finalize.',
  };
}

function createFinalizedAnswer(sessionId: string): FinalizedAnswerState {
  return {
    id: sessionId,
    status: 'FINALIZED',
    finalized: true,
    locked: true,
    editable: false,
    content: 'Your finalized answer is ready to export or copy.',
  };
}

export function SessionWorkflowShell({
  session,
  onVoiceResponseSaved,
}: SessionWorkflowShellProps) {
  const mappedSessionStage = useMemo<WorkflowStage>(
    () => mapSessionStateToStage(session.state, {
      source: session.source,
      questionId: session.questionId ?? null,
    }),
    [session.state, session.source, session.questionId],
  );
  const sessionStageSeed = useMemo(
    () => `${session.state}|${session.source}|${session.questionId ?? ''}`,
    [session.questionId, session.source, session.state],
  );

  const [stageOverride, setStageOverride] = useState<{
    stage: WorkflowStage;
    seed: string;
    fromStage: WorkflowStage;
  } | null>(null);
  const [activeInterstitial, setActiveInterstitial] = useState<InterstitialTransition | null>(null);
  const [pendingStage, setPendingStage] = useState<WorkflowStage | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);

  const stage = useMemo<WorkflowStage>(() => {
    if (
      stageOverride
      && stageOverride.seed === sessionStageSeed
      && mappedSessionStage === stageOverride.fromStage
    ) {
      return stageOverride.stage;
    }

    return mappedSessionStage;
  }, [mappedSessionStage, sessionStageSeed, stageOverride]);

  useEffect(() => {
    if (!stageOverride || stageOverride.seed !== sessionStageSeed) {
      return;
    }

    if (mappedSessionStage !== stageOverride.fromStage) {
      setStageOverride(null);
    }
  }, [mappedSessionStage, sessionStageSeed, stageOverride]);

  const applyStageOverride = (nextStage: WorkflowStage, fromStage: WorkflowStage) => {
    setStageOverride({
      stage: nextStage,
      seed: sessionStageSeed,
      fromStage,
    });
  };

  const transitionTo = (nextStage: WorkflowStage) => {
    setUiError(null);
    const interstitial = mapWorkflowTransitionToInterstitial(stage, nextStage);

    if (interstitial) {
      setPendingStage(nextStage);
      setActiveInterstitial(interstitial);
      return;
    }

    applyStageOverride(nextStage, mappedSessionStage);
  };

  const handleInterstitialAdvance = () => {
    if (!activeInterstitial || !pendingStage) {
      setActiveInterstitial(null);
      setPendingStage(null);
      return;
    }

    applyStageOverride(pendingStage, activeInterstitial.stepBefore);
    setActiveInterstitial(null);
    setPendingStage(null);
  };

  const handleReviewStageChange = (workflowStage: string) => {
    if (workflowStage === 'FINALIZE') {
      transitionTo('FINALIZE');
      return;
    }

    setUiError(`Unsupported workflow stage transition: ${workflowStage}`);
  };

  const handleStoryConfirmed = (story: Story) => {
    setSelectedStory(story);
    transitionTo('RECALL_REVIEW');
  };

  if (stage === 'UNKNOWN') {
    return (
      <Card data-testid="session-workflow-fallback" role="alert" className="border-destructive/30 bg-destructive/5">
        <CardHeader className="space-y-2">
          <Badge variant="destructive" className="w-fit">
            Unsupported Workflow State
          </Badge>
          <CardTitle className="text-base">State: {session.state}</CardTitle>
          <CardDescription>
            Refresh the page or start a new session from /writer.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div data-testid="session-workflow-shell" className="flex flex-col gap-4">
      {stage === 'ORIENT' && (
        session.questionId
          ? (
              <OrientStoryModule
                questionId={session.questionId}
                onConfirmed={(story) => handleStoryConfirmed(story)}
              />
          )
          : (
              <Card data-testid="session-workflow-error" role="alert" className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 text-sm text-destructive">
                  Missing question context for ORIENT stage.
                </CardContent>
              </Card>
            )
      )}

      {stage === 'RECALL_REVIEW' && (
        <WritingFlowModule
          initialStep="RECALL"
          selectedStory={selectedStory}
          sessionId={session.id}
          initialWorkingAnswer={session.storyContent ?? null}
          initialResponses={session.responses ?? []}
          onVoiceResponseSaved={onVoiceResponseSaved}
        />
      )}

      {stage === 'DRAFT' && (
        <ReviewWorkflowModule
          contentItems={createDraftContentItems(session.id)}
          onWorkflowStageChange={handleReviewStageChange}
        />
      )}

      {stage === 'FINALIZE' && (
        <AnswerModule
          answerId={session.id}
          initialAnswer={createInitialAnswer(session.id)}
          onFinalized={() => transitionTo('FINALIZED')}
        />
      )}

      {stage === 'FINALIZED' && (
        <FinalizedAnswerModule
          answerId={session.id}
          initialAnswer={createFinalizedAnswer(session.id)}
        />
      )}

      {uiError && (
        <Card data-testid="session-workflow-error" role="alert" className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {uiError}
          </CardContent>
        </Card>
      )}

      {activeInterstitial && (
        <InterstitialController
          transition={activeInterstitial}
          sessionId={session.id}
          autoAdvanceReady={true}
          onAdvance={handleInterstitialAdvance}
        />
      )}
    </div>
  );
}
