/**
 * Tests for submitVoiceResponse API contract
 *
 * Resource: api-q7v1 (frontend_api_contract)
 * Path: 307-process-voice-input-and-progress-session
 *
 * TLA+ properties tested:
 * - Reachability: mock fetch success → expect POST to /api/session/voice-response with correct JSON body
 * - TypeInvariant: response parsed as SubmitVoiceResponseResponse
 * - ErrorConsistency:
 *   - 401 → expect error with "Authentication required"
 *   - Network reject → expect error and surfaced message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SubmitVoiceResponseRequestSchema,
  SubmitVoiceResponseResponseSchema,
  submitVoiceResponse,
} from '../submitVoiceResponse';
import type { SubmitVoiceResponseRequest } from '../submitVoiceResponse';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('submitVoiceResponse API contract', () => {
  const validPayload: SubmitVoiceResponseRequest = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    transcript: 'I led a project that reduced deployment time by 40 percent.',
  };

  const validResponse = {
    session: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      state: 'IN_PROGRESS',
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:01Z',
    },
    storyRecord: {
      id: '660e8400-e29b-41d4-a716-446655440001',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'IN_PROGRESS',
      content: 'I led a project that reduced deployment time by 40 percent.',
      createdAt: '2026-02-28T00:00:00Z',
      updatedAt: '2026-02-28T00:00:01Z',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
    });
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability: valid payload → fetch called correctly', () => {
    it('should POST to /api/session/voice-response with JSON body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validResponse),
      });

      await submitVoiceResponse(validPayload);

      expect(mockFetch).toHaveBeenCalledWith('/api/session/voice-response', {
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(validPayload),
      });
    });

    it('should return parsed response on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validResponse),
      });

      const result = await submitVoiceResponse(validPayload);

      expect(result.session.id).toBe(validResponse.session.id);
      expect(result.session.state).toBe('IN_PROGRESS');
      expect(result.storyRecord.content).toBe(validPayload.transcript);
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant: schemas validate correctly', () => {
    it('should validate a correct request', () => {
      const parsed = SubmitVoiceResponseRequestSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('should reject request with empty transcript', () => {
      const parsed = SubmitVoiceResponseRequestSchema.safeParse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        transcript: '',
      });
      expect(parsed.success).toBe(false);
    });

    it('should reject request with invalid sessionId', () => {
      const parsed = SubmitVoiceResponseRequestSchema.safeParse({
        sessionId: 'not-a-uuid',
        transcript: 'Some transcript',
      });
      expect(parsed.success).toBe(false);
    });

    it('should reject request with missing fields', () => {
      const parsed = SubmitVoiceResponseRequestSchema.safeParse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(parsed.success).toBe(false);
    });

    it('should validate a correct response', () => {
      const parsed = SubmitVoiceResponseResponseSchema.safeParse(validResponse);
      expect(parsed.success).toBe(true);
    });

    it('should reject response with missing session', () => {
      const parsed = SubmitVoiceResponseResponseSchema.safeParse({
        storyRecord: validResponse.storyRecord,
      });
      expect(parsed.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency: HTTP errors mapped correctly', () => {
    it('sends Authorization token from client auth context', async () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => (key === 'authToken' ? 'valid-token' : null)),
        removeItem: vi.fn(),
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validResponse),
      });

      await submitVoiceResponse(validPayload);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session/voice-response',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        }),
      );
    });

    it('should throw with "Authentication required" on 401', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ code: 'UNAUTHORIZED', message: 'Authentication required' }),
      });

      await expect(submitVoiceResponse(validPayload)).rejects.toThrow('Authentication required');
    });

    it('should throw with server message on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ code: 'INVALID_STATE', message: 'Session is not in INIT state' }),
      });

      await expect(submitVoiceResponse(validPayload)).rejects.toThrow('Session is not in INIT state');
    });

    it('should throw when network rejects', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(submitVoiceResponse(validPayload)).rejects.toThrow('Failed to fetch');
    });

    it('should throw when response body does not match schema', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data' }),
      });

      await expect(submitVoiceResponse(validPayload)).rejects.toThrow('Invalid response');
    });

    it('should throw with status when error body cannot be parsed', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      });

      await expect(submitVoiceResponse(validPayload)).rejects.toThrow('500');
    });
  });
});
