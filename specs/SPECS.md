# Specifications Index

Technical specifications for the implemented `/writer` voice-loop workflow.

## Core Documents

| Document | Description |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Route-first system architecture for `/writer` -> `/session/[sessionId]`, module layering, APIs, data model, and model allocation |
| [voice-loop.md](voice-loop.md) | Master technical spec for the `/writer` voice-loop (state model, API contracts, realtime voice path, traceability) |

## Domain Specifications

Consolidated from session orchestration path specs `293-339`.

| Document | Domain | Paths | Priority |
|---|---|---|---|
| [session-initialization.md](session-initialization.md) | Session creation, object ingestion, consent gating | 293-295, 302, 310-312 | P0 |
| [voice-recall-story-selection.md](voice-recall-story-selection.md) | ORIENT + RECALL interactions, story selection, voice prompting | 303-304, 306-309, 313-316 | P0 |
| [slot-filling-verification.md](slot-filling-verification.md) | Slot completion loop, claim extraction, verification pipeline | 296-297, 317-324 | P0 |
| [draft-generation-review.md](draft-generation-review.md) | Draft generation, review approval, stage progression | 298-300, 325-329 | P0 |
| [finalize-export-sms.md](finalize-export-sms.md) | Finalization lock, export/copy, voice edit, SMS follow-up | 305, 330-337 | P0 |
| [metrics-analytics.md](metrics-analytics.md) | Leading KPI computation and primary KPI events | 301, 338-339 | P0-P1 |

## Route-to-Spec Map

| Route | Primary Specs |
|---|---|
| `/writer` | voice-loop, session-initialization |
| `/session/[sessionId]` | voice-loop, voice-recall-story-selection, slot-filling-verification, draft-generation-review, finalize-export-sms |
| `/api/voice/session` | ARCHITECTURE, voice-loop |

## Orchestration Source Specs

Path-level implementation docs live in:
- [orchestration/session-1772314225364/](orchestration/session-1772314225364/)

Each path doc contains:
- Resource reference mappings (UUID -> implementation surface)
- Stepwise Input / Process / Output / Error contracts
- Terminal conditions and retry loops
- TLA+ verification results (Reachability, TypeInvariant, ErrorConsistency)

## Pipeline Specifications

| Document | Description |
|---|---|
| [orchestration/file-to-llm-pipeline-model.md](orchestration/file-to-llm-pipeline-model.md) | Behavioral model for attachment-to-LLM pipeline |
| [orchestration/file-to-llm-pipeline-target.md](orchestration/file-to-llm-pipeline-target.md) | Target specification for attachment-to-LLM pipeline |
| [orchestration/type-gating-pipeline-model.md](orchestration/type-gating-pipeline-model.md) | Behavioral model for MIME/type gating pipeline |
| [orchestration/type-gating-pipeline-target.md](orchestration/type-gating-pipeline-target.md) | Target specification for MIME/type gating pipeline |

## Schemas

| Document | Description |
|---|---|
| [schemas/resource_registry.json](schemas/resource_registry.json) | Portable UUID registry mapping path resources to implementation surfaces |
