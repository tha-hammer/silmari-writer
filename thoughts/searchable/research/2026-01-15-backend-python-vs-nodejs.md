---
date: 2026-01-15T00:00:00Z
researcher: mjourdan
git_commit: 636d752d0af8551af9b73659e02f8a3f42fb27c9
branch: main
repository: silmari-writer
topic: "Backend Python vs Node.js - Which server handles API endpoints?"
tags: [research, codebase, backend, architecture, fastapi, nextjs, api-routes]
status: complete
last_updated: 2026-01-15
last_updated_by: mjourdan
---

# Research: Backend Python vs Node.js - Which Server Handles API Endpoints?

**Date**: 2026-01-15
**Researcher**: mjourdan
**Git Commit**: 636d752d0af8551af9b73659e02f8a3f42fb27c9
**Branch**: main
**Repository**: silmari-writer

## Research Question
Is the backend Python code used in this implementation, or does the Node.js server handle all of the API endpoints?

## Summary
**The Python FastAPI backend exists and is fully functional, but it is NOT currently used by the frontend.** The Next.js frontend uses its own API routes (`/api/transcribe` and `/api/generate`) that call OpenAI directly. The Python backend at `backend/app.py` contains a comprehensive API with conversation management, file handling, transcription, theme extraction, and content generation capabilities, but none of these endpoints are called by the current frontend implementation.

## Detailed Findings

### Python FastAPI Backend (EXISTS BUT UNUSED)

**Location**: `backend/app.py`

The Python backend is a fully-featured FastAPI application with the following endpoints:

**Health & Info:**
- `GET /health` (backend/app.py:184-187)
- `GET /` (backend/app.py:190-193)

**File Management:**
- `POST /api/files/upload` (backend/app.py:196-241) - Upload audio files with metadata
- `GET /api/files/{file_id}` (backend/app.py:244-253) - Retrieve file metadata

**Conversations:**
- `GET /api/conversations` (backend/app.py:274-289) - List all conversations
- `POST /api/conversations` (backend/app.py:292-304) - Create new conversation
- `GET /api/conversations/{conversation_id}` (backend/app.py:307-314) - Get conversation details
- `PUT /api/conversations/{conversation_id}` (backend/app.py:317-335) - Update conversation
- `DELETE /api/conversations/{conversation_id}` (backend/app.py:338-347) - Delete conversation

**AI-Powered Features:**
- `POST /api/transcribe` (backend/app.py:388-432) - Transcribe audio to text
- `POST /api/themes/extract` (backend/app.py:526-544) - Extract themes from text using LLM
- `POST /api/generate` (backend/app.py:553-576) - Generate content based on themes and prompt

**Backend Infrastructure:**
- Framework: FastAPI with async/await support
- Server: Uvicorn (ASGI)
- Data Validation: Pydantic v2+
- Storage: In-memory dictionaries (backend/app.py:171-173)
- External Services: OpenAI API for transcription and content generation

**Test Coverage:**
Comprehensive test suite in `backend/tests/`:
- test_conversations.py (72+ test functions)
- test_files.py
- test_transcription.py
- test_themes.py
- test_generation.py (12+ test functions)
- test_error_handling.py (45+ test functions)
- test_health.py

**Dependencies** (pyproject.toml:10-18):
- fastapi>=0.109.0
- uvicorn[standard]>=0.27.0
- pydantic>=2.0.0
- openai>=1.0.0
- python-multipart>=0.0.6

**How to Start:**
```bash
uvicorn backend.app:app --reload
```
Default: http://127.0.0.1:8000

### Node.js/Next.js Frontend (ACTIVELY USED)

**Location**: `frontend/src/app/api/`

The Next.js frontend defines TWO API routes that handle all current API functionality:

**1. Transcription Route:**
- Endpoint: `POST /api/transcribe`
- Handler: frontend/src/app/api/transcribe/route.ts:27-109
- Direct OpenAI Integration: Calls Whisper API (line 168)
- Model: whisper-1
- Features:
  - File validation (type and size checks)
  - Retry logic with exponential backoff
  - Max file size: 25MB
  - Supported formats: mp3, m4a, mpga, wav, webm, mp4, mpeg

**2. Chat Generation Route:**
- Endpoint: `POST /api/generate`
- Handler: frontend/src/app/api/generate/route.ts:13-85
- Direct OpenAI Integration: Calls Chat Completions API (line 128)
- Model: gpt-4o-mini
- Features:
  - History management (last 10 messages)
  - Retry logic with exponential backoff
  - Custom error handling

**Frontend API Client:**
- Location: frontend/src/lib/api.ts:3-32
- Calls: Relative URLs (`/api/generate`, `/api/transcribe`)
- No base URL configuration (same-origin requests)

**Frontend Dependencies** (frontend/package.json:19-31):
- next@16.1.2
- react@19.2.3
- openai@6.16.0
- zustand@5.0.10
- zod@4.3.5

**How to Start:**
```bash
cd frontend
npm run dev
```
Default: http://localhost:3000

### Architecture Analysis

**Current Implementation:**
```
User → Next.js Frontend (localhost:3000)
         ↓
         Next.js API Routes (/api/transcribe, /api/generate)
         ↓
         OpenAI API (direct calls from Next.js server)
```

**Unused Python Backend:**
```
FastAPI Backend (localhost:8000) ← NOT CALLED
  ├── /api/conversations
  ├── /api/files/upload
  ├── /api/transcribe
  ├── /api/themes/extract
  └── /api/generate
```

### Code References

**Frontend API Integration:**
- `frontend/src/lib/api.ts:7` - Fetch call to `/api/generate`
- `frontend/src/lib/transcription.ts:43-46` - Fetch call to `/api/transcribe`
- `frontend/src/app/page.tsx:41-72` - Chat message handler calling `generateResponse()`
- `frontend/src/app/page.tsx:74-115` - Recording handler calling `transcribeAudio()`

**Backend Python Implementation:**
- `backend/app.py:177-181` - FastAPI app instantiation
- `backend/app.py:171-173` - In-memory data stores (file_store, conversation_store)
- `backend/app.py:435-474` - Theme extraction LLM function
- `backend/app.py:477-518` - Content generation LLM function

**Environment Configuration:**
- `frontend/.env:3` - OPENAI_API_KEY for Next.js routes
- `frontend/.env.example:1-3` - Template showing required env vars

### Key Observations

1. **Dual Implementation**: The codebase contains two complete but separate implementations:
   - A comprehensive Python FastAPI backend with advanced features
   - A minimal Next.js API layer with only two routes

2. **Frontend Uses Next.js Only**: The frontend at `frontend/src/lib/api.ts` uses relative URLs that resolve to Next.js API routes, not the Python backend.

3. **No Backend Connection**: There's no configuration, fetch calls, or references to the Python backend (no `http://localhost:8000` or similar).

4. **Backend Features Not Used**:
   - Conversation management (CRUD operations)
   - File upload/metadata tracking
   - Theme extraction endpoint
   - Advanced content generation endpoint

5. **Test Coverage Disparity**: The Python backend has extensive tests (8 test files, 100+ test functions), while the frontend has tests for the API routes.

6. **Development Pattern**: This appears to be a TDD-developed Python backend that was built alongside a separate Next.js implementation. The Python backend is production-ready but currently unused.

7. **OpenAI Integration**: Both implementations integrate with OpenAI, but:
   - Next.js routes: Direct SDK calls from API route handlers
   - Python backend: Helper functions that would be called by endpoints

8. **Deployment Configuration**:
   - Frontend: Configured for Vercel deployment (vercel.json)
   - Backend: No deployment configuration found (likely intended for separate deployment)

## Related Research
None currently in thoughts/shared/research/

## Open Questions
1. Was the Python backend intended for future use or as an alternative implementation?
2. Should the frontend be migrated to use the Python backend's richer feature set (conversations, file management, themes)?
3. Is there a plan to consolidate on one backend architecture?
4. Why maintain two parallel implementations of transcription and generation?
