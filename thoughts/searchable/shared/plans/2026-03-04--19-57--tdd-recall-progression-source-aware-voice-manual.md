# Recall Progression Source + Voice/Manual Unification TDD Plan

## Overview
This plan implements a test-first fix for seven linked issues:
- `silmari-writer-5ef`
- `silmari-writer-dkk`
- `silmari-writer-awa`
- `silmari-writer-e5n`
- `silmari-writer-gu1`
- `silmari-writer-eov`
- `silmari-writer-1lq`

Goal: make recall progression fully operational across both session sources while keeping manual progression active and reliable.

## Current State Analysis

### Key Discoveries
- Recall progress loader fetches only `sessionId` today, not `sessionSource`:
  - `frontend/src/data_loaders/RecallProgressLoader.ts:46`
- Recall screen refresh calls the loader with only `sessionId`:
  - `frontend/src/components/RecallScreen.tsx:215`
- `/api/recall/progress` currently resolves records with voice-only alias:
  - `frontend/src/app/api/recall/progress/route.ts:70`
  - `frontend/src/server/data_access_objects/SessionDAO.ts:477`
- DAO already has source-specific lookup helpers we can use directly:
  - `frontend/src/server/data_access_objects/SessionDAO.ts:434`
  - `frontend/src/server/data_access_objects/SessionDAO.ts:454`
- Slot metrics are floored with `Math.max(1, ...)`, masking real missing slots:
  - `frontend/src/app/api/recall/progress/route.ts:44`
  - `frontend/src/app/api/recall/progress/route.ts:45`
  - `frontend/src/app/api/recall/progress/route.ts:46`
- Move-on intent is detected but currently only opens stop controls; it does not advance:
  - `frontend/src/components/RecallScreen.tsx:104`
  - `frontend/src/components/RecallScreen.tsx:472`
  - `frontend/src/components/RecallScreen.tsx:483`
- Manual progression works through stop controls and calls `handleNextQuestion`:
  - `frontend/src/components/RecallScreen.tsx:284`
  - `frontend/src/components/RecallScreen.tsx:703`
- Session voice-turns route is already source-aware and can be reused for consistent advancement:
  - `frontend/src/app/api/session/voice-turns/route.ts:61`
  - `frontend/src/app/api/session/voice-turns/route.ts:162`

### Existing Test Baseline
- Recall progress route tests currently cover invalid id + neutral + happy path only:
  - `frontend/src/app/api/recall/progress/__tests__/route.test.ts:19`
- Recall screen voice tests currently assert move-on is control intent (no advance contract yet):
  - `frontend/src/components/__tests__/RecallScreen.voice.test.tsx:333`
- Session voice-turns tests already validate source-aware progression endpoint behavior:
  - `frontend/src/app/api/session/voice-turns/__tests__/route.test.ts:262`

## Desired End State

### Observable Behaviors
1. Given `sessionSource='answer_session'`, when recall progress loads, then it reads `voice_session_id` records.
2. Given `sessionSource='session'`, when recall progress loads, then it reads `session_id` records.
3. Given non-empty corpus missing one dimension, when progress is computed, then that dimension can remain `0` and appears in `incompleteSlots`.
4. Given transcript says "next question" or "move on", when slots are complete, then question progression advances.
5. Given transcript says move-on while slots are incomplete, when guard runs, then question does not advance and guidance remains visible.
6. Given user clicks manual `Next question` or `Finish to Review`, when progression runs, then behavior remains unchanged and reliable.
7. Given either manual or voice-triggered advancement, when progression executes, then a single shared advancement primitive is used.

## What We Are Not Doing
- No schema migration or historical backfill of old story records.
- No redesign of coach prompt language beyond behavior-correct messaging.
- No workflow merge between `session` and `answer_session` models.

## Testing Strategy
- **Framework**: Vitest + React Testing Library (same as current suite)
- **Test layers**:
  - Unit/route: `/api/recall/progress`
  - Component behavior: `RecallScreen` voice/manual controls
  - Contract tests: loader + session voice-turns request/response usage
  - Verification sweep: targeted end-to-end pipeline checks
- **Execution order**:
  1. Source-aware progress contract
  2. Slot math correctness
  3. Voice move-on progression guard
  4. Manual-path regression guard
  5. Shared advancement path
  6. Expanded regression suite
  7. Verification checklist

## Implementation Contracts (Locked Before Coding)
- `sessionSource` contract is **strict** for `/api/recall/progress`: missing or invalid `sessionSource` returns `400`; no silent default.
- Source typing is shared across component, loader, and route using `SessionVoiceTurnsSource` / `SessionVoiceTurnsSourceSchema` from `frontend/src/api_contracts/sessionVoiceTurns.ts`.
- Voice move-on auto-advance lifecycle is **disconnect-before-advance**: when a move-on intent is allowed, disconnect realtime session first, then run shared advancement flow.
- Move-on idempotency uses two guards:
  - control-intent dedupe key is recorded before advance attempt;
  - a single `advanceInFlight` guard blocks concurrent advancement attempts.
- Move-on guard timing is deterministic: evaluate advancement eligibility from the latest persisted/loaded progress snapshot (not stale pre-refresh state). If persistence refresh is in flight, delay move-on evaluation until refresh resolves.
- Telemetry contract includes explicit outcomes:
  - `recall_move_on_advanced` with source + question transition metadata;
  - `recall_move_on_blocked` with source + blocking reason (`incomplete_slots` or `advance_in_flight`).

---

## Behavior 1 (Issue `silmari-writer-5ef`): Source-Aware Recall Progress Loading

### Test Specification
**Given** a valid `sessionId` and `sessionSource='answer_session'`  
**When** GET `/api/recall/progress` is called  
**Then** route reads via `findStoryRecordByVoiceSessionId`.

**Given** a valid `sessionId` and `sessionSource='session'`  
**When** GET `/api/recall/progress` is called  
**Then** route reads via `findStoryRecordByPrepSessionId`.

**Given** RecallScreen mounts with session data  
**When** it refreshes progress  
**Then** it passes both `sessionId` and `sessionSource` through loader and query string.

### Edge Cases
- Missing/invalid `sessionSource` returns `400` from route.
- No backward-compat defaulting: callers must always pass explicit `sessionSource`.

### TDD Cycle

#### Red: Write Failing Tests
**Files**:
- `frontend/src/app/api/recall/progress/__tests__/route.test.ts`
- `frontend/src/data_loaders/__tests__/RecallProgressLoader.step4.test.ts`
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`
- `frontend/src/modules/__tests__/RecallModule.integration.test.tsx`

```ts
it('routes progress lookup to prep session store when sessionSource=session', async () => {
  // assert DAO prep lookup called, voice lookup not called
});

it('appends sessionSource to recall progress loader request', async () => {
  // assert fetch('/api/recall/progress?...&sessionSource=session')
});

it('returns 400 when sessionSource is missing', async () => {
  // strict contract: no implicit default
});
```

#### Green: Minimal Implementation
**Files**:
- `frontend/src/data_loaders/RecallProgressLoader.ts`
- `frontend/src/components/RecallScreen.tsx`
- `frontend/src/app/api/recall/progress/route.ts`

```ts
// loadRecallProgress(sessionId, sessionSource: SessionVoiceTurnsSource)
// GET route validates sessionSource via shared schema and resolves DAO by source
// strict path: missing sessionSource => 400
```

#### Refactor: Improve Code
**Files**:
- `frontend/src/app/api/recall/progress/route.ts`
- `frontend/src/data_loaders/RecallProgressLoader.ts`

```ts
// extract resolveStoryRecordBySource(sessionId, sessionSource)
// keep route and loader contracts explicit and typed
// reuse SessionVoiceTurnsSourceSchema to avoid source-string drift
```

### Success Criteria
**Automated**
- [x] New source-specific route tests fail before implementation, pass after.
- [x] Loader tests assert query includes `sessionSource`.
- [x] RecallScreen test confirms source-aware progress call path.
- [x] Missing `sessionSource` now deterministically returns `400` (strict contract).
- [x] `npm --prefix frontend exec vitest -- src/app/api/recall/progress/__tests__/route.test.ts src/data_loaders/__tests__/RecallProgressLoader.step4.test.ts src/components/__tests__/RecallScreen.voice.test.tsx src/modules/__tests__/RecallModule.integration.test.tsx`

**Manual**
- [ ] In both source modes, A/A/O panel updates from persisted content after refresh.

---

## Behavior 2 (Issue `silmari-writer-dkk`): Preserve True Missing Slots in Progress Math

### Test Specification
**Given** non-empty corpus containing only anchor/context language  
**When** progress is computed  
**Then** `actions=0`, `outcomes=0`, and both appear in `incompleteSlots`.

**Given** empty corpus  
**When** progress is computed  
**Then** all counts are `0` and all slots are incomplete.

### Edge Cases
- Mixed corpus with only outcomes still leaves anchors/actions incomplete.
- No regression on existing positive multi-signal text.

### TDD Cycle

#### Red: Write Failing Tests
**File**:
- `frontend/src/app/api/recall/progress/__tests__/route.test.ts`

```ts
it('keeps zero counts for missing dimensions in non-empty corpus', async () => {
  // content contains only anchors
  // expect actions/outcomes to be 0 and in incompleteSlots
});
```

#### Green: Minimal Implementation
**File**:
- `frontend/src/app/api/recall/progress/route.ts`

```ts
// remove Math.max(1, ...)
// derive incompleteSlots directly from zero counts
```

#### Refactor: Improve Code
**File**:
- `frontend/src/app/api/recall/progress/route.ts`

```ts
// keep computeRecallProgress small and deterministic
```

### Success Criteria
**Automated**
- [x] Non-empty partial-content cases now produce true zero values.
- [x] Empty corpus behavior remains unchanged.
- [x] `npm --prefix frontend exec vitest -- src/app/api/recall/progress/__tests__/route.test.ts`

**Manual**
- [ ] Progress hint shows exactly which slots are missing during partial answers.

---

## Behavior 3 (Issue `silmari-writer-awa`): Wire Move-On Voice Intents to Guarded Advancement

### Test Specification
**Given** transcript contains move-on intent and all required slots are complete  
**When** final transcript event is processed  
**Then** progression advances to next question via advancement flow.

**Given** transcript contains move-on intent and required slots are incomplete  
**When** event is processed  
**Then** progression is blocked and guidance remains on current question.

**Given** answer transcript persistence/refresh is still in flight and user says move-on  
**When** guard evaluation runs  
**Then** advancement decision waits for latest loaded progress snapshot before allowing/blocking progression.

### Edge Cases
- Duplicate dedupe key cannot trigger double-advance.
- Rapid distinct move-on transcripts during one advancement are ignored while `advanceInFlight=true`.
- Control-intent transcript is not persisted as answer content.

### TDD Cycle

#### Red: Write Failing Tests
**File**:
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`

```tsx
it('advances on move-on voice intent when guards pass', async () => {
  // set progress incompleteSlots=[]
  // emit move-on transcript
  // expect disconnect called before progression
  // expect advanceSessionQuestion called and question increments
});

it('does not advance on move-on when slots are missing', async () => {
  // set incompleteSlots=['actions']
  // emit move-on transcript
  // expect stop controls and no advancement
});

it('does not double-advance on repeated move-on dedupe key', async () => {
  // emit same move-on event twice; expect one progression
});

it('defers move-on guard until latest progress refresh resolves', async () => {
  // simulate in-flight save/refresh then move-on; assert decision uses refreshed incompleteSlots
});
```

#### Green: Minimal Implementation
**File**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// in move-on branch:
// record dedupe key before branch
// if advanceInFlight => emit blocked telemetry and return
// if shouldAdvanceFromMoveOnIntent(latestLoadedProgress) => disconnect then invoke shared advance action
// else presentStopState('move_on_intent') + emit blocked telemetry
```

#### Refactor: Improve Code
**File**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// isolate shouldAdvanceFromMoveOnIntent() for readability and testability
// isolate evaluateMoveOnAfterProgressRefresh() to enforce deterministic guard timing
```

### Success Criteria
**Automated**
- [x] Move-on intent tests cover both allowed and blocked paths.
- [x] No duplicate advancement on repeated or rapid concurrent control-intent events.
- [x] Allowed auto-advance disconnects realtime session before question progression executes.
- [x] `npm --prefix frontend exec vitest -- src/components/__tests__/RecallScreen.voice.test.tsx`

**Manual**
- [ ] Saying "next question" advances only when answer has enough detail.

---

## Behavior 4 (Issue `silmari-writer-e5n`): Protect Manual Progression Path

### Test Specification
**Given** stop controls are shown  
**When** user clicks `Next question`  
**Then** progression advances exactly once.

**Given** user is on terminal question  
**When** user clicks `Finish to Review`  
**Then** review transition callback fires.

### Edge Cases
- Manual buttons remain usable even if voice intent detection fails or is disabled.
- Manual path remains available while stop controls are visible.

### TDD Cycle

#### Red: Write Failing Tests (if any regression appears)
**File**:
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`

```tsx
it('manual next remains functional independent of voice intent path', async () => {
  // click stop controls, then next question
  // expect question index to change
});
```

#### Green: Minimal Implementation
**File**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// preserve button handlers and terminal review behavior while adding voice auto-advance
```

#### Refactor: Improve Code
**File**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// avoid introducing any voice-state-only gate around manual button path
```

### Success Criteria
**Automated**
- [x] Existing manual progression test stays green.
- [x] Additional explicit manual regression guard (if added) passes.
- [x] `npm --prefix frontend exec vitest -- src/components/__tests__/RecallScreen.voice.test.tsx`

**Manual**
- [ ] Clicking manual controls always works, including final transition.

---

## Behavior 5 (Issue `silmari-writer-gu1`): Unify Voice + Manual Advancement Through One Path

### Test Specification
**Given** advancement is triggered by button click or move-on voice intent  
**When** progression executes  
**Then** both entry points invoke the same advancement primitive and produce identical state transitions.

### Edge Cases
- Server advance error keeps UI recoverable (local optimistic progress retained or gracefully reconciled).
- No drift between local `questionProgress` and server-returned `questionProgress`.
- Auto-advance path emits `recall_move_on_advanced`; blocked path emits `recall_move_on_blocked` with reason.

### TDD Cycle

#### Red: Write Failing Tests
**File**:
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`

```tsx
it('voice and manual progression converge on same state transition path', async () => {
  // exercise both triggers and assert resulting questionProgress shape parity
});
```

#### Green: Minimal Implementation
**File**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// extract advanceQuestionFlow() and call from:
// - manual Next/Finish button
// - allowed move-on voice intent branch
// - ensure move-on branch uses disconnect-before-advance lifecycle
```

#### Refactor: Improve Code
**File**:
- `frontend/src/components/RecallScreen.tsx`

```tsx
// centralize telemetry and error handling in the shared advancement helper
// emit explicit outcome telemetry for advanced vs blocked move-on branches
```

### Success Criteria
**Automated**
- [x] New shared-path tests pass.
- [x] Existing progression tests remain stable.
- [x] Telemetry assertions validate advanced vs blocked move-on outcomes.
- [x] `npm --prefix frontend exec vitest -- src/components/__tests__/RecallScreen.voice.test.tsx src/app/api/session/voice-turns/__tests__/route.test.ts`

**Manual**
- [ ] Question index and active question stay consistent after both trigger types.

---

## Behavior 6 (Issue `silmari-writer-eov`): Expand Regression Coverage for Source-Aware Progression

### Test Specification
**Given** both session sources and both progression trigger types  
**When** tests run  
**Then** regressions in source lookup, slot math, move-on guard, and manual path are detected deterministically.

### TDD Cycle

#### Red: Add Missing Regression Tests
**Files**:
- `frontend/src/app/api/recall/progress/__tests__/route.test.ts`
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`
- `frontend/src/data_loaders/__tests__/RecallProgressLoader.step4.test.ts`
- `frontend/src/api_contracts/__tests__/sessionVoiceTurns.test.ts` (if contract adjustments are needed)
- `frontend/src/modules/__tests__/RecallModule.integration.test.tsx`

#### Green: Implement Minimal Code for Passing Behavior
- Use Behaviors 1-5 implementation.

#### Refactor: Improve Test Determinism
- Keep event timing assertions deterministic with explicit `waitFor` around transition effects.
- Add explicit race regression: “answer transcript” followed immediately by “move on” resolves against refreshed progress snapshot, not stale state.

### Success Criteria
**Automated**
- [x] New tests fail on pre-fix behavior and pass after fixes.
- [x] Coverage includes both `answer_session` and `session` flows.
- [x] Coverage includes race-condition and telemetry outcome assertions for move-on control intent.
- [x] `npm --prefix frontend exec vitest -- src/app/api/recall/progress/__tests__/route.test.ts src/components/__tests__/RecallScreen.voice.test.tsx src/data_loaders/__tests__/RecallProgressLoader.step4.test.ts src/modules/__tests__/RecallModule.integration.test.tsx`

**Manual**
- [ ] No contradictory UI states between coach prompt, stop controls, and A/A/O hint.

---

## Behavior 7 (Issue `silmari-writer-1lq`): Targeted Verification Pipeline

### Verification Specification
**Given** implementation from Behaviors 1-6 is complete  
**When** targeted verification executes  
**Then** recall pipeline is proven operational for both source modes and both progression modes.

### Automated Verification Command Set
1. `npm --prefix frontend exec vitest -- src/app/api/recall/progress/__tests__/route.test.ts`
2. `npm --prefix frontend exec vitest -- src/data_loaders/__tests__/RecallProgressLoader.step4.test.ts`
3. `npm --prefix frontend exec vitest -- src/components/__tests__/RecallScreen.voice.test.tsx`
4. `npm --prefix frontend exec vitest -- src/app/api/session/voice-turns/__tests__/route.test.ts`
5. `npm --prefix frontend exec vitest -- src/api_contracts/__tests__/sessionVoiceTurns.test.ts`
6. `npm --prefix frontend exec vitest -- src/modules/__tests__/RecallModule.integration.test.tsx`
7. `npm --prefix frontend run type-check`
8. `npm --prefix frontend run lint`

### Manual Smoke Checklist
- [ ] `answer_session`: speak answer, A/A/O updates, say "next question", manual Next still works, final transition reaches Review.
- [ ] `session`: speak answer, A/A/O updates from correct source record, say "move on" behaves per guard, manual Next still works.
- [ ] Repeated move-on utterance does not double-advance.
- [ ] Auto-advance does not leave stale question context in coach behavior (disconnect-before-advance lifecycle validated).
- [ ] No unexpected 409/500 in normal progression path.

### Exit Criteria
- All targeted automated checks pass.
- Manual checklist completed in both sources.
- Any residual defect gets a new beads issue linked with `discovered-from:silmari-writer-c3a`.

## Planned File Touch Map
- `frontend/src/components/RecallScreen.tsx`
- `frontend/src/data_loaders/RecallProgressLoader.ts`
- `frontend/src/app/api/recall/progress/route.ts`
- `frontend/src/server/data_access_objects/SessionDAO.ts` (read helper usage and optional extraction)
- `frontend/src/api_contracts/sessionVoiceTurns.ts` (shared source type/schema reuse; no behavior change expected)
- `frontend/src/app/api/recall/progress/__tests__/route.test.ts`
- `frontend/src/components/__tests__/RecallScreen.voice.test.tsx`
- `frontend/src/data_loaders/__tests__/RecallProgressLoader.step4.test.ts`
- `frontend/src/modules/__tests__/RecallModule.integration.test.tsx`
- `frontend/src/app/api/session/voice-turns/__tests__/route.test.ts` (regression guard)

## References
- Research: `thoughts/searchable/shared/research/2026-03-04-voice-loop-wiring-question-progression.md`
- Prior plan: `thoughts/searchable/shared/plans/2026-03-04--16-34--tdd-fix-voice-workflow-session-boundary-guards.md`
- Related issue umbrella: `silmari-writer-c3a`
