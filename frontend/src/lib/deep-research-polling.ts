/**
 * Deep Research Polling Utility (REQ_008.4)
 *
 * Implements polling mechanism with exponential backoff for background mode
 * Deep Research tasks.
 *
 * Features:
 * - Initial poll at 5 seconds after task creation
 * - Exponential backoff: 5s → 10s → 20s → 40s → 60s (capped)
 * - Maximum poll interval of 60 seconds
 * - Maximum total duration of 30 minutes before timeout
 * - Cancellation support via AbortController
 * - Progress updates during polling
 * - Network error retry (max 3 retries per poll)
 */

import type {
  DeepResearchResult,
  DeepResearchJobStatus,
  DeepResearchProgress,
  DeepResearchStatusResponse,
  DeepResearchErrorCode,
} from './types';

// =============================================================================
// Constants (REQ_008.4)
// =============================================================================

/** Initial poll interval in milliseconds (5 seconds) */
export const INITIAL_POLL_INTERVAL_MS = 5000;

/** Maximum poll interval in milliseconds (60 seconds) */
export const MAX_POLL_INTERVAL_MS = 60000;

/** Maximum total polling duration in milliseconds (30 minutes) */
export const MAX_TOTAL_DURATION_MS = 1800000;

/** Backoff multiplier for exponential backoff */
export const BACKOFF_MULTIPLIER = 2;

/** Maximum retries per poll for network errors */
export const MAX_NETWORK_RETRIES_PER_POLL = 3;

// =============================================================================
// Types
// =============================================================================

/**
 * Polling error with error code
 * REQ_008.4: Timeout error includes elapsed time
 */
export class DeepResearchPollingError extends Error {
  code: DeepResearchErrorCode | 'POLLING_TIMEOUT' | 'POLLING_CANCELLED';
  retryable: boolean;
  elapsedTimeMs?: number;

  constructor(
    message: string,
    code: DeepResearchErrorCode | 'POLLING_TIMEOUT' | 'POLLING_CANCELLED',
    retryable: boolean = false,
    elapsedTimeMs?: number
  ) {
    super(message);
    this.name = 'DeepResearchPollingError';
    this.code = code;
    this.retryable = retryable;
    this.elapsedTimeMs = elapsedTimeMs;
  }
}

/**
 * Progress callback for polling updates
 * REQ_008.4: Progress updates during polling
 */
export interface PollingProgressUpdate {
  status: DeepResearchJobStatus;
  elapsedTimeMs: number;
  pollCount: number;
  progress?: DeepResearchProgress;
}

/**
 * Options for polling Deep Research job
 */
export interface PollDeepResearchOptions {
  /** The job ID to poll */
  jobId: string;
  /** Optional AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Optional callback for progress updates */
  onProgress?: (update: PollingProgressUpdate) => void;
  /** Optional initial poll interval override (for testing) */
  initialIntervalMs?: number;
  /** Optional max interval override (for testing) */
  maxIntervalMs?: number;
  /** Optional max duration override (for testing) */
  maxDurationMs?: number;
}

/**
 * Result of polling operation
 */
export interface PollDeepResearchResult {
  result: DeepResearchResult;
  elapsedTimeMs: number;
  pollCount: number;
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Calculate next poll interval with exponential backoff
 * REQ_008.4: 5s → 10s → 20s → 40s → 60s (capped)
 */
export function calculateNextInterval(
  currentInterval: number,
  maxInterval: number = MAX_POLL_INTERVAL_MS
): number {
  const next = currentInterval * BACKOFF_MULTIPLIER;
  return Math.min(next, maxInterval);
}

/**
 * Sleep helper that respects abort signal
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DeepResearchPollingError('Polling cancelled', 'POLLING_CANCELLED', false));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new DeepResearchPollingError('Polling cancelled', 'POLLING_CANCELLED', false));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Fetch job status with network retry
 * REQ_008.4: Network errors trigger retry with same interval (max 3 retries per poll)
 */
async function fetchStatusWithRetry(
  jobId: string,
  signal?: AbortSignal,
  maxRetries: number = MAX_NETWORK_RETRIES_PER_POLL
): Promise<DeepResearchStatusResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (signal?.aborted) {
        throw new DeepResearchPollingError('Polling cancelled', 'POLLING_CANCELLED', false);
      }

      const response = await fetch(`/api/tools/deep-research/${jobId}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new DeepResearchPollingError(
          errorData.error ?? `Status check failed: ${response.status}`,
          errorData.code ?? 'API_ERROR',
          errorData.retryable ?? response.status >= 500
        );
      }

      return (await response.json()) as DeepResearchStatusResponse;
    } catch (error) {
      // Handle abort
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new DeepResearchPollingError('Polling cancelled', 'POLLING_CANCELLED', false);
      }

      // Handle DeepResearchPollingError (pass through non-network errors)
      if (error instanceof DeepResearchPollingError) {
        if (error.code === 'POLLING_CANCELLED' || error.code !== 'NETWORK') {
          throw error;
        }
      }

      // Network errors - retry if attempts remain
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Brief delay before retry (1 second)
        await sleep(1000, signal).catch(() => {
          throw new DeepResearchPollingError('Polling cancelled', 'POLLING_CANCELLED', false);
        });
        continue;
      }
    }
  }

  // All retries exhausted
  throw new DeepResearchPollingError(
    `Network error after ${maxRetries + 1} attempts: ${lastError?.message ?? 'Unknown error'}`,
    'NETWORK',
    true
  );
}

// =============================================================================
// Main polling function (REQ_008.4)
// =============================================================================

/**
 * Poll a Deep Research job until completion or failure
 *
 * REQ_008.4: Polling mechanism with exponential backoff
 * - Initial poll at 5 seconds
 * - Backoff: 5s → 10s → 20s → 40s → 60s (capped)
 * - Max 30 minute total duration
 * - Cancellation via AbortController
 * - Progress updates during polling
 * - Network error retry (max 3 per poll)
 *
 * @param options - Polling options
 * @returns The completed research result
 * @throws DeepResearchPollingError on timeout, cancellation, or API failure
 */
export async function pollDeepResearchJob(
  options: PollDeepResearchOptions
): Promise<PollDeepResearchResult> {
  const {
    jobId,
    signal,
    onProgress,
    initialIntervalMs = INITIAL_POLL_INTERVAL_MS,
    maxIntervalMs = MAX_POLL_INTERVAL_MS,
    maxDurationMs = MAX_TOTAL_DURATION_MS,
  } = options;

  const startTime = Date.now();
  let currentInterval = initialIntervalMs;
  let pollCount = 0;

  // Initial delay before first poll
  await sleep(initialIntervalMs, signal);

  while (true) {
    pollCount++;
    const elapsedTimeMs = Date.now() - startTime;

    // Check timeout
    if (elapsedTimeMs >= maxDurationMs) {
      throw new DeepResearchPollingError(
        `Polling timed out after ${Math.round(elapsedTimeMs / 1000)} seconds. ` +
        `For thorough depth queries, this may indicate the research is taking longer than expected.`,
        'POLLING_TIMEOUT',
        false,
        elapsedTimeMs
      );
    }

    // Check cancellation
    if (signal?.aborted) {
      throw new DeepResearchPollingError('Polling cancelled', 'POLLING_CANCELLED', false);
    }

    // Fetch status
    const statusResponse = await fetchStatusWithRetry(jobId, signal);

    // Emit progress update
    onProgress?.({
      status: statusResponse.status,
      elapsedTimeMs,
      pollCount,
      progress: statusResponse.progress,
    });

    // Handle completed status
    if (statusResponse.status === 'completed') {
      if (!statusResponse.result) {
        throw new DeepResearchPollingError(
          'Job completed but no result returned',
          'API_ERROR',
          false
        );
      }
      return {
        result: statusResponse.result,
        elapsedTimeMs: Date.now() - startTime,
        pollCount,
      };
    }

    // Handle failed status
    if (statusResponse.status === 'failed') {
      const errorMsg = statusResponse.error?.message ?? 'Research job failed';
      const errorCode = (statusResponse.error?.code ?? 'API_ERROR') as DeepResearchErrorCode;
      throw new DeepResearchPollingError(errorMsg, errorCode, false);
    }

    // Status is pending or processing - continue polling
    // Calculate next interval with exponential backoff
    const nextInterval = calculateNextInterval(currentInterval, maxIntervalMs);

    // Don't wait longer than remaining time
    const remainingTime = maxDurationMs - (Date.now() - startTime);
    const waitTime = Math.min(nextInterval, remainingTime);

    if (waitTime <= 0) {
      throw new DeepResearchPollingError(
        `Polling timed out after ${Math.round((Date.now() - startTime) / 1000)} seconds.`,
        'POLLING_TIMEOUT',
        false,
        Date.now() - startTime
      );
    }

    // Wait before next poll
    await sleep(waitTime, signal);
    currentInterval = nextInterval;
  }
}

/**
 * Convenience function to start Deep Research and poll for result
 *
 * Combines job creation and polling into a single call.
 *
 * @param query - The research query
 * @param options - Additional options including depth, tools, and polling options
 * @returns The completed research result
 */
export async function executeDeepResearch(
  query: string,
  options: {
    depth?: 'quick' | 'thorough';
    tools?: Array<{ type: string; [key: string]: unknown }>;
    developerInstructions?: string;
    signal?: AbortSignal;
    onProgress?: (update: PollingProgressUpdate) => void;
  } = {}
): Promise<DeepResearchResult> {
  const { depth = 'quick', tools, developerInstructions, signal, onProgress } = options;

  // Check cancellation before starting
  if (signal?.aborted) {
    throw new DeepResearchPollingError('Operation cancelled', 'POLLING_CANCELLED', false);
  }

  // Create the research job (background mode is default)
  const createResponse = await fetch('/api/tools/deep-research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      depth,
      tools,
      developerInstructions,
      background: true, // Always use background mode for long-running tasks
    }),
    signal,
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    throw new DeepResearchPollingError(
      errorData.error ?? `Failed to create research job: ${createResponse.status}`,
      errorData.code ?? 'API_ERROR',
      errorData.retryable ?? createResponse.status >= 500
    );
  }

  const jobData = await createResponse.json();

  // If job already completed (non-background mode response), return directly
  if (jobData.text !== undefined) {
    return jobData as DeepResearchResult;
  }

  // Poll for result
  const pollResult = await pollDeepResearchJob({
    jobId: jobData.jobId,
    signal,
    onProgress,
  });

  return pollResult.result;
}
