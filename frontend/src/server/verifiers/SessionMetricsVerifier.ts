/**
 * SessionMetricsVerifier - Validates aggregated session dataset before
 * metrics computation using Zod.
 *
 * Ensures the dataset contains required timestamps and event categories
 * needed for computing all five session metrics.
 *
 * Resource: db-j6x9 (backend_verifier)
 * Path: 301-store-session-metrics-on-pipeline-run
 */

import { z } from 'zod';
import type { AggregatedSessionDataset } from '@/server/data_structures/SessionMetrics';
import { InvalidMetricsInputError } from '@/server/error_definitions/MetricsErrors';

// ---------------------------------------------------------------------------
// Verification Schema — stricter than storage schema
// ---------------------------------------------------------------------------

const MetricsInputSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    status: z.literal('FINALIZED'),
    createdAt: z.string().min(1, 'session.createdAt is required'),
    updatedAt: z.string(),
    firstDraftAt: z.string().min(1, 'session.firstDraftAt is required'),
    finalizedAt: z.string().min(1, 'session.finalizedAt is required'),
  }),
  events: z.array(z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    category: z.enum(['DRAFT', 'VERIFY', 'FINALIZE', 'EDIT', 'REVISION', 'SIGNAL']),
    timestamp: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).min(1, 'At least one event is required'),
});

export const SessionMetricsVerifier = {
  /**
   * Validate that the aggregated dataset has all required fields
   * for computing session metrics.
   *
   * Throws InvalidMetricsInputError if validation fails.
   */
  validate(dataset: AggregatedSessionDataset): AggregatedSessionDataset {
    try {
      return MetricsInputSchema.parse(dataset) as AggregatedSessionDataset;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown validation error';
      throw InvalidMetricsInputError(
        `Metrics input validation failed: ${message}`,
      );
    }
  },
} as const;
