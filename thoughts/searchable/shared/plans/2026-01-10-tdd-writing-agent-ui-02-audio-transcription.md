# Phase 2: Audio Transcription Service

**Date:** 2026-01-10
**Phase:** 2 of 4
**Human-Testable Function:** Can record/upload audio and see transcription text

## Overview

Integrate OpenAI Whisper API for audio transcription. Users can upload audio files or record directly, and the system will transcribe the audio to text for further processing.

## Dependencies

### Requires
- Phase 1 (Backend API) - needs file upload infrastructure

### Blocks
- Phase 4 (Theme Extraction) - needs transcription output for processing

## Changes Required

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `backend/requirements.txt:1` | Add `openai>=1.0.0` dependency |
| `backend/app.py:10` | Register transcription router |

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/services/transcription.py:1` | Whisper API integration |
| `backend/routers/transcription.py:1` | Transcription endpoints |
| `backend/models/transcription.py:1` | Transcription models |
| `backend/config.py:1` | Configuration with API keys |

### Directory Structure Updates

```
backend/
├── services/
│   ├── __init__.py
│   └── transcription.py     # NEW
├── routers/
│   └── transcription.py     # NEW
├── models/
│   └── transcription.py     # NEW
└── config.py                # NEW
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transcribe` | Transcribe uploaded audio file |
| GET | `/api/transcribe/{id}` | Get transcription result |
| POST | `/api/transcribe/stream` | Stream transcription progress |

### Key Code Patterns

```python
# backend/services/transcription.py:1
import openai
from pathlib import Path

async def transcribe_audio(file_path: Path) -> str:
    """Transcribe audio using OpenAI Whisper API"""
    with open(file_path, "rb") as audio_file:
        transcript = await openai.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )
    return transcript.text

# backend/routers/transcription.py:1
from fastapi import APIRouter, UploadFile, File
from ..services.transcription import transcribe_audio

router = APIRouter(prefix="/api/transcribe", tags=["transcription"])

@router.post("")
async def transcribe(file: UploadFile = File(...)):
    """Upload and transcribe audio file"""
    # Save temp file
    temp_path = save_temp_file(file)

    # Transcribe
    text = await transcribe_audio(temp_path)

    # Cleanup
    temp_path.unlink()

    return {"text": text, "duration": None}

# backend/models/transcription.py:1
from pydantic import BaseModel
from typing import Optional

class TranscriptionResult(BaseModel):
    id: str
    text: str
    duration: Optional[float]
    language: Optional[str]
    segments: Optional[list] = None
```

### Configuration

```python
# backend/config.py:1
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    upload_dir: str = "./uploads"
    max_audio_size_mb: int = 25  # Whisper limit

    class Config:
        env_file = ".env"

settings = Settings()
```

### Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-your-key-here
```

## Success Criteria

### Functional Tests
1. **Audio Upload:** Accepts common audio formats (mp3, wav, m4a, webm)
2. **Transcription:** Returns accurate text transcription
3. **Error Handling:** Returns clear error for unsupported formats or API failures
4. **Size Limit:** Enforces 25MB file size limit (Whisper API constraint)

### Human Verification Steps
1. Ensure Phase 1 backend is running
2. Open Swagger UI at `http://localhost:8000/docs`
3. Navigate to `/api/transcribe` POST endpoint
4. Upload a short audio file (speech)
5. Verify response contains transcribed text
6. Test with different audio formats (mp3, wav)
7. Test error case with non-audio file

### Test Commands
```bash
# Transcribe audio file
curl -X POST http://localhost:8000/api/transcribe \
  -F "file=@test-audio.mp3"

# Expected response:
# {"text": "Hello, this is a test recording...", "duration": 3.5}

# Test with WAV file
curl -X POST http://localhost:8000/api/transcribe \
  -F "file=@test-audio.wav"

# Test error handling (non-audio file)
curl -X POST http://localhost:8000/api/transcribe \
  -F "file=@document.pdf"
# Should return error
```

### Supported Audio Formats
- mp3
- mp4
- mpeg
- mpga
- m4a
- wav
- webm

## Notes

- OpenAI Whisper API has 25MB file size limit
- For longer audio, consider chunking or using local Whisper model
- Store transcription results in database for retrieval
- Consider adding language detection/specification option
- WebM format important for browser MediaRecorder compatibility
