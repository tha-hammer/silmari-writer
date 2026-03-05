# PATH: voice-advance-regression-model

**Layer:** 3 (Function Path)
**Priority:** P1
**Version:** 1
**Source:** Extracted from HAR trace (session 7d14f077, 2026-03-05) + code analysis — RecallScreen.tsx, voice-turns/route.ts, SessionDAO.ts, voice-session.ts

## Purpose

Behavioral model of two compounding bugs observed in HAR trace when a user advances questions while the voice session remains connected:

1. **Backend Record Divergence** — `advance_question` and `update_working_answer` (session source) resolve different story records via different DAO paths, causing `currentIndex` regression in API responses
2. **LLM Silence After session.update** — After `advanceQuestionFlow` sends `session.update` with new instructions, the LLM does not auto-speak the new question greeting, creating a silence gap

## Trigger

User says "next question" during voice session → taps "Next question" button → system advances UI and backend → LLM goes silent → user speaks to break silence → backend returns regressed `currentIndex` → correction exchange follows.

## HAR Evidence (session 7d14f077-84b7-47d3-97f5-c24ba8db317e)

| Time | Entry | Action | currentIndex | Evidence |
|------|-------|--------|-------------|----------|
| 14:49:57 | 16 | voice/session POST (connect) | 0 | LLM gets Q1 instructions |
| 14:50:04 | 17 | update_working_answer | 0 | "Unicorn Project" transcript |
| 14:50:20 | 23 | advance_question | **1** | Backend advances to Q2 |
| 14:51:41 | 24 | update_working_answer | **0** | "Okay." — **REGRESSION** |
| 14:52:03 | 28 | update_working_answer | 0 | "I see a different question" |
| 14:52:17 | 32 | update_working_answer | 0 | LLM reads Q2 text (correction) |

**81-second gap** between advance (entry 23) and next user speech (entry 24) confirms LLM silence.

## Steps

1. **VoiceConnect** (entry 16)
   - Input: User clicks Record
   - Process: `connect(VOICE_EDIT, { instructions: buildRecallInstructions(...) })`
   - Output: connected=TRUE, llmIndex=0, llmSpeaking=TRUE (auto-greeting)

2. **UserSpeaks** (entry 17)
   - Input: Transcript event ("Unicorn Project")
   - Process: `persistTranscriptBySource` → `updateSessionWorkingAnswer` → `upsertPrepStoryRecordWorkingAnswer`
   - Output: Working answer persisted, backend returns currentIndex=0

3. **DetectMoveOn** (between entries 17-23)
   - Input: User says "next question"
   - Process: `detectMoveOnIntent(transcript)` matches
   - Output: stopControlsVisible=TRUE, voice stays connected

4. **AdvanceWhileConnected** (entry 23)
   - Input: User taps "Next question" button
   - Process: `advanceQuestionFlow()` → local advance + `advanceSessionQuestion()` + `syncActiveQuestionInstructions()`
   - Output: uiIndex=1, advIndex=1, llmIndex=1
   - **BUG 1**: `upsertIndex` stays at 0 (different record)
   - **BUG 2**: llmSpeaking=FALSE (no auto-speak after session.update)

5. **LLM Silence Gap** (14:50:20 → 14:51:41)
   - Input: None (user waits for LLM to speak)
   - Process: LLM receives session.update but doesn't auto-respond
   - Output: 81 seconds of silence until user says "ok"

6. **UserBreaksSilence** (entry 24)
   - Input: User says "ok"
   - Process: Transcript persisted via upsert path → reads different record
   - Output: Backend returns currentIndex=0 (**REGRESSION**)

7. **Correction Exchange** (entries 28, 32)
   - Input: User says "I see a different question in my UI"
   - Process: LLM realizes mismatch, reads correct Q2 text
   - Output: LLM and UI realign, but backend still reports currentIndex=0

## Terminal Condition

FinishToReview — user completes all questions. Disconnects voice, navigates to review.

## Feedback Loops

**Regression feedback loop (BUG 1):**
advance_question writes to record A → update_working_answer reads from record B (stale) → all subsequent API responses show regressed index → any refetch/reload adopts stale index

**Silence feedback loop (BUG 2):**
session.update sent → LLM receives new instructions but doesn't speak → user confused by silence → user prompts LLM → LLM responds to user instead of greeting new question

## Extracted Invariants

| ID | Invariant | Source | TLA+ Property | Test Oracle |
|----|-----------|--------|---------------|-------------|
| INV-1 | Connected implies LLM has valid question | voice-session.ts:229 | ErrorConsistency | `expect(llmIndex).toBeGreaterThanOrEqual(0)` when connected |
| INV-2 | Backend advance and upsert paths agree on currentIndex | voice-turns/route.ts:158,145 | BackendConsistency | `expect(advanceResponse.currentIndex).toBe(upsertResponse.currentIndex)` |
| INV-3 | LLM auto-speaks after mid-session advance | RecallScreen.tsx:359 | NoLLMSilenceAfterAdvance | After session.update, LLM produces audio within 3s |
| INV-4 | UI and LLM agree while listening | RecallScreen.tsx:318-329 | NoSilentDesync | `expect(uiIndex).toBe(llmIndex)` when connected |
| INV-5 | UI never behind backend advance path | RecallScreen.tsx:333 | UINotBehindAdvance | `expect(uiIndex).toBeGreaterThanOrEqual(advIndex)` |
| INV-6 | Backend paths eventually sync | voice-turns/route.ts | BackendEventualSync | After advance, both paths report same index |
| INV-7 | LLM eventually responds or disconnects | — | LLMEventualResponse | After advance, LLM speaks or session closes |
| INV-8 | UI index never decreases | recallQuestions.ts:81 | MonotonicProgress | `expect(newIndex).toBeGreaterThanOrEqual(oldIndex)` |

## Root Cause Analysis

### BUG 1: Backend Record Divergence

**advance_question** path (voice-turns/route.ts:158-186):
```
resolveStoryRecordBySource(sessionId, 'session')
  → SessionDAO.findStoryRecordByCanonicalSessionId(sessionId, 'session')
  → updates question_progress on THAT record
```

**update_working_answer** path (voice-turns/route.ts:145-156):
```
body.sessionSource === 'session'
  → SessionDAO.upsertPrepStoryRecordWorkingAnswer(body.sessionId, body.content)
  → resolves via prep session lookup (DIFFERENT resolution path)
  → returns question_progress from THAT record (may differ)
```

The two DAO methods use different record resolution strategies. `findStoryRecordByCanonicalSessionId` resolves through the canonical session→story_record join, while `upsertPrepStoryRecordWorkingAnswer` resolves through the prep_session→story_record join. When these join paths hit different records, the advance is invisible to the upsert path.

### BUG 2: LLM Silence After session.update

`syncActiveQuestionInstructions` (RecallScreen.tsx:318-329) sends:
```json
{ "type": "session.update", "session": { "instructions": "..." } }
```

The OpenAI Realtime API accepts the session.update but doesn't auto-generate a response. The LLM waits for user speech (VAD trigger) before responding. A `response.create` event would need to be sent after the session.update to prompt the LLM to speak the new question greeting.

### BUG 3: LLM Improvises Questions Instead of Reading Active Question

`buildRecallInstructions` (RecallScreen.tsx:62-89) embeds the active question as context:
```
Active question:
[question text from recallQuestions.ts]
```

The prompt treated this as contextual information rather than a directive. The LLM would naturally read the first question as part of its greeting, but after `session.update` with a new question, it would improvise its own questions using the "conversational interviewing" guidance instead of reading the exact question text from `DEFAULT_RECALL_QUESTIONS`.

**Symptom:** First question matches `recallQuestions.ts`, subsequent questions do not.
**Root cause (layer 1):** Prompt lacked explicit instruction to read the active question verbatim.
**Root cause (layer 2):** OpenAI Realtime API conversation history bleeds through `session.update`. Even with a verbatim prompt directive, the LLM weighs accumulated conversation turns over the new system message and improvises questions from context. The fix requires passing `instructions` directly in `response.create` as a per-inference override.

## Change Impact Analysis

**Fix 1 (FIX_RECORD):** Guard against backend questionProgress regression
- `advanceQuestionFlow` only adopts backend `questionProgress` when `currentIndex >= locallyAdvanced.currentIndex`
- Prevents silent DB write failure (`isMissingQuestionProgressColumnError` fallback) from regressing UI
- **Status: APPLIED** (commit `9581775`)

**Fix 2 (FIX_REPROMPT):** Send response.create with per-inference instructions override
- After `syncActiveQuestionInstructions`, send `{ type: "response.create", response: { instructions } }` via data channel
- The `instructions` field in `response.create` overrides session-level instructions for that specific inference, bypassing conversation history bleed-through
- This both triggers the LLM to speak and forces it to use the updated question
- **Status: APPLIED** (commits `d58b85e`, `51ffe29`)

**Fix 3 (FIX_PROMPT):** Force LLM to read active question verbatim
- Added `CRITICAL` instruction requiring word-for-word reading of the Active question
- Restructured prompt flow: greet → read question verbatim → use follow-ups to probe deeper
- **Status: APPLIED** (commit `da500e0`)

**Affected steps:** Steps 4 (AdvanceWhileConnected), 5 (LLM Silence), 6 (UserBreaksSilence), 7 (Correction Exchange)
**Affected invariants:** INV-2, INV-3, INV-6 — all now addressed by applied fixes
**Risk:** Fix 1 depends on `question_progress` column migration being applied to deployed Supabase. Fix 3 depends on LLM compliance with prompt instructions (non-deterministic).
**Recommendation:** Apply Supabase migration `20260303175356_new-migration.sql` to eliminate the silent write failure root cause.

## TLC Verification Results

**Buggy model (FIX_RECORD=FALSE, FIX_REPROMPT=FALSE):**
- BackendConsistency: **VIOLATED** — counterexample in 4 states
- NoLLMSilenceAfterAdvance: **VIOLATED** (tested separately)
- 11 states generated, 9 distinct

**Fixed model (FIX_RECORD=TRUE, FIX_REPROMPT=TRUE):**
- All 10 properties: **PASSED**
- 219 states generated, 90 distinct, complete state space explored

**Counterexample (BackendConsistency):**
```
State 1: idle, advIndex=0, upsertIndex=0
State 2: VoiceConnect → listening, connected=TRUE
State 3: DetectMoveOn → stop_presented
State 4: AdvanceWhileConnected → advIndex=1, upsertIndex=0 ← DIVERGENCE
```

**Counterexample (NoLLMSilenceAfterAdvance, FIX_RECORD=TRUE, FIX_REPROMPT=FALSE):**
```
State 4: AdvanceWhileConnected → llmSpeaking=FALSE, uiIndex=1 ← SILENCE
```
