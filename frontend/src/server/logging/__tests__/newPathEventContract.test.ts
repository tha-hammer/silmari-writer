import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { newPathEventLogger } from '../newPathEventLogger';
import { TypedTelemetryGateway } from '../TypedTelemetryGateway';

describe('new-path event contracts (paths 340-345)', () => {
  it('validates required payload fields for interstitial_shown event', () => {
    expect(() => newPathEventLogger.validate('interstitial_shown', {
      interstitial_type: 'before_voice_recall',
      step_before: 'ORIENT',
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
      // Missing step_after
    })).toThrow(z.ZodError);
  });

  it('routes artifact copy events to analytics sink', async () => {
    const analyticsSink = vi.fn().mockResolvedValue(undefined);

    const result = await TypedTelemetryGateway.emit('artifact_copied_to_clipboard', {
      artifact_type: 'outreach',
      copy_success: true,
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
    }, {
      sinks: {
        analytics_events: analyticsSink,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.sink).toBe('analytics_events');
    expect(analyticsSink).toHaveBeenCalledWith(
      'artifact_copied_to_clipboard',
      expect.objectContaining({
        artifact_type: 'outreach',
        copy_success: true,
      }),
    );
  });

  it('routes interstitial events to analytics sink', async () => {
    const analyticsSink = vi.fn().mockResolvedValue(undefined);

    const result = await TypedTelemetryGateway.emit('interstitial_shown', {
      interstitial_type: 'before_verification_draft',
      step_before: 'RECALL_REVIEW',
      step_after: 'DRAFT',
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
    }, {
      sinks: {
        analytics_events: analyticsSink,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.sink).toBe('analytics_events');
    expect(analyticsSink).toHaveBeenCalledWith(
      'interstitial_shown',
      expect.objectContaining({
        interstitial_type: 'before_verification_draft',
      }),
    );
  });

  it('is non-blocking when sink persistence fails', async () => {
    const analyticsSink = vi.fn().mockRejectedValue(new Error('sink unavailable'));

    await expect(TypedTelemetryGateway.emit('interstitial_abandonment', {
      interstitial_type: 'before_voice_recall',
      step_before: 'ORIENT',
      dwell_ms: 1200,
      session_id: 'session-1',
      user_id: 'user-1',
      source: 'ui',
    }, {
      sinks: {
        analytics_events: analyticsSink,
      },
    })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        sink: 'analytics_events',
      }),
    );
  });
});

