import { z } from 'zod';

export const ContributionAreaSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  companyId: z.string().min(1),
  label: z.string().min(1),
  rationale: z.string().min(1),
  createdAt: z.string().min(1),
});

export const ContributionRequestSchema = z.object({
  shortlistId: z.string().uuid(),
  companyId: z.string().min(1),
  timeoutMs: z.number().int().positive().max(30000).optional(),
  simulateDelayMs: z.number().int().nonnegative().max(30000).optional(),
});

export const ContributionResponseSchema = z.object({
  companyId: z.string().min(1),
  contributionAreas: z.array(ContributionAreaSchema),
  degraded: z.boolean(),
  reason: z.enum(['timeout', 'cancelled']).nullable(),
});

export const ContributionErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ContributionRequest = z.infer<typeof ContributionRequestSchema>;
export type ContributionResponse = z.infer<typeof ContributionResponseSchema>;
export type ContributionErrorResponse = z.infer<typeof ContributionErrorResponseSchema>;
