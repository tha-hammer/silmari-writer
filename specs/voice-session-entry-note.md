# Voice Session Entry Note

## 2026-03-02: Start Voice-Assisted Session should enter voice-first flow

When a user starts a voice-assisted session from `/writer`, the session workflow should
land in the recall path first (voice capture path), not the review path.

### Implementation update

- `SessionWorkflowShell` now renders `WritingFlowModule` with `initialStep="RECALL"`
  for the `RECALL_REVIEW` stage.

### Rationale

- `Start Voice-Assisted Session` semantically implies voice-first capture.
- Starting at `REVIEW` made the flow appear text-first and caused confusion.

### Validation

- Unit coverage in `SessionWorkflowShell.test.tsx` now asserts that
  `WritingFlowModule` receives `initialStep: 'RECALL'` when the stage resolves to
  `RECALL_REVIEW`.
