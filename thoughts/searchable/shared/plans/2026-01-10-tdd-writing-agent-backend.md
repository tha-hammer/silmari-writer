# Writing Agent Backend API - TDD Implementation Plan

## Overview

Build a FastAPI backend for the writing agent that supports:
- File upload/attachment handling
- Conversation CRUD operations
- Audio transcription via OpenAI Whisper
- Theme extraction from text
- Content generation via LLM

This plan follows TDD principles: write failing tests first, implement minimal code to pass, then refactor.

## Current State Analysis

### What Exists
- Research document: `2026-01-09-building-writing-agent-ui.md`
- Existing phase plans in `thoughts/searchable/plans/`
- No backend code implemented yet
- No test framework configured

### Key Discoveries
- Greenfield project - no existing Python/TS code
- Planning documents specify FastAPI + SvelteKit architecture
- OpenAI Whisper API for transcription
- SQLite for dev, PostgreSQL for production

### Constraints
- Test framework: pytest + pytest-asyncio
- Frontend test framework: vitest (for later phases)
- Single consolidated file (will decompose in future step)

## Desired End State

A fully-tested FastAPI backend with:
1. Health check endpoint
2. File upload and retrieval
3. Conversation CRUD operations
4. Audio transcription service
5. Theme extraction service
6. Content generation service

### Observable Behaviors
- Given a running server, when GET /health, then returns {"status": "ok"}
- Given a file, when POST /api/files/upload, then returns file metadata with ID
- Given a conversation payload, when POST /api/conversations, then creates and returns conversation
- Given an audio file, when POST /api/transcribe, then returns transcribed text
- Given text input, when POST /api/themes/extract, then returns identified themes
- Given themes and prompt, when POST /api/generate, then returns generated content

## What We're NOT Doing

- Frontend implementation (Phase 3)
- Deployment configuration
- Production database setup
- Authentication/authorization
- Rate limiting
- Caching layer

## Testing Strategy

- **Framework**: pytest + pytest-asyncio
- **Test Types**: Unit tests for each endpoint behavior
- **Mocking/Setup**:
  - httpx.AsyncClient for FastAPI testing
  - Mock OpenAI API calls for transcription tests
  - In-memory SQLite for database tests
- **Test Location**: `backend/tests/`

---

## Behavior 1: Health Check Endpoint

### Test Specification

**Given**: The FastAPI server is running
**When**: A GET request is made to /health
**Then**: Returns 200 OK with {"status": "ok"}

**Edge Cases**: None - this is the simplest possible endpoint

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_health.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_health_check_returns_ok():
    """Given server running, when GET /health, then returns status ok."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

#### Green: Minimal Implementation

**File**: `backend/app.py`

```python
from fastapi import FastAPI

app = FastAPI(title="Writing Agent API")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
```

#### Refactor: Improve Code

No refactoring needed - implementation is already minimal.

### Success Criteria

**Automated:**
- [ ] Test fails initially (Red): `pytest backend/tests/test_health.py -v`
- [ ] Test passes after implementation (Green): `pytest backend/tests/test_health.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`

---

## Behavior 2: File Upload Endpoint

### Test Specification

**Given**: A file to upload
**When**: POST /api/files/upload with multipart form data
**Then**: Returns 201 Created with file metadata (id, filename, content_type, size)

**Edge Cases**:
- Empty file upload returns 400 Bad Request
- Missing file parameter returns 422 Unprocessable Entity

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_files.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app
import io


@pytest.mark.asyncio
async def test_upload_file_returns_metadata():
    """Given a file, when POST /api/files/upload, then returns file metadata."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("test.txt", io.BytesIO(b"Hello, World!"), "text/plain")}
        response = await client.post("/api/files/upload", files=files)

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["filename"] == "test.txt"
    assert data["content_type"] == "text/plain"
    assert data["size"] == 13


@pytest.mark.asyncio
async def test_upload_empty_file_returns_400():
    """Given empty file, when POST /api/files/upload, then returns 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
        response = await client.post("/api/files/upload", files=files)

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_missing_file_returns_422():
    """Given no file, when POST /api/files/upload, then returns 422."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/files/upload")

    assert response.status_code == 422
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import uuid
import os

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class FileMetadata(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int


@app.post("/api/files/upload", response_model=FileMetadata, status_code=201)
async def upload_file(file: UploadFile = File(...)):
    """Upload a file attachment."""
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, file_id)

    with open(file_path, "wb") as f:
        f.write(content)

    return FileMetadata(
        id=file_id,
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
    )
```

#### Refactor: Improve Code

Extract file storage logic to a service class (future refactor when decomposing).

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_files.py -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_files.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] `curl -X POST http://localhost:8000/api/files/upload -F "file=@test.txt"` returns file metadata

---

## Behavior 3: Get File Metadata Endpoint

### Test Specification

**Given**: A previously uploaded file ID
**When**: GET /api/files/{id}
**Then**: Returns 200 OK with file metadata

**Edge Cases**:
- Non-existent file ID returns 404 Not Found

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_files.py` (add to existing)

```python
@pytest.mark.asyncio
async def test_get_file_returns_metadata():
    """Given uploaded file, when GET /api/files/{id}, then returns metadata."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # First upload a file
        files = {"file": ("test.txt", io.BytesIO(b"Hello!"), "text/plain")}
        upload_response = await client.post("/api/files/upload", files=files)
        file_id = upload_response.json()["id"]

        # Then retrieve it
        response = await client.get(f"/api/files/{file_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == file_id
    assert data["filename"] == "test.txt"


@pytest.mark.asyncio
async def test_get_nonexistent_file_returns_404():
    """Given invalid file ID, when GET /api/files/{id}, then returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/files/nonexistent-id")

    assert response.status_code == 404
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
# In-memory file metadata store (will move to database later)
file_store: dict[str, FileMetadata] = {}


@app.post("/api/files/upload", response_model=FileMetadata, status_code=201)
async def upload_file(file: UploadFile = File(...)):
    """Upload a file attachment."""
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, file_id)

    with open(file_path, "wb") as f:
        f.write(content)

    metadata = FileMetadata(
        id=file_id,
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
    )
    file_store[file_id] = metadata
    return metadata


@app.get("/api/files/{file_id}", response_model=FileMetadata)
async def get_file(file_id: str):
    """Get file metadata by ID."""
    if file_id not in file_store:
        raise HTTPException(status_code=404, detail="File not found")
    return file_store[file_id]
```

#### Refactor: Improve Code

No refactoring needed yet - will extract to repository pattern when adding database.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_files.py::test_get_file_returns_metadata -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_files.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] Upload file, then GET /api/files/{id} returns metadata

---

## Behavior 4: Create Conversation Endpoint

### Test Specification

**Given**: A conversation title
**When**: POST /api/conversations with JSON body
**Then**: Returns 201 Created with conversation object (id, title, created_at, messages=[])

**Edge Cases**:
- Missing title returns 422 Unprocessable Entity
- Empty title returns 400 Bad Request

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_conversations.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app


@pytest.mark.asyncio
async def test_create_conversation_returns_conversation():
    """Given title, when POST /api/conversations, then returns conversation."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/conversations",
            json={"title": "Test Conversation"}
        )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["title"] == "Test Conversation"
    assert "created_at" in data
    assert data["messages"] == []


@pytest.mark.asyncio
async def test_create_conversation_empty_title_returns_400():
    """Given empty title, when POST /api/conversations, then returns 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/conversations",
            json={"title": ""}
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_conversation_missing_title_returns_422():
    """Given no title, when POST /api/conversations, then returns 422."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/conversations", json={})

    assert response.status_code == 422
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
from datetime import datetime
from typing import Optional


class Message(BaseModel):
    id: str
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime
    attachments: list[str] = []


class Conversation(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: list[Message] = []


class CreateConversationRequest(BaseModel):
    title: str


# In-memory conversation store
conversation_store: dict[str, Conversation] = {}


@app.post("/api/conversations", response_model=Conversation, status_code=201)
async def create_conversation(request: CreateConversationRequest):
    """Create a new conversation."""
    if not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    conversation_id = str(uuid.uuid4())
    conversation = Conversation(
        id=conversation_id,
        title=request.title,
        created_at=datetime.utcnow(),
        messages=[],
    )
    conversation_store[conversation_id] = conversation
    return conversation
```

#### Refactor: Improve Code

No refactoring needed - will extract models to separate file when decomposing.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_conversations.py::test_create_conversation_returns_conversation -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_conversations.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] `curl -X POST http://localhost:8000/api/conversations -H "Content-Type: application/json" -d '{"title": "Test"}'` returns conversation

---

## Behavior 5: List Conversations Endpoint

### Test Specification

**Given**: Multiple conversations exist
**When**: GET /api/conversations
**Then**: Returns 200 OK with array of conversations

**Edge Cases**:
- No conversations returns empty array

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_conversations.py` (add to existing)

```python
@pytest.mark.asyncio
async def test_list_conversations_returns_array():
    """Given conversations exist, when GET /api/conversations, then returns array."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Create two conversations
        await client.post("/api/conversations", json={"title": "First"})
        await client.post("/api/conversations", json={"title": "Second"})

        response = await client.get("/api/conversations")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    titles = [c["title"] for c in data]
    assert "First" in titles
    assert "Second" in titles


@pytest.mark.asyncio
async def test_list_conversations_empty_returns_empty_array():
    """Given no conversations, when GET /api/conversations, then returns []."""
    # Clear store for this test
    from backend.app import conversation_store
    conversation_store.clear()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/conversations")

    assert response.status_code == 200
    assert response.json() == []
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
@app.get("/api/conversations", response_model=list[Conversation])
async def list_conversations():
    """List all conversations."""
    return list(conversation_store.values())
```

#### Refactor: Improve Code

No refactoring needed.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_conversations.py::test_list_conversations_returns_array -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_conversations.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] `curl http://localhost:8000/api/conversations` returns array

---

## Behavior 6: Get Single Conversation Endpoint

### Test Specification

**Given**: A conversation ID
**When**: GET /api/conversations/{id}
**Then**: Returns 200 OK with conversation object

**Edge Cases**:
- Non-existent ID returns 404 Not Found

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_conversations.py` (add to existing)

```python
@pytest.mark.asyncio
async def test_get_conversation_returns_conversation():
    """Given conversation ID, when GET /api/conversations/{id}, then returns it."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Create conversation
        create_response = await client.post(
            "/api/conversations",
            json={"title": "Get Test"}
        )
        conv_id = create_response.json()["id"]

        response = await client.get(f"/api/conversations/{conv_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == conv_id
    assert data["title"] == "Get Test"


@pytest.mark.asyncio
async def test_get_nonexistent_conversation_returns_404():
    """Given invalid ID, when GET /api/conversations/{id}, then returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/conversations/nonexistent-id")

    assert response.status_code == 404
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """Get a conversation by ID."""
    if conversation_id not in conversation_store:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_store[conversation_id]
```

#### Refactor: Improve Code

No refactoring needed.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_conversations.py::test_get_conversation_returns_conversation -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_conversations.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] Create conversation, then GET by ID returns it

---

## Behavior 7: Update Conversation Endpoint

### Test Specification

**Given**: A conversation ID and updated title
**When**: PUT /api/conversations/{id}
**Then**: Returns 200 OK with updated conversation, updated_at is set

**Edge Cases**:
- Non-existent ID returns 404 Not Found
- Empty title returns 400 Bad Request

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_conversations.py` (add to existing)

```python
@pytest.mark.asyncio
async def test_update_conversation_updates_title():
    """Given conversation, when PUT with new title, then updates it."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Create conversation
        create_response = await client.post(
            "/api/conversations",
            json={"title": "Original"}
        )
        conv_id = create_response.json()["id"]

        response = await client.put(
            f"/api/conversations/{conv_id}",
            json={"title": "Updated"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated"
    assert data["updated_at"] is not None


@pytest.mark.asyncio
async def test_update_nonexistent_conversation_returns_404():
    """Given invalid ID, when PUT /api/conversations/{id}, then returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.put(
            "/api/conversations/nonexistent-id",
            json={"title": "New"}
        )

    assert response.status_code == 404
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
class UpdateConversationRequest(BaseModel):
    title: str


@app.put("/api/conversations/{conversation_id}", response_model=Conversation)
async def update_conversation(conversation_id: str, request: UpdateConversationRequest):
    """Update a conversation."""
    if conversation_id not in conversation_store:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    conversation = conversation_store[conversation_id]
    conversation.title = request.title
    conversation.updated_at = datetime.utcnow()
    return conversation
```

#### Refactor: Improve Code

No refactoring needed.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_conversations.py::test_update_conversation_updates_title -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_conversations.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] Create conversation, PUT with new title, verify update

---

## Behavior 8: Delete Conversation Endpoint

### Test Specification

**Given**: A conversation ID
**When**: DELETE /api/conversations/{id}
**Then**: Returns 204 No Content, conversation is removed

**Edge Cases**:
- Non-existent ID returns 404 Not Found

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_conversations.py` (add to existing)

```python
@pytest.mark.asyncio
async def test_delete_conversation_removes_it():
    """Given conversation, when DELETE, then removes it."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Create conversation
        create_response = await client.post(
            "/api/conversations",
            json={"title": "To Delete"}
        )
        conv_id = create_response.json()["id"]

        # Delete it
        delete_response = await client.delete(f"/api/conversations/{conv_id}")
        assert delete_response.status_code == 204

        # Verify it's gone
        get_response = await client.get(f"/api/conversations/{conv_id}")
        assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_conversation_returns_404():
    """Given invalid ID, when DELETE, then returns 404."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete("/api/conversations/nonexistent-id")

    assert response.status_code == 404
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
from fastapi import Response


@app.delete("/api/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str):
    """Delete a conversation."""
    if conversation_id not in conversation_store:
        raise HTTPException(status_code=404, detail="Conversation not found")

    del conversation_store[conversation_id]
    return Response(status_code=204)
```

#### Refactor: Improve Code

No refactoring needed.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_conversations.py::test_delete_conversation_removes_it -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_conversations.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] Create conversation, DELETE it, verify GET returns 404

---

## Behavior 9: Audio Transcription Endpoint

### Test Specification

**Given**: An audio file (webm, mp3, wav)
**When**: POST /api/transcribe
**Then**: Returns 200 OK with transcribed text

**Edge Cases**:
- Non-audio file returns 400 Bad Request
- Empty file returns 400 Bad Request
- Whisper API error returns 500 with error message

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_transcription.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app
from unittest.mock import patch, AsyncMock
import io


@pytest.mark.asyncio
async def test_transcribe_audio_returns_text():
    """Given audio file, when POST /api/transcribe, then returns text."""
    # Mock the OpenAI transcription
    mock_transcription = AsyncMock(return_value={"text": "Hello, this is a test."})

    with patch("backend.app.transcribe_audio", mock_transcription):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            files = {"file": ("audio.webm", io.BytesIO(b"fake audio data"), "audio/webm")}
            response = await client.post("/api/transcribe", files=files)

    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "Hello, this is a test."


@pytest.mark.asyncio
async def test_transcribe_non_audio_returns_400():
    """Given non-audio file, when POST /api/transcribe, then returns 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("document.pdf", io.BytesIO(b"pdf data"), "application/pdf")}
        response = await client.post("/api/transcribe", files=files)

    assert response.status_code == 400
    assert "audio" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_transcribe_empty_file_returns_400():
    """Given empty file, when POST /api/transcribe, then returns 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        files = {"file": ("audio.webm", io.BytesIO(b""), "audio/webm")}
        response = await client.post("/api/transcribe", files=files)

    assert response.status_code == 400
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
import openai
import tempfile


AUDIO_CONTENT_TYPES = [
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
]


class TranscriptionResponse(BaseModel):
    text: str


async def transcribe_audio(file_path: str) -> dict:
    """Transcribe audio using OpenAI Whisper API."""
    client = openai.AsyncOpenAI()
    with open(file_path, "rb") as audio_file:
        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )
    return {"text": transcript.text}


@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe(file: UploadFile = File(...)):
    """Transcribe audio file to text using Whisper."""
    content = await file.read()

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")

    if file.content_type not in AUDIO_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type. Expected audio file, got {file.content_type}"
        )

    # Save to temp file for OpenAI API
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await transcribe_audio(tmp_path)
        return TranscriptionResponse(text=result["text"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        os.unlink(tmp_path)
```

#### Refactor: Improve Code

Extract transcription service to separate module when decomposing.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_transcription.py -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_transcription.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] Upload real audio file, verify transcription returned

---

## Behavior 10: Theme Extraction Endpoint

### Test Specification

**Given**: Text input
**When**: POST /api/themes/extract
**Then**: Returns 200 OK with list of extracted themes

**Edge Cases**:
- Empty text returns 400 Bad Request
- Very short text (< 10 chars) returns themes array (may be empty)

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_themes.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_extract_themes_returns_themes():
    """Given text, when POST /api/themes/extract, then returns themes."""
    mock_extract = AsyncMock(return_value={
        "themes": [
            {"name": "Technology", "confidence": 0.9},
            {"name": "Innovation", "confidence": 0.8}
        ]
    })

    with patch("backend.app.extract_themes_from_text", mock_extract):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/themes/extract",
                json={"text": "This is about AI and technology innovation."}
            )

    assert response.status_code == 200
    data = response.json()
    assert "themes" in data
    assert len(data["themes"]) == 2
    assert data["themes"][0]["name"] == "Technology"


@pytest.mark.asyncio
async def test_extract_themes_empty_text_returns_400():
    """Given empty text, when POST /api/themes/extract, then returns 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/themes/extract", json={"text": ""})

    assert response.status_code == 400
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
class Theme(BaseModel):
    name: str
    confidence: float


class ThemeExtractionRequest(BaseModel):
    text: str


class ThemeExtractionResponse(BaseModel):
    themes: list[Theme]


async def extract_themes_from_text(text: str) -> dict:
    """Extract themes using LLM (Claude/GPT-4)."""
    client = openai.AsyncOpenAI()
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": "Extract key themes from the text. Return JSON with 'themes' array containing objects with 'name' and 'confidence' (0-1) fields."
            },
            {"role": "user", "content": text}
        ],
        response_format={"type": "json_object"}
    )
    import json
    return json.loads(response.choices[0].message.content)


@app.post("/api/themes/extract", response_model=ThemeExtractionResponse)
async def extract_themes(request: ThemeExtractionRequest):
    """Extract themes from text input."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        result = await extract_themes_from_text(request.text)
        return ThemeExtractionResponse(themes=[Theme(**t) for t in result["themes"]])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Theme extraction failed: {str(e)}")
```

#### Refactor: Improve Code

Extract LLM service to separate module when decomposing.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_themes.py -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_themes.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] POST text, verify themes returned

---

## Behavior 11: Content Generation Endpoint

### Test Specification

**Given**: Themes and user prompt
**When**: POST /api/generate
**Then**: Returns 200 OK with generated content

**Edge Cases**:
- Empty themes array generates based on prompt only
- Empty prompt returns 400 Bad Request

### TDD Cycle

#### Red: Write Failing Test

**File**: `backend/tests/test_generation.py`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app import app
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_generate_content_returns_text():
    """Given themes and prompt, when POST /api/generate, then returns content."""
    mock_generate = AsyncMock(return_value={
        "content": "Generated article about technology and innovation..."
    })

    with patch("backend.app.generate_content", mock_generate):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "themes": ["Technology", "Innovation"],
                    "prompt": "Write a blog post about these themes"
                }
            )

    assert response.status_code == 200
    data = response.json()
    assert "content" in data
    assert len(data["content"]) > 0


@pytest.mark.asyncio
async def test_generate_empty_prompt_returns_400():
    """Given empty prompt, when POST /api/generate, then returns 400."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/generate",
            json={"themes": ["Tech"], "prompt": ""}
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_generate_no_themes_still_works():
    """Given empty themes, when POST /api/generate, then generates from prompt."""
    mock_generate = AsyncMock(return_value={"content": "Generated content..."})

    with patch("backend.app.generate_content", mock_generate):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/generate",
                json={"themes": [], "prompt": "Write about cats"}
            )

    assert response.status_code == 200
```

#### Green: Minimal Implementation

**File**: `backend/app.py` (add to existing)

```python
class GenerateRequest(BaseModel):
    themes: list[str] = []
    prompt: str


class GenerateResponse(BaseModel):
    content: str


async def generate_content(themes: list[str], prompt: str) -> dict:
    """Generate content using LLM (Claude/GPT-4)."""
    client = openai.AsyncOpenAI()

    theme_context = f"Key themes to address: {', '.join(themes)}" if themes else ""

    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {
                "role": "system",
                "content": f"You are a skilled writer. {theme_context}"
            },
            {"role": "user", "content": prompt}
        ]
    )
    return {"content": response.choices[0].message.content}


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Generate content based on themes and prompt."""
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        result = await generate_content(request.themes, request.prompt)
        return GenerateResponse(content=result["content"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
```

#### Refactor: Improve Code

Extract generation service to separate module when decomposing.

### Success Criteria

**Automated:**
- [ ] Tests fail initially (Red): `pytest backend/tests/test_generation.py -v`
- [ ] Tests pass after implementation (Green): `pytest backend/tests/test_generation.py -v`
- [ ] All tests pass: `pytest backend/tests/ -v`

**Manual:**
- [ ] POST with themes and prompt, verify content returned

---

## Project Setup

### Directory Structure to Create

```
backend/
├── __init__.py
├── app.py              # FastAPI application (all endpoints in single file initially)
├── requirements.txt    # Python dependencies
├── pyproject.toml      # Project configuration
└── tests/
    ├── __init__.py
    ├── conftest.py     # Pytest fixtures
    ├── test_health.py
    ├── test_files.py
    ├── test_conversations.py
    ├── test_transcription.py
    ├── test_themes.py
    └── test_generation.py
```

### requirements.txt

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

### pyproject.toml

```toml
[project]
name = "writing-agent-backend"
version = "0.1.0"
description = "FastAPI backend for Writing Agent"
requires-python = ">=3.11"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### conftest.py

```python
import pytest
from backend.app import file_store, conversation_store


@pytest.fixture(autouse=True)
def clear_stores():
    """Clear in-memory stores before each test."""
    file_store.clear()
    conversation_store.clear()
    yield
    file_store.clear()
    conversation_store.clear()
```

---

## Integration & E2E Testing

### Integration Tests

After all behaviors are implemented, add integration tests that verify the full workflow:

1. **Upload and transcribe flow**: Upload audio → Transcribe → Extract themes
2. **Conversation flow**: Create → Add messages → Generate content → Update
3. **Full writing workflow**: Record audio → Transcribe → Extract themes → Generate content

### E2E Test Ideas (Manual)

1. Start server: `uvicorn backend.app:app --reload`
2. Open Swagger UI: `http://localhost:8000/docs`
3. Test each endpoint manually
4. Verify CORS works from `http://localhost:5173`

---

## Implementation Order

1. **Setup** (5 min): Create directory structure, requirements.txt, pyproject.toml
2. **Behavior 1** (10 min): Health check - simplest endpoint
3. **Behavior 2-3** (20 min): File upload and retrieval
4. **Behavior 4-8** (30 min): Conversation CRUD
5. **Behavior 9** (20 min): Audio transcription
6. **Behavior 10** (20 min): Theme extraction
7. **Behavior 11** (20 min): Content generation
8. **Integration tests** (15 min): Full workflow tests

---

## References

- Research: `../2026-01-09-building-writing-agent-ui.md`
- Previous plans: `thoughts/searchable/plans/2026-01-10-tdd-writing-agent-ui-*.md`
- FastAPI docs: https://fastapi.tiangolo.com/
- pytest-asyncio: https://pytest-asyncio.readthedocs.io/
- OpenAI API: https://platform.openai.com/docs/api-reference
