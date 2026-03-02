import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionWorkflowShell } from '../SessionWorkflowShell';
import type { SessionView } from '@/server/data_structures/SessionView';

const mockOrientStoryModule = vi.fn();
const mockWritingFlowModule = vi.fn();

vi.mock('@/modules/orient-story/OrientStoryModule', () => ({
  OrientStoryModule: (props: { questionId: string }) => {
    mockOrientStoryModule(props);
    return <div data-testid="orient-story-module" />;
  },
}));

vi.mock('@/modules/WritingFlowModule', () => ({
  WritingFlowModule: (props: { initialStep?: string }) => {
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
      expect.objectContaining({ initialStep: 'RECALL' }),
    );
  });

  it('renders fallback UI for unknown stage', () => {
    render(<SessionWorkflowShell session={makeSession('NOT_A_REAL_STATE')} />);
    expect(screen.getByTestId('session-workflow-fallback')).toBeInTheDocument();
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
});
