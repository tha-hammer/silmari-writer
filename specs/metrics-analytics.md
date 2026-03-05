# KPI Strategy and Measurement Spec

**Domain:** Writer conversion optimization and trust restoration
**Status:** Active (v2)
**Last updated:** 2026-03-04
**Supersedes:** prior `metrics-analytics.md` KPI framing

## Source Inputs

This spec consolidates the current KPI planning documents:

1. https://docs.google.com/document/d/1AZin41YoVnZ6kOJOEanb-rHsj3J_oZ4lubaMidC0wqc/edit?usp=sharing
2. https://docs.google.com/document/d/1C-CD8lWFR0n383mii7K0vZUgkebP8xA8zJ6SozfKhug/edit?usp=sharing
3. https://docs.google.com/document/d/1InmpKbeMoZdbZ3j4gOgdufZVcIiyz0WYYbzTktRX2fc/edit?usp=sharing
4. https://docs.google.com/document/d/1ahC6iyxKmIIQm-HIPEJa5XyHDQVkrVUDI7quJ1-5aNo/edit?usp=sharing

## Product Thesis

AI-generated application content has increased polished output but reduced recruiter trust.
Writer is positioned as a signal extraction system, not a generic text generator.
The business wedge is application conversion optimization through structured, verifiable evidence.

## KPI Hierarchy

### Level 1 (North Star, lagging)

**Writer-assisted Application -> Interview Conversion Rate**

Formula:

```text
(writer_assisted_applications_with_interview_invite / writer_assisted_completed_applications) * 100
```

Where `writer_assisted_completed_applications` means applications completed with Writer-generated finalized output.

### Level 2 (leading indicators)

1. **Signal Density Score**
2. **Story Completion Rate**
3. **Truth Confirmation Rate**
4. **Time to First Usable Draft**

### Operational guardrail

- **Voice Session Drop-off Rate** (friction and abandonment early warning)

## Canonical KPI Definitions

| KPI | Canonical definition (business meaning) | Formula (semantic target) |
|---|---|---|
| Signal Density Score | Amount of concrete, specific, recruiter-relevant evidence per answer | Weighted evidence completeness minus vagueness penalty, normalized to a bounded score |
| Story Completion Rate | Share of sessions that satisfy required narrative slots before finalization | `sessions_with_required_slots_complete / eligible_sessions` |
| Truth Confirmation Rate | Share of key claims explicitly confirmed (voice or SMS) | `confirmed_key_claims / total_key_claims` |
| Time to First Usable Draft | Time from session creation to first acceptable draft output | `first_draft_timestamp - session_created_timestamp` |
| Voice Session Drop-off Rate | Share of sessions that exit before draft stage | `sessions_exited_before_draft / started_sessions` |

## Evidence Model for Signal Density

Signal density is driven by extraction of concrete artifacts:

- Quantified outcomes (percentages, absolute numbers, deltas)
- Named tools/technologies
- Clear actor and role references (who did what)
- Obstacle/challenge specificity
- Action sequence clarity (ordered steps)
- Artifact references (PRs, docs, tickets, launches)
- Job-alignment evidence

Low-signal anti-patterns to penalize:

- Vague verbs with no evidence ("helped", "worked on", "involved")
- Generic claims without scope, baseline, or result
- Unattributed or unverified impact claims

## KPI -> Product Mechanism Mapping

| KPI | Product mechanism | Why it moves the KPI |
|---|---|---|
| Signal Density | Structured interrogation loop | Forces concrete recall instead of one-pass generic text |
| Story Completion | Slot-based workflow/state gating | Prevents draft/finalize before required narrative structure exists |
| Truth Confirmation | Claim verification loop (voice + SMS) | Separates confirmed signal from unverified assertions |
| Time to First Usable Draft | Voice-first UX and guided progression | Reduces typing/blank-page friction |
| Conversion (North Star) | Recruiter-trusted, structured outputs | Increases shortlist confidence and interview likelihood |

## KPI -> Code Surfaces (Current Repo)

| Mechanism | Primary surfaces |
|---|---|
| Interrogation loop | `frontend/src/components/RecallScreen.tsx`, `frontend/src/app/api/session/voice-response/route.ts`, `frontend/src/app/api/voice-session/start/route.ts` |
| Slot completion and flow gating | `frontend/src/app/api/session/submit-slots/route.ts`, `frontend/src/modules/session/stageMapper.ts`, `frontend/src/modules/session/SessionWorkflowShell.tsx`, `frontend/src/verifiers/draftPreconditionsVerifier.ts` |
| Truth confirmation | `frontend/src/components/ConfirmMetricClaim.tsx`, `frontend/src/app/api/truth-checks/confirm/route.ts`, `frontend/src/app/api/verification/initiate/route.ts`, `frontend/src/app/api/sms/dispute/route.ts`, `frontend/src/app/api/sms/webhook/route.ts` |
| Draft/finalize progression | `frontend/src/app/api/draft/generate/route.ts`, `frontend/src/app/api/review/approve/route.ts`, `frontend/src/app/api/sessions/[id]/finalize/route.ts` |
| Leading KPI event recording | `frontend/src/app/api/onboarding/complete/route.ts`, `frontend/src/server/processors/OnboardingCompletionProcessor.ts`, `frontend/src/shared/constants/LeadingKpis.ts` |
| Primary KPI event recording | `frontend/src/app/api/kpi/primary/route.ts`, `frontend/src/server/services/PrimaryKpiService.ts`, `frontend/src/server/verifiers/PrimaryKpiVerifier.ts` |
| Session metrics pipeline | `frontend/src/server/process_chains/StoreSessionMetricsProcessChain.ts`, `frontend/src/server/data_access_objects/SessionMetricsDAO.ts` |

## Measurement and Instrumentation Contract

### Persistence surfaces

- `session_metrics` stores per-session computed metric values.
- `analytics_events` stores leading KPI analytics events.
- `primary_kpi_events` stores primary KPI action events.

### Current computed proxies in path 301

The current implementation computes these proxies in `StoreSessionMetricsProcessChain`:

- `timeToFirstDraft = firstDraftAt - createdAt`
- `completionRate = finalizeEvents / totalEvents`
- `confirmationRate = verifyEvents / (draftEvents + verifyEvents + finalizeEvents)`
- `signalDensity = signalEvents / (editEvents + revisionEvents)`
- `dropOff = 1 - completionRate`

These are valid operational proxies today and should remain backward-compatible until a richer semantic scorer is introduced.

## KPI Planning Gate (Required Before Implementation)

Every new feature plan must include complete answers for all four KPI dimensions.
A plan is not implementation-ready if any field is missing or vague.

```md
### Signal Density
- Artifacts captured:
- Low-signal pattern prevented/detected:
- Baseline -> target impact:
- Measurement source:

### Story Completion
- Required slots/states:
- Completion rule:
- Incomplete behavior:
- Baseline -> target impact:
- Measurement source:

### Truth Confirmation
- Claims requiring confirmation:
- Verified vs unverified representation:
- Confirmation mechanism:
- Baseline -> target impact:
- Measurement source:

### Conversion
- Recruiter-facing output change:
- Why shortlist/interview likelihood improves:
- Baseline -> target impact:
- Measurement source:
```

## Change Risk Taxonomy (For Formal Modeling)

A behavior change is **risky** when a defect could meaningfully distort trust, conversion, or KPI measurement semantics.

High-risk categories:

1. Session/workflow state transitions (e.g., RECALL -> VERIFY -> DRAFT -> FINALIZE)
2. Auth and identity derivation/scoping
3. Error-code/status propagation across adapters/routes
4. Retry, timeout, idempotency, and duplicate suppression logic
5. Claim confirmation state transitions (confirmed/unverified/disputed)
6. KPI event mapping, persistence, and telemetry contracts

If a change touches one or more high-risk categories, extract/verify a formal model before implementation:

```text
/extract_tlaplus_model -> silmari run-tlc --json -> create_tdd_plan
```

## Success Criteria for This KPI Framework

1. Every feature spec can trace to the north star through one or more leading KPIs.
2. KPI names/definitions remain stable across product, analytics, and code.
3. Changes in high-risk behavior surfaces are formally modeled before rollout.
4. Metrics are decision-usable (not vanity), with explicit baseline and target deltas.

## Non-Goals

- Optimizing for generic writing quality independent of conversion/trust.
- Shipping features without KPI traceability.
- Treating unverified claims as equivalent to confirmed claims.
