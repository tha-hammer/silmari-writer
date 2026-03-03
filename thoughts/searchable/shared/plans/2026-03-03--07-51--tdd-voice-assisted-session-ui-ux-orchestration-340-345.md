# Voice-Assisted Session UI/UX (Paths 340-345) TDD Implementation Plan

## Overview
This plan extends the existing `/writer` orchestration implementation (paths `293-339`) with the newly linked UX paths `340-345` from [`specs/voice-assisted-session-ui-ux.md`](../../../../../specs/voice-assisted-session-ui-ux.md) and [`specs/orchestration/session-1772314225364`](../../../../../specs/orchestration/session-1772314225364).

TDD principle for all slices:
1. Write a failing test for one observable behavior.
2. Add minimal implementation to pass.
3. Refactor while keeping the suite green.

## Current State Analysis
The codebase already has strong path-based test coverage for `293-339`, but no implementation markers for `340-345`.

### Key Discoveries
- UX spec explicitly maps the resolved gaps to `340-345` in [`specs/voice-assisted-session-ui-ux.md:305`](../../../../../specs/voice-assisted-session-ui-ux.md:305), [`specs/voice-assisted-session-ui-ux.md:331`](../../../../../specs/voice-assisted-session-ui-ux.md:331), [`specs/voice-assisted-session-ui-ux.md:334`](../../../../../specs/voice-assisted-session-ui-ux.md:334), [`specs/voice-assisted-session-ui-ux.md:338`](../../../../../specs/voice-assisted-session-ui-ux.md:338), [`specs/voice-assisted-session-ui-ux.md:342`](../../../../../specs/voice-assisted-session-ui-ux.md:342), [`specs/voice-assisted-session-ui-ux.md:347`](../../../../../specs/voice-assisted-session-ui-ux.md:347).
- Session stage rendering is direct and does not include interstitial lifecycle hooks in [`frontend/src/modules/session/SessionWorkflowShell.tsx:116`](../../../../../frontend/src/modules/session/SessionWorkflowShell.tsx:116).
- Stage mapping currently covers `INIT/ORIENT/.../FINALIZED` only in [`frontend/src/modules/session/stageMapper.ts:14`](../../../../../frontend/src/modules/session/stageMapper.ts:14).
- Copy UX is currently finalized-answer specific in [`frontend/src/modules/finalizedAnswer/FinalizedAnswerModule.tsx:121`](../../../../../frontend/src/modules/finalizedAnswer/FinalizedAnswerModule.tsx:121).
- Onboarding and KPI service/testing patterns already exist and should be reused:
  - [`frontend/src/server/services/OnboardingService.ts:18`](../../../../../frontend/src/server/services/OnboardingService.ts:18)
  - [`frontend/src/server/services/PrimaryKpiService.ts:31`](../../../../../frontend/src/server/services/PrimaryKpiService.ts:31)
  - [`frontend/src/server/processors/__tests__/OnboardingCompletionProcessor.step3.test.ts:78`](../../../../../frontend/src/server/processors/__tests__/OnboardingCompletionProcessor.step3.test.ts:78)
  - [`frontend/src/server/services/__tests__/PrimaryKpiAnalytics.test.ts:98`](../../../../../frontend/src/server/services/__tests__/PrimaryKpiAnalytics.test.ts:98)
- Orchestration path specs define concrete invariants for each missing flow:
  - Path 340: channel ingestion invariants in [`specs/orchestration/session-1772314225364/340-ingest-url-via-email-or-sms-channel.md:72`](../../../../../specs/orchestration/session-1772314225364/340-ingest-url-via-email-or-sms-channel.md:72)
  - Path 341: universal copy invariants in [`specs/orchestration/session-1772314225364/341-copy-artifact-to-clipboard.md:55`](../../../../../specs/orchestration/session-1772314225364/341-copy-artifact-to-clipboard.md:55)
  - Path 342: LinkedIn onboarding invariants in [`specs/orchestration/session-1772314225364/342-linkedin-onboarding-connect-flow.md:71`](../../../../../specs/orchestration/session-1772314225364/342-linkedin-onboarding-connect-flow.md:71)
  - Path 343: short-list invariants in [`specs/orchestration/session-1772314225364/343-shortlist-contacts-contribution-discovery.md:74`](../../../../../specs/orchestration/session-1772314225364/343-shortlist-contacts-contribution-discovery.md:74)
  - Path 344: manual-post-only invariants in [`specs/orchestration/session-1772314225364/344-linkedin-content-planning-workflow.md:64`](../../../../../specs/orchestration/session-1772314225364/344-linkedin-content-planning-workflow.md:64)
  - Path 345: interstitial lifecycle invariants in [`specs/orchestration/session-1772314225364/345-interstitial-overlay-orchestration.md:83`](../../../../../specs/orchestration/session-1772314225364/345-interstitial-overlay-orchestration.md:83)

## Desired End State
1. Paths `340-345` are implemented with path-tagged tests matching existing conventions.
2. Existing `293-339` behavior remains intact.
3. New events (`ingestion_*`, `artifact_copied_to_clipboard`, `linkedin_*`, `shortlist_*`, `interstitial_*`) are emitted with required fields.
4. UX guardrails are enforced:
   - No auto-post to LinkedIn.
   - All completed artifacts expose copy action.
   - Interstitials never block indefinitely.

### Observable Behaviors
1. Given inbound email/SMS URL messages, when parsed and user-resolved, then equivalent initialized session context is created (Path 340).
2. Given completed artifacts, when user taps Copy, then exact text is copied and feedback is immediate (Path 341).
3. Given onboarding LinkedIn step, when URL/manual/OAuth is used or skipped, then profile baseline is persisted correctly with secure token handling (Path 342).
4. Given profile baseline, when acceleration view is used, then shortlist, contribution areas, contacts, and outreach drafts are generated/persisted (Path 343).
5. Given selected company contribution areas, when LinkedIn drafts are generated, then manual-post-only safeguard is shown and no publish action exists (Path 344).
6. Given major stage transitions, when interstitial is configured, then overlay lifecycle and telemetry execute and flow advances (Path 345).
7. Given new flows, when actions succeed/fail, then required observability payloads are emitted with valid schema and required fields.

## What We're NOT Doing
- Rebuilding existing `293-339` modules/services already covered by current tests.
- Integrating real external LinkedIn or provider SDKs in this pass beyond interface boundaries and mocks.
- Building a full production message queue stack; ingress is route/service-driven with testable adapters.
- Changing model allocations or core OpenAI endpoint contracts.

## Testing Strategy
- **Framework**: Vitest + React Testing Library + Playwright (`frontend/package.json`, `frontend/vitest.config.ts`, `frontend/playwright.config.ts`).
- **Unit tests**:
  - Transformers/verifiers/event-schema validation.
  - Stage transition → interstitial mapping rules.
- **Integration tests**:
  - API route -> request handler -> service orchestration with DAO/provider mocks.
  - Existing pattern: path-scoped integration tests (example: [`frontend/src/modules/finalizedAnswer/__tests__/exportOrCopyFinalizedAnswer.integration.test.tsx:57`](../../../../../frontend/src/modules/finalizedAnswer/__tests__/exportOrCopyFinalizedAnswer.integration.test.tsx:57)).
- **E2E tests**:
  - Happy path through onboarding + session + copy + interstitial + finalize checks.
- **Mocking/Setup**:
  - Mock clipboard, analytics, LinkedIn parser/OAuth, channel ingress senders, and external comms provider.
  - Preserve existing typed error models and Zod schema validation.

## Review-Driven Issue Resolution (2026-03-03)
All findings from [`2026-03-03--07-51--tdd-voice-assisted-session-ui-ux-orchestration-340-345-REVIEW.md`](./2026-03-03--07-51--tdd-voice-assisted-session-ui-ux-orchestration-340-345-REVIEW.md) are applied in this revision.

### Contract Updates
- [x] Path 340 initialization contract now targets path-310-compatible `initialized` session flow via `ChannelIngestionPipelineAdapter` (not `answer_session INIT` bootstrap).
- [x] Path 340 channel-reply boundary is explicit via `ChannelReplySender` (deep link + summary, notification failure is non-blocking).
- [x] Idempotency contract is explicit: dedupe by provider message id and by `user_id + canonical_url`.
- [x] Universal copy contract now uses artifact union `status` semantics, not a generic `completed` boolean.
- [x] Interstitial authority contract is explicit relative to backend stage updates and existing shell `stageOverride`.

### Interface Updates
- [x] API contract files are required for every new endpoint family before route implementation.
- [x] Auth strategy is defined per endpoint (service-auth for inbound channel; user auth for shortlist/contact/drafts/linkedin flows).
- [x] Provider interfaces are explicit: `InboundChannelReceiver`, `ChannelReplySender`, `LinkedInAuthClient`, `CompanyDiscoveryClient`.
- [x] Logging interface strategy is explicit: path-level loggers delegate to a shared typed telemetry gateway.

### Promise/Security Updates
- [x] OAuth security contract now includes `state/nonce` verification, encrypted token storage, redaction rules, and token lifecycle semantics.
- [x] Abandonment telemetry reliability defined as best-effort with `sendBeacon` primary and fallback emission path.
- [x] Timeout/cancellation policies are explicit for shortlist/discovery/draft generation operations with degraded-mode UX.

### Data Model Updates
- [x] Dedicated persistence and migration plan is included for 342-344 entities.
- [x] LinkedIn connection/token envelope model is defined with encryption metadata and expiry/refresh fields.
- [x] Event-schema sink mapping is explicit against existing analytics tables.
- [x] Uniqueness constraints are specified (`user_id + canonical_url`, `user_id + company_id`, draft uniqueness keys).

### API Updates
- [x] Path 340 API now includes both route response contract and origin-channel reply contract.
- [x] Per-endpoint request/response/error schemas are required via `frontend/src/api_contracts/*`.
- [x] Endpoint rollout strategy is explicit via feature flags for new endpoint families.
- [x] Authorization policy is explicit for user-scoped routes.

## Implementation Gap Addendum (2026-03-03)
Targeted review against the current implementation found one additional missed function in the 340-345 scope:

- [ ] Behavior 9 telemetry ingestion endpoint is missing.
  - Evidence: client telemetry emits to `POST /api/telemetry/new-path-events` from `frontend/src/lib/newPathTelemetryClient.ts`, but no corresponding route exists under `frontend/src/app/api/telemetry/new-path-events/route.ts`.
  - Impact: interstitial telemetry emits can fail at runtime (observed `405 Method Not Allowed` in `new-path-events` testing), breaking required observability coverage for `interstitial_shown`, `interstitial_dismissed_or_continued`, and `interstitial_abandonment`.
  - Tracking: `silmari-writer-nzo` (bug) and umbrella `silmari-writer-xa5` updated.

## Cross-Cutting Contracts (Required Before Behavior Work)

### API Contract Layer + Rollout
- Create and test Zod contract modules before route code for:
  - `frontend/src/api_contracts/ingestion/channelContracts.ts`
  - `frontend/src/api_contracts/onboarding/linkedinContracts.ts`
  - `frontend/src/api_contracts/acceleration/shortlistContracts.ts`
  - `frontend/src/api_contracts/acceleration/contributionContracts.ts`
  - `frontend/src/api_contracts/acceleration/contactsContracts.ts`
  - `frontend/src/api_contracts/acceleration/outreachContracts.ts`
  - `frontend/src/api_contracts/linkedin/draftsContracts.ts`
- Each contract file must define request, success response, and error response schemas.
- Rollout policy: all new endpoints are behind feature flags (`voiceUx340`, `voiceUx342`, `voiceUx343`, `voiceUx344`, `voiceUx345`); no path version split in this phase.

### AuthN/AuthZ Matrix
- `POST /api/ingestion/channel`: provider/service-auth signature validation; no end-user session required.
- `POST /api/onboarding/linkedin/*`: authenticated user required; callback binds to user via verified state payload.
- `POST /api/acceleration/*` and `POST /api/linkedin/drafts`: authenticated user required; all reads/writes scoped to requester `user_id`.
- Contract tests must include unauthorized and cross-user access denial branches.

### Provider Interface Boundaries
- `InboundChannelReceiver`: normalize inbound provider payloads.
- `ChannelIngestionPipelineAdapter`: map channel URL input into path-310 initialization objects and create `initialized` sessions.
- `ChannelReplySender`: send origin-channel deep-link summary with non-blocking failure behavior.
- `LinkedInAuthClient`: OAuth start/callback token exchange and refresh/revoke semantics.
- `CompanyDiscoveryClient`: shortlist/contribution/contact discovery with timeout and cancellation support.

### Timeout/Cancellation + Degraded Modes
- Shortlist generation timeout: 8s; fallback to manual company entry UI.
- Contribution/contact discovery timeout: 10s; fallback to partial results with retry affordance.
- Outreach/LinkedIn draft generation timeout: 12s; fallback to "try again" state preserving user context.
- Cancellation source: request abort and UI route transition; cancellation emits typed timeout/cancel telemetry.

### Interstitial Stage Authority
- Source of truth order:
  1. Backend-confirmed stage from session payload.
  2. `stageOverride` used only for temporary optimistic transition while interstitial is active.
  3. Interstitial controller never mutates canonical stage; it decorates transition timing only.

### Event Sink Contract
- Path loggers (`onboardingLogger`, `kpiLogger`, and new path loggers) emit through shared `TypedTelemetryGateway`.
- Gateway routes:
  - KPI-like events -> `primary_kpi_events`
  - Behavioral analytics -> `analytics_events`
  - Ingestion operational idempotency/reply status -> `ingestion_messages` + analytics mirror
- Backpressure policy: never block UX-critical path on telemetry persistence failure; emit best-effort fallback log.

## Data Model & Migration Plan (Required Before Behavior 4)
- `candidate_profile_baselines`
  - key: `id` (uuid), `user_id` FK, `mode` enum (`url|manual|oauth|skip`), baseline payload, timestamps
- `linkedin_connections`
  - key: `id`, `user_id` unique FK, encrypted token envelope fields (`ciphertext`, `key_id`, `expires_at`, `refresh_expires_at`, `revoked_at`)
- `company_shortlists`
  - key: `id`, `user_id` FK, `source` enum, created/updated timestamps
- `shortlist_items`
  - key: `id`, `shortlist_id` FK, `company_id`, `rank`, uniqueness (`shortlist_id + company_id`)
- `company_contribution_areas`
  - key: `id`, `user_id` FK, `company_id`, `label`, `rationale`, uniqueness (`user_id + company_id + label`)
- `company_contact_suggestions`
  - key: `id`, `user_id` FK, `company_id`, `contact_external_id`, metadata, uniqueness (`user_id + company_id + contact_external_id`)
- `outreach_drafts`
  - key: `id`, `user_id` FK, `company_id`, `contact_id` FK nullable, `draft_hash`, content, uniqueness (`user_id + draft_hash`)
- `linkedin_post_drafts`
  - key: `id`, `user_id` FK, `company_id`, `contribution_area_id` FK nullable, `draft_hash`, content, uniqueness (`user_id + draft_hash`)
- `ingestion_messages`
  - key: `id`, provider message metadata, `user_id`, `canonical_url`, `session_id` FK nullable, `reply_status`, `error_code`
  - uniqueness: (`provider_name + provider_message_id`) and (`user_id + canonical_url`)
- Migration deliverables:
  - Supabase migration SQL for tables/indexes/FKs
  - DAO tests for dedupe constraints
  - Backfill policy: none required (new domain)

---

## Behavior 1: Channel Ingestion Normalization (Path 340, Steps 1-3)

### Test Specification
**Given** inbound email/SMS payload with sender + body  
**When** channel ingress route receives request  
**Then** payload is normalized, sender is resolved, URL extracted/validated/canonicalized, idempotency keys are derived, and failure modes produce typed errors/events.

**Edge Cases**: unknown sender, duplicate provider message id, duplicate canonical URL for same user, no URL in body, invalid URL domain, malformed payload.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/server/request_handlers/__tests__/ChannelIngestionHandler.test.ts`
```ts
it('normalizes sms payload, resolves user, and returns validated url context', async () => {
  await expect(ChannelIngestionHandler.handle(validSmsPayload)).resolves.toMatchObject({
    channel: 'sms',
    userId: 'user-1',
    canonicalUrl: 'https://example.com/job/123',
  });
});
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/server/request_handlers/ChannelIngestionHandler.ts`
```ts
export const ChannelIngestionHandler = {
  async handle(payload: unknown) {
    const normalized = InboundMessageTransformer.parse(payload);
    const user = await ChannelIngestionService.resolveSender(normalized);
    const canonicalUrl = ChannelIngestionService.extractCanonicalUrl(normalized.body, user.id);
    const dedupe = ChannelIngestionService.buildIdempotencyKeys({
      providerMessageId: normalized.providerMessageId,
      userId: user.id,
      canonicalUrl,
    });
    return { channel: normalized.channel, sender: normalized.sender, userId: user.id, canonicalUrl, dedupe };
  },
};
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/server/transformers/InboundMessageTransformer.ts`
```ts
// Split parse logic into channel-specific parser + common schema validator
```

### Success Criteria
**Automated:**
- [x] Red fails for missing sender/canonical-url handling.
- [x] Green passes `npm --prefix frontend run test -- src/server/request_handlers/__tests__/ChannelIngestionHandler.test.ts`.
- [x] Typecheck passes.

**Manual:**
- [x] Inbound email and SMS examples produce consistent normalized objects.

---

## Behavior 2: Channel URL -> Session Init + Notification Contract (Path 340, Steps 4-5)

### Test Specification
**Given** validated URL + resolved user  
**When** channel ingestion continues  
**Then** path-310-compatible initialization is invoked through `ChannelIngestionPipelineAdapter`, origin-channel reply is attempted via `ChannelReplySender`, and failures do not create partial sessions.

**Edge Cases**: session initialization failure, notification failure (non-blocking), duplicate URL retry, duplicate provider message id replay.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/app/api/ingestion/channel/__tests__/route.test.ts`
```ts
it('creates initialized session context and returns deep link reply payload', async () => {
  const res = await POST(makeChannelRequest(validPayload));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    deepLink: expect.stringContaining('/session/'),
    replyAttempted: true,
    replyStatus: expect.stringMatching(/sent|failed_non_blocking/),
  });
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/app/api/ingestion/channel/route.ts`
- `frontend/src/api_contracts/ingestion/channelContracts.ts`
```ts
const result = await ChannelIngestionHandler.handle(body);
const initialized = await ChannelIngestionPipelineAdapter.initializeFromUrl({
  userId: result.userId,
  sourceUrl: result.canonicalUrl,
  channel: result.channel,
});

const replyStatus = await ChannelReplySender.sendSuccess({
  channel: result.channel,
  recipient: result.sender,
  deepLink: `/session/${initialized.id}`,
  contextSummary: initialized.contextSummary,
});

return NextResponse.json({
  deepLink: `/session/${initialized.id}`,
  channel: result.channel,
  replyAttempted: true,
  replyStatus,
});
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/server/services/ChannelIngestionService.ts`
```ts
// Extract idempotency store contract:
// - dedupe key A: provider_name + provider_message_id
// - dedupe key B: user_id + canonical_url
// plus ingestion_* event emission helper
```

### Success Criteria
**Automated:**
- [x] Route tests cover success + all error branches.
- [x] Existing init route tests remain green.
- [x] API contract tests validate request/success/error schema for `/api/ingestion/channel`.

**Manual:**
- [x] Deep link payload is identical for paste and channel-ingested sessions.
- [x] Origin-channel reply includes deep link + context summary and does not block session creation when reply send fails.

---

## Behavior 3: Universal Copy Artifact UX (Path 341)

### Test Specification
**Given** artifact `answer|outreach|linkedin_post|summary` with `status='completed'`  
**When** user taps Copy  
**Then** exact content is copied, immediate confirmation is shown, and copy event is emitted.

**Edge Cases**: artifact status not `completed` hides copy button, clipboard permission failure, large text payload.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/components/__tests__/ArtifactCopyButton.test.tsx`
```tsx
it('copies exact rendered text and shows "Copied!" feedback', async () => {
  render(<ArtifactCopyButton artifactType="outreach" content="Hello..." status="completed" />);
  await user.click(screen.getByRole('button', { name: /copy/i }));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello...');
  expect(screen.getByText(/copied/i)).toBeInTheDocument();
});
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/ArtifactCopyButton.tsx`
```tsx
export function ArtifactCopyButton({ content, status, artifactType }: Props) {
  if (status !== 'completed') return null;
  // clipboard write + local feedback + analytics emit
}
```

#### 🔵 Refactor: Improve Code
**Files**:
- `frontend/src/modules/finalizedAnswer/FinalizedAnswerModule.tsx`
- `frontend/src/components/ExportCopyControls.tsx`
```tsx
// Reuse ArtifactCopyButton to avoid duplicate copy logic
```

### Success Criteria
**Automated:**
- [x] `ArtifactCopyButton` tests pass.
- [x] Existing finalized-answer copy tests stay green.

**Manual:**
- [x] Copy feedback appears within <500ms and resets correctly.

---

## Behavior 4: LinkedIn Onboarding Input Modes + Secure OAuth (Path 342)

### Test Specification
**Given** onboarding LinkedIn step  
**When** user chooses URL/manual/OAuth/skip  
**Then** exactly one input mode is persisted, URL failure falls back, and OAuth tokens remain server-only.

**Edge Cases**: URL parse fail, OAuth deny, OAuth state/nonce mismatch, token refresh/revoke failure, empty manual form, profile merge with empty LinkedIn fields.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/modules/onboarding/__tests__/LinkedinInputStep.test.tsx`
```tsx
it('offers manual and oauth fallback after url parse failure', async () => {
  // URL parse fails -> fallback UI visible
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/modules/onboarding/LinkedinInputStep.tsx`
- `frontend/src/app/api/onboarding/linkedin/connect/start/route.ts`
- `frontend/src/app/api/onboarding/linkedin/parse/route.ts`
- `frontend/src/app/api/onboarding/linkedin/connect/callback/route.ts`
- `frontend/src/api_contracts/onboarding/linkedinContracts.ts`
```ts
// parse + mode tagging + secure token persistence on server side only
// callback enforces OAuth state/nonce verification before token exchange
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/server/services/OnboardingService.ts`
```ts
// Add profile merge helper that preserves resume-derived non-empty fields
```

### Success Criteria
**Automated:**
- [x] UI and route tests for URL/manual/OAuth/skip paths.
- [x] Token leakage test (no token in client payload/logs).
- [x] OAuth security tests: invalid state rejected, token fields encrypted at rest, refresh/revoke semantics covered.

**Manual:**
- [x] User can skip LinkedIn and continue onboarding.
- [x] OAuth callback failure states are user-safe and do not leak token material.

---

## Behavior 5: Short-list Generation and Persistence (Path 343, Steps 1-2)

### Test Specification
**Given** candidate profile baseline exists  
**When** user enters acceleration module and saves shortlist  
**Then** shortlist is generated and persisted with per-company save events.

**Edge Cases**: no baseline, persistence failure with retry, manual company add/remove/reorder.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/modules/acceleration/__tests__/ShortlistModule.test.tsx`
```tsx
it('generates shortlist and persists user edits', async () => {
  // render -> generate -> reorder -> save -> assert API calls
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/modules/acceleration/ShortlistModule.tsx`
- `frontend/src/app/api/acceleration/shortlist/route.ts`
- `frontend/src/api_contracts/acceleration/shortlistContracts.ts`
```ts
// generate + CRUD save endpoints with typed payloads
// enforce authenticated user scope + explicit timeout/degraded mode
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/server/services/AccelerationService.ts`
```ts
// isolate shortlist generation strategy from persistence adapter
```

### Success Criteria
**Automated:**
- [x] Shortlist module + route tests pass.
- [x] Event payload contract test for `shortlist_generated` and `shortlist_company_saved`.
- [x] Auth contract tests cover unauthorized and cross-user denial branches.

**Manual:**
- [x] User can curate list without losing unsaved local state on transient errors.

---

## Behavior 6: Contribution Areas, Contacts, Outreach Drafts (Path 343, Steps 3-5)

### Test Specification
**Given** a selected shortlist company  
**When** contribution and contact generation runs  
**Then** contribution areas, contacts, and outreach drafts are returned and drafts expose copy controls.

**Edge Cases**: sparse company context, no contacts found, generation failure fallback.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/server/services/__tests__/AccelerationService.discovery.test.ts`
```ts
it('returns contribution areas and contact suggestions scoped to selected company', async () => {
  // expect single-company scoped outputs
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/app/api/acceleration/contribution/route.ts`
- `frontend/src/app/api/acceleration/contacts/route.ts`
- `frontend/src/app/api/acceleration/outreach/route.ts`
- `frontend/src/api_contracts/acceleration/contributionContracts.ts`
- `frontend/src/api_contracts/acceleration/contactsContracts.ts`
- `frontend/src/api_contracts/acceleration/outreachContracts.ts`
```ts
// minimal handlers + service calls + typed responses
// enforce authenticated user scope + timeout/cancel-aware provider adapters
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/modules/acceleration/AccelerationModule.tsx`
```tsx
// split fetch/state logic into hooks: useContribution, useContacts, useOutreach
```

### Success Criteria
**Automated:**
- [x] Discovery and outreach generation tests pass.
- [x] Copy button rendering tests pass for outreach artifacts.
- [x] Timeout/cancellation tests verify degraded-mode responses preserve user context.

**Manual:**
- [x] Contact/relevance and contribution labels are understandable in UI.

---

## Behavior 7: LinkedIn Content Planning with Manual-Post Guard (Path 344)

### Test Specification
**Given** contribution areas for a shortlist company  
**When** LinkedIn drafts are generated  
**Then** drafts include manual-post-only reminder, copy action exists, and no publish action/API is exposed.

**Edge Cases**: no contribution areas available, draft generation failure and retry.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/modules/linkedin/__tests__/LinkedinPlanningModule.test.tsx`
```tsx
it('renders manual-post-only safeguard and no publish controls', async () => {
  render(<LinkedinPlanningModule ... />);
  expect(screen.getByText(/post manually/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /publish|post/i })).not.toBeInTheDocument();
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/modules/linkedin/LinkedinPlanningModule.tsx`
- `frontend/src/app/api/linkedin/drafts/route.ts`
- `frontend/src/api_contracts/linkedin/draftsContracts.ts`
```ts
// generate draft text + render copy-only controls
// enforce authenticated user scope and explicit error schema
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/modules/linkedin/useLinkedinDrafts.ts`
```ts
// extract generation/loading/error state hook
```

### Success Criteria
**Automated:**
- [x] UI tests enforce manual-post-only invariant.
- [x] No route/API named for LinkedIn publish exists.
- [x] API contract tests validate request/success/error schema for draft generation.

**Manual:**
- [x] Reminder remains visible whenever drafts are displayed.

---

## Behavior 8: Interstitial Overlay Lifecycle (Path 345)

### Test Specification
**Given** configured stage transitions  
**When** transition occurs  
**Then** appropriate interstitial appears with progress + copy, dwell is tracked, abandonment is handled with best-effort reliability, stage authority preserves backend-first precedence, and next stage auto-advances after minimum display.

**Edge Cases**: unknown transition (no-op), missing content fallback, next-stage load failure, immediate backend completion.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**Files**:
- `frontend/src/modules/session/interstitial/__tests__/interstitialMapper.test.ts`
- `frontend/src/modules/session/interstitial/__tests__/InterstitialController.test.tsx`
```tsx
it('auto-advances only after minimum display time even when processing completes immediately', async () => {
  // fake timers + transition + expect delay >= 1500ms
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/modules/session/interstitial/interstitialContent.ts`
- `frontend/src/modules/session/interstitial/interstitialMapper.ts`
- `frontend/src/modules/session/interstitial/InterstitialController.tsx`
- `frontend/src/modules/session/SessionWorkflowShell.tsx`
```tsx
// wrap stage transitions with InterstitialController for configured transitions
// stage precedence: backend stage > temporary stageOverride > interstitial display state
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/modules/session/SessionWorkflowShell.tsx`
```tsx
// move transition effects into useSessionStageTransition hook for clarity/testability
```

### Success Criteria
**Automated:**
- [x] Mapper + controller tests pass.
- [x] Existing `SessionWorkflowShell` tests remain green.
- [x] Abandonment telemetry tests validate sendBeacon primary and non-blocking fallback path.

**Manual:**
- [x] Interstitial never presents as error styling.
- [x] User can continue/wait and progress is visible.

---

## Behavior 9: Observability Contract for New Paths

### Test Specification
**Given** each new flow action succeeds/fails  
**When** telemetry is emitted  
**Then** required event name + required fields are present and schema-valid.

**Edge Cases**: failure events with `error_code`, copy failure with `copy_success=false`, abandonment event on unload.

### TDD Cycle
#### 🔴 Red: Write Failing Test
**File**: `frontend/src/server/logging/__tests__/newPathEventContract.test.ts`
```ts
it('validates required payload fields for interstitial_shown event', () => {
  expect(() => validateEvent('interstitial_shown', badPayload)).toThrow();
});
```

#### 🟢 Green: Minimal Implementation
**Files**:
- `frontend/src/server/data_structures/NewPathEvents.ts`
- `frontend/src/server/logging/newPathEventLogger.ts`
```ts
// zod schemas per event + emit helper
// route events through TypedTelemetryGateway to analytics_events/primary_kpi_events
```

#### 🔵 Refactor: Improve Code
**File**: `frontend/src/server/logging/newPathEventLogger.ts`
```ts
// centralize common fields: session_id, user_id, timestamp, source
// use path-level logger wrappers that delegate to shared gateway
```

### Success Criteria
**Automated:**
- [x] Event contract tests pass for all `340-345` events.
- [x] Existing analytics tests remain green.
- [x] Event sink routing tests verify destination mapping and non-blocking failure semantics.

**Manual:**
- [x] QA logs clearly show success/failure payloads for all new flows.

---

## Integration & E2E Testing
- Integration:
  - Channel ingress -> initialization contract parity (paste vs inbound channel) + origin-channel reply emission.
  - LinkedIn onboarding mode transitions + secure callback handling (`state/nonce`, encrypted token persistence).
  - Interstitial lifecycle and fallback behavior.
  - AuthZ coverage for all user-scoped routes (unauthorized + cross-user).
- E2E:
  - Onboarding (skip + LinkedIn URL/manual) -> session start -> recall transition with interstitial.
  - Acceleration flow: shortlist -> contribution -> contacts -> outreach copy.
  - LinkedIn planning: draft generation -> copy -> manual-post guard visible.
  - Channel URL replay/idempotency: duplicate inbound message does not create duplicate sessions.

## Global Verification Commands
- `npm --prefix frontend run test`
- `npm --prefix frontend run test:coverage`
- `npm --prefix frontend run type-check`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test:e2e`

## References
- [`thoughts/searchable/shared/plans/2026-03-03--07-51--tdd-voice-assisted-session-ui-ux-orchestration-340-345-REVIEW.md`](./2026-03-03--07-51--tdd-voice-assisted-session-ui-ux-orchestration-340-345-REVIEW.md)
- [`specs/voice-assisted-session-ui-ux.md`](../../../../../specs/voice-assisted-session-ui-ux.md)
- [`specs/orchestration/session-1772314225364/340-ingest-url-via-email-or-sms-channel.md`](../../../../../specs/orchestration/session-1772314225364/340-ingest-url-via-email-or-sms-channel.md)
- [`specs/orchestration/session-1772314225364/341-copy-artifact-to-clipboard.md`](../../../../../specs/orchestration/session-1772314225364/341-copy-artifact-to-clipboard.md)
- [`specs/orchestration/session-1772314225364/342-linkedin-onboarding-connect-flow.md`](../../../../../specs/orchestration/session-1772314225364/342-linkedin-onboarding-connect-flow.md)
- [`specs/orchestration/session-1772314225364/343-shortlist-contacts-contribution-discovery.md`](../../../../../specs/orchestration/session-1772314225364/343-shortlist-contacts-contribution-discovery.md)
- [`specs/orchestration/session-1772314225364/344-linkedin-content-planning-workflow.md`](../../../../../specs/orchestration/session-1772314225364/344-linkedin-content-planning-workflow.md)
- [`specs/orchestration/session-1772314225364/345-interstitial-overlay-orchestration.md`](../../../../../specs/orchestration/session-1772314225364/345-interstitial-overlay-orchestration.md)
- Existing architecture anchors:
  - [`frontend/src/modules/session/stageMapper.ts`](../../../../../frontend/src/modules/session/stageMapper.ts)
  - [`frontend/src/modules/session/SessionWorkflowShell.tsx`](../../../../../frontend/src/modules/session/SessionWorkflowShell.tsx)
  - [`frontend/src/modules/finalizedAnswer/FinalizedAnswerModule.tsx`](../../../../../frontend/src/modules/finalizedAnswer/FinalizedAnswerModule.tsx)
