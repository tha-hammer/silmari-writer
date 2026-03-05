# PATH: display-recall-state-with-record-button-and-progress-indicator

**Layer:** 3 (Function Path)
**Priority:** P0
**Version:** 1

## Trigger

User navigates to or opens the main interface while their current session/state is RECALL.

## Resource References

| UUID | Name | Role in this path |
|------|------|-------------------|
| `ui-v3n6` | module | Frontend module that controls state detection and orchestrates RECALL UI rendering. |
| `ui-x1r9` | access_control | Ensures user is permitted to view the RECALL state interface. |
| `ui-w8p2` | component | Defines and renders the record button and progress indicator UI elements. |
| `ui-y5t3` | data_loader | Supplies progress data for Anchors, Actions, and Outcomes to the UI. |
| `cfg-r3d7` | frontend_logging | Logs UI initialization, authorization, and data-loading errors. |
| `cfg-j9w2` | shared_error_definitions | Provides standardized error types for state, access, and data failures. |

## Steps

1. **Activate Recall Module**
   - Input: User navigation event to main interface; ui-v3n6 (module)
   - Process: The frontend module responsible for the main interface initializes and determines the current application state.
   - Output: Initialized module context with current state value = RECALL.
   - Error: If state cannot be determined, module falls back to a safe default state and logs via cfg-r3d7; [PROPOSED: explicit state-not-found error definition in shared_error_definitions].

2. **Validate Recall Access**
   - Input: Initialized module context with state = RECALL; ui-x1r9 (access_control)
   - Process: Access control verifies that the user is allowed to view the RECALL state interface.
   - Output: Authorization result permitting rendering of RECALL UI.
   - Error: If access is denied, user is redirected to an allowed route and an error is logged via cfg-r3d7; may reference shared error from cfg-j9w2.

3. **Compose Recall UI Components**
   - Input: Authorized RECALL state context; ui-w8p2 (component)
   - Process: The module assembles the RECALL-specific layout, including a large record button component and a progress indicator component structured around Anchors, Actions, and Outcomes.
   - Output: Rendered component tree containing record button and progress indicator placeholders.
   - Error: If a required component is missing or fails to initialize, the module displays a fallback error message component and logs via cfg-r3d7; [PROPOSED: UI component initialization error in shared_error_definitions].

4. **Populate Progress Indicator**
   - Input: Rendered RECALL component tree; ui-y5t3 (data_loader)
   - Process: The data loader retrieves or derives the current progress state for Anchors, Actions, and Outcomes and binds it to the progress indicator component.
   - Output: Progress indicator displays current completion or step status for Anchors, Actions, and Outcomes.
   - Error: If progress data retrieval fails, the indicator displays a neutral or empty state and logs the failure via cfg-r3d7; may reference shared error from cfg-j9w2.

5. **Display Prominent Record Button**
   - Input: Rendered RECALL component tree with state-bound properties; ui-w8p2 (component)
   - Process: The record button component is styled and configured to appear prominently (e.g., large size, central placement) and enabled for interaction.
   - Output: User visibly sees a large, enabled record button alongside the populated progress indicator.
   - Error: If styling or configuration fails, button falls back to default styling but remains visible; error is logged via cfg-r3d7.

## Terminal Condition

User sees the RECALL interface with a prominent record button and a visible progress indicator showing Anchors, Actions, and Outcomes.

## Feedback Loops

None — strictly linear.

## Current Runtime Wiring (2026-03-04)

- The RECALL UI renders question progression (`Question X of Y`) from local `questionProgress` state and binds active prompt text from that state.
- Progression is synchronized through `/api/session/voice-turns` with action `advance_question`.
- `ui-y5t3` currently fetches `/api/recall/progress?sessionId=<uuid>` and does not send a source discriminator.
- The progress API computes Anchors/Actions/Outcomes from `story_records.content + story_records.responses`.
- Progress lookup uses `SessionDAO.findStoryRecordBySessionId(sessionId)`, which is an alias to a `voice_session_id` lookup path.
- On retrieval failure or missing record, the UI renders a neutral progress state (`anchors/actions/outcomes = 0`).
