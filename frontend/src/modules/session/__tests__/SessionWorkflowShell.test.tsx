import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionWorkflowShell } from '../SessionWorkflowShell';
import type { SessionView } from '@/server/data_structures/SessionView';

const mockOrientStoryModule = vi.fn();
const mockWritingFlowModule = vi.fn();

vi.mock('@/lib/newPathTelemetryClient', () => ({
  emitNewPathClientEvent: vi.fn().mockResolvedValue(true),
  emitInterstitialAbandonmentEvent: vi.fn().mockResolvedValue('beacon'),
}));

vi.mock('@/modules/orient-story/OrientStoryModule', () => ({
  OrientStoryModule: (
    props: { questionId: string; onConfirmed?: (_story: unknown, _excludedCount: number) => void },
  ) => {
    mockOrientStoryModule(props);
    return (
      <button
        data-testid="orient-story-module"
        onClick={() => {
          props.onConfirmed?.(
            {
              id: 'story-001',
              title: 'Led migration',
              summary: 'Migrated a critical service with zero downtime.',
              status: 'CONFIRMED',
              questionId: props.questionId,
            },
            2,
          );
        }}
      >
        Confirm story
      </button>
    );
  },
}));

vi.mock('@/modules/WritingFlowModule', () => ({
  WritingFlowModule: (props: {
    initialStep?: string;
    selectedStory?: unknown;
    sessionId?: string;
    onVoiceResponseSaved?: () => Promise<void> | void;
  }) => {
    mockWritingFlowModule(props);
    return <div data-testid="writing-flow-module" />;
  },
}));

vi.mock('@/modules/review/ReviewWorkflowModule', () => ({
  ReviewWorkflowModule: ({ onWorkflowStageChange }: { onWorkflowStageChange?: (_stage: string) => void }) => (
    <button
      data-testid="review-workflow-module"
      onClick={() => onWorkflowStageChange?.('FINALIZE')}
    >
      Approve
    </button>
  ),
}));

vi.mock('@/modules/answer/AnswerModule', () => ({
  default: ({ onFinalized }: { onFinalized?: () => void }) => (
    <button data-testid="answer-module" onClick={() => onFinalized?.()}>
      Finalize
    </button>
  ),
}));

vi.mock('@/modules/finalizedAnswer/FinalizedAnswerModule', () => ({
  default: () => <div data-testid="finalized-answer-module" />,
}));

function makeSession(state: string): SessionView {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    state,
    source: 'answer_session',
    questionId: null,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z',
  };
}

describe('SessionWorkflowShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips ORIENT for INIT answer_session without questionId', () => {
    render(<SessionWorkflowShell session={makeSession('INIT')} />);
    expect(screen.getByTestId('writing-flow-module')).toBeInTheDocument();
    expect(screen.queryByTestId('orient-story-module')).not.toBeInTheDocument();
    expect(mockOrientStoryModule).not.toHaveBeenCalled();
  });

  it('renders ORIENT with questionId when available', () => {
    render(
      <SessionWorkflowShell
        session={{
          ...makeSession('INIT'),
          questionId: '550e8400-e29b-41d4-a716-446655440001',
        }}
      />,
    );
    expect(screen.getByTestId('orient-story-module')).toBeInTheDocument();
    expect(mockOrientStoryModule).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    );
  });

  it('renders WritingFlowModule when stage resolves to recall/review', () => {
    render(<SessionWorkflowShell session={makeSession('REVIEW')} />);
    expect(screen.getByTestId('writing-flow-module')).toBeInTheDocument();
    expect(mockWritingFlowModule).toHaveBeenCalled();
    expect(mockWritingFlowModule.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        initialStep: 'RECALL',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    );
  });

  it('renders fallback UI for unknown stage', () => {
    render(<SessionWorkflowShell session={makeSession('NOT_A_REAL_STATE')} />);
    expect(screen.getByTestId('session-workflow-fallback')).toBeInTheDocument();
  });

  it('persists confirmed story into WritingFlowModule after ORIENT confirmation', async () => {
    vi.useFakeTimers();
    render(
      <SessionWorkflowShell
        session={{
          ...makeSession('INIT'),
          questionId: '550e8400-e29b-41d4-a716-446655440001',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('orient-story-module'));

    expect(screen.getByTestId('interstitial-controller')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(screen.queryByTestId('writing-flow-module')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('writing-flow-module')).toBeInTheDocument();

    expect(mockWritingFlowModule.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        initialStep: 'RECALL',
        selectedStory: expect.objectContaining({
          id: 'story-001',
          title: 'Led migration',
        }),
      }),
    );

  });

  it('advances DRAFT -> FINALIZE -> FINALIZED when callbacks succeed', async () => {
    const user = userEvent.setup();
    render(<SessionWorkflowShell session={makeSession('DRAFT')} />);

    expect(screen.getByTestId('review-workflow-module')).toBeInTheDocument();
    await user.click(screen.getByTestId('review-workflow-module'));
    expect(screen.getByTestId('answer-module')).toBeInTheDocument();

    await user.click(screen.getByTestId('answer-module'));
    expect(screen.getByTestId('finalized-answer-module')).toBeInTheDocument();
  });

  it('updates rendered stage when session prop changes after mount', async () => {
    const { rerender } = render(<SessionWorkflowShell session={makeSession('DRAFT')} />);
    expect(screen.getByTestId('review-workflow-module')).toBeInTheDocument();

    rerender(<SessionWorkflowShell session={makeSession('FINALIZE')} />);

    await waitFor(() => {
      expect(screen.getByTestId('answer-module')).toBeInTheDocument();
    });
  });

  it('prefers backend-confirmed stage over temporary override when session updates', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SessionWorkflowShell session={makeSession('DRAFT')} />);

    await user.click(screen.getByTestId('review-workflow-module'));
    expect(screen.getByTestId('answer-module')).toBeInTheDocument();

    rerender(<SessionWorkflowShell session={makeSession('REVIEW')} />);

    await waitFor(() => {
      expect(screen.getByTestId('writing-flow-module')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('answer-module')).not.toBeInTheDocument();
  });

  it('forwards voice save callback into WritingFlowModule', () => {
    const onVoiceResponseSaved = vi.fn();
    render(
      <SessionWorkflowShell
        session={makeSession('REVIEW')}
        onVoiceResponseSaved={onVoiceResponseSaved}
      />,
    );

    expect(mockWritingFlowModule.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        onVoiceResponseSaved,
      }),
    );
  });
});
