# Phase 1: Core Backend API Server

**Date:** 2026-01-10
**Phase:** 1 of 4
**Human-Testable Function:** Can upload files and receive JSON response

## Overview

Set up FastAPI backend with basic file upload, conversation CRUD, and health check endpoints. This forms the foundation for all subsequent phases.

## Dependencies

### Requires
- None (this is the first phase)

### Blocks
- Phase 2 (Audio Transcription) - needs upload endpoint
- Phase 3 (Svelte Frontend) - needs API endpoints
- Phase 4 (Theme Extraction) - needs backend infrastructure

## Changes Required

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/app.py:1` | FastAPI application entry point |
| `backend/routers/files.py:1` | File upload endpoints |
| `backend/routers/conversations.py:1` | Conversation CRUD endpoints |
| `backend/models/conversation.py:1` | Pydantic models for conversations |
| `backend/models/file.py:1` | Pydantic models for file uploads |
| `backend/db/database.py:1` | SQLite/PostgreSQL connection |
| `backend/db/models.py:1` | SQLAlchemy ORM models |
| `backend/requirements.txt:1` | Python dependencies |
| `backend/pyproject.toml:1` | Project configuration |

### Directory Structure

```
backend/
├── app.py
├── requirements.txt
├── pyproject.toml
├── routers/
│   ├── __init__.py
│   ├── files.py
│   └── conversations.py
├── models/
│   ├── __init__.py
│   ├── conversation.py
│   └── file.py
└── db/
    ├── __init__.py
    ├── database.py
    └── models.py
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| POST | `/api/files/upload` | Upload file attachment |
| GET | `/api/files/{id}` | Get file metadata |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/{id}` | Get conversation |
| PUT | `/api/conversations/{id}` | Update conversation |
| DELETE | `/api/conversations/{id}` | Delete conversation |

### Key Code Patterns

```python
# backend/app.py:1
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Writing Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Svelte dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# backend/routers/files.py:1
from fastapi import APIRouter, UploadFile, File

router = APIRouter(prefix="/api/files", tags=["files"])

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Save file, return metadata
    pass
```

## Success Criteria

### Functional Tests
1. **Health Check:** `GET /health` returns `{"status": "ok"}`
2. **File Upload:** `POST /api/files/upload` with multipart form data returns file metadata JSON
3. **Conversation CRUD:**
   - Create returns new conversation with ID
   - List returns array of conversations
   - Get returns single conversation
   - Update modifies conversation
   - Delete removes conversation

### Human Verification Steps
1. Start backend with `uvicorn backend.app:app --reload`
2. Open browser to `http://localhost:8000/docs` (Swagger UI)
3. Test `/health` endpoint - should return OK
4. Upload a test file via Swagger UI - should return file ID and metadata
5. Create a conversation via Swagger UI - should return conversation object
6. List conversations - should show created conversation

### Test Commands
```bash
# Health check
curl http://localhost:8000/health

# File upload
curl -X POST http://localhost:8000/api/files/upload \
  -F "file=@test.txt"

# Create conversation
curl -X POST http://localhost:8000/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}'

# List conversations
curl http://localhost:8000/api/conversations
```

## Notes

- Use SQLite for development, PostgreSQL for production
- Store uploaded files in `./uploads/` directory
- Use environment variables for configuration
- Follow FastAPI best practices for dependency injection
