import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecallScreen from '../RecallScreen';

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';

type VoiceEvent = { type: string; [key: string]: unknown };

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSetOnEvent = vi.fn();
const mockSubmitVoiceResponse = vi.fn();
const mockOnVoiceResponseSaved = vi.fn();
const mockGetSessionVoiceTurns = vi.fn();
const mockUpdateSessionWorkingAnswer = vi.fn();
const mockResetSessionVoiceTurns = vi.fn();
const mockLoadRecallProgress = vi.fn();
const mockEmitNewPathClientEvent = vi.fn();

let mockSessionState: 'idle' | 'connecting' | 'connected' | 'error' = 'idle';
let capturedEventHandler: ((event: VoiceEvent) => void) | null = null;

function emitVoiceEvent(event: VoiceEvent) {
  act(() => {
    capturedEventHandler?.(event);
  });
}

vi.mock('@/hooks/useRealtimeSession', () => ({
  useRealtimeSession: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    sessionState: mockSessionState,
    setOnEvent: mockSetOnEvent,
  }),
}));

vi.mock('@/api_contracts/submitVoiceResponse', () => ({
  submitVoiceResponse: (payload: unknown) => mockSubmitVoiceResponse(payload),
}));

vi.mock('@/api_contracts/sessionVoiceTurns', () => ({
  getSessionVoiceTurns: (sessionId: string) => mockGetSessionVoiceTurns(sessionId),
  updateSessionWorkingAnswer: (sessionId: string, content: string) => mockUpdateSessionWorkingAnswer(sessionId, content),
  resetSessionVoiceTurns: (sessionId: string) => mockResetSessionVoiceTurns(sessionId),
}));

vi.mock('@/data_loaders/RecallProgressLoader', () => ({
  NEUTRAL_PROGRESS: {
    anchors: 0,
    actions: 0,
    outcomes: 0,
    incompleteSlots: ['anchors', 'actions', 'outcomes'],
  },
  loadRecallProgress: (sessionId: string) => mockLoadRecallProgress(sessionId),
}));

vi.mock('@/lib/newPathTelemetryClient', () => ({
  emitNewPathClientEvent: (...args: unknown[]) => mockEmitNewPathClientEvent(...args),
}));

describe('RecallScreen voice session wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = 'idle';
    capturedEventHandler = null;

    mockConnect.mockResolvedValue(true);
    mockOnVoiceResponseSaved.mockResolvedValue(undefined);
    mockSetOnEvent.mockImplementation((callback: ((event: VoiceEvent) => void) | null) => {
      capturedEventHandler = callback;
    });

    mockSubmitVoiceResponse.mockResolvedValue({
      session: {
        id: SESSION_ID,
        userId: 'user-123',
        state: 'IN_PROGRESS',
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:01.000Z',
      },
      storyRecord: {
        id: '660e8400-e29b-41d4-a716-446655440001',
        sessionId: SESSION_ID,
        status: 'IN_PROGRESS',
        content: 'content',
        responses: ['content'],
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:01.000Z',
      },
    });

    mockGetSessionVoiceTurns.mockResolvedValue({
      sessionId: SESSION_ID,
      workingAnswer: '',
      turns: [],
    });

    mockUpdateSessionWorkingAnswer.mockResolvedValue({
      sessionId: SESSION_ID,
      workingAnswer: '',
      turns: [],
    });

    mockResetSessionVoiceTurns.mockResolvedValue({
      sessionId: SESSION_ID,
      workingAnswer: '',
      turns: [],
    });

    mockLoadRecallProgress.mockResolvedValue({
      anchors: 1,
      actions: 1,
      outcomes: 1,
      incompleteSlots: [],
    });

    mockEmitNewPathClientEvent.mockResolvedValue(true);
  });

  it('renders proactive coach greeting', () => {
    render(<RecallScreen />);

    expect(screen.getByTestId('recall-coach-prompt')).toHaveTextContent('Hello');
  });

  it('renders selected story details when provided', () => {
    render(
      <RecallScreen
        selectedStory={{
          id: 'story-001',
          title: 'Led migration',
          summary: 'Migrated a critical service with zero downtime.',
          status: 'CONFIRMED',
          questionId: 'q-001',
        }}
      />,
    );

    expect(screen.getByTestId('selected-story')).toBeInTheDocument();
    expect(screen.getByText('Led migration')).toBeInTheDocument();
  });

  it('connects to the voice model when record is clicked', async () => {
    const user = userEvent.setup();
    render(<RecallScreen />);

    await user.click(screen.getByTestId('record-button'));

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith(
        'voice_edit',
        expect.objectContaining({
          instructions: expect.stringContaining('warm greeting'),
        }),
      );
    });
  });

  it('shows stop-state controls when user stops recording', async () => {
    const user = userEvent.setup();
    mockSessionState = 'connected';

    render(<RecallScreen sessionId={SESSION_ID} />);

    await user.click(screen.getByTestId('record-button'));

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('recall-stop-controls')).toBeInTheDocument();
  });

  it('registers and cleans up realtime event handler when connected with sessionId', () => {
    mockSessionState = 'connected';
    const { unmount } = render(<RecallScreen sessionId={SESSION_ID} />);

    expect(mockSetOnEvent).toHaveBeenCalledWith(expect.any(Function));

    unmount();

    expect(mockSetOnEvent).toHaveBeenLastCalledWith(null);
  });

  it('submits final transcript events and invokes refresh callback on success', async () => {
    mockSessionState = 'connected';
    render(
      <RecallScreen
        sessionId={SESSION_ID}
        onVoiceResponseSaved={mockOnVoiceResponseSaved}
      />,
    );

    emitVoiceEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Built an onboarding workflow.',
    });

    await waitFor(() => {
      expect(mockSubmitVoiceResponse).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        transcript: 'Built an onboarding workflow.',
      });
    });

    await waitFor(() => {
      expect(mockUpdateSessionWorkingAnswer).toHaveBeenCalled();
      expect(mockOnVoiceResponseSaved).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('voice-submit-status')).toHaveTextContent('Response saved.');
    });
  });

  it('treats move-on utterances as control intents', async () => {
    mockSessionState = 'connected';
    render(<RecallScreen sessionId={SESSION_ID} />);

    emitVoiceEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-1',
      transcript: 'Can we move on to the next question?',
    });

    await waitFor(() => {
      expect(mockSubmitVoiceResponse).not.toHaveBeenCalled();
      expect(screen.getByTestId('recall-stop-controls')).toBeInTheDocument();
    });
  });

  it('persists manual working-answer edits on blur', async () => {
    const user = userEvent.setup();
    render(<RecallScreen sessionId={SESSION_ID} />);

    const editor = screen.getByTestId('working-answer-editor');
    await user.type(editor, 'Draft answer line.');

    await user.tab();

    await waitFor(() => {
      expect(mockUpdateSessionWorkingAnswer).toHaveBeenCalledWith(
        SESSION_ID,
        expect.stringContaining('Draft answer line.'),
      );
    });
  });

  it('loads persisted working answer on mount', async () => {
    mockGetSessionVoiceTurns.mockResolvedValueOnce({
      sessionId: SESSION_ID,
      workingAnswer: 'Recovered answer from DB',
      turns: ['Recovered answer from DB'],
    });

    render(<RecallScreen sessionId={SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByTestId('working-answer-editor')).toHaveValue('Recovered answer from DB');
    });
  });
});
