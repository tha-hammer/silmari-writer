/**
 * Event - Zod schema and TypeScript types for session Event records.
 *
 * Events represent timestamped occurrences during a session, used for
 * computing session metrics (time-to-first-draft, signal density, etc.).
 *
 * Resource: db-f8n5 (data_structure)
 * Path: 301-store-session-metrics-on-pipeline-run
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Event Category Enum
// ---------------------------------------------------------------------------

export const EventCategory = {
  DRAFT: 'DRAFT',
  VERIFY: 'VERIFY',
  FINALIZE: 'FINALIZE',
  EDIT: 'EDIT',
  REVISION: 'REVISION',
  SIGNAL: 'SIGNAL',
} as const;

export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

// ---------------------------------------------------------------------------
// Event Zod Schema
// ---------------------------------------------------------------------------

export const EventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  category: z.enum(['DRAFT', 'VERIFY', 'FINALIZE', 'EDIT', 'REVISION', 'SIGNAL']),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Event = z.infer<typeof EventSchema>;
