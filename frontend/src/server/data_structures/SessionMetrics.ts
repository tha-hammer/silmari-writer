/**
 * SessionMetrics - Zod schema and TypeScript types for computed session metrics.
 *
 * Stores the five key metrics computed from a completed session:
 * time-to-first-draft, completion rate, confirmation rate, signal density, and drop-off.
 *
 * Resource: db-f8n5 (data_structure)
 * Path: 301-store-session-metrics-on-pipeline-run
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Session Metrics Zod Schema
// ---------------------------------------------------------------------------

export const SessionMetricsSchema = z.object({
  id: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  timeToFirstDraft: z.number(),
  completionRate: z.number(),
  confirmationRate: z.number(),
  signalDensity: z.number(),
  dropOff: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;

// ---------------------------------------------------------------------------
// Aggregated Session Dataset — input for metrics computation
// ---------------------------------------------------------------------------

export const AggregatedSessionDatasetSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    status: z.literal('FINALIZED'),
    createdAt: z.string(),
    updatedAt: z.string(),
    firstDraftAt: z.string().optional(),
    finalizedAt: z.string().optional(),
  }),
  events: z.array(z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    category: z.enum(['DRAFT', 'VERIFY', 'FINALIZE', 'EDIT', 'REVISION', 'SIGNAL']),
    timestamp: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
});

export type AggregatedSessionDataset = z.infer<typeof AggregatedSessionDatasetSchema>;

// ---------------------------------------------------------------------------
// Pipeline Result — returned after successful pipeline execution
// ---------------------------------------------------------------------------

export const PipelineResultSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['SUCCESS', 'FAILURE']),
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;
