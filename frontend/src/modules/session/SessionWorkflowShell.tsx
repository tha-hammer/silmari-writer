'use client';

import { useMemo, useState } from 'react';
import { OrientStoryModule } from '@/modules/orient-story/OrientStoryModule';
import { WritingFlowModule } from '@/modules/WritingFlowModule';
import { ReviewWorkflowModule } from '@/modules/review/ReviewWorkflowModule';
import AnswerModule, { type AnswerState } from '@/modules/answer/AnswerModule';
import FinalizedAnswerModule, {
  type FinalizedAnswerState,
} from '@/modules/finalizedAnswer/FinalizedAnswerModule';
import type { SessionView } from '@/server/data_structures/SessionView';
import { mapSessionStateToStage, type WorkflowStage } from './stageMapper';

export interface SessionWorkflowShellProps {
  session: SessionView;
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

export function SessionWorkflowShell({ session }: SessionWorkflowShellProps) {
  const initialStage = useMemo<WorkflowStage>(
    () => mapSessionStateToStage(session.state, {
      source: session.source,
      questionId: session.questionId ?? null,
    }),
    [session.state, session.source, session.questionId],
  );

  const [stage, setStage] = useState<WorkflowStage>(initialStage);
  const [uiError, setUiError] = useState<string | null>(null);

  const transitionTo = (nextStage: WorkflowStage) => {
    setUiError(null);
    setStage(nextStage);
  };

  const handleReviewStageChange = (workflowStage: string) => {
    if (workflowStage === 'FINALIZE') {
      transitionTo('FINALIZE');
      return;
    }

    setUiError(`Unsupported workflow stage transition: ${workflowStage}`);
  };

  if (stage === 'UNKNOWN') {
    return (
      <div data-testid="session-workflow-fallback" role="alert" className="space-y-2">
        <p className="text-sm font-medium">Unsupported workflow state: {session.state}</p>
        <p className="text-sm text-muted-foreground">
          Refresh the page or start a new session from /writer.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="session-workflow-shell" className="flex flex-col gap-4">
      {stage === 'ORIENT' && (
        session.questionId
          ? (
              <OrientStoryModule
                questionId={session.questionId}
                onConfirmed={() => transitionTo('RECALL_REVIEW')}
              />
            )
          : (
              <div data-testid="session-workflow-error" role="alert" className="text-sm text-red-600">
                Missing question context for ORIENT stage.
              </div>
            )
      )}

      {stage === 'RECALL_REVIEW' && <WritingFlowModule initialStep="RECALL" />}

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
        <div data-testid="session-workflow-error" role="alert" className="text-sm text-red-600">
          {uiError}
        </div>
      )}
    </div>
  );
}
