import { z } from 'zod';

export const ContactSuggestionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1),
  companyId: z.string().min(1),
  contactExternalId: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  createdAt: z.string().min(1),
});

export const ContactsRequestSchema = z.object({
  shortlistId: z.string().uuid(),
  companyId: z.string().min(1),
  timeoutMs: z.number().int().positive().max(30000).optional(),
  simulateDelayMs: z.number().int().nonnegative().max(30000).optional(),
});

export const ContactsResponseSchema = z.object({
  companyId: z.string().min(1),
  contacts: z.array(ContactSuggestionSchema),
  degraded: z.boolean(),
  reason: z.enum(['timeout', 'cancelled']).nullable(),
});

export const ContactsErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ContactsRequest = z.infer<typeof ContactsRequestSchema>;
export type ContactsResponse = z.infer<typeof ContactsResponseSchema>;
export type ContactsErrorResponse = z.infer<typeof ContactsErrorResponseSchema>;
