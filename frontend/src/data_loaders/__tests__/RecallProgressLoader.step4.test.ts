/**
 * RecallProgressLoader Step 4 Tests - Populate Progress Indicator
 *
 * Resource: ui-y5t3 (data_loader)
 * Path: 303-display-recall-state-with-record-button-and-progress-indicator
 *
 * TLA+ properties tested:
 * - Reachability: Mock fetch success → returns { anchors, actions, outcomes }
 * - TypeInvariant: Returned object matches RecallProgress type
 * - ErrorConsistency: Mock fetch rejection → returns neutral state + logger called
 */

import { loadRecallProgress, NEUTRAL_PROGRESS } from '../RecallProgressLoader';
import type { RecallProgress } from '../RecallProgressLoader';
import { frontendLogger } from '@/logging/index';

vi.mock('@/logging/index', () => ({
  frontendLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockLogger = vi.mocked(frontendLogger);

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const successData = { anchors: 3, actions: 5, outcomes: 2, incompleteSlots: [] };

describe('RecallProgressLoader - Step 4: Populate Progress Indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability', () => {
    it('should return progress data when fetch succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successData,
      });

      const result = await loadRecallProgress('session-001', 'session');

      expect(result).toEqual({ anchors: 3, actions: 5, outcomes: 2, incompleteSlots: [] });
    });

    it('should call the correct API endpoint with sessionId and sessionSource', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successData,
      });

      await loadRecallProgress('session-abc', 'session');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/recall/progress?sessionId=session-abc&sessionSource=session',
      );
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should return object matching RecallProgress type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successData,
      });

      const result: RecallProgress = await loadRecallProgress('session-001', 'session');

      expect(typeof result.anchors).toBe('number');
      expect(typeof result.actions).toBe('number');
      expect(typeof result.outcomes).toBe('number');
    });

    it('should default non-number values to 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: 'bad', actions: null, outcomes: undefined }),
      });

      const result = await loadRecallProgress('session-001', 'session');

      expect(result).toEqual({
        anchors: 0,
        actions: 0,
        outcomes: 0,
        incompleteSlots: undefined,
      });
    });

    it('should return all three required properties', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successData,
      });

      const result = await loadRecallProgress('session-001', 'session');

      expect(result).toHaveProperty('anchors');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('outcomes');
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should return neutral state when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await loadRecallProgress('session-001', 'session');

      expect(result).toEqual(NEUTRAL_PROGRESS);
    });

    it('should log UI_PROGRESS_LOAD_FAILED when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await loadRecallProgress('session-001', 'session');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'UI_PROGRESS_LOAD_FAILED',
        expect.any(Error),
        expect.objectContaining({
          module: 'RecallProgressLoader',
          sessionId: 'session-001',
        }),
      );
    });

    it('should return neutral state when HTTP status is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await loadRecallProgress('session-001', 'session');

      expect(result).toEqual(NEUTRAL_PROGRESS);
    });

    it('should log error when HTTP status is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await loadRecallProgress('session-001', 'session');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'UI_PROGRESS_LOAD_FAILED',
        expect.any(Error),
        expect.objectContaining({ module: 'RecallProgressLoader' }),
      );
    });
  });
});
