# TDD Writing Agent Backend - Plan Analysis

## Overview of Findings

This document summarizes the key architectural decisions, patterns, and implementation details from the TDD plan for the Writing Agent Backend API (`2026-01-10-tdd-writing-agent-backend.md`).

The plan outlines a FastAPI backend following TDD principles (Red-Green-Refactor) to support:
- File upload/attachment handling
- Conversation CRUD operations
- Audio transcription via OpenAI Whisper
- Theme extraction from text
- Content generation via LLM

## Key Details and Patterns Discovered

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | FastAPI | Async-native, automatic OpenAPI docs, Pydantic integration |
| Test Framework | pytest + pytest-asyncio | Industry standard for Python async testing |
| Database (Dev) | In-memory dict stores | Simplicity for initial implementation |
| Database (Prod) | PostgreSQL (future) | Scalability, full SQL support |
| LLM Provider | OpenAI (GPT-4, Whisper) | API simplicity, proven reliability |

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/files/upload` | POST | Upload file attachment |
| `/api/files/{id}` | GET | Get file metadata |
| `/api/conversations` | GET/POST | List/Create conversations |
| `/api/conversations/{id}` | GET/PUT/DELETE | CRUD single conversation |
| `/api/transcribe` | POST | Audio transcription via Whisper |
| `/api/themes/extract` | POST | Extract themes from text |
| `/api/generate` | POST | Generate content from themes+prompt |

### TDD Pattern Applied

Each behavior follows the same structure:

1. **Test Specification**: Given/When/Then format with edge cases
2. **Red Phase**: Write failing tests first
3. **Green Phase**: Minimal implementation to pass
4. **Refactor Phase**: Improve code (deferred to decomposition step)

### Testing Strategy

```python
# Test client pattern used throughout
async with AsyncClient(
    transport=ASGITransport(app=app), base_url="http://test"
) as client:
    response = await client.get("/health")
```

**Key Testing Practices**:
- `httpx.AsyncClient` for async endpoint testing
- Mocking OpenAI API calls for transcription/generation tests
- Auto-clearing in-memory stores via `conftest.py` fixture
- Each test is isolated and independent

### Data Models

```python
# Core models identified
FileMetadata(id, filename, content_type, size)
Message(id, role, content, created_at, attachments)
Conversation(id, title, created_at, updated_at, messages)
Theme(name, confidence)
```

### Error Handling Pattern

| Scenario | HTTP Status | Detail |
|----------|-------------|--------|
| Empty file | 400 | "Empty file not allowed" |
| Missing required field | 422 | FastAPI validation error |
| Resource not found | 404 | "Resource not found" |
| Invalid content type | 400 | "Invalid content type..." |
| External API failure | 500 | "Service failed: {error}" |

## Code Examples

### Fixture for Test Isolation

```python
# conftest.py
@pytest.fixture(autouse=True)
def clear_stores():
    """Clear in-memory stores before each test."""
    file_store.clear()
    conversation_store.clear()
    yield
    file_store.clear()
    conversation_store.clear()
```

### Mocking External Services

```python
from unittest.mock import patch, AsyncMock

mock_transcription = AsyncMock(return_value={"text": "Hello, this is a test."})

with patch("backend.app.transcribe_audio", mock_transcription):
    # Test code here
```

### Audio Content Type Validation

```python
AUDIO_CONTENT_TYPES = [
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
]
```

## Dependencies

```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
openai>=1.0.0
httpx>=0.26.0
pytest>=7.4.0
pytest-asyncio>=0.23.0
```

## Project Structure

```
backend/
├── __init__.py
├── app.py              # All endpoints (single file initially)
├── requirements.txt
├── pyproject.toml
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_health.py
    ├── test_files.py
    ├── test_conversations.py
    ├── test_transcription.py
    ├── test_themes.py
    └── test_generation.py
```

## Implementation Timeline

| Step | Time | Description |
|------|------|-------------|
| Setup | 5 min | Directory structure, config files |
| Behavior 1 | 10 min | Health check endpoint |
| Behaviors 2-3 | 20 min | File upload/retrieval |
| Behaviors 4-8 | 30 min | Conversation CRUD |
| Behavior 9 | 20 min | Audio transcription |
| Behavior 10 | 20 min | Theme extraction |
| Behavior 11 | 20 min | Content generation |
| Integration | 15 min | Full workflow tests |
| **Total** | ~2.5 hrs | |

## Open Questions That Remain

1. **Database Migration**: When to transition from in-memory stores to SQLite/PostgreSQL? What ORM (if any) to use?

2. **Authentication**: Plan explicitly excludes auth - when should this be added? JWT vs session-based?

3. **Rate Limiting**: No rate limiting specified - critical for LLM endpoints to control costs

4. **File Storage**: Currently storing to `./uploads` directory - should move to cloud storage (S3, etc.) for production

5. **LLM Provider Flexibility**: Hardcoded to OpenAI - should consider abstraction layer for Claude/other providers

6. **Streaming Responses**: Content generation endpoint returns full response - should consider SSE for streaming

7. **Message Handling**: Conversation model has messages array but no endpoints to add/modify messages directly

8. **Cost Tracking**: No mechanism to track LLM API costs per request/user

9. **Error Recovery**: What happens if transcription/generation partially fails? No retry logic specified

10. **Caching**: Theme extraction and transcription could benefit from caching identical inputs

## Related Documents

- Research: `2026-01-09-building-writing-agent-ui.md`
- UI Phase Plans: `thoughts/searchable/plans/2026-01-10-tdd-writing-agent-ui-*.md`
