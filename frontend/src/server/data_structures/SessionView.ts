import { z } from 'zod';

export const SessionViewSourceSchema = z.enum(['answer_session', 'session']);

export const SessionViewSchema = z.object({
  id: z.string().uuid(),
  state: z.string().min(1),
  source: SessionViewSourceSchema,
  questionId: z.string().uuid().nullable().optional(),
  storyContent: z.string().nullable().optional(),
  responses: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export type SessionView = z.infer<typeof SessionViewSchema>;
