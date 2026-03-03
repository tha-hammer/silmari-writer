import { z } from 'zod';

export const OutreachDraftSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  status: z.literal('completed'),
});

export const OutreachRequestSchema = z.object({
  shortlistId: z.string().uuid(),
  companyId: z.string().min(1),
  contactId: z.string().uuid().optional(),
  timeoutMs: z.number().int().positive().max(30000).optional(),
  simulateDelayMs: z.number().int().nonnegative().max(30000).optional(),
});

export const OutreachResponseSchema = z.object({
  companyId: z.string().min(1),
  draft: OutreachDraftSchema.nullable(),
  degraded: z.boolean(),
  reason: z.enum(['timeout', 'cancelled']).nullable(),
});

export const OutreachErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type OutreachRequest = z.infer<typeof OutreachRequestSchema>;
export type OutreachResponse = z.infer<typeof OutreachResponseSchema>;
export type OutreachErrorResponse = z.infer<typeof OutreachErrorResponseSchema>;
