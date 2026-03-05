# PATH: complete-voice-answer-advances-workflow

**Layer:** 3 (Function Path)
**Priority:** P0
**Version:** 1

## Trigger

User provides a complete spoken answer during an active voice interaction for a specific question_type

## Resource References

| UUID | Name | Role in this path |
|------|------|-------------------|
| `cfg-d2q3` | common_structure | Defines shared slot structures and question_type schema used for extraction and validation. |
| `cfg-h5v9` | transformer | Transforms transcribed text into structured slot-value objects. |
| `cfg-g1u4` | shared_verifier | Validates that minimum required slots are filled and values meet constraints. |
| `cfg-j9w2` | shared_error_definitions | Provides standardized error codes for transcription, transformation, and validation failures. |
| `db-h2s4` | service | Orchestrates business logic for marking question_type complete and coordinating persistence. |
| `db-d3w8` | data_access_object | Persists completed slot values and updates session state in the database. |
| `db-l1c3` | backend_error_definitions | Defines backend-specific errors for persistence and workflow transition failures. |
| `mq-r4z8` | backend_process_chain | Determines and executes the next step in the workflow once slots are complete. |
| `ui-w8p2` | component | Frontend voice interaction component that renders and vocalizes the next workflow step. |
| `cfg-r3d7` | frontend_logging | Logs frontend rendering or playback issues during prompt delivery. |

## Steps

1. **Capture spoken answer**
   - Input: Active voice interaction context for a specific question_type; raw audio input from user
   - Process: Convert the spoken audio into structured textual input and attach it to the current interaction session.
   - Output: Transcribed user response associated with the active question_type session context.
   - Error: If transcription fails or audio is empty, raise a voice input processing error using cfg-j9w2 and re-prompt the user (counts toward the 3-attempt limit).

2. **Extract slot values from response**
   - Input: Transcribed user response; shared slot data definitions (cfg-d2q3); transformation rules (cfg-h5v9)
   - Process: Identify and map entities in the response to the defined slots for the active question_type, producing a structured slot-value payload.
   - Output: Structured slot-value object representing extracted values for the question_type.
   - Error: If transformation fails due to malformed input, raise a structured transformation error via cfg-j9w2 and trigger a clarification prompt (within 3-attempt limit).

3. **Validate minimum required slots**
   - Input: Structured slot-value object; shared validation rules (cfg-g1u4); slot definitions (cfg-d2q3)
   - Process: Evaluate whether all minimum required slots for the current question_type are present and valid.
   - Output: Validation result indicating either all required slots satisfied or list of missing/invalid slots.
   - Error: If validation fails, generate a validation error using cfg-j9w2 and initiate a targeted follow-up prompt for missing slots (within 3-attempt limit).

4. **Persist completed slot set**
   - Input: Validated slot-value object; backend service orchestration (db-h2s4); data access object (db-d3w8)
   - Process: Store the completed slot values in the backend conversation/session record and mark the question_type as completed.
   - Output: Updated session state with question_type marked complete and slots persisted.
   - Error: If persistence fails, raise a backend error using db-l1c3 and notify the user of a temporary issue while preventing workflow advancement.

5. **Advance workflow to next step**
   - Input: Updated session state; backend process chain definition (mq-r4z8)
   - Process: Determine and activate the next step in the workflow, explicitly disabling further iterative questioning for the completed question_type.
   - Output: Next workflow step activated and response payload prepared for user.
   - Error: If next step resolution fails, emit a workflow transition error via db-l1c3 and halt progression.

6. **Deliver next prompt to user**
   - Input: Next-step response payload; frontend component responsible for voice interaction (ui-w8p2)
   - Process: Render and vocalize the next step prompt, signaling that no further questions are needed for the previous question_type.
   - Output: User hears the new prompt and sees updated UI state reflecting progression to the next workflow step.
   - Error: If UI rendering or audio playback fails, log via cfg-r3d7 and present a fallback text prompt to maintain user visibility.

## Terminal Condition

User hears the system stop follow-up slot questions for the current question_type and begin the next step in the workflow (e.g., next question or confirmation prompt)

## Feedback Loops

If minimum required slots are not satisfied after parsing, the system re-prompts for missing slots with a maximum of 3 iterative clarification attempts before emitting a validation error and halting progression.

## Current Runtime Wiring (2026-03-04)

- The Recall UI listens for transcript phrases such as `next question`, `move on`, and `let's continue` from realtime transcription events.
- Detected move-on intent currently presents a stop-state panel and guidance copy.
- Progression to the next question is currently executed from an explicit user action (`Next question` / `Finish to Review`) in stop-state controls, which calls `/api/session/voice-turns` action `advance_question`.
