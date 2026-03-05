# PATH: process-voice-input-and-progress-session

**Layer:** 3 (Function Path)
**Priority:** P0
**Version:** 1

## Trigger

User provides voice input during an active voice-assisted session in INIT state

## Resource References

| UUID | Name | Role in this path |
|------|------|-------------------|
| `ui-w8p2` | component | Captures voice input and renders updated session and StoryRecord |
| `api-q7v1` | frontend_api_contract | Defines typed contract for submitting voice responses to backend |
| `api-m5g7` | endpoint | Receives voice response submission requests |
| `api-n8k2` | request_handler | Validates and routes voice response requests to backend service |
| `db-h2s4` | service | Orchestrates business logic for session progression and StoryRecord updates |
| `db-b7r2` | processor | Processes voice response content and determines next session state |
| `db-d3w8` | data_access_object | Persists session state changes and StoryRecord updates |
| `db-l1c3` | backend_error_definitions | Defines backend domain and validation errors |
| `cfg-j9w2` | shared_error_definitions | Provides standardized cross-layer error types |
| `cfg-q9c5` | backend_logging | Logs backend processing and persistence failures |
| `cfg-r3d7` | frontend_logging | Logs frontend state update and rendering issues |
| `ui-y5t3` | data_loader | Bridges backend response data to frontend state management |

## Steps

1. **Capture voice input**
   - Input: Voice audio stream from user within active session context in INIT state via ui-w8p2 (component)
   - Process: The frontend component captures the user's spoken input, associates it with the active session identifier, and prepares a structured request payload.
   - Output: Structured voice input payload containing session ID and audio/transcribed content ready for submission
   - Error: If no active session is found or microphone access fails, display an error notification and prevent submission.

2. **Submit voice response to backend endpoint**
   - Input: Structured voice input payload sent through api-q7v1 (frontend_api_contract) to api-m5g7 (endpoint)
   - Process: The frontend sends the voice response payload to the backend endpoint responsible for processing session answers.
   - Output: HTTP request received by backend endpoint with session ID and captured response data
   - Error: If network or authorization fails, return an appropriate error from cfg-j9w2 (shared_error_definitions) and display a user-visible error message.

3. **Handle and validate request**
   - Input: Incoming HTTP request at api-m5g7 (endpoint) routed to api-n8k2 (request_handler)
   - Process: The request handler validates session state (must be INIT or valid intermediate state), verifies payload structure, and forwards the request to the appropriate backend service for orchestration.
   - Output: Validated command to process and store voice response for the active session
   - Error: If session is not in a valid state or payload is invalid, raise a domain error using db-l1c3 (backend_error_definitions) and return a failure response.

4. **Process response and update session**
   - Input: Validated command received by db-h2s4 (service) coordinating db-b7r2 (processor) and db-d3w8 (data_access_object)
   - Process: The service orchestrates processing of the voice response, determines the next session state, updates the session entity and associated StoryRecord in persistent storage.
   - Output: Persisted StoryRecord with new answers and session state transitioned to the next intermediate state
   - Error: If persistence fails or state transition rules are violated, log via cfg-q9c5 (backend_logging), raise an error from db-l1c3 (backend_error_definitions), and return failure to the caller.

5. **Return updated session to frontend**
   - Input: Updated session and StoryRecord data from db-d3w8 (data_access_object) returned through db-h2s4 (service) to api-n8k2 (request_handler)
   - Process: The backend constructs a response containing the updated session state and StoryRecord snapshot and sends it back through the endpoint to the frontend.
   - Output: HTTP success response with updated session state and StoryRecord data
   - Error: If response construction fails, return a standardized error from cfg-j9w2 (shared_error_definitions) and log the incident.

6. **Update UI with progressed session**
   - Input: Successful HTTP response consumed via api-q7v1 (frontend_api_contract) by ui-y5t3 (data_loader) and rendered in ui-w8p2 (component)
   - Process: The frontend updates local session state, reflects the new intermediate state, and displays the captured answers within the StoryRecord view.
   - Output: User interface shows progressed session state and updated StoryRecord with captured answers
   - Error: If UI state update fails, log via cfg-r3d7 (frontend_logging) and display a recoverable error message prompting page refresh.

## Terminal Condition

User sees the session advance from INIT to the next state with their spoken answers reflected in the updated StoryRecord in the UI

## Feedback Loops

If voice transcription or processing fails, the system prompts the user to retry voice input, with a maximum of 2 retries before surfacing an error message.

## Current Runtime Wiring (2026-03-04)

- `api-n8k2` accepts `INIT`, `IN_PROGRESS`, and `RECALL` for `answer_sessions`.
- When the same `sessionId` resolves to a prep/session workflow, `api-n8k2` returns an invalid-state error directing callers to `/api/session/voice-turns` for Recall persistence.
- Question index progression for Recall prompts is not persisted through `/api/session/voice-response`; it is persisted through `/api/session/voice-turns` action `advance_question`.
