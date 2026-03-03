import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StartSessionFromUrlRequestSchema,
  StartSessionFromUrlResponseSchema,
  startSessionFromUrl,
} from '../startSessionFromUrl';

vi.mock('@/logging/index', () => ({
  frontendLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('startSessionFromUrl API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates request payload schema', () => {
    expect(
      StartSessionFromUrlRequestSchema.safeParse({
        sourceUrl: 'https://example.greenhouse.io/job/123',
      }).success,
    ).toBe(true);
  });

  it('validates response schema', () => {
    expect(
      StartSessionFromUrlResponseSchema.safeParse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        state: 'initialized',
        canonicalUrl: 'https://example.greenhouse.io/job/123',
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      }).success,
    ).toBe(true);
  });

  it('posts URL payload and returns parsed session response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        state: 'initialized',
        canonicalUrl: 'https://example.greenhouse.io/job/123',
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      }),
    });

    const result = await startSessionFromUrl(
      'valid-token',
      'https://example.greenhouse.io/job/123',
    );

    expect(result.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ingestion/url',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-token',
        }),
      }),
    );
  });

  it('throws when backend returns an error payload', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: 'INVALID_URL_DOMAIN',
        message: 'URL domain is not allowed for ingestion',
      }),
    });

    await expect(
      startSessionFromUrl('valid-token', 'https://example.com/not-a-job'),
    ).rejects.toThrow('URL domain is not allowed for ingestion');
  });
});
