# /writer Voice Loop Technical Specification

## Scope
This specification documents the implemented voice-loop workflow initiated at [`/writer`](../frontend/src/app/writer/page.tsx) and continued at [`/session/[sessionId]`](../frontend/src/app/session/[sessionId]/page.tsx).

Source of truth for behavior:
- Path specs: `specs/orchestration/session-1772314225364/293-339`
- Runtime wiring: `frontend/src/app/writer`, `frontend/src/app/session/[sessionId]`, `frontend/src/modules/session`, `frontend/src/app/api/session/*`, `frontend/src/app/api/sessions/*`

## Product Goal
Enable users to produce truthful, high-signal application answers through a structured voice loop with claim verification and finalize/export controls.

Primary KPI:
- Writer-assisted Application -> Interview Conversion Rate

Leading KPIs:
1. Time-to-first-usable-draft
2. Story completion rate
3. Truth-confirmation rate
4. Signal density score
5. Voice session drop-off rate

## Entry Flow (`/writer`)
1. `GET /writer` renders `WriterPage` and mounts `StartSessionRouteAdapter`.
2. `StartSessionRouteAdapter` resolves auth context and renders `StartVoiceSessionModule`.
3. User clicks "Start Voice-Assisted Session".
4. `createSession()` calls `POST /api/sessions` with Bearer token.
5. Backend creates:
   - `answer_sessions` row in `INIT`
   - bootstrap ORIENT context:
     - one `questions` row
     - baseline `job_requirements` rows linked by `question_id`
     - baseline `stories` rows (`status='AVAILABLE'`) linked by `question_id`
   - linked `story_records` row in `INIT` with `question_id` set to the bootstrap question
6. UI navigates to `/session/{sessionId}`.

## Session Hydration (`/session/[sessionId]`)
1. Session page loads `getSession(sessionId)`.
2. `GET /api/sessions/[id]` returns `SessionView` from `answer_sessions` or `sessions`.
3. `SessionWorkflowShell` maps backend state to UI stage and renders stage module.

## Session Source Boundary (2026-03-04)
Two intentional workflow sources are supported and now guarded explicitly:

| Source | Backing table | Typical state model | Recall persistence path |
|---|---|---|---|
| `answer_session` | `answer_sessions` | `INIT`, `IN_PROGRESS`, `RECALL`, `...` | `/api/session/voice-response` + `/api/session/voice-turns` |
| `session` | `sessions` | `initialized`, `DRAFT`, `ACTIVE`, `...` | `/api/session/voice-turns` only |

Boundary guarantees:
- `sessionSource` is required on voice-turns read/write contracts.
- Recall submit is source-aware and fail-closed when source is missing.
- `/api/session/voice-response` rejects legacy-source IDs with deterministic mismatch semantics after auth/ownership checks.

## State Model

### Backend Session States
Common states observed in the workflow implementation:
- `INIT`, `ORIENT`, `IN_PROGRESS`, `RECALL`, `COMPLETE`, `VERIFY`, `REVIEW`, `DRAFT`, `FINALIZE`, `FINALIZED`

### UI Stage Mapping
`SessionWorkflowShell` collapses backend states into route-level UI stages:

| Backend state | UI stage | Rendered module |
|---|---|---|
| `ORIENT` | `ORIENT` | `OrientStoryModule` |
| `INIT` | Source-aware: `ORIENT` when `SessionView.questionId` exists; otherwise `RECALL_REVIEW` | `OrientStoryModule` or `WritingFlowModule` |
| `initialized` | `RECALL_REVIEW` | `WritingFlowModule` |
| `IN_PROGRESS`, `RECALL`, `COMPLETE`, `VERIFY`, `REVIEW` | `RECALL_REVIEW` | `WritingFlowModule` |
| `DRAFT`, `DRAFT_ENABLED`, `ACTIVE` | `DRAFT` | `ReviewWorkflowModule` |
| `FINALIZE` | `FINALIZE` | `AnswerModule` |
| `FINALIZED` | `FINALIZED` | `FinalizedAnswerModule` |

## Phase-by-Phase Technical Contracts

### INIT / Start Session
- UI: `StartVoiceSessionModule`
- API: `POST /api/sessions`
- Handler chain: `AuthAndValidationFilter -> CreateSessionHandler -> SessionInitializationService -> SessionDAO`
- Path specs: `306`, `293`
- Bootstrap persistence details:
  - `SessionInitializationService` creates session, then bootstrap question context, then story record.
  - `SessionDAO.createBootstrapQuestionContext()` seeds question + requirements + stories used by ORIENT.
  - `SessionDAO.createStoryRecord(..., questionId)` persists `story_records.question_id` for downstream orient-context loading.
  - Best-effort rollback removes session/context records on downstream failure.

### ORIENT / Story Selection
- UI: `OrientStoryModule`, `StorySelection`
- APIs:
  - `GET /api/story/orient-context`
  - `POST /api/story/confirm`
- Path specs: `313-316`, `295`

### RECALL / Voice Input + Slot Prompting
- UI: `RecallScreen`, `RecordButton`, `ProgressIndicator`, `VoiceSessionComponent`, `RecallSlotPrompt`
- APIs:
  - `POST /api/session/voice-response`
  - `GET|POST /api/session/voice-turns`
  - `POST /api/session/submit-slots`
- Path specs: `303`, `307`, `317-320`
- Source-aware runtime contract:
  - `sessionSource='answer_session'`: final transcript -> `submitVoiceResponse` then `voice-turns` working-answer update.
  - `sessionSource='session'`: final transcript skips `submitVoiceResponse` and persists via `voice-turns` only.
  - missing `sessionSource`: fail closed (no persistence call).

### VERIFY / Claim Confirmation
- APIs:
  - `POST /api/truth-checks/confirm`
  - `POST /api/verification/initiate`
  - `POST /api/sms/dispute`
  - `POST /api/sms/webhook`
- Path specs: `297`, `321-324`, `305`

### DRAFT / REVIEW
- UI: `ReviewWorkflowModule`, `ReviewScreen`, `EditByVoiceComponent`
- APIs:
  - `POST /api/draft/generate`
  - `POST /api/generate-draft`
  - `POST /api/review/approve`
  - `POST /api/edit-by-voice`
- Path specs: `298-300`, `325-332`

### FINALIZE / EXPORT
- UI: `AnswerModule`, `FinalizedAnswerModule`, `ExportCopyControls`
- APIs:
  - `POST /api/answers/[id]/finalize`
  - `GET /api/answers/[id]/export`
  - `POST /api/sessions/[id]/finalize`
- Path specs: `333-337`, `308`, `309`

### METRICS
- APIs:
  - `POST /api/analytics`
  - `POST /api/kpi/primary`
- Path specs: `301`, `338-339`

## Realtime Voice Subsystem
Realtime voice is server-proxied and never calls OpenAI directly from the client.

- Client creates WebRTC offer in `createVoiceSession()`.
- Offer is sent to `POST /api/voice/session`.
- Server proxies SDP exchange to `https://api.openai.com/v1/realtime/calls` using `OPENAI_API_KEY`.
- Data channel (`oai-events`) carries `session.update` and runtime events.
- Voice modes:
  - `read_aloud` (receive-only)
  - `voice_edit` (microphone required)
- Session limit: 60 minutes (configurable constant).

## Canonical Data Structures (route-level)

### `CreateSessionResponse`
```ts
{
  sessionId: string; // uuid
  state: 'INIT';
}
```

### `SessionView`
```ts
{
  id: string;        // uuid
  state: string;
  source: 'answer_session' | 'session';
  questionId?: string | null; // uuid for ORIENT context when available
  createdAt: string;
  updatedAt: string;
}
```

### `SubmitVoiceResponseRequest`
```ts
{
  sessionId: string; // uuid
  transcript: string;
}
```

### `SubmitVoiceResponseResponse`
```ts
{
  session: AnswerSession;
  storyRecord: AnswerStoryRecord;
}
```

### `SessionVoiceTurnsRequest` (source-aware)
```ts
{
  sessionId: string; // uuid
  sessionSource: 'answer_session' | 'session';
  action: 'update_working_answer' | 'reset_turns' | 'advance_question';
  content?: string;
}
```

### `SessionVoiceTurnsResponse` (source-aware)
```ts
{
  sessionId: string; // uuid
  sessionSource: 'answer_session' | 'session';
  workingAnswer: string;
  turns: string[];
  questionProgress: QuestionProgressState;
}
```

## Error Model
Route handlers return typed JSON errors:
```json
{ "code": "ERROR_CODE", "message": "Human-readable message" }
```
Key domains in the `/writer` flow:
- `SessionError` (session lifecycle + transitions)
- `ConfirmStoryError` (orient selection)
- `SlotError` (slot prompting)
- `ApprovalError` (review approval)
- `FinalizeAnswerError` / `AnswerError` (finalize/export)

Voice-response boundary semantics:
- `401 UNAUTHORIZED`: missing/invalid Authorization header.
- `404 SESSION_NOT_FOUND`: no owned matching session in either model.
- `409 INVALID_STATE`: owned ID belongs to prep/session workflow (use `/api/session/voice-turns`).

Operational resilience from debug:
- Legacy prep-story upsert tolerates temporary Supabase schema-cache drift for `story_records.question_progress` by retrying create without that column.

## Traceability to Orchestration Specs
- Session bootstrap: `293-296`, `302`, `306-312`
- Recall/verify loop: `303-304`, `317-324`
- Draft/review/finalize: `298-300`, `325-337`
- Metrics: `301`, `338-339`

All referenced path specs are in `specs/orchestration/session-1772314225364/`.
