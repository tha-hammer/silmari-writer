import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/services/InitializeSessionService', () => ({
  InitializeSessionService: {
    createSession: vi.fn(),
  },
}));

import { ChannelIngestionPipelineAdapter } from '../ChannelIngestionPipelineAdapter';
import { InitializeSessionService } from '../InitializeSessionService';

const mockInitialize = vi.mocked(InitializeSessionService);

describe('ChannelIngestionPipelineAdapter.initializeFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to InitializeSessionService and returns initialized session payload', async () => {
    mockInitialize.createSession.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      resume: {
        content: 'x',
        name: 'x',
        wordCount: 1,
      },
      job: {
        title: 'x',
        description: 'x',
        sourceType: 'link',
        sourceValue: 'https://example.greenhouse.io/job/123',
      },
      question: {
        text: 'x',
      },
      state: 'initialized',
      createdAt: new Date().toISOString(),
    });

    const result = await ChannelIngestionPipelineAdapter.initializeFromUrl({
      userId: 'user-1',
      sourceUrl: 'https://example.greenhouse.io/job/123',
      channel: 'sms',
    });

    expect(mockInitialize.createSession).toHaveBeenCalledTimes(1);
    expect(mockInitialize.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
      }),
    );
    expect(result).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'initialized',
    });
    expect(result.contextSummary).toContain('example.greenhouse.io');
  });
});
