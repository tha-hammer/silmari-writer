import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/services/ChannelIngestionPipelineAdapter', () => ({
  ChannelIngestionPipelineAdapter: {
    initializeFromUrl: vi.fn(),
  },
}));

vi.mock('@/server/settings/voiceUxFeatureFlags', () => ({
  isVoiceUxFeatureEnabled: vi.fn(),
}));

import { POST } from '../route';
import { ChannelIngestionPipelineAdapter } from '@/server/services/ChannelIngestionPipelineAdapter';
import { isVoiceUxFeatureEnabled } from '@/server/settings/voiceUxFeatureFlags';

const mockAdapter = vi.mocked(ChannelIngestionPipelineAdapter);
const mockFeatureFlag = vi.mocked(isVoiceUxFeatureEnabled);

function makeRequest(body: unknown, authToken?: string) {
  return new Request('http://localhost/api/ingestion/url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ingestion/url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlag.mockReturnValue(true);
  });

  it('returns 200 and initialized session payload for a valid URL', async () => {
    mockAdapter.initializeFromUrl.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'initialized',
      contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
    });

    const response = await POST(
      makeRequest(
        { sourceUrl: 'https://EXAMPLE.greenhouse.io/job/123/' },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      state: 'initialized',
      canonicalUrl: 'https://example.greenhouse.io/job/123',
    });

    expect(mockAdapter.initializeFromUrl).toHaveBeenCalledWith({
      userId: 'user-valid-to',
      sourceUrl: 'https://example.greenhouse.io/job/123',
      channel: 'direct',
    });
  });

  it('returns 404 when voiceUx340 feature flag is disabled', async () => {
    mockFeatureFlag.mockReturnValue(false);

    const response = await POST(
      makeRequest(
        { sourceUrl: 'https://example.greenhouse.io/job/123' },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.code).toBe('FEATURE_DISABLED');
  });

  it('returns 401 when authorization header is missing', async () => {
    const response = await POST(
      makeRequest({ sourceUrl: 'https://example.greenhouse.io/job/123' }) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
    expect(mockAdapter.initializeFromUrl).not.toHaveBeenCalled();
  });

  it('returns 400 for unsupported URL domains', async () => {
    const response = await POST(
      makeRequest(
        { sourceUrl: 'https://example.com/not-supported' },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.code).toBe('INVALID_URL_DOMAIN');
    expect(mockAdapter.initializeFromUrl).not.toHaveBeenCalled();
  });
});
