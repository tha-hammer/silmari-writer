/**
 * Tests for POST /api/session/voice-response route
 *
 * Resource: api-m5g7 (endpoint)
 * Path: 307-process-voice-input-and-progress-session
 *
 * TLA+ properties tested:
 * - Reachability: mock handler success → expect 200 JSON with updated session
 * - TypeInvariant: response matches Zod response schema
 * - ErrorConsistency:
 *   - Handler throws domain error → expect mapped error with correct status code
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitVoiceResponseResponseSchema } from '@/api_contracts/submitVoiceResponse';
import { deriveUserIdForToken } from '@/test_helpers/authTestUtils';

// Mock the handler
vi.mock('@/server/request_handlers/ProcessVoiceResponseHandler', () => ({
  ProcessVoiceResponseHandler: {
    handle: vi.fn(),
  },
}));

import { ProcessVoiceResponseHandler } from '@/server/request_handlers/ProcessVoiceResponseHandler';
import { POST } from '../route';

const mockHandler = vi.mocked(ProcessVoiceResponseHandler);

// Helper to create a Next.js Request object
function createRequest(body: unknown, authToken?: string): Request {
  return new Request('http://localhost:3000/api/session/voice-response', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/session/voice-response', () => {
  const validPayload = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    transcript: 'I led a cross-functional team that reduced deployment time by 40 percent.',
  };

  const handlerResult = {
    session: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      state: 'IN_PROGRESS' as const,
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:01Z',
    },
    storyRecord: {
      id: '660e8400-e29b-41d4-a716-446655440001',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'IN_PROGRESS' as const,
      content: 'I led a cross-functional team that reduced deployment time by 40 percent.',
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:01Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const request = createRequest(validPayload);
    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(mockHandler.handle).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability: handler success → 200 JSON', () => {
    it('should return 200 with updated session and story record', async () => {
      mockHandler.handle.mockResolvedValue(handlerResult);

      const request = createRequest(validPayload, 'valid-token');
      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.session.id).toBe(handlerResult.session.id);
      expect(body.session.state).toBe('IN_PROGRESS');
      expect(body.storyRecord.content).toBe(validPayload.transcript);
    });

    it('should pass payload to handler', async () => {
      mockHandler.handle.mockResolvedValue(handlerResult);

      const request = createRequest(validPayload, 'valid-token');
      await POST(request as any);

      expect(mockHandler.handle).toHaveBeenCalledWith(validPayload, {
        userId: deriveUserIdForToken('valid-token'),
        authenticated: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant: response matches schema', () => {
    it('should return body matching SubmitVoiceResponseResponseSchema', async () => {
      mockHandler.handle.mockResolvedValue(handlerResult);

      const request = createRequest(validPayload, 'valid-token');
      const response = await POST(request as any);
      const body = await response.json();

      const parsed = SubmitVoiceResponseResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency: domain errors mapped correctly', () => {
    it('should return 409 when handler throws INVALID_STATE', async () => {
      const { SessionErrors } = await import('@/server/error_definitions/SessionErrors');
      mockHandler.handle.mockRejectedValue(
        SessionErrors.InvalidState('Session not in INIT state'),
      );

      const request = createRequest(validPayload, 'valid-token');
      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.code).toBe('INVALID_STATE');
      expect(body.message).toContain('Session not in INIT state');
    });

    it('should return 400 when handler throws INVALID_PAYLOAD', async () => {
      const { SessionErrors } = await import('@/server/error_definitions/SessionErrors');
      mockHandler.handle.mockRejectedValue(
        SessionErrors.InvalidPayload('Missing transcript'),
      );

      const request = createRequest(validPayload, 'valid-token');
      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('INVALID_PAYLOAD');
    });

    it('should return 500 when handler throws GenericError', async () => {
      const { GenericErrors } = await import('@/server/error_definitions/GenericErrors');
      mockHandler.handle.mockRejectedValue(
        GenericErrors.InternalError('Unexpected error'),
      );

      const request = createRequest(validPayload, 'valid-token');
      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('should return 500 for completely unexpected errors', async () => {
      mockHandler.handle.mockRejectedValue(new TypeError('cannot read property'));

      const request = createRequest(validPayload, 'valid-token');
      const response = await POST(request as any);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });
});
