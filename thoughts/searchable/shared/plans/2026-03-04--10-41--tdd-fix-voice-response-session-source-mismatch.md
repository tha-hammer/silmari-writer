# Fix Voice-Response Session Source Mismatch TDD Implementation Plan

## Overview
This plan fixes the recurring `409 INVALID_STATE` errors from `POST /api/session/voice-response` during Recall by aligning writer session identity with the voice-response pipeline and adding source-aware safeguards for legacy sessions.

TDD objective: ensure every session that reaches Recall autosave is compatible with `ProcessVoiceResponseHandler` (answer-session backed), while stale legacy sessions fail gracefully with explicit UX guidance instead of noisy retry conflicts.

## Current State Analysis

### Key Discoveries
- Writer start endpoints still create legacy `sessions` records via `InitializeSessionService.createSession`:
  - `frontend/src/app/api/session/start-default/route.ts:31`
  - `frontend/src/app/api/session/start-from-upload/route.ts:287`
  - `frontend/src/server/services/ChannelIngestionPipelineAdapter.ts:37`
- Recall autosave always posts transcripts to `/api/session/voice-response`:
  - `frontend/src/components/RecallScreen.tsx:469`
- Voice-response handler only accepts `answer_sessions` IDs and returns `INVALID_STATE` when missing:
  - `frontend/src/server/request_handlers/ProcessVoiceResponseHandler.ts:60`
- Session fetch allows mixed models (`answer_session` first, then legacy `session` fallback):
  - `frontend/src/server/request_handlers/GetSessionHandler.ts:9`
  - `frontend/src/server/request_handlers/GetSessionHandler.ts:24`
- `SessionView` explicitly encodes this mixed source model:
  - `frontend/src/server/data_structures/SessionView.ts:3`
- Stage mapping currently routes legacy `initialized` state into Recall/Review, which makes legacy sessions reachable by Recall autosave:
  - `frontend/src/modules/session/stageMapper.ts:16`

### Existing Test Patterns To Follow
- Handler-level mocks + typed error assertions:
  - `frontend/src/server/request_handlers/__tests__/ProcessVoiceResponseHandler.test.ts`
- Next route behavior mapping tests:
  - `frontend/src/app/api/session/voice-response/__tests__/route.test.ts`
- Recall event wiring with mocked realtime callbacks:
  - `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`
- Start-route contract tests:
  - `frontend/src/app/api/session/start-default/__tests__/route.test.ts`
  - `frontend/src/app/api/session/start-from-upload/__tests__/route.test.ts`
  - `frontend/src/app/api/ingestion/url/__tests__/route.test.ts`

## Desired End State
- Sessions created from `/writer` start flows are Recall-autosave compatible by default.
- Legacy `source=session` records no longer trigger repeated `/api/session/voice-response` conflicts.
- UI and API emit deterministic behavior for both supported and unsupported session sources.

### Observable Behaviors
1. Given a newly started writer session, when Recall transcript finalization fires, then `submitVoiceResponse` succeeds (no `Session <id> not found`).
2. Given a legacy `source=session` session, when Recall receives transcript events, then app avoids incompatible voice-response posts and surfaces a clear recovery message.
3. Given an incompatible session ID reaches backend voice-response, when handler validates session identity, then error is explicit and actionable (not ambiguous not-found).
4. Given regression tests run for writer start + Recall autosave, when test suite executes, then no path reintroduces mixed-model conflicts.

## What We're NOT Doing
- Full migration/backfill of historical legacy `sessions` rows.
- Redesign of Recall question generation logic.
- Large orchestration rewrites for unrelated paths (`342-345`) beyond source-compatibility boundaries.

## Testing Strategy
- **Framework**: Vitest + React Testing Library.
- **Primary test types**:
  - Unit: session-source resolution and handler branching.
  - Integration: API route behavior and cross-endpoint compatibility.
  - UI wiring: Recall realtime event handling and source-aware submit strategy.
- **Execution order**: smallest deterministic route/handler tests first, then Recall UI regression, then end-to-end compatibility test.

## Behavior 1: Writer Start Flows Produce Recall-Compatible Session IDs

### Test Specification
**Given** writer start endpoints (`start-default`, `start-from-upload`, `ingestion/url`)  
**When** session initialization succeeds  
**Then** returned `sessionId` resolves through `/api/sessions/[id]` as `source='answer_session'` and can be used by `/api/session/voice-response`.

**Edge Cases**:
- Active-session conflict still maps to 409.
- Existing response schema remains backward compatible (`state: 'initialized'` in start contracts if required by frontend contract).

### TDD Cycle

#### Red: Write Failing Tests
**Files**:
- `frontend/src/app/api/session/start-default/__tests__/route.test.ts`
- `frontend/src/app/api/session/start-from-upload/__tests__/route.test.ts`
- `frontend/src/server/services/__tests__/ChannelIngestionPipelineAdapter.test.ts`
- `frontend/src/app/api/ingestion/url/__tests__/route.test.ts`

```ts
it('returns a session id that is answer-session backed', async () => {
  // start endpoint succeeds
  // follow-up fetch (or mocked handler contract) resolves source === 'answer_session'
  // response shape contract remains valid
});
```

#### Green: Minimal Implementation
**Candidate files**:
- `frontend/src/app/api/session/start-default/route.ts`
- `frontend/src/app/api/session/start-from-upload/route.ts`
- `frontend/src/server/services/ChannelIngestionPipelineAdapter.ts`
- `frontend/src/server/services/SessionInitializationService.ts` (or new writer bootstrap service)

```ts
// Replace legacy InitializeSessionService-based identity allocation
// with answer-session compatible allocation for writer flow.
// Keep outward contract fields expected by existing API contracts.
```

#### Refactor: Improve Code
**Candidate files**:
- `frontend/src/server/services/WriterSessionBootstrapService.ts` (new)
- `frontend/src/server/services/ChannelIngestionPipelineAdapter.ts`

```ts
// Centralize writer session bootstrap so all start endpoints use one source-of-truth.
```

### Success Criteria
**Automated:**
- [ ] Start route tests fail first, then pass after bootstrap alignment.
- [ ] Channel ingestion adapter tests stay green for success and 409 mapping.
- [ ] `npm --prefix frontend run test -- src/app/api/session/start-default/__tests__/route.test.ts src/app/api/session/start-from-upload/__tests__/route.test.ts src/server/services/__tests__/ChannelIngestionPipelineAdapter.test.ts src/app/api/ingestion/url/__tests__/route.test.ts`

**Manual:**
- [ ] Start session from URL/default/upload and verify resulting `/session/:id` no longer throws `Session <id> not found` on Recall voice autosave.

---

## Behavior 2: Recall Submit Strategy Is Session-Source Aware

### Test Specification
**Given** Recall screen loaded with session source metadata  
**When** final transcript events arrive  
**Then** app uses compatible persistence path and does not repeatedly call incompatible voice-response endpoint.

**Edge Cases**:
- `source='answer_session'` keeps current autosave behavior.
- `source='session'` shows deterministic unsupported-path messaging and avoids duplicate retry loops.

### TDD Cycle

#### Red: Write Failing Tests
**Files**:
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`
- `frontend/src/modules/session/__tests__/SessionWorkflowShell.test.tsx`

```tsx
it('does not call submitVoiceResponse for legacy source=session', async () => {
  render(<RecallScreen sessionId={SESSION_ID} sessionSource="session" />);
  emitVoiceEvent(finalTranscriptEvent);
  await waitFor(() => expect(mockSubmitVoiceResponse).not.toHaveBeenCalled());
});
```

#### Green: Minimal Implementation
**Candidate files**:
- `frontend/src/modules/session/SessionWorkflowShell.tsx`
- `frontend/src/modules/WritingFlowModule.tsx`
- `frontend/src/components/RecallScreen.tsx`

```tsx
// Thread session.source down to RecallScreen
// Branch transcript submit path by source:
// answer_session => submitVoiceResponse + updateSessionWorkingAnswer
// session => compatible fallback + user-visible status
```

#### Refactor: Improve Code
**Candidate file**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// Extract a small submit strategy helper to reduce effect complexity.
```

### Success Criteria
**Automated:**
- [ ] Legacy-source Recall test fails before implementation and passes after.
- [ ] Existing `answer_session` Recall tests remain green.
- [ ] `npm --prefix frontend run test -- src/components/__tests__/RecallScreen.voice.test.tsx src/modules/session/__tests__/SessionWorkflowShell.test.tsx`

**Manual:**
- [ ] Legacy session link no longer spams `/api/session/voice-response` 409s in Network tab.
- [ ] Answer-session Recall still autosaves normally.

---

## Behavior 3: Backend Voice-Response Error Messaging Is Deterministic

### Test Specification
**Given** `/api/session/voice-response` receives a UUID not present in `answer_sessions` but present in legacy `sessions`  
**When** handler validates session identity  
**Then** error explicitly states source mismatch (legacy vs answer-session requirement).

**Edge Cases**:
- Truly missing session keeps current not-found behavior.
- Unsupported answer-session state keeps current state-validation behavior.

### TDD Cycle

#### Red: Write Failing Tests
**Files**:
- `frontend/src/server/request_handlers/__tests__/ProcessVoiceResponseHandler.test.ts`
- `frontend/src/app/api/session/voice-response/__tests__/route.test.ts`

```ts
it('returns explicit source-mismatch message when legacy session id is provided', async () => {
  mockDAO.findAnswerSessionById.mockResolvedValue(null);
  mockDAO.findById.mockResolvedValue({ id: LEGACY_ID, state: 'initialized', ... });
  await expect(ProcessVoiceResponseHandler.handle(payload)).rejects.toMatchObject({
    code: 'INVALID_STATE',
    message: expect.stringContaining('legacy session source'),
  });
});
```

#### Green: Minimal Implementation
**Candidate file**:
- `frontend/src/server/request_handlers/ProcessVoiceResponseHandler.ts`

```ts
// On answer-session miss, probe legacy sessions and throw explicit mismatch reason.
```

#### Refactor: Improve Code
**Candidate file**:
- `frontend/src/server/request_handlers/ProcessVoiceResponseHandler.ts`

```ts
// Factor session source resolution into small helper for readability/testability.
```

### Success Criteria
**Automated:**
- [ ] Source-mismatch handler test added and passing.
- [ ] Route mapping tests still pass (status code + payload shape).
- [ ] `npm --prefix frontend run test -- src/server/request_handlers/__tests__/ProcessVoiceResponseHandler.test.ts src/app/api/session/voice-response/__tests__/route.test.ts`

**Manual:**
- [ ] Conflict payload message is actionable and distinguishes mismatch from true deletion/not-found.

---

## Behavior 4: End-to-End Regression for Writer Start to Recall Transcript Submit

### Test Specification
**Given** a session started from writer entry points  
**When** transcript submit path is exercised in Recall  
**Then** flow completes without 409 conflicts and transcript persistence callback chain executes.

**Edge Cases**:
- Rapid consecutive transcript events do not duplicate conflicting submits.
- Network retry behavior does not regress dedupe logic.

### TDD Cycle

#### Red: Write Failing Test
**File**: `frontend/src/__tests__/writer-recall-voice-response-compat.integration.test.ts` (new)

```ts
it('writer-started session id is accepted by submitVoiceResponse flow', async () => {
  // Arrange a writer-started session id
  // Submit transcript payload
  // Expect 200-compatible progression and no INVALID_STATE conflict
});
```

#### Green: Minimal Implementation
**Files**:
- Reuse Behavior 1 + 2 changes.

#### Refactor: Improve Code
**Files**:
- `frontend/src/test_helpers/sessionFactories.ts` (new helper if needed)

```ts
// Shared factory for answer-session-backed writer sessions in tests.
```

### Success Criteria
**Automated:**
- [ ] New compatibility integration test fails first, then passes.
- [ ] `npm --prefix frontend run test -- src/__tests__/writer-recall-voice-response-compat.integration.test.ts`
- [ ] Full related suite: `npm --prefix frontend run test`
- [ ] Static checks: `npm --prefix frontend run type-check && npm --prefix frontend run lint`

**Manual:**
- [ ] Reproduce prior scenario in browser; verify no repeated 409s for normal Recall flow.

## Integration Checklist
1. Migrate writer start identity allocation first (Behavior 1).
2. Add source-aware UI guardrails (Behavior 2).
3. Improve backend mismatch diagnostics (Behavior 3).
4. Lock regression with writer-start integration test (Behavior 4).

## References
- Bug issue: `silmari-writer-1ly`
- `frontend/src/app/api/session/start-default/route.ts:31`
- `frontend/src/app/api/session/start-from-upload/route.ts:287`
- `frontend/src/server/services/ChannelIngestionPipelineAdapter.ts:37`
- `frontend/src/server/request_handlers/GetSessionHandler.ts:9`
- `frontend/src/server/request_handlers/GetSessionHandler.ts:24`
- `frontend/src/server/request_handlers/ProcessVoiceResponseHandler.ts:60`
- `frontend/src/components/RecallScreen.tsx:469`
- `frontend/src/server/data_structures/SessionView.ts:3`
- `frontend/src/modules/session/stageMapper.ts:16`
- Existing orchestration plan alignment:
  - `thoughts/searchable/shared/plans/2026-03-03--07-51--tdd-voice-assisted-session-ui-ux-orchestration-340-345.md`
