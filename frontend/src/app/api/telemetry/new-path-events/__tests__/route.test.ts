import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/logging/newPathEventLogger', () => ({
  newPathEventLogger: {
    validate: vi.fn(),
    emit: vi.fn(),
  },
}));

import { newPathEventLogger } from '@/server/logging/newPathEventLogger';
import { OPTIONS, POST } from '../route';

const mockNewPathEventLogger = vi.mocked(newPathEventLogger);

describe('/api/telemetry/new-path-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNewPathEventLogger.validate.mockImplementation((_eventName, payload) => payload as never);
    mockNewPathEventLogger.emit.mockResolvedValue({ ok: true });
  });

  it('OPTIONS responds with preflight headers', async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('POST accepts valid telemetry payload and returns 202', async () => {
    const request = new Request('http://localhost:3000/api/telemetry/new-path-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'interstitial_shown',
        payload: {
          interstitial_type: 'before_voice_recall',
          step_before: 'ORIENT',
          step_after: 'RECALL_REVIEW',
          session_id: 'session-1',
          user_id: 'user-1',
          source: 'ui',
        },
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual(
      expect.objectContaining({
        accepted: true,
        event_name: 'interstitial_shown',
        persisted: true,
      }),
    );
    expect(mockNewPathEventLogger.validate).toHaveBeenCalled();
    expect(mockNewPathEventLogger.emit).toHaveBeenCalled();
  });

  it('POST returns 400 when envelope is invalid', async () => {
    const request = new Request('http://localhost:3000/api/telemetry/new-path-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {},
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INVALID_REQUEST');
  });

  it('POST remains non-blocking when sink persistence fails', async () => {
    mockNewPathEventLogger.emit.mockResolvedValue({ ok: false });

    const request = new Request('http://localhost:3000/api/telemetry/new-path-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: 'interstitial_abandonment',
        payload: {
          interstitial_type: 'before_voice_recall',
          step_before: 'ORIENT',
          dwell_ms: 1200,
          session_id: 'session-1',
          user_id: 'user-1',
          source: 'ui',
        },
      }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.persisted).toBe(false);
  });
});
