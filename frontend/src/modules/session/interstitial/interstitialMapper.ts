import type { WorkflowStage } from '@/modules/session/stageMapper';
import type { InterstitialType } from './interstitialContent';

export interface InterstitialTransition {
  type: InterstitialType;
  stepBefore: WorkflowStage;
  stepAfter: WorkflowStage;
  minDisplayMs: number;
}

const MINIMUM_INTERSTITIAL_DISPLAY_MS = 1500;

export function mapWorkflowTransitionToInterstitial(
  fromStage: WorkflowStage | null,
  toStage: WorkflowStage,
): InterstitialTransition | null {
  if (fromStage === toStage || toStage === 'UNKNOWN') {
    return null;
  }

  if (fromStage === 'ORIENT' && toStage === 'RECALL_REVIEW') {
    return {
      type: 'before_voice_recall',
      stepBefore: 'ORIENT',
      stepAfter: 'RECALL_REVIEW',
      minDisplayMs: MINIMUM_INTERSTITIAL_DISPLAY_MS,
    };
  }

  if (fromStage === 'RECALL_REVIEW' && toStage === 'DRAFT') {
    return {
      type: 'before_verification_draft',
      stepBefore: 'RECALL_REVIEW',
      stepAfter: 'DRAFT',
      minDisplayMs: MINIMUM_INTERSTITIAL_DISPLAY_MS,
    };
  }

  if (fromStage === null && (toStage === 'ORIENT' || toStage === 'RECALL_REVIEW')) {
    return {
      type: 'after_ingestion',
      stepBefore: 'ORIENT',
      stepAfter: toStage,
      minDisplayMs: MINIMUM_INTERSTITIAL_DISPLAY_MS,
    };
  }

  return null;
}

