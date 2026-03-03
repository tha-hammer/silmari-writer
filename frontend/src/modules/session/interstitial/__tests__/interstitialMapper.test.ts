import { describe, expect, it } from 'vitest';
import { mapWorkflowTransitionToInterstitial } from '../interstitialMapper';

describe('interstitialMapper', () => {
  it('maps ORIENT -> RECALL_REVIEW to before_voice_recall interstitial', () => {
    expect(mapWorkflowTransitionToInterstitial('ORIENT', 'RECALL_REVIEW')).toEqual(
      expect.objectContaining({
        type: 'before_voice_recall',
        stepBefore: 'ORIENT',
        stepAfter: 'RECALL_REVIEW',
        minDisplayMs: 1500,
      }),
    );
  });

  it('maps RECALL_REVIEW -> DRAFT to before_verification_draft interstitial', () => {
    expect(mapWorkflowTransitionToInterstitial('RECALL_REVIEW', 'DRAFT')).toEqual(
      expect.objectContaining({
        type: 'before_verification_draft',
        stepBefore: 'RECALL_REVIEW',
        stepAfter: 'DRAFT',
      }),
    );
  });

  it('returns null for transitions without an interstitial contract', () => {
    expect(mapWorkflowTransitionToInterstitial('DRAFT', 'FINALIZE')).toBeNull();
    expect(mapWorkflowTransitionToInterstitial('FINALIZE', 'FINALIZED')).toBeNull();
    expect(mapWorkflowTransitionToInterstitial('RECALL_REVIEW', 'RECALL_REVIEW')).toBeNull();
  });
});

