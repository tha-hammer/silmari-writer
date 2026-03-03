import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InterstitialController from '../InterstitialController';
import type { InterstitialTransition } from '../interstitialMapper';

const emitNewPathClientEventMock = vi.fn().mockResolvedValue(true);
const emitInterstitialAbandonmentEventMock = vi.fn().mockResolvedValue('beacon');

vi.mock('@/lib/newPathTelemetryClient', () => ({
  emitNewPathClientEvent: (...args: unknown[]) => emitNewPathClientEventMock(...args),
  emitInterstitialAbandonmentEvent: (...args: unknown[]) => emitInterstitialAbandonmentEventMock(...args),
}));

const transition: InterstitialTransition = {
  type: 'before_voice_recall',
  stepBefore: 'ORIENT',
  stepAfter: 'RECALL_REVIEW',
  minDisplayMs: 1500,
};

describe('InterstitialController (Path 345)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-advances only after minimum display time when ready immediately', () => {
    const onAdvance = vi.fn();

    render(
      <InterstitialController
        transition={transition}
        sessionId="session-1"
        userId="user-1"
        autoAdvanceReady={true}
        onAdvance={onAdvance}
      />,
    );

    expect(screen.getByTestId('interstitial-controller')).toBeInTheDocument();
    expect(screen.getByTestId('interstitial-progress-indicator')).toBeInTheDocument();

    vi.advanceTimersByTime(1499);
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledWith('auto-advance');
    expect(emitNewPathClientEventMock).toHaveBeenCalledWith(
      'interstitial_shown',
      expect.objectContaining({
        interstitial_type: 'before_voice_recall',
        step_before: 'ORIENT',
        step_after: 'RECALL_REVIEW',
      }),
    );
  });

  it('supports manual continue while still enforcing minimum display time', async () => {
    const onAdvance = vi.fn();

    render(
      <InterstitialController
        transition={transition}
        sessionId="session-1"
        autoAdvanceReady={false}
        onAdvance={onAdvance}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    vi.advanceTimersByTime(1499);
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledWith('continue');
  });

  it('emits abandonment telemetry on pagehide while interstitial is active', () => {
    const onAdvance = vi.fn();

    render(
      <InterstitialController
        transition={transition}
        sessionId="session-2"
        userId="user-2"
        autoAdvanceReady={false}
        onAdvance={onAdvance}
      />,
    );

    window.dispatchEvent(new Event('pagehide'));

    expect(emitInterstitialAbandonmentEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        interstitial_type: 'before_voice_recall',
        step_before: 'ORIENT',
        session_id: 'session-2',
        user_id: 'user-2',
      }),
    );
  });
});
