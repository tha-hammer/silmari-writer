# TDD Writing Agent UI - Overview

**Date:** 2026-01-10
**Based On:** 2026-01-09-building-writing-agent-ui.md

## Project Summary

Build a writing agent with a Svelte conversation UI that enables:
- Text and audio input ingestion
- Audio transcription
- Theme identification
- Content generation based on user prompts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WRITING AGENT STACK                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐             │
│  │  Svelte Frontend │────▶│  FastAPI Backend │             │
│  │                  │     │                  │             │
│  │  • Sidebar       │     │  • File uploads  │             │
│  │  • Messages      │     │  • Whisper API   │             │
│  │  • Attachments   │     │  • Theme extract │             │
│  │  • Recording     │     │  • Generation    │             │
│  └──────────────────┘     └──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Phase Index

| Phase | Description | Human-Testable Function |
|-------|-------------|------------------------|
| [Phase 1](./2026-01-10-tdd-writing-agent-ui-01-backend-api.md) | Core Backend API Server | Can upload files and receive JSON response |
| [Phase 2](./2026-01-10-tdd-writing-agent-ui-02-audio-transcription.md) | Audio Transcription Service | Can record/upload audio and see transcription |
| [Phase 3](./2026-01-10-tdd-writing-agent-ui-03-svelte-frontend.md) | Svelte Frontend UI | Can view conversation UI with sidebar and messages |
| [Phase 4](./2026-01-10-tdd-writing-agent-ui-04-theme-extraction.md) | Theme Extraction & Generation | Can submit text and see extracted themes + generated content |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit |
| Backend | FastAPI (Python) |
| Transcription | OpenAI Whisper API |
| LLM | Claude/GPT-4 via BAML |
| Storage | SQLite (dev) / PostgreSQL (prod) |

## Dependencies

- Phase 2 requires Phase 1 (backend needed for audio endpoints)
- Phase 3 requires Phase 1 (backend needed for API calls)
- Phase 4 requires Phases 1, 2, 3 (full stack integration)

## Existing Assets to Leverage

| Component | Source Location | Usage |
|-----------|----------------|-------|
| Theme Extraction | `planning_pipeline/decomposition.py` | Adapt for writing themes |
| LLM Integration | `planning_pipeline/claude_runner.py` | Use for content generation |
| Context Storage | `context_window_array/store.py` | Conversation state |
| BAML Functions | `baml_src/` | Type-safe LLM calls |
