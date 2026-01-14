# Phase 05: The system must provide theme extraction and conte...

## Requirements

### REQ_004: The system must provide theme extraction and content generat

The system must provide theme extraction and content generation capabilities via LLM integration

#### REQ_004.1: Implement POST /api/themes/extract endpoint that accepts tex

Implement POST /api/themes/extract endpoint that accepts text input and returns extracted themes with confidence scores using LLM analysis

##### Testable Behaviors

1. Endpoint accepts JSON body with 'text' field (string, required)
2. Returns 422 validation error if 'text' field is missing or empty
3. Returns array of Theme objects, each containing 'name' (string) and 'confidence' (float 0.0-1.0)
4. Themes are extracted using OpenAI GPT-4 API with structured prompt
5. Returns empty array when no themes can be extracted from text
6. Returns 500 error with detail 'Service failed: {error}' when OpenAI API fails
7. Confidence scores reflect LLM's certainty about each theme (normalized 0-1)
8. Response time is reasonable (<10 seconds for typical text lengths)
9. Endpoint is async and non-blocking
10. OpenAI API calls are mocked in tests using AsyncMock pattern

#### REQ_004.2: Implement POST /api/generate endpoint that generates content

Implement POST /api/generate endpoint that generates content based on provided themes and user prompt using LLM

##### Testable Behaviors

1. Endpoint accepts JSON body with 'themes' (array of Theme objects) and 'prompt' (string) fields
2. Returns 422 validation error if 'prompt' field is missing or empty
3. Returns 422 validation error if 'themes' array is empty
4. Returns generated content as JSON with 'content' field (string)
5. Generated content incorporates all provided themes naturally
6. Prompt is passed to LLM along with theme context for generation
7. Returns 500 error with detail 'Service failed: {error}' when OpenAI API fails
8. Supports various content types (essays, stories, summaries) based on prompt
9. Response includes metadata like token count or generation time (optional)
10. Endpoint is async and non-blocking
11. OpenAI API calls are mocked in tests using AsyncMock pattern

#### REQ_004.3: Define and implement Theme Pydantic model with name and conf

Define and implement Theme Pydantic model with name and confidence score fields for use across theme extraction and generation endpoints

##### Testable Behaviors

1. Theme model has 'name' field of type string (required, non-empty)
2. Theme model has 'confidence' field of type float (required, range 0.0 to 1.0)
3. Confidence field validates that value is between 0.0 and 1.0 inclusive
4. Model serializes to JSON correctly for API responses
5. Model deserializes from JSON correctly for API requests
6. Model provides clear validation error messages for invalid data
7. Model is importable from shared location for use in both endpoints
8. Model supports equality comparison for testing purposes
9. Model has sensible __repr__ for debugging

#### REQ_004.4: Integrate with OpenAI GPT-4 API for both theme extraction an

Integrate with OpenAI GPT-4 API for both theme extraction and content generation LLM operations with proper client configuration and error handling

##### Testable Behaviors

1. OpenAI client is initialized with API key from environment variable
2. API key is not hardcoded or exposed in logs
3. Client supports async operations using openai>=1.0.0 SDK
4. GPT-4 model is used for both extraction and generation (configurable)
5. API calls include appropriate timeout settings
6. Failed API calls raise descriptive errors that map to HTTP 500 responses
7. Rate limit errors from OpenAI are handled gracefully
8. Network errors are caught and converted to service errors
9. Client is mockable for unit testing without real API calls
10. Temperature and other model parameters are configurable
11. Token usage is logged for cost monitoring (preparation for future tracking)


## Success Criteria

- [ ] All tests pass
- [ ] All behaviors implemented
- [ ] Code reviewed