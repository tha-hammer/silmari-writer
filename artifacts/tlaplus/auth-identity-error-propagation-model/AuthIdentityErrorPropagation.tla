---- MODULE AuthIdentityErrorPropagation ----
EXTENDS Naturals, Sequences, FiniteSets

\* Resource constants
CONSTANTS api_p3e6, api_e5f6, db_h2s4, db_d3w8, db_l1c3, fn_w3k8

\* Mode selector
CONSTANTS mode

\* State variables
VARIABLES pc, error_state, error_code, http_status,
          \* Auth identity
          token_a, token_b, derived_user_a, derived_user_b, users_collide,
          \* Session state
          session_owner_user_id, active_session_exists,
          \* Error propagation
          original_error_code, original_http_status,
          wrapped_error_code, wrapped_http_status,
          client_sees_actionable_error,
          \* Step outputs
          step_1_out, step_2_out, step_3_out, step_4_out, step_5_out

vars == << pc, error_state, error_code, http_status,
           token_a, token_b, derived_user_a, derived_user_b, users_collide,
           session_owner_user_id, active_session_exists,
           original_error_code, original_http_status,
           wrapped_error_code, wrapped_http_status,
           client_sees_actionable_error,
           step_1_out, step_2_out, step_3_out, step_4_out, step_5_out >>

\* ====================================================================
\* TYPE INVARIANT
\* ====================================================================
TypeInvariant ==
    /\ pc \in {"idle", "step_1", "step_2", "step_3", "step_4", "step_5",
               "done", "error"}
    /\ error_state \in {TRUE, FALSE}
    /\ error_code \in {"none", "UNAUTHORIZED", "SESSION_ALREADY_ACTIVE",
                        "PIPELINE_INIT_FAILED", "PERSISTENCE_FAILURE"}
    /\ http_status \in {0, 200, 401, 409, 500}
    /\ users_collide \in {TRUE, FALSE}
    /\ active_session_exists \in {TRUE, FALSE}
    /\ original_error_code \in {"none", "SESSION_ALREADY_ACTIVE"}
    /\ original_http_status \in {0, 409}
    /\ wrapped_error_code \in {"none", "PIPELINE_INIT_FAILED", "SESSION_ALREADY_ACTIVE"}
    /\ wrapped_http_status \in {0, 409, 500}
    /\ client_sees_actionable_error \in {TRUE, FALSE}
    /\ mode \in {"buggy", "fixed"}

\* ====================================================================
\* ERROR CONSISTENCY
\* ====================================================================
ErrorConsistency ==
    error_state = TRUE => pc = "error"

\* ====================================================================
\* INVARIANTS
\* ====================================================================

\* INV-1: Distinct tokens must produce distinct userIds
DistinctTokensDistinctUsers ==
    (mode = "fixed") => users_collide = FALSE

\* INV-2: Error HTTP status must reflect original semantics
ErrorStatusPreserved ==
    (mode = "fixed" /\ original_http_status = 409) =>
        wrapped_http_status = 409

\* INV-3: Error code must be preserved through wrapping
ErrorCodePreserved ==
    (mode = "fixed" /\ original_error_code = "SESSION_ALREADY_ACTIVE") =>
        wrapped_error_code = "SESSION_ALREADY_ACTIVE"

\* INV-5: Client error responses must be actionable
ClientErrorActionable ==
    (mode = "fixed" /\ original_error_code = "SESSION_ALREADY_ACTIVE") =>
        client_sees_actionable_error = TRUE

\* ====================================================================
\* INIT
\* ====================================================================
Init ==
    /\ pc = "idle"
    /\ error_state = FALSE
    /\ error_code = "none"
    /\ http_status = 0
    /\ token_a = "eyJhbGciOiJIUz..."
    /\ token_b = "eyJhbGciOiJSUz..."
    /\ derived_user_a = "none"
    /\ derived_user_b = "none"
    /\ users_collide = FALSE
    /\ session_owner_user_id = "none"
    /\ active_session_exists = TRUE   \* User A already has an active session
    /\ original_error_code = "none"
    /\ original_http_status = 0
    /\ wrapped_error_code = "none"
    /\ wrapped_http_status = 0
    /\ client_sees_actionable_error = FALSE
    /\ step_1_out = "none"
    /\ step_2_out = "none"
    /\ step_3_out = "none"
    /\ step_4_out = "none"
    /\ step_5_out = "none"

\* ====================================================================
\* STEP 1: Derive user identity from bearer token
\* BUGGY: token.substring(0,8) — "eyJhbGci" for all standard JWTs
\* FIXED: JWT decode sub claim or hash full token
\* ====================================================================

Step1_Buggy_IdentityCollision ==
    /\ mode = "buggy"
    /\ pc = "idle"
    /\ pc' = "step_1"
    /\ derived_user_a' = "user-eyJhbGci"
    /\ derived_user_b' = "user-eyJhbGci"
    /\ users_collide' = TRUE              \* <-- THE BUG
    /\ session_owner_user_id' = "user-eyJhbGci"  \* User A's session
    /\ step_1_out' = "auth_collided"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b,
                    active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_2_out, step_3_out, step_4_out, step_5_out >>

Step1_Fixed_UniqueIdentity ==
    /\ mode = "fixed"
    /\ pc = "idle"
    /\ pc' = "step_1"
    /\ derived_user_a' = "user-abc123"
    /\ derived_user_b' = "user-def456"
    /\ users_collide' = FALSE              \* <-- FIX A
    /\ session_owner_user_id' = "user-abc123"  \* User A's session
    /\ step_1_out' = "auth_unique"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b,
                    active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_2_out, step_3_out, step_4_out, step_5_out >>

Step1_Error_Unauthorized ==
    /\ pc = "idle"
    /\ pc' = "error"
    /\ error_state' = TRUE
    /\ error_code' = "UNAUTHORIZED"
    /\ http_status' = 401
    /\ UNCHANGED << derived_user_a, derived_user_b, users_collide,
                    token_a, token_b,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_2_out, step_3_out, step_4_out, step_5_out >>

\* ====================================================================
\* STEP 2: Check active session uniqueness (user-scoped)
\* With collided userId, User B's request finds User A's session
\* ====================================================================

\* User B's request — no collision, different user, no active session match
Step2_Fixed_NoCollision ==
    /\ mode = "fixed"
    /\ pc = "step_1"
    /\ users_collide = FALSE
    /\ active_session_exists = TRUE   \* User A has session, but user B is different
    /\ pc' = "done"                   \* User B proceeds to create their own session
    /\ http_status' = 200
    /\ step_2_out' = "no_collision_proceed"
    /\ UNCHANGED << error_state, error_code,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_3_out, step_4_out, step_5_out >>

\* User B's request — collision, finds User A's session, throws 409
Step2_Buggy_CrossUserCollision ==
    /\ mode = "buggy"
    /\ pc = "step_1"
    /\ users_collide = TRUE
    /\ active_session_exists = TRUE
    /\ pc' = "step_2"
    /\ original_error_code' = "SESSION_ALREADY_ACTIVE"
    /\ original_http_status' = 409
    /\ step_2_out' = "cross_user_conflict_409"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_3_out, step_4_out, step_5_out >>

\* No active session at all — proceed (both modes)
Step2_NoActiveSession ==
    /\ pc = "step_1"
    /\ active_session_exists = FALSE
    /\ pc' = "done"
    /\ http_status' = 200
    /\ step_2_out' = "no_active_session_proceed"
    /\ UNCHANGED << error_state, error_code,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_3_out, step_4_out, step_5_out >>

\* ====================================================================
\* STEP 3: Error wrapping in pipeline adapter
\* BUGGY: blanket catch wraps 409 → 500
\* FIXED: preserve SessionError or map preserving status
\* ====================================================================

Step3_Buggy_WrapTo500 ==
    /\ mode = "buggy"
    /\ pc = "step_2"
    /\ original_error_code = "SESSION_ALREADY_ACTIVE"
    /\ pc' = "step_3"
    /\ wrapped_error_code' = "PIPELINE_INIT_FAILED"   \* <-- BUG: code swallowed
    /\ wrapped_http_status' = 500                       \* <-- BUG: 409 → 500
    /\ step_3_out' = "error_wrapped_to_500"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_2_out, step_4_out, step_5_out >>

Step3_Fixed_Preserve409 ==
    /\ mode = "fixed"
    /\ pc = "step_2"
    /\ original_error_code = "SESSION_ALREADY_ACTIVE"
    /\ pc' = "step_3"
    /\ wrapped_error_code' = "SESSION_ALREADY_ACTIVE"  \* <-- FIX B: preserved
    /\ wrapped_http_status' = 409                       \* <-- FIX B: preserved
    /\ step_3_out' = "error_preserved_409"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_2_out, step_4_out, step_5_out >>

\* ====================================================================
\* STEP 4: Route error handler dispatches HTTP response
\* ====================================================================

Step4_ReturnErrorResponse ==
    /\ pc = "step_3"
    /\ pc' = "step_4"
    /\ error_state' = TRUE
    /\ error_code' = wrapped_error_code
    /\ http_status' = wrapped_http_status
    /\ step_4_out' = "http_response_sent"
    /\ UNCHANGED << token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    client_sees_actionable_error,
                    step_1_out, step_2_out, step_3_out, step_5_out >>

\* ====================================================================
\* STEP 5: Client receives error
\* ====================================================================

Step5_Buggy_ClientSeesGenericError ==
    /\ mode = "buggy"
    /\ pc = "step_4"
    /\ http_status = 500
    /\ pc' = "error"
    /\ client_sees_actionable_error' = FALSE   \* <-- Client cannot act on 500
    /\ step_5_out' = "client_sees_500_generic"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    step_1_out, step_2_out, step_3_out, step_4_out >>

Step5_Fixed_ClientSeesActionableError ==
    /\ mode = "fixed"
    /\ pc = "step_4"
    /\ http_status = 409
    /\ pc' = "error"
    /\ client_sees_actionable_error' = TRUE    \* <-- Client can offer resolution
    /\ step_5_out' = "client_sees_409_actionable"
    /\ UNCHANGED << error_state, error_code, http_status,
                    token_a, token_b, derived_user_a, derived_user_b, users_collide,
                    session_owner_user_id, active_session_exists,
                    original_error_code, original_http_status,
                    wrapped_error_code, wrapped_http_status,
                    step_1_out, step_2_out, step_3_out, step_4_out >>

\* ====================================================================
\* NEXT STATE RELATION
\* ====================================================================
Next ==
    \/ Step1_Buggy_IdentityCollision
    \/ Step1_Fixed_UniqueIdentity
    \/ Step1_Error_Unauthorized
    \/ Step2_Fixed_NoCollision
    \/ Step2_Buggy_CrossUserCollision
    \/ Step2_NoActiveSession
    \/ Step3_Buggy_WrapTo500
    \/ Step3_Fixed_Preserve409
    \/ Step4_ReturnErrorResponse
    \/ Step5_Buggy_ClientSeesGenericError
    \/ Step5_Fixed_ClientSeesActionableError
    \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)

\* ====================================================================
\* PROPERTIES
\* ====================================================================

\* Fixed mode: User B always succeeds (no cross-user collision)
ReachabilityDone_Fixed == (mode = "fixed") => <>(pc = "done")

\* Buggy mode: User B gets stuck at error
ReachabilityError_Buggy == (mode = "buggy") => <>(pc = "error")

\* INV-1: DistinctTokensDistinctUsers
\* INV-2: ErrorStatusPreserved
\* INV-3: ErrorCodePreserved
\* INV-5: ClientErrorActionable

====
