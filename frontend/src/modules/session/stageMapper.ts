export type WorkflowStage =
  | 'ORIENT'
  | 'RECALL_REVIEW'
  | 'DRAFT'
  | 'FINALIZE'
  | 'FINALIZED'
  | 'UNKNOWN';

export interface StageMappingOptions {
  source?: 'answer_session' | 'session';
  questionId?: string | null;
}

const STAGE_BY_STATE: Record<string, WorkflowStage> = {
  INIT: 'ORIENT',
  initialized: 'RECALL_REVIEW',
  ORIENT: 'ORIENT',

  IN_PROGRESS: 'RECALL_REVIEW',
  RECALL: 'RECALL_REVIEW',
  COMPLETE: 'RECALL_REVIEW',
  VERIFY: 'RECALL_REVIEW',
  REVIEW: 'RECALL_REVIEW',

  DRAFT: 'DRAFT',
  DRAFT_ENABLED: 'DRAFT',
  ACTIVE: 'DRAFT',

  FINALIZE: 'FINALIZE',
  FINALIZED: 'FINALIZED',
};

export function mapSessionStateToStage(
  state: string,
  options?: StageMappingOptions,
): WorkflowStage {
  const mapped = STAGE_BY_STATE[state] ?? 'UNKNOWN';

  // /api/sessions bootstrap currently has no question context. Avoid invoking
  // ORIENT with an invalid questionId derived from session.id.
  if (
    mapped === 'ORIENT'
    && options?.source === 'answer_session'
    && (!options.questionId || options.questionId.trim() === '')
  ) {
    return 'RECALL_REVIEW';
  }

  return mapped;
}

export function isTerminalStage(stage: WorkflowStage): boolean {
  return stage === 'FINALIZED';
}
