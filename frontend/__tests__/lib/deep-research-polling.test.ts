/**
 * Tests for Deep Research Polling Utility (REQ_008.4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pollDeepResearchJob,
  executeDeepResearch,
  calculateNextInterval,
  DeepResearchPollingError,
  INITIAL_POLL_INTERVAL_MS,
  MAX_POLL_INTERVAL_MS,
  MAX_TOTAL_DURATION_MS,
  BACKOFF_MULTIPLIER,
  MAX_NETWORK_RETRIES_PER_POLL,
} from '@/lib/deep-research-polling';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Deep Research Polling Utility (REQ_008.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // REQ_008.4.1: Initial poll at 5 seconds
  // ==========================================================================
  describe('REQ_008.4.1: Initial poll timing', () => {
    it('should wait 5 seconds before first poll', async () => {
      const completedResponse = {
        status: 'completed',
        result: { text: 'Research result', citations: [], reasoningSteps: [] },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => completedResponse,
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: INITIAL_POLL_INTERVAL_MS,
      });

      // Should not have polled yet
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance 4 seconds - still no poll
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockFetch).not.toHaveBeenCalled();

      // Advance to 5 seconds - should poll
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await pollPromise;
    });

    it('should use configurable initial interval', async () => {
      const completedResponse = {
        status: 'completed',
        result: { text: 'Research result', citations: [], reasoningSteps: [] },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => completedResponse,
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 1000, // Custom 1 second
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await pollPromise;
    });
  });

  // ==========================================================================
  // REQ_008.4.2: Exponential backoff
  // ==========================================================================
  describe('REQ_008.4.2: Exponential backoff', () => {
    it('should double poll interval with each attempt: 5s → 10s → 20s → 40s → 60s', () => {
      expect(calculateNextInterval(5000)).toBe(10000);
      expect(calculateNextInterval(10000)).toBe(20000);
      expect(calculateNextInterval(20000)).toBe(40000);
      expect(calculateNextInterval(40000)).toBe(60000); // Capped at 60s
      expect(calculateNextInterval(60000)).toBe(60000); // Stay at 60s
    });

    it('should have BACKOFF_MULTIPLIER of 2', () => {
      expect(BACKOFF_MULTIPLIER).toBe(2);
    });

    it('should apply backoff between polls', async () => {
      // Setup: pending → pending → completed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'pending' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'pending' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            result: { text: 'Done', citations: [], reasoningSteps: [] },
          }),
        });

      const onProgress = vi.fn();
      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 1000,
        onProgress,
      });

      // Initial wait (1s)
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // After first pending, wait 2s (doubled from 1s)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // After second pending, wait 4s (doubled from 2s)
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      await pollPromise;
    });
  });

  // ==========================================================================
  // REQ_008.4.3: Maximum poll interval capped at 60 seconds
  // ==========================================================================
  describe('REQ_008.4.3: Maximum poll interval cap', () => {
    it('should cap poll interval at 60 seconds', () => {
      expect(MAX_POLL_INTERVAL_MS).toBe(60000);
      expect(calculateNextInterval(60000, MAX_POLL_INTERVAL_MS)).toBe(60000);
      expect(calculateNextInterval(120000, MAX_POLL_INTERVAL_MS)).toBe(60000);
    });

    it('should respect custom max interval', () => {
      expect(calculateNextInterval(20000, 30000)).toBe(30000);
      expect(calculateNextInterval(40000, 30000)).toBe(30000);
    });
  });

  // ==========================================================================
  // REQ_008.4.4: Maximum 30 minute total duration
  // ==========================================================================
  describe('REQ_008.4.4: Maximum total duration', () => {
    it('should have MAX_TOTAL_DURATION_MS of 30 minutes (1800000ms)', () => {
      expect(MAX_TOTAL_DURATION_MS).toBe(1800000);
    });

    it('should timeout after max duration with elapsed time in error', async () => {
      // Always return pending
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
        maxIntervalMs: 100,
        maxDurationMs: 500, // Short timeout for testing
      });

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(600);

      try {
        await pollPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DeepResearchPollingError);
        expect((error as DeepResearchPollingError).code).toBe('POLLING_TIMEOUT');
      }
    });

    it('should include elapsed time info in timeout error message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
        maxIntervalMs: 100,
        maxDurationMs: 500,
      });

      await vi.advanceTimersByTimeAsync(600);

      try {
        await pollPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toMatch(/timed out/i);
      }
    });

    it('should suggest thorough depth may need longer in timeout message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
        maxIntervalMs: 100,
        maxDurationMs: 500,
      });

      await vi.advanceTimersByTimeAsync(600);

      try {
        await pollPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toMatch(/thorough|longer/i);
      }
    });
  });

  // ==========================================================================
  // REQ_008.4.5: Poll request uses GET
  // ==========================================================================
  describe('REQ_008.4.5: Poll request format', () => {
    it('should use GET /v1/responses/{response_id} to check status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          result: { text: 'Done', citations: [], reasoningSteps: [] },
        }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_abc123',
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      await pollPromise;

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tools/deep-research/job_abc123/status',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  // ==========================================================================
  // REQ_008.4.6-8: Status handling
  // ==========================================================================
  describe('REQ_008.4.6-8: Status handling', () => {
    it('should return result when status is completed', async () => {
      const result = { text: 'Research complete', citations: [], reasoningSteps: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', result }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      const response = await pollPromise;

      expect(response.result).toEqual(result);
    });

    it('should continue polling when status is in_progress', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'processing' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            result: { text: 'Done', citations: [], reasoningSteps: [] },
          }),
        });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      // First poll
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second poll after backoff
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await pollPromise;
    });

    it('should throw error when status is failed with API error details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'failed',
          error: { code: 'RATE_LIMIT', message: 'Too many requests' },
        }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);

      try {
        await pollPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Too many requests');
        expect((error as DeepResearchPollingError).code).toBe('RATE_LIMIT');
      }
    });
  });

  // ==========================================================================
  // REQ_008.4.9-10: Progress updates
  // ==========================================================================
  describe('REQ_008.4.9-10: Progress updates', () => {
    it('should emit progress updates during polling', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'processing',
            progress: { step: 'Researching...', percentage: 25 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            result: { text: 'Done', citations: [], reasoningSteps: [] },
          }),
        });

      const onProgress = vi.fn();
      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
        onProgress,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'processing',
          pollCount: 1,
          progress: { step: 'Researching...', percentage: 25 },
        })
      );

      await vi.advanceTimersByTimeAsync(200);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          pollCount: 2,
        })
      );

      await pollPromise;
    });

    it('should include step count and elapsed time in progress updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          result: { text: 'Done', citations: [], reasoningSteps: [] },
        }),
      });

      const onProgress = vi.fn();
      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
        onProgress,
      });

      await vi.advanceTimersByTimeAsync(100);
      await pollPromise;

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          pollCount: expect.any(Number),
          elapsedTimeMs: expect.any(Number),
        })
      );
    });
  });

  // ==========================================================================
  // REQ_008.4.11: Cancellation via AbortController
  // ==========================================================================
  describe('REQ_008.4.11: Cancellation support', () => {
    it('should support cancellation via AbortController', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });

      const controller = new AbortController();
      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        signal: controller.signal,
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      controller.abort();

      await expect(pollPromise).rejects.toThrow(DeepResearchPollingError);
      await expect(pollPromise).rejects.toMatchObject({
        code: 'POLLING_CANCELLED',
      });
    });

    it('should pass abort signal to fetch request', async () => {
      // Verify the signal is passed to fetch - this is the key behavior
      // The actual abort handling is tested via the sleep abort test above
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', result: { text: 'done' } }),
      });

      const controller = new AbortController();
      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        signal: controller.signal,
        initialIntervalMs: 100,
      });

      // Wait for first poll
      await vi.advanceTimersByTimeAsync(100);

      // Verify fetch was called with the signal
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );

      // Advance to complete (second poll uses backoff interval)
      await vi.advanceTimersByTimeAsync(200);

      const result = await pollPromise;
      expect(result.result.text).toBe('done');
    });
  });

  // ==========================================================================
  // REQ_008.4.12: Network error retry
  // ==========================================================================
  describe('REQ_008.4.12: Network error retry', () => {
    it('should have MAX_NETWORK_RETRIES_PER_POLL of 3', () => {
      expect(MAX_NETWORK_RETRIES_PER_POLL).toBe(3);
    });

    it('should retry network errors up to 3 times per poll', async () => {
      // Fail 3 times, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            result: { text: 'Done', citations: [], reasoningSteps: [] },
          }),
        });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      // Initial wait
      await vi.advanceTimersByTimeAsync(100);

      // Wait for retries (1s each for 3 retries)
      await vi.advanceTimersByTimeAsync(3000);

      const result = await pollPromise;
      expect(result.result.text).toBe('Done');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should fail after 3 network retries exhausted', async () => {
      // Fail 4 times (initial + 3 retries)
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(4000);

      try {
        await pollPromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toMatch(/Network error/);
        expect((error as DeepResearchPollingError).code).toBe('NETWORK');
        expect((error as DeepResearchPollingError).retryable).toBe(true);
      }
    });
  });

  // ==========================================================================
  // REQ_008.4.13: Result caching
  // ==========================================================================
  describe('REQ_008.4.13: Final result handling', () => {
    it('should return result without additional polls after completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          result: { text: 'Final result', citations: [], reasoningSteps: [] },
        }),
      });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      const result = await pollPromise;

      expect(result.result.text).toBe('Final result');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include poll count and elapsed time in result', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'processing' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            result: { text: 'Done', citations: [], reasoningSteps: [] },
          }),
        });

      const pollPromise = pollDeepResearchJob({
        jobId: 'job_123',
        initialIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await pollPromise;
      expect(result.pollCount).toBe(2);
      expect(result.elapsedTimeMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // executeDeepResearch convenience function
  // ==========================================================================
  describe('executeDeepResearch', () => {
    it('should create job and poll for result', async () => {
      // Mock job creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job_new_123', status: 'pending' }),
      });

      // Mock poll result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          result: { text: 'Research complete', citations: [], reasoningSteps: [] },
        }),
      });

      const resultPromise = executeDeepResearch('Research AI safety');

      // Wait for job creation and first poll
      await vi.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;
      expect(result.text).toBe('Research complete');

      // Verify job was created with correct params
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/tools/deep-research',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"query":"Research AI safety"'),
        })
      );
    });

    it('should pass depth and tools to job creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job_123', status: 'pending' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          result: { text: 'Done', citations: [], reasoningSteps: [] },
        }),
      });

      const resultPromise = executeDeepResearch('Research', {
        depth: 'thorough',
        tools: [{ type: 'web_search_preview' }],
      });

      await vi.advanceTimersByTimeAsync(5000);
      await resultPromise;

      const createCall = mockFetch.mock.calls[0];
      const body = JSON.parse(createCall[1].body);
      expect(body.depth).toBe('thorough');
      expect(body.tools).toEqual([{ type: 'web_search_preview' }]);
    });

    it('should return directly if job completes synchronously', async () => {
      // Mock direct completion (non-background mode response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Direct result',
          citations: [],
          reasoningSteps: [],
        }),
      });

      const result = await executeDeepResearch('Quick query');

      expect(result.text).toBe('Direct result');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should support cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: 'job_123', status: 'pending' }),
      });

      const controller = new AbortController();
      const resultPromise = executeDeepResearch('Research', {
        signal: controller.signal,
      });

      controller.abort();

      await expect(resultPromise).rejects.toThrow(DeepResearchPollingError);
    });

    it('should handle job creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid query',
          code: 'VALIDATION_ERROR',
        }),
      });

      await expect(executeDeepResearch('')).rejects.toThrow('Invalid query');
    });
  });

  // ==========================================================================
  // DeepResearchPollingError class
  // ==========================================================================
  describe('DeepResearchPollingError', () => {
    it('should have correct properties', () => {
      const error = new DeepResearchPollingError(
        'Test error',
        'POLLING_TIMEOUT',
        true,
        60000
      );

      expect(error.name).toBe('DeepResearchPollingError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('POLLING_TIMEOUT');
      expect(error.retryable).toBe(true);
      expect(error.elapsedTimeMs).toBe(60000);
    });

    it('should extend Error', () => {
      const error = new DeepResearchPollingError('Test', 'API_ERROR', false);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
