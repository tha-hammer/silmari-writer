import { z } from 'zod';

export const ShortlistItemSchema = z.object({
  companyId: z.string().min(1),
  companyName: z.string().min(1),
  rank: z.number().int().positive(),
});

export const ShortlistRequestSchema = z
  .object({
    action: z.enum(['generate', 'save']),
    baselineId: z.string().uuid().optional(),
    shortlistId: z.string().uuid().optional(),
    items: z.array(ShortlistItemSchema).optional(),
    timeoutMs: z.number().int().positive().max(30000).optional(),
    simulateDelayMs: z.number().int().nonnegative().max(30000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'save' && (!value.items || value.items.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'items are required when action=save',
        path: ['items'],
      });
    }
  });

export const ShortlistResponseSchema = z.object({
  shortlistId: z.string().uuid().nullable(),
  items: z.array(ShortlistItemSchema),
  generated: z.boolean(),
  saved: z.boolean(),
  degraded: z.boolean(),
  reason: z.enum(['timeout', 'cancelled', 'missing_baseline']).nullable(),
  manualEntryRequired: z.boolean(),
});

export const ShortlistErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ShortlistRequest = z.infer<typeof ShortlistRequestSchema>;
export type ShortlistResponse = z.infer<typeof ShortlistResponseSchema>;
export type ShortlistErrorResponse = z.infer<typeof ShortlistErrorResponseSchema>;
