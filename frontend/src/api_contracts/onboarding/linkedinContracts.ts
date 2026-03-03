import { z } from 'zod';

export const LinkedinInputModeSchema = z.enum(['url', 'manual', 'skip']);

export const LinkedinManualProfileSchema = z.object({
  headline: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  positions: z.array(z.string().trim().min(1)).optional(),
});

export const LinkedinParseRequestSchema = z
  .object({
    mode: LinkedinInputModeSchema,
    url: z.string().url().optional(),
    manualProfile: LinkedinManualProfileSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'url' && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'url is required when mode=url',
        path: ['url'],
      });
    }

    if (value.mode === 'manual' && !value.manualProfile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'manualProfile is required when mode=manual',
        path: ['manualProfile'],
      });
    }
  });

export const LinkedinProfileSnapshotSchema = z.object({
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  positions: z.array(z.string()),
  sourceUrl: z.string().url().optional(),
});

export const LinkedinParseResponseSchema = z.object({
  baselineId: z.string().uuid(),
  mode: z.enum(['url', 'manual', 'oauth', 'skip']),
  profile: LinkedinProfileSnapshotSchema,
});

export const LinkedinConnectStartRequestSchema = z.object({
  redirectUri: z.string().url(),
});

export const LinkedinConnectStartResponseSchema = z.object({
  authorizationUrl: z.string().url(),
  state: z.string().min(1),
  nonce: z.string().min(1),
});

export const LinkedinConnectCallbackRequestSchema = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  code: z.string().min(1),
});

export const LinkedinConnectCallbackResponseSchema = z.object({
  connectionStatus: z.literal('connected'),
  linkedinUserId: z.string().min(1),
  tokenStored: z.literal(true),
});

export const LinkedinErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fallbackOptions: z.array(z.enum(['manual', 'oauth', 'skip'])).optional(),
});

export type LinkedinParseRequest = z.infer<typeof LinkedinParseRequestSchema>;
export type LinkedinParseResponse = z.infer<typeof LinkedinParseResponseSchema>;
export type LinkedinConnectStartRequest = z.infer<typeof LinkedinConnectStartRequestSchema>;
export type LinkedinConnectStartResponse = z.infer<typeof LinkedinConnectStartResponseSchema>;
export type LinkedinConnectCallbackRequest = z.infer<typeof LinkedinConnectCallbackRequestSchema>;
export type LinkedinConnectCallbackResponse = z.infer<typeof LinkedinConnectCallbackResponseSchema>;
export type LinkedinErrorResponse = z.infer<typeof LinkedinErrorResponseSchema>;
