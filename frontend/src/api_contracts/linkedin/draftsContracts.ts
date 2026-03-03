import { z } from 'zod';

export const LinkedinDraftSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  status: z.literal('completed'),
  manualPostOnly: z.literal(true),
});

export const LinkedinDraftRequestSchema = z.object({
  shortlistId: z.string().uuid(),
  companyId: z.string().min(1),
  contributionAreaId: z.string().uuid().optional(),
  timeoutMs: z.number().int().positive().max(30000).optional(),
  simulateDelayMs: z.number().int().nonnegative().max(30000).optional(),
});

export const LinkedinDraftResponseSchema = z.object({
  companyId: z.string().min(1),
  draft: LinkedinDraftSchema.nullable(),
  manualPostReminder: z.string().min(1),
  degraded: z.boolean(),
  reason: z.enum(['timeout', 'cancelled']).nullable(),
});

export const LinkedinDraftErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type LinkedinDraftRequest = z.infer<typeof LinkedinDraftRequestSchema>;
export type LinkedinDraftResponse = z.infer<typeof LinkedinDraftResponseSchema>;
export type LinkedinDraftErrorResponse = z.infer<typeof LinkedinDraftErrorResponseSchema>;
