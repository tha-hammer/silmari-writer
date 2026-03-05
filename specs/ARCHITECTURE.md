# CosmicHR Writer — /writer Voice-Loop Architecture

## System Scope
This document describes the production voice-loop architecture as implemented through:
- `GET /writer` (workflow entry)
- `GET /session/[sessionId]` (stateful workflow shell)

The implementation is grounded in path specs `293-339` under `specs/orchestration/session-1772314225364/`.

## Architecture Summary

```text
Browser
  /writer
    -> WriterPage
    -> StartSessionRouteAdapter
    -> StartVoiceSessionModule
    -> POST /api/sessions
    -> navigate /session/{id}

  /session/{id}
    -> SessionPage
    -> GET /api/sessions/[id]
    -> SessionWorkflowShell
       -> ORIENT: OrientStoryModule
       -> RECALL_REVIEW: WritingFlowModule
       -> DRAFT: ReviewWorkflowModule
       -> FINALIZE: AnswerModule
       -> FINALIZED: FinalizedAnswerModule
```

## Frontend Route Topology

### 1. `/writer` bootstrap route
- File: `frontend/src/app/writer/page.tsx`
- Responsibility: expose the start-session control and route users into an initialized workflow.
- Session start path:
  - `StartSessionRouteAdapter` resolves auth context from `localStorage` (`authToken` fallback: `dev-session-token`).
  - `StartVoiceSessionModule` gates access with `RequireAuth`.
  - `createSession()` calls `POST /api/sessions`.
  - Success path navigates to `/session/{sessionId}`.

### 2. `/session/[sessionId]` workflow route
- File: `frontend/src/app/session/[sessionId]/page.tsx`
- Responsibility: hydrate server session state and render the appropriate stage module.
- Hydration path:
  - `getSession(sessionId)` -> `GET /api/sessions/[id]`
  - Renders `SessionWorkflowShell` on success.

## UI Stage Mapping

`SessionWorkflowShell` maps backend session states to route-level UI stages.

| Backend state | UI stage | Module |
|---|---|---|
| `ORIENT` | `ORIENT` | `OrientStoryModule` |
| `INIT` | Source-aware: `ORIENT` when `questionId` exists; otherwise `RECALL_REVIEW` | `OrientStoryModule` or `WritingFlowModule` |
| `initialized` | `RECALL_REVIEW` | `WritingFlowModule` |
| `IN_PROGRESS`, `RECALL`, `COMPLETE`, `VERIFY`, `REVIEW` | `RECALL_REVIEW` | `WritingFlowModule` |
| `DRAFT`, `DRAFT_ENABLED`, `ACTIVE` | `DRAFT` | `ReviewWorkflowModule` |
| `FINALIZE` | `FINALIZE` | `AnswerModule` |
| `FINALIZED` | `FINALIZED` | `FinalizedAnswerModule` |

## Dual Workflow Boundary

| Session source | Backing table | Typical states | Voice submit endpoint |
|---|---|---|---|
| `answer_session` | `answer_sessions` | `INIT`, `IN_PROGRESS`, `RECALL`, `...` | `/api/session/voice-response` |
| `session` | `sessions` | `initialized`, `DRAFT`, `ACTIVE`, `...` | `/api/session/voice-turns` (no voice-response) |

Guardrails implemented:
- `sessionSource` is a required API contract field for `/api/session/voice-turns`.
- `SessionWorkflowShell` forwards source to `WritingFlowModule` and `RecallScreen`.
- `RecallScreen` uses source-aware persistence and fails closed when source is missing.

## Server Architecture (request path)

```text
Route Handler (app/api/*)
  -> Filter (auth/validation where required)
  -> Request Handler
  -> Service
  -> Processor / Process Chain
  -> DAO (Supabase)
  -> Typed Error mapping
```

### Session bootstrap example (`POST /api/sessions`)
- `AuthAndValidationFilter.authenticate()` validates Bearer header.
- `CreateSessionHandler.handle()` validates command shape.
- `SessionInitializationService.initializeSession()`:
  1. create `answer_sessions` row (`INIT`)
  2. create linked `story_records` row (`INIT`)
  3. rollback session if story creation fails
- Returns `{ sessionId, state: 'INIT' }`.

## API Surface for `/writer` Workflow

### Core workflow endpoints
| Method | Path | Role |
|---|---|---|
| `POST` | `/api/sessions` | Create initial answer session |
| `GET` | `/api/sessions/[id]` | Hydrate session view for workflow shell |
| `GET` | `/api/story/orient-context` | Load question + requirements + stories |
| `POST` | `/api/story/confirm` | Confirm aligned story selection |
| `POST` | `/api/session/voice-response` | Process transcript and progress session |
| `GET` | `/api/session/voice-turns` | Read source-specific working-answer persistence |
| `POST` | `/api/session/voice-turns` | Write source-specific working-answer persistence |
| `POST` | `/api/session/submit-slots` | Re-prompt and collect missing required slots |
| `POST` | `/api/truth-checks/confirm` | Confirm / deny key claim |
| `POST` | `/api/verification/initiate` | Start verification flow |
| `POST` | `/api/review/approve` | Approve reviewed content and advance stage |
| `POST` | `/api/edit-by-voice` | Apply voice edit instruction in review |
| `POST` | `/api/answers/[id]/finalize` | Lock finalized answer |
| `GET` | `/api/answers/[id]/export` | Export finalized answer |

### Supporting endpoints used by the same lifecycle
| Method | Path | Role |
|---|---|---|
| `POST` | `/api/sessions/[id]/approve` | Session approval transition |
| `POST` | `/api/sessions/[id]/finalize` | Persist finalized session/story state |
| `POST` | `/api/sms/webhook` | Receive SMS replies |
| `POST` | `/api/sms/dispute` | Capture SMS dispute in verify/follow-up |
| `POST` | `/api/analytics` | Emit leading KPI analytics |
| `POST` | `/api/kpi/primary` | Emit primary KPI event |

## Data Model (workflow-critical)

### `answer_sessions`
- `id`, `user_id`, `state`, `created_at`, `updated_at`

### `story_records`
- `id`, `voice_session_id` (legacy fallback `session_id`), `status`, `content`, `responses`, optional `question_progress`, timestamps

### Workflow-linked entities
- `truth_checks` (verification outcomes)
- `claims`, `verification_requests`
- `answers` / `content` (review + finalize)
- `session_metrics`, `events`, analytics tables

## Voice-Response Auth & Mismatch Semantics
- `/api/session/voice-response` now authenticates at route entry (`AuthAndValidationFilter`).
- Handler resolves answer session with ownership check before processing.
- When an owned legacy prep-session ID is posted to voice-response, handler returns deterministic `409 INVALID_STATE` with guidance to use `/api/session/voice-turns`.
- Unauthenticated (`401`) or unauthorized (`404`) calls do not leak source/type existence details.

## Debug-Driven Resilience
- Prep-session story-record creation includes a fallback for Supabase schema-cache drift:
  - if `question_progress` column is temporarily missing in schema cache, DAO retries insert without `question_progress` so persistence remains durable.

## Realtime Voice Architecture

### WebRTC proxy flow
1. Client creates offer via `RTCPeerConnection` and waits for ICE completion.
2. Client posts SDP to `POST /api/voice/session`.
3. Server proxies to `https://api.openai.com/v1/realtime/calls` using `OPENAI_API_KEY`.
4. Server returns SDP answer; client sets remote description.
5. Data channel `oai-events` carries session events and `session.update`.

### Voice modes
- `read_aloud` -> receive-only audio transceiver
- `voice_edit` -> microphone capture required

### Session policy
- Configured limit: 60 minutes (`SESSION_LIMIT_MINUTES`)
- Server key only; no direct client OpenAI authentication

## AI Model Allocation (implemented)
| Endpoint | Model |
|---|---|
| `/api/transcribe` | `whisper-1` |
| `/api/generate` | `gpt-4o-mini` |
| `/api/voice/session` | `gpt-4o-realtime-preview` |
| `/api/voice/edit` | `gpt-4o-mini` |
| `/api/tools/document-generation` | default `gpt-4o` (supports `gpt-4o-mini`, `gpt-4-turbo`) |
| `/api/tools/intent-classification` | `gpt-4o-mini` |
| `/api/tools/deep-research` | OpenAI Responses API (`o4-mini-deep-research-2025-06-26` quick, `o3-deep-research-2025-06-26` thorough) |

## Validation and Error Boundaries
- Zod validation at route inputs and typed API contract boundaries.
- Typed domain errors mapped to HTTP JSON `{ code, message }`.
- Frontend modules preserve recoverable UI states when API calls fail.

## Technology Stack (active codebase)
- Next.js 16.1.2 + React 19.2.3 + TypeScript 5
- Tailwind CSS 4
- Zustand 5
- Zod 4
- Supabase JS 2 (DAO layer)
- OpenAI SDK 6
- Vercel Blob 2
- Vitest + React Testing Library + Playwright

## Implementation Notes
- Session DAO and service layers are present and wired; some paths still rely on stubs/fallback patterns depending on environment configuration.
- Voice and editing flows are route-driven under `/writer` and `/session/[sessionId]`, not the legacy root-page flow.
