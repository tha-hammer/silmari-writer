# Phase 4: Theme Extraction & Content Generation

**Date:** 2026-01-10
**Phase:** 4 of 4
**Human-Testable Function:** Can submit text and see extracted themes + generated content

## Overview

Integrate theme extraction from user input (text or transcribed audio) and use identified themes to guide content generation. This completes the writing agent workflow: input -> transcription -> theme identification -> content generation.

## Dependencies

### Requires
- Phase 1 (Backend API) - backend infrastructure
- Phase 2 (Audio Transcription) - transcribed text input
- Phase 3 (Svelte Frontend) - UI for theme display and content

### Blocks
- None (final phase)

## Changes Required

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `backend/app.py:15` | Register themes and generation routers |
| `frontend/src/lib/components/MessageInput.svelte:10` | Add theme extraction before submission |
| `frontend/src/routes/conversation/[id]/+page.svelte:20` | Display themes in conversation |

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/services/themes.py:1` | Theme extraction logic |
| `backend/services/generation.py:1` | Content generation with Claude/GPT |
| `backend/routers/themes.py:1` | Theme extraction endpoint |
| `backend/routers/generation.py:1` | Content generation endpoint |
| `backend/models/themes.py:1` | Theme models |
| `backend/models/generation.py:1` | Generation request/response models |
| `frontend/src/lib/components/ThemeDisplay.svelte:1` | Theme visualization |
| `frontend/src/lib/components/GeneratedContent.svelte:1` | Content display with actions |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/themes/extract` | Extract themes from text |
| GET | `/api/themes/{conversation_id}` | Get themes for conversation |
| POST | `/api/generate` | Generate content based on themes and prompt |
| POST | `/api/generate/stream` | Stream generated content |

### Key Code Patterns

```python
# backend/services/themes.py:1
from typing import List
from pydantic import BaseModel

class Theme(BaseModel):
    name: str
    description: str
    relevance: float  # 0-1 score
    keywords: List[str]

async def extract_themes(text: str) -> List[Theme]:
    """Extract key themes from input text using LLM"""
    # Adapt from planning_pipeline/decomposition.py pattern
    prompt = f"""
    Analyze the following text and identify key themes.
    For each theme, provide:
    - A short name (2-4 words)
    - A brief description
    - Relevance score (0-1)
    - Key related keywords

    Text:
    {text}

    Return as JSON array of themes.
    """

    response = await call_llm(prompt)
    return parse_themes(response)
```

```python
# backend/services/generation.py:1
from typing import List, AsyncGenerator
from .themes import Theme

async def generate_content(
    user_input: str,
    themes: List[Theme],
    style: str = "professional"
) -> str:
    """Generate content based on input and themes"""
    theme_context = "\n".join([
        f"- {t.name}: {t.description}"
        for t in themes
    ])

    prompt = f"""
    Based on the user's input and identified themes, generate well-written content.

    User Input:
    {user_input}

    Key Themes:
    {theme_context}

    Style: {style}

    Generate content that:
    1. Addresses all identified themes
    2. Maintains the user's original voice/intent
    3. Is well-structured and coherent
    4. Uses appropriate tone for the style
    """

    return await call_llm(prompt)

async def stream_content(
    user_input: str,
    themes: List[Theme]
) -> AsyncGenerator[str, None]:
    """Stream generated content token by token"""
    async for chunk in call_llm_stream(prompt):
        yield chunk
```

```python
# backend/routers/themes.py:1
from fastapi import APIRouter
from ..services.themes import extract_themes, Theme
from pydantic import BaseModel

router = APIRouter(prefix="/api/themes", tags=["themes"])

class ThemeRequest(BaseModel):
    text: str

class ThemeResponse(BaseModel):
    themes: list[Theme]

@router.post("/extract", response_model=ThemeResponse)
async def extract(request: ThemeRequest):
    themes = await extract_themes(request.text)
    return {"themes": themes}
```

```python
# backend/routers/generation.py:1
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from ..services.generation import generate_content, stream_content
from ..services.themes import Theme
from pydantic import BaseModel

router = APIRouter(prefix="/api/generate", tags=["generation"])

class GenerateRequest(BaseModel):
    user_input: str
    themes: list[Theme]
    style: str = "professional"

@router.post("")
async def generate(request: GenerateRequest):
    content = await generate_content(
        request.user_input,
        request.themes,
        request.style
    )
    return {"content": content}

@router.post("/stream")
async def stream(request: GenerateRequest):
    return StreamingResponse(
        stream_content(request.user_input, request.themes),
        media_type="text/event-stream"
    )
```

```svelte
<!-- frontend/src/lib/components/ThemeDisplay.svelte:1 -->
<script lang="ts">
  export let themes: Theme[] = [];

  interface Theme {
    name: string;
    description: string;
    relevance: number;
    keywords: string[];
  }
</script>

<div class="themes">
  <h4>Identified Themes</h4>
  <div class="theme-list">
    {#each themes as theme}
      <div class="theme" style="opacity: {0.5 + theme.relevance * 0.5}">
        <span class="name">{theme.name}</span>
        <span class="description">{theme.description}</span>
        <div class="keywords">
          {#each theme.keywords as keyword}
            <span class="keyword">{keyword}</span>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .theme-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .theme {
    background: var(--theme-bg);
    padding: 0.5rem;
    border-radius: 4px;
  }
  .keyword {
    font-size: 0.75rem;
    background: var(--keyword-bg);
    padding: 0.125rem 0.25rem;
    border-radius: 2px;
  }
</style>
```

### Workflow Integration

```
User Input (text or audio)
         ↓
   [Transcribe if audio]
         ↓
   Extract Themes (/api/themes/extract)
         ↓
   Display Themes (ThemeDisplay.svelte)
         ↓
   User confirms/edits themes
         ↓
   Generate Content (/api/generate)
         ↓
   Stream response to UI (GeneratedContent.svelte)
         ↓
   User can copy/export/iterate
```

## Success Criteria

### Functional Tests
1. **Theme Extraction:**
   - Submit text, receive list of themes
   - Themes have name, description, relevance, keywords
   - Themes are relevant to input content
2. **Theme Display:**
   - Themes render as clickable/viewable items
   - Relevance reflected visually (opacity, size, etc.)
   - Keywords shown for each theme
3. **Content Generation:**
   - Submit input + themes, receive generated content
   - Content addresses all themes
   - Content maintains coherent structure
4. **Streaming:**
   - Content streams to UI progressively
   - User sees content appear in real-time

### Human Verification Steps
1. Ensure Phases 1-3 are complete and running
2. Open conversation view in browser
3. **Test Theme Extraction:**
   - Type or paste substantial text (2-3 paragraphs)
   - Click "Extract Themes" or submit message
   - Verify themes appear in UI
   - Check themes are relevant to content
4. **Test Content Generation:**
   - With themes displayed, click "Generate"
   - Watch content stream into view
   - Verify content addresses input themes
   - Check writing quality and coherence
5. **Test Full Workflow:**
   - Record audio using recorder
   - Wait for transcription
   - Themes auto-extract from transcription
   - Generate content based on themes
   - Verify end-to-end flow works

### Test Commands
```bash
# Extract themes
curl -X POST http://localhost:8000/api/themes/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "The importance of sustainable agriculture cannot be overstated. Modern farming practices have led to soil degradation and water pollution. We need to embrace regenerative techniques that restore ecosystems while maintaining productivity."}'

# Expected response:
# {
#   "themes": [
#     {"name": "Sustainable Agriculture", "description": "Focus on sustainable farming methods", "relevance": 0.95, "keywords": ["sustainable", "agriculture", "farming"]},
#     {"name": "Environmental Impact", "description": "Effects on soil and water", "relevance": 0.85, "keywords": ["soil", "water", "pollution", "degradation"]},
#     {"name": "Regenerative Practices", "description": "Solutions for ecosystem restoration", "relevance": 0.80, "keywords": ["regenerative", "restoration", "ecosystem"]}
#   ]
# }

# Generate content
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "Write about sustainable farming",
    "themes": [{"name": "Sustainable Agriculture", "description": "Focus on sustainable farming", "relevance": 0.95, "keywords": ["sustainable"]}],
    "style": "professional"
  }'

# Stream content
curl -N http://localhost:8000/api/generate/stream \
  -H "Content-Type: application/json" \
  -d '{"user_input": "...", "themes": [...], "style": "professional"}'
```

## Notes

- Theme extraction uses LLM for semantic understanding
- Consider caching themes per conversation for quick access
- Allow users to edit/remove themes before generation
- Support different writing styles (professional, casual, academic, etc.)
- Implement retry logic for LLM API failures
- Consider adding theme persistence to conversation model
- Adapt patterns from `planning_pipeline/decomposition.py` for hierarchical themes

## Reference Code

From existing codebase to adapt:

| Source | Usage |
|--------|-------|
| `planning_pipeline/decomposition.py` | Theme/requirement extraction patterns |
| `planning_pipeline/claude_runner.py` | LLM invocation patterns |
| `baml_src/functions.baml` | Type-safe LLM function definitions |
| `context_window_array/store.py` | Context storage for themes |
