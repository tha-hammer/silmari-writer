---
date: 2026-01-15T16:08:05+0000
researcher: Claude Sonnet 4.5
git_commit: 636d752d0af8551af9b73659e02f8a3f42fb27c9
branch: main
repository: silmari-writer
topic: "API Endpoints and BAML Integration Patterns"
tags: [research, codebase, baml, next.js, api-routes, typescript, llm-integration]
status: complete
last_updated: 2026-01-15
last_updated_by: Claude Sonnet 4.5
---

# Research: API Endpoints and BAML Integration Patterns

**Date**: 2026-01-15T16:08:05+0000
**Researcher**: Claude Sonnet 4.5
**Git Commit**: 636d752d0af8551af9b73659e02f8a3f42fb27c9
**Branch**: main
**Repository**: silmari-writer

## Research Question

Research the API endpoints in `/home/mjourdan/Dev/silmari-writer/frontend/src/app/api` and deduce how to integrate BAML for type-safe LLM function calling.

## Summary

The silmari-writer project has a Next.js frontend with two API endpoints (`/api/transcribe` and `/api/generate`) that currently use OpenAI SDK directly. BAML is already configured in the project with a generated TypeScript client in `baml_client/` and BAML source definitions in `baml_src/`. The existing API routes follow consistent patterns for error handling, retry logic, and environment variable management that can serve as templates for BAML integration.

BAML provides type-safe LLM function calling with:
- Auto-generated TypeScript client (`b` singleton from `baml_client/index.ts`)
- Structured input/output types defined in BAML files
- Built-in retry policies, fallback strategies, and error handling
- Streaming support via `b.stream.FunctionName()`
- Support for multiple LLM providers (OpenAI, Anthropic, etc.)

Integration involves:
1. Defining BAML functions in `baml_src/*.baml` files
2. Running `npx baml-cli generate` to create TypeScript client
3. Importing and calling `b.FunctionName()` in Next.js API routes
4. Following existing error handling patterns

## Detailed Findings

### Component 1: Existing API Endpoints

The project has two Next.js API routes implementing REST endpoints:

**Transcribe Endpoint** (`frontend/src/app/api/transcribe/route.ts`)
- **Purpose**: Audio transcription via OpenAI Whisper API
- **Method**: POST
- **Input**: FormData with audio file and optional language parameter
- **Output**: `{ text: string }` on success
- **Key Features**:
  - File type validation against SUPPORTED_AUDIO_TYPES (mp3, m4a, wav, webm, mp4, mpeg)
  - File size validation (25MB limit)
  - Environment variable validation (OPENAI_API_KEY)
  - Retry logic with exponential backoff
  - Custom TranscriptionError class with error codes and retryable flags

**Generate Endpoint** (`frontend/src/app/api/generate/route.ts`)
- **Purpose**: Chat completions via OpenAI Chat API
- **Method**: POST
- **Input**: JSON with `{ message: string, history?: Message[] }`
- **Output**: `{ content: string }` on success
- **Key Features**:
  - JSON body parsing and validation
  - Conversation history support (system message + user/assistant exchanges)
  - Same retry and error handling patterns as transcribe
  - Uses gpt-4o-mini model with temperature 0.7

### Component 2: Next.js API Route Patterns

Key patterns found in the existing routes:

1. **Route Handler Structure**: Named exports (POST), NextRequest/NextResponse types, try/catch error handling
2. **Custom Error Classes**: Errors with code, message, and retryable properties
3. **Environment Variable Validation**: Server-side API key checks with CONFIG_ERROR responses
4. **Retry Logic**: Exponential backoff with different delays for rate limits (10s base) vs network errors (2s base)
5. **HTTP Status Classification**: 401 (INVALID_API_KEY, not retryable), 429 (RATE_LIMIT, retryable), 5xx (API_ERROR, retryable)

### Component 3: BAML Configuration and Setup

BAML is configured with:
- Generator: TypeScript output, async default client, version 0.217.0
- Multiple pre-configured LLM clients (OpenAI GPT-5/Mini, Anthropic Claude models)
- Fallback strategies and retry policies
- Sample Resume extraction function in baml_src/resume.baml

### Component 4: BAML Client Architecture

The auto-generated client (`baml_client/`) provides:
- **Singleton `b`**: Main async client for calling functions
- **Type System**: Full types and partial types for streaming
- **Error Types**: BamlClientHttpError, BamlValidationError, BamlClientFinishReasonError
- **Streaming Support**: `b.stream.FunctionName()` with async iteration
- **Options**: Environment variables, client registry, type builder, tags, abort signals

Key execution flow:
1. Merge options
2. Check abort signal
3. Route to streaming if onTick provided
4. Merge environment variables
5. Call runtime.callFunction()
6. Parse typed result
7. Transform errors

### Component 5: BAML Integration Strategy

Integration steps:

1. **Define BAML Functions** in baml_src/ files with classes and prompts
2. **Generate Client**: Run `npx baml-cli generate`
3. **Create API Routes**: Import `b` from `@/baml_client`, call functions with options
4. **Handle Errors**: Map BAML errors to existing error codes
5. **Streaming**: Use `b.stream` API with ReadableStream for streaming responses
6. **Configuration**: Pass environment variables via options, use ClientRegistry for dynamic client selection

Example integration:
```typescript
import { b, BamlValidationError, BamlClientHttpError } from '@/baml_client'

const response = await b.GenerateResponse(message, history, {
  env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY! }
})
```

### Component 6: BAML vs Direct OpenAI SDK

**BAML Advantages:**
- Type-safe inputs/outputs
- Automatic schema generation
- Built-in retry/fallback
- Provider switching
- Testing support

**Direct SDK Advantages:**
- Simpler for basic cases
- No abstraction layer
- Direct control

**Recommendation**: Use BAML for structured outputs, type safety, and multi-provider support. Use direct SDK for simple text-to-text generation.

## Code References

- `frontend/src/app/api/transcribe/route.ts:27-109` - Transcribe endpoint
- `frontend/src/app/api/generate/route.ts:13-85` - Generate endpoint
- `frontend/baml_src/resume.baml:1-43` - Sample BAML function
- `frontend/baml_client/async_client.ts:246-247` - Singleton client
- `frontend/baml_client/types.ts:50-56` - Type definitions

## Architecture Documentation

### Current Architecture
Client → Next.js API Route → OpenAI SDK → OpenAI API

### Proposed Architecture
Client → Next.js API Route → BAML Client (validation, retry, streaming) → LLM Providers

### BAML Development Workflow
1. Define BAML function in baml_src/
2. Run `npx baml-cli generate`
3. Import `b` from baml_client
4. Call `b.FunctionName(params)`

## Recommendations

1. **Start with New Endpoints**: Create `/api/baml-*` routes before migrating existing ones
2. **Follow Existing Patterns**: Maintain consistency in error handling and responses
3. **Leverage BAML Features**: Use structured outputs, fallback strategies, streaming
4. **Environment Variables**: Pass explicitly via BAML options
5. **Error Mapping**: Map BAML errors to existing error codes
6. **Testing**: Use same vitest patterns with mocked BAML client

## Integration Roadmap

**Phase 1**: Parallel implementation with new BAML endpoints
**Phase 2**: Migrate existing endpoints to BAML
**Phase 3**: Add structured outputs, streaming, provider switching

## Open Questions

1. Performance overhead of BAML vs direct SDK?
2. Best streaming approach for Next.js with BAML?
3. Provider selection: client-side or server-side?
4. Test BAML functions directly or via integration tests?
5. Migrate existing endpoints or keep as-is?
