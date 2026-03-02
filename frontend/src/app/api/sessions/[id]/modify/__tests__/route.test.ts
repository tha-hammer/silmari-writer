/**
 * route.test.ts - Step 2: Route request to handler
 *
 * TLA+ Properties:
 * - Reachability: POST valid JSON → expect handler invoked with typed command.
 * - TypeInvariant: handler receives ModifySessionCommand { sessionId: string; action: 'ADD_VOICE' | 'FINALIZE' }
 * - ErrorConsistency: send malformed body → expect 400 + INVALID_REQUEST from SessionErrors.
 *
 * Resource: api-m5g7 (endpoint)
 * Path: 309-reject-modifications-to-finalized-session
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/server/request_handlers/ModifySessionRequestHandler', () => ({
  ModifySessionRequestHandler: {
    handle: vi.fn(),
  },
}));

import { ModifySessionRequestHandler } from '@/server/request_handlers/ModifySessionRequestHandler';
import { SessionError } from '@/server/error_definitions/SessionErrors';
import { POST } from '../route';

const mockHandler = vi.mocked(ModifySessionRequestHandler);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sessionId = '550e8400-e29b-41d4-a716-446655440000';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/sessions/${sessionId}/modify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/sessions/[id]/modify — Step 2: Route to handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability', () => {
    it('should call handler with sessionId and action from request body', async () => {
      mockHandler.handle.mockResolvedValue({
        success: false,
        error: new SessionError(
          'Session is already finalized',
          'SESSION_ALREADY_FINALIZED',
          409,
          false,
        ),
      });

      const request = createRequest({ sessionId, action: 'ADD_VOICE' });
      await POST(request, { params: Promise.resolve({ id: sessionId }) });

      expect(mockHandler.handle).toHaveBeenCalledWith(sessionId, 'ADD_VOICE');
    });

    it('should return 409 with SESSION_ALREADY_FINALIZED when modification rejected', async () => {
      mockHandler.handle.mockResolvedValue({
        success: false,
        error: new SessionError(
          'Session is already finalized and cannot be modified',
          'SESSION_ALREADY_FINALIZED',
          409,
          false,
        ),
      });

      const request = createRequest({ sessionId, action: 'ADD_VOICE' });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('SESSION_ALREADY_FINALIZED');
    });

    it('should return 200 when modification is allowed', async () => {
      mockHandler.handle.mockResolvedValue({
        success: true,
        record: {
          id: sessionId,
          draftId: 'draft-001',
          resumeId: 'resume-001',
          jobId: 'job-001',
          questionId: 'question-001',
          voiceSessionId: 'voice-001',
          userId: 'user-001',
          status: 'DRAFT',
          content: 'Draft content',
          createdAt: '2026-02-28T12:00:00.000Z',
          updatedAt: '2026-02-28T12:01:00.000Z',
        },
      });

      const request = createRequest({ sessionId, action: 'ADD_VOICE' });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });

      expect(response.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should validate request body against Zod schema for action type', async () => {
      mockHandler.handle.mockResolvedValue({
        success: false,
        error: new SessionError(
          'Session is already finalized',
          'SESSION_ALREADY_FINALIZED',
          409,
          false,
        ),
      });

      const request = createRequest({ sessionId, action: 'ADD_VOICE' });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });

      expect(response.status).not.toBe(400);
      expect(mockHandler.handle).toHaveBeenCalledWith(sessionId, 'ADD_VOICE');
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should return 400 with INVALID_REQUEST for malformed body', async () => {
      const request = createRequest({ garbage: true });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_REQUEST');
      expect(mockHandler.handle).not.toHaveBeenCalled();
    });

    it('should return 400 when action is missing', async () => {
      const request = createRequest({ sessionId });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 when action is invalid value', async () => {
      const request = createRequest({ sessionId, action: 'INVALID_ACTION' });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_REQUEST');
    });

    it('should return 404 when handler throws SESSION_NOT_FOUND', async () => {
      mockHandler.handle.mockRejectedValue(
        new SessionError('Session not found', 'SESSION_NOT_FOUND', 404, false),
      );

      const request = createRequest({ sessionId, action: 'ADD_VOICE' });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 500 for unexpected errors', async () => {
      mockHandler.handle.mockRejectedValue(new Error('Unexpected DB failure'));

      const request = createRequest({ sessionId, action: 'ADD_VOICE' });
      const response = await POST(request, { params: Promise.resolve({ id: sessionId }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});
