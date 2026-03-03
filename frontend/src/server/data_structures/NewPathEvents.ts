import { z } from 'zod';

export const ArtifactTypeSchema = z.enum(['answer', 'outreach', 'linkedin_post', 'summary']);

export const InterstitialTypeSchema = z.enum([
  'after_ingestion',
  'before_voice_recall',
  'before_verification_draft',
]);

export const InterstitialCtaActionSchema = z.enum(['continue', 'wait', 'auto-advance']);

const NewPathEventCommonSchema = z.object({
  session_id: z.string().min(1),
  user_id: z.string().min(1),
  source: z.string().min(1).default('ui'),
  timestamp: z.string().min(1).optional(),
});

export const ArtifactCopiedToClipboardEventSchema = NewPathEventCommonSchema.extend({
  artifact_type: ArtifactTypeSchema,
  copy_success: z.boolean(),
  error_code: z.string().min(1).optional(),
});

export const InterstitialShownEventSchema = NewPathEventCommonSchema.extend({
  interstitial_type: InterstitialTypeSchema,
  step_before: z.string().min(1),
  step_after: z.string().min(1),
});

export const InterstitialDismissedOrContinuedEventSchema = NewPathEventCommonSchema.extend({
  interstitial_type: InterstitialTypeSchema,
  dwell_ms: z.number().int().nonnegative(),
  cta_action: InterstitialCtaActionSchema,
});

export const InterstitialAbandonmentEventSchema = NewPathEventCommonSchema.extend({
  interstitial_type: InterstitialTypeSchema,
  step_before: z.string().min(1),
  dwell_ms: z.number().int().nonnegative(),
});

export const NewPathEventSchemas = {
  artifact_copied_to_clipboard: ArtifactCopiedToClipboardEventSchema,
  interstitial_shown: InterstitialShownEventSchema,
  interstitial_dismissed_or_continued: InterstitialDismissedOrContinuedEventSchema,
  interstitial_abandonment: InterstitialAbandonmentEventSchema,
} as const;

export type NewPathEventName = keyof typeof NewPathEventSchemas;

export type NewPathEventPayloadMap = {
  artifact_copied_to_clipboard: z.infer<typeof ArtifactCopiedToClipboardEventSchema>;
  interstitial_shown: z.infer<typeof InterstitialShownEventSchema>;
  interstitial_dismissed_or_continued: z.infer<typeof InterstitialDismissedOrContinuedEventSchema>;
  interstitial_abandonment: z.infer<typeof InterstitialAbandonmentEventSchema>;
};

export type NewPathEventPayload<T extends NewPathEventName> = NewPathEventPayloadMap[T];

export function validateNewPathEvent<T extends NewPathEventName>(
  eventName: T,
  payload: unknown,
): NewPathEventPayload<T> {
  const schema = NewPathEventSchemas[eventName];
  return schema.parse(payload) as NewPathEventPayload<T>;
}

