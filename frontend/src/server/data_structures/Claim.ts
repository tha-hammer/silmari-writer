/**
 * Claim - TypeScript interfaces and Zod schemas for claim entities,
 * including truth_checks, status, and SMS opt-in fields.
 *
 * Resource: db-f8n5 (data_structure)
 * Path: 305-followup-sms-for-uncertain-claim
 * Maps to: claims table
 */

import { z } from 'zod';

export type ClaimStatus = 'UNCERTAIN' | 'CONFIRMED' | 'DENIED' | 'PENDING' | 'UNVERIFIED';

export type TruthCheckVerdict = 'confirmed' | 'denied';

/**
 * TruthCheckEntry - A single truth check verdict within a claim.
 */
export const TruthCheckEntrySchema = z.object({
  id: z.string().min(1),
  verdict: z.enum(['confirmed', 'denied']),
  source: z.string().min(1),
  created_at: z.string(),
});

export type TruthCheckEntry = z.infer<typeof TruthCheckEntrySchema>;

/**
 * Zod schema for a Claim entity.
 */
export const ClaimSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(['UNCERTAIN', 'CONFIRMED', 'DENIED', 'PENDING', 'UNVERIFIED']),
  smsOptIn: z.boolean(),
  phoneNumber: z.string().optional(),
  truth_checks: z.array(TruthCheckEntrySchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Claim = z.infer<typeof ClaimSchema>;

/**
 * EligibleClaimContext - Enriched claim context after eligibility validation.
 */
export interface EligibleClaimContext {
  eligible: true;
  claim: Claim;
}

/**
 * IneligibleClaimContext - Context when claim does not meet eligibility.
 */
export interface IneligibleClaimContext {
  eligible: false;
  reason: string;
}

export type ClaimEligibilityResult = EligibleClaimContext | IneligibleClaimContext;

/**
 * FollowupSmsEvent - Event dispatched to the backend process chain.
 */
export interface FollowupSmsEvent {
  type: 'FOLLOWUP_SMS';
  claimId: string;
}

/**
 * SmsSendResult - Result from the SMS send operation.
 */
export interface SmsSendResult {
  status: 'sent' | 'failed';
  messageId?: string;
}

/**
 * TruthCheckUpdateRequest - Structured update from SMS reply.
 */
export interface TruthCheckUpdateRequest {
  claimId: string;
  verdict: TruthCheckVerdict;
  source: string;
}

// ---------------------------------------------------------------------------
// Path 326: generate-draft-with-only-confirmed-claims
// ---------------------------------------------------------------------------

/**
 * CaseClaimStatus — status values for claims in a case context.
 * Lowercase to distinguish from StoryClaim's uppercase statuses.
 */
export type CaseClaimStatus = 'confirmed' | 'unconfirmed' | 'rejected';

/**
 * CaseClaimSchema — Zod schema for a claim in a case context (path 326).
 */
export const CaseClaimSchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  text: z.string().min(1),
  status: z.enum(['confirmed', 'unconfirmed', 'rejected']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CaseClaim = z.infer<typeof CaseClaimSchema>;

/**
 * CaseDraftSchema — Zod schema for a simple draft composed from
 * confirmed claims (path 326).
 */
export const CaseDraftSchema = z.object({
  caseId: z.string().min(1),
  content: z.string(),
  claimsUsed: z.array(z.string().min(1)),
});

export type CaseDraft = z.infer<typeof CaseDraftSchema>;

/**
 * GenerateCaseDraftRequestSchema — request to the draft/generate endpoint.
 */
export const GenerateCaseDraftRequestSchema = z.object({
  caseId: z.string().min(1),
});

export type GenerateCaseDraftRequest = z.infer<typeof GenerateCaseDraftRequestSchema>;

/**
 * GenerateCaseDraftResponseSchema — response from the draft/generate endpoint.
 */
export const GenerateCaseDraftResponseSchema = z.object({
  caseId: z.string().min(1),
  content: z.string(),
  claimsUsed: z.array(z.string().min(1)),
});

export type GenerateCaseDraftResponse = z.infer<typeof GenerateCaseDraftResponseSchema>;

// ---------------------------------------------------------------------------
// Path 327: prevent-draft-generation-without-confirmed-claims
// ---------------------------------------------------------------------------

/**
 * StoryRecordClaim — A claim associated with a story record,
 * with a boolean confirmed flag for path 327 evaluation.
 *
 * Resource: db-f8n5 (data_structure)
 * Path: 327-prevent-draft-generation-without-confirmed-claims
 */
export const StoryRecordClaimSchema = z.object({
  id: z.string().min(1),
  storyRecordId: z.string().min(1),
  confirmed: z.boolean(),
  content: z.string().min(1),
});

export type StoryRecordClaim = z.infer<typeof StoryRecordClaimSchema>;

/**
 * GenerateStoryDraftRequestSchema — request to generate a draft
 * from confirmed claims for a story record.
 */
export const GenerateStoryDraftRequestSchema = z.object({
  storyRecordId: z.string().min(1),
});

export type GenerateStoryDraftRequest = z.infer<typeof GenerateStoryDraftRequestSchema>;

/**
 * GenerateStoryDraftResponseSchema — response containing
 * generated draft content or empty on failure.
 */
export const GenerateStoryDraftResponseSchema = z.object({
  storyRecordId: z.string().min(1),
  content: z.string(),
  claimsUsed: z.array(z.string().min(1)),
});

export type GenerateStoryDraftResponse = z.infer<typeof GenerateStoryDraftResponseSchema>;

/**
 * ErrorResponseSchema — shared error response shape
 * used across error boundaries.
 */
export const ErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ---------------------------------------------------------------------------
// Path 328: exclude-incomplete-claim-during-draft-generation
// ---------------------------------------------------------------------------

/**
 * ConfirmedClaim — A claim with status CONFIRMED that includes
 * structural metadata fields (metric, scope, context) used for
 * completeness evaluation.
 *
 * Resource: db-f8n5 (data_structure)
 * Path: 328-exclude-incomplete-claim-during-draft-generation
 */
export const ConfirmedClaimSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  content: z.string().min(1),
  status: z.literal('CONFIRMED'),
  metric: z.string().optional(),
  scope: z.string().optional(),
  context: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ConfirmedClaim = z.infer<typeof ConfirmedClaimSchema>;

/**
 * Required structural metadata fields that must be present
 * for a claim to be considered "complete" for drafting.
 */
export const REQUIRED_STRUCTURAL_METADATA_FIELDS = ['metric', 'scope', 'context'] as const;

export type StructuralMetadataField = (typeof REQUIRED_STRUCTURAL_METADATA_FIELDS)[number];

/**
 * IncompleteClaimReport — describes a claim that was excluded from
 * the draft because it is missing required structural metadata.
 */
export const IncompleteClaimReportSchema = z.object({
  claimId: z.string().min(1),
  missingFields: z.array(z.enum(REQUIRED_STRUCTURAL_METADATA_FIELDS)),
});

export type IncompleteClaimReport = z.infer<typeof IncompleteClaimReportSchema>;

/**
 * OmissionEntry — describes a claim omitted from the draft with
 * a human-readable reason.
 */
export const OmissionEntrySchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().min(1),
});

export type OmissionEntry = z.infer<typeof OmissionEntrySchema>;

/**
 * DraftGenerationCommandSchema — structured command produced by
 * normalizing the incoming draft generation HTTP request.
 */
export const DraftGenerationCommandSchema = z.object({
  sessionId: z.string().min(1),
});

export type DraftGenerationCommand = z.infer<typeof DraftGenerationCommandSchema>;

/**
 * DraftGenerationResultSchema — the result of a successful draft
 * generation, containing the draft content and an omission report
 * for excluded incomplete claims.
 */
export const DraftGenerationResultSchema = z.object({
  draftContent: z.string(),
  omissionReport: z.array(OmissionEntrySchema),
});

export type DraftGenerationResult = z.infer<typeof DraftGenerationResultSchema>;

/**
 * Request schema for path 328 draft generation.
 */
export const ExcludeIncompleteDraftRequestSchema = z.object({
  sessionId: z.string().min(1),
});

export type ExcludeIncompleteDraftRequest = z.infer<typeof ExcludeIncompleteDraftRequestSchema>;

/**
 * Response schema for path 328 draft generation — includes draft + omissions.
 */
export const ExcludeIncompleteDraftResponseSchema = z.object({
  draft: z.string(),
  omissions: z.array(OmissionEntrySchema),
});

export type ExcludeIncompleteDraftResponse = z.infer<typeof ExcludeIncompleteDraftResponseSchema>;
