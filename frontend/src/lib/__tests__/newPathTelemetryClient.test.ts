import { describe, expect, it, vi } from 'vitest';
import {
  emitInterstitialAbandonmentEvent,
  emitNewPathClientEvent,
} from '../newPathTelemetryClient';

vi.mock('@/logging', () => ({
  frontendLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('newPathTelemetryClient', () => {
  it('sends interstitial abandonment via sendBeacon when available', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchImpl = vi.fn();

    const result = await emitInterstitialAbandonmentEvent({
      interstitial_type: 'before_voice_recall',
      step_before: 'ORIENT',
      dwell_ms: 1500,
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
    }, {
      sendBeaconImpl: sendBeacon,
      fetchImpl,
    });

    expect(result).toBe('beacon');
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon returns false', async () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await emitInterstitialAbandonmentEvent({
      interstitial_type: 'before_verification_draft',
      step_before: 'RECALL_REVIEW',
      dwell_ms: 1750,
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
    }, {
      sendBeaconImpl: sendBeacon,
      fetchImpl,
    });

    expect(result).toBe('fetch');
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('is non-blocking and returns dropped when both beacon and fetch fail', async () => {
    const sendBeacon = vi.fn(() => {
      throw new Error('beacon unavailable');
    });
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(emitInterstitialAbandonmentEvent({
      interstitial_type: 'after_ingestion',
      step_before: 'INIT',
      dwell_ms: 2200,
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
    }, {
      sendBeaconImpl: sendBeacon,
      fetchImpl,
    })).resolves.toBe('dropped');
  });

  it('returns false for invalid payload without throwing', async () => {
    const fetchImpl = vi.fn();

    await expect(emitNewPathClientEvent('artifact_copied_to_clipboard', {
      artifact_type: 'answer',
      copy_success: true,
      session_id: '',
      user_id: 'user-1',
      source: 'ui',
    }, {
      fetchImpl,
    })).resolves.toBe(false);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

