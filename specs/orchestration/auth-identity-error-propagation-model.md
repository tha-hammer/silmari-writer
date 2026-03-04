# PATH: auth-identity-error-propagation-model

**Layer:** 3 (Function Path)
**Priority:** P0
**Version:** 1
**Source:** Extracted from existing code — AuthAndValidationFilter.ts, ChannelIngestionPipelineAdapter.ts, InitializeSessionService.ts, ChannelIngestionErrors.ts, SessionErrors.ts, ingestion/url/route.ts

## Purpose

Behavioral model of two composing bugs in the URL ingestion auth and error propagation path:

1. **Auth identity collision:** `AuthAndValidationFilter.authenticate()` derives userId from the first 8 characters of the bearer token. All standard JWTs share the prefix `eyJhbGci`, collapsing distinct users to the same userId (`user-eyJhbGci`). This defeats the user-scoped session uniqueness check added by the previous model's Fix 3.

2. **Error type swallowing:** `ChannelIngestionPipelineAdapter.initializeFromUrl()` catches all errors from `InitializeSessionService.createSession()` and wraps them into `ChannelIngestionErrors.PipelineInitFailed()` (HTTP 500, code `PIPELINE_INIT_FAILED`). This destroys the original `SessionError(SESSION_ALREADY_ACTIVE, 409)` semantics, making the conflict appear as a server error to the client.

These compose: the identity collision causes cross-user active-session conflicts, and the error wrapping hides the real cause.

## Trigger

User submits a URL via `POST /api/ingestion/url` with a JWT bearer token.

## Resource References

| UUID | Name | Role in this path |
|------|------|-------------------|
| `api-p3e6` | auth_filter | Authenticates request, derives userId from bearer token |
| `api-e5f6` | channel_router | Normalizes inbound URL into ingestion request |
| `db-h2s4` | initialize_session_service | Validates objects, checks uniqueness, creates session |
| `db-d3w8` | initialize_session_dao | Persists session, checks active sessions by user_id |
| `db-l1c3` | error_definitions | Defines SessionError and ChannelIngestionError types |
| `fn-w3k8` | pipeline_adapter | Orchestrates URL → session; wraps errors |

## Steps

1. **Derive user identity from bearer token**
   - Input: Authorization header with JWT bearer token at `api-p3e6`.
   - Process: Strip `Bearer ` prefix, extract `token.substring(0, 8)`, construct `userId = "user-" + prefix`. BUG — standard JWTs begin with base64-encoded `{"alg":` which always produces prefix `eyJhbGci`. All users with standard JWT tokens map to `userId = "user-eyJhbGci"`. FIXED — decode JWT, extract `sub` claim, or hash the full token.
   - Output: `AuthContext { userId: "user-eyJhbGci", authenticated: true }` for all standard JWTs. FIXED — unique userId per token/user.
   - Error: Missing/empty header → `StoryErrors.UNAUTHORIZED` (401). Empty token → `StoryErrors.UNAUTHORIZED` (401).

2. **Check active session uniqueness (user-scoped)**
   - Input: `userId` from step 1 passed through pipeline adapter → `InitializeSessionService.createSession()` → `InitializeSessionDAO.getActiveSession(userId)`.
   - Process: Query `sessions WHERE state = 'initialized' AND user_id = :userId`. Because all users share the same userId (step 1 bug), this returns any user's initialized session. The user-scoping from Fix 3 is defeated.
   - Output: Null (no active session) → proceed. Non-null + stale → supersede. Non-null + fresh → throw.
   - Error: `SessionErrors.SessionAlreadyActive()` — code `SESSION_ALREADY_ACTIVE`, HTTP 409, retryable: false.

3. **Error wrapping in pipeline adapter**
   - Input: `SessionError(SESSION_ALREADY_ACTIVE, 409)` thrown from step 2, caught by `ChannelIngestionPipelineAdapter.initializeFromUrl()` at `fn-w3k8:52`.
   - Process: BUG — blanket catch wraps ALL errors into `ChannelIngestionErrors.PipelineInitFailed()`. The original error's code (`SESSION_ALREADY_ACTIVE`), status (409), and retryable flag (false) are destroyed. The error message is preserved as a substring but the structured metadata is lost. FIXED — check if error is `SessionError` with code `SESSION_ALREADY_ACTIVE` and re-throw as `ChannelIngestionError` with status 409 (or re-throw the `SessionError` directly).
   - Output: BUG — `ChannelIngestionError(PIPELINE_INIT_FAILED, 500, retryable: true)`. FIXED — `ChannelIngestionError` or `SessionError` preserving 409 semantics.
   - Error: The error IS the output at this step.

4. **Route error handler dispatches HTTP response**
   - Input: Error from step 3 caught by route handler at `route.ts:60-89`.
   - Process: Route checks `instanceof` chain: `StoryError` → `VoiceUxError` → `ChannelIngestionError` → fallback 500. Because step 3 wraps to `ChannelIngestionError`, the route handler matches at line 79 and uses `.statusCode` (500) and `.code` (`PIPELINE_INIT_FAILED`).
   - Output: BUG — HTTP 500 `{ code: "PIPELINE_INIT_FAILED", message: "Channel initialization pipeline failed: A session is already active..." }`. FIXED — HTTP 409 `{ code: "SESSION_ALREADY_ACTIVE", message: "..." }`.
   - Error: None — the route handler always returns a response.

5. **Client receives misleading error**
   - Input: HTTP 500 response from step 4.
   - Process: Client `startSessionFromUrl()` contract at `startSessionFromUrl.ts:40-48` checks `response.ok`. HTTP 500 → not ok → parses error body → throws `Error(message)`. The client sees "pipeline failed" instead of "session already active". Client cannot distinguish transient server error from a conflict that requires different user action.
   - Output: BUG — user sees generic failure, retries, gets same 500 forever. FIXED — user sees 409 conflict, UI can display "session already active" and offer resolution.
   - Error: None at this step — but user is stuck without actionable information.

## Terminal Condition

**Happy path:** No active session collision → session created → 200 returned with session ID.

**Buggy terminal:** Cross-user collision → `SESSION_ALREADY_ACTIVE` → wrapped to `PIPELINE_INIT_FAILED` 500 → client shows generic error → user retries → same result. No path to resolution without manual DB intervention.

**Fixed terminal:** Either (a) no collision because userId is unique per user, or (b) collision is user's own session → 409 with actionable error code → client UI offers resolution (finalize/end active session).

## Feedback Loops

**Retry loop (broken):** User retry → same collided userId → same active session found → same 500. Infinite loop with no degradation (the session won't become stale for 30 minutes if it was freshly created by another user).

**Fixed retry loop:** User retry after 409 → client shows "active session exists" → user finalizes/ends → retry succeeds.

## Extracted Invariants

| ID | Invariant | Source | TLA+ Property | Test Oracle | Status |
|----|-----------|--------|---------------|-------------|--------|
| INV-1 | Distinct bearer tokens must produce distinct userIds | AuthAndValidationFilter.ts:36 | TypeInvariant | `authenticate("Bearer tokenA").userId !== authenticate("Bearer tokenB").userId` when tokenA !== tokenB | **VIOLATED** |
| INV-2 | Error HTTP status must reflect the original error semantics | ChannelIngestionPipelineAdapter.ts:52 | ErrorConsistency | `SESSION_ALREADY_ACTIVE` → HTTP 409 at the route response level | **VIOLATED** |
| INV-3 | Error code must be preserved through wrapping layers | ChannelIngestionPipelineAdapter.ts:52 | ErrorConsistency | Client receives `SESSION_ALREADY_ACTIVE` code, not `PIPELINE_INIT_FAILED` | **VIOLATED** |
| INV-4 | User-scoped queries must receive a unique user identifier | InitializeSessionDAO.ts:45 | TypeInvariant | `getActiveSession(userId)` where userId uniquely identifies the authenticated user | **VIOLATED** (because INV-1 is violated) |
| INV-5 | Client error responses must be actionable | route.ts:79-83 | Reachability | 409 conflict → client UI can offer resolution path (finalize/end) | **VIOLATED** |

## Fix-to-Invariant Mapping

| Fix | Description | File:Line | Invariants Resolved | Risk |
|-----|-------------|-----------|---------------------|------|
| Fix A | Derive userId from JWT `sub` claim or hash full token | `AuthAndValidationFilter.ts:36` | INV-1, INV-4 | Low — single function, well-tested boundary |
| Fix B | Re-throw `SessionError` from pipeline adapter instead of wrapping | `ChannelIngestionPipelineAdapter.ts:52-55` | INV-2, INV-3 | Low — add instanceof check before blanket wrap |
| Fix C | Add `SessionError` handler to route (or let existing handler catch) | `route.ts:60-89` | INV-5 | Low — route already handles `SessionError` if it reaches the handler |

## Change Impact Analysis

### Fix A: Derive userId from JWT sub claim (root cause)
- **Affected step:** 1
- **Change:** Replace `token.substring(0, 8)` with JWT decode → extract `sub` claim. Fallback to full-token hash if JWT decode fails.
- **Files:** `AuthAndValidationFilter.ts:35-36`
- **Risk:** Low. Auth is a stub anyway (comment says "In production: validate JWT via Supabase Auth"). This moves it closer to production behavior.
- **Test oracle:** Two different valid JWTs → two different userIds. Same JWT → same userId.
- **Implementation note:** Can use `atob(token.split('.')[1])` to decode JWT payload without a library, or import `jsonwebtoken` / use Supabase's `getUser()`.

### Fix B: Preserve SessionError through pipeline adapter (error propagation)
- **Affected step:** 3
- **Change:** In the catch block, check `if (error instanceof SessionError) throw error;` before wrapping. This lets `SessionError(SESSION_ALREADY_ACTIVE, 409)` propagate to the route handler, which already handles `SessionError` at line 61-65 (via `StoryError` — need to verify inheritance).
- **Files:** `ChannelIngestionPipelineAdapter.ts:52-55`
- **Risk:** Low. The route handler at line 60-89 checks `StoryError`, `VoiceUxError`, `ChannelIngestionError` in order. `SessionError` is NOT currently caught — it falls through to the generic 500 at line 86-89. So Fix B requires Fix C too.
- **Alternative:** Map `SessionError` to `ChannelIngestionError` preserving status code: `new ChannelIngestionError(error.message, 'PIPELINE_INIT_FAILED', error.statusCode, error.retryable)`.

### Fix C: Add SessionError handler to route
- **Affected step:** 4
- **Change:** Add `if (error instanceof SessionError)` block to the route handler, returning `{ code: error.code, message: error.message }` with `error.statusCode`.
- **Files:** `route.ts:60-89` — add between StoryError and VoiceUxError checks
- **Risk:** Low. Additive. No existing behavior changes for other error types.
- **Alternative (simpler):** In Fix B, map to ChannelIngestionError preserving status code. Then existing ChannelIngestionError handler at line 79 catches it with correct status.

### Recommended fix order
1. **Fix A** — root cause, stops the identity collision
2. **Fix B** — stop error type swallowing, preserve 409 semantics
3. **Fix C** — ensure route handler returns correct HTTP status for SessionError

### Interaction with previous model (url-ingestion-error-space-model)
- Fix 3 (user-scoped uniqueness) from the previous model is already implemented but **defeated by the identity collision** (this model's INV-1). Fix A here unblocks Fix 3's effectiveness.
- Fix 4 (stale supersede) from the previous model is already implemented. It works correctly IF the userId is unique — but with collided userId, user B's fresh session might be incorrectly superseded if user A's stale session exists.
