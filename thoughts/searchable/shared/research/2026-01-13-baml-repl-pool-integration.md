---
date: 2026-01-13T18:44:31-05:00
researcher: tha-hammer
git_commit: 93229c83fa008ccbf7791c369deabdaf7f8fda02
branch: master
repository: silmari-writer
topic: "BAML Integration with 200-REPL Pool System"
tags: [research, codebase, baml, repl, ray, tool-calling, llm-integration]
status: complete
last_updated: 2026-01-13
last_updated_by: tha-hammer
---

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│            BAML INTEGRATION WITH 200-REPL POOL SYSTEM                        │
│                        Research Document                                     │
│                                                                              │
│  Status: COMPLETE                                         Date: 2026-01-13  │
└──────────────────────────────────────────────────────────────────────────────┘
```

# Research: BAML Integration with 200-REPL Pool System

**Date**: 2026-01-13T18:44:31-05:00
**Researcher**: tha-hammer
**Git Commit**: 93229c83fa008ccbf7791c369deabdaf7f8fda02
**Branch**: master
**Repository**: silmari-writer

## Research Question

How can BAML be integrated into the 200-REPL pool system implementation to provide type-safe LLM function calling for REPL task orchestration?

## Summary

The silmari-writer codebase has existing BAML infrastructure and a comprehensive plan for the 200-REPL pool system. Integration involves:

1. **Existing BAML Setup**: Root project has `baml_src/` with clients and a sample resume function; python-chatbot has a more sophisticated tool-calling implementation with `ChooseTools` function
2. **Existing Research**: The `2026-01-13-repl-architecture-tool-calls.md` document already defines a `SpawnREPL` BAML tool pattern for orchestrating REPL execution
3. **Phase 3 Ray Architecture**: Ray actors wrap `SecureREPLEnv` with `RayREPLPool` managing 200 concurrent actors via `ActorPool`
4. **Integration Path**: Add `SpawnREPL` tool to BAML, connect to `RayREPLPool.execute()`, enable master LLM to orchestrate parallel REPL tasks

---

## Detailed Findings

### 1. Existing BAML Infrastructure

#### Root Project (`baml_src/`)

| File | Purpose | Key Components |
|------|---------|----------------|
| `baml_src/generators.baml` | Code generation config | Python/Pydantic, version 0.217.0, sync mode |
| `baml_src/clients.baml` | LLM client definitions | GPT-5, Claude Opus 4, Sonnet 4, Haiku, round-robin, fallback |
| `baml_src/resume.baml` | Sample function | `ExtractResume(resume: string) -> Resume` |

**Generated Client**: `baml_client/` with sync/async clients, Pydantic types, streaming support

#### Python Chatbot (`python-chatbot/server/baml_src/`)

| File | Purpose | Key Components |
|------|---------|----------------|
| `agent.baml` | Tool selection | `ChooseTools` function with union return types |
| `summarize.baml` | Context management | `SummarizeMessages` for conversation compression |
| `clients.baml` | LLM clients | GPT-4o, Sonnet, Vertex AI |

**Key Pattern - Union Return Types for Tools** (`agent.baml:61`):
```baml
function ChooseTools(state: State, query: Query) -> (
    GetWeatherReport | ComputeValue | MessageToUser | Resume
)[] {
  client CustomGPT4o
  prompt #"..."#
}
```

**Streaming Annotations**:
- `@@stream.done` - Atomic tool completion (prevents partial tool execution)
- `@stream.with_state` - Token-by-token streaming with state tracking

---

### 2. Existing REPL Architecture

#### Core REPL Components (`rlm/`)

| File | Class | Purpose |
|------|-------|---------|
| `repl.py` | `REPLEnv` | Original sync REPL with threading.Lock |
| `async_repl_env.py` | `AsyncREPLEnv` | Async REPL without lock, ProcessPoolExecutor |
| `secure_repl_env.py` | `SecureREPLEnv` | Import whitelist + file isolation |
| `repl_pool.py` | `SimplifiedREPLPool` | Pool of 2-5 REPLs with state machine |
| `repl_state.py` | `REPLState` | State machine (IDLE → ACTIVE → CLEANING) |

#### Phase 3 Ray Architecture (`rlm/ray_repl_*.py` - planned)

| Component | Purpose |
|-----------|---------|
| `REPLActor` | Ray actor wrapping `SecureREPLEnv` with `@ray.remote` |
| `RayREPLPool` | Pool manager using `ray.util.ActorPool` |
| Resource limits | `num_cpus=0.5`, `memory=500MB` per actor |
| Fault tolerance | `max_restarts=3`, `max_task_retries=2` |

**Key Interface** (`RayREPLPool.execute`):
```python
async def execute(
    self,
    code: str,
    session_id: Optional[str] = None,
    timeout: float = 30.0
) -> Dict[str, Any]:
    # Routes to session-bound actor or ActorPool load balancing
```

---

### 3. Prior Research on BAML + REPL Integration

#### SpawnREPL Tool Pattern

From `thoughts/shared/research/2026-01-13-repl-architecture-tool-calls.md`:

```baml
class SpawnREPL {
  type "spawn_repl"
  task_id string @description("Unique identifier for this REPL task")
  task_type string @description("Type: analyze, compute, summarize, search")
  context_data string @description("JSON-encoded context for this REPL")
  custom_prompt string? @description("Optional task-specific prompt override")
  @@stream.done  // Entire object streams atomically
}

function ChooseTools(state: State, query: Query) -> (
    GetWeatherReport |
    ComputeValue |
    MessageToUser |
    SpawnREPL |  // NEW
    Resume
)[] {
  // ...
}
```

#### Execution Flow Diagram

```
User Query + Session State
    ↓
BAML ChooseTools Function (with SpawnREPL tool)
    ↓
Master LLM Decides:
    SpawnREPL(task="analyze_data", context={...}, prompt="...")
    SpawnREPL(task="compute_metric", context={...}, prompt="...")
    SpawnREPL(task="summarize", context={...}, prompt="...")
    ...up to 200 REPLs
    ↓
REPL Pool Manager (RayREPLPool):
    Creates/reuses REPLActor instances
    Assigns task-specific prompts and context
    Executes in parallel via ActorPool
    ↓
Results aggregated
    ↓
Master LLM synthesizes final response
```

#### Usage Patterns

**Pattern 1: Sequential Dependency**
```
Query: "Find the average price and then find RVs near that price"

Master LLM:
1. SpawnREPL(task_id="avg_price", task_type="compute", ...)
2. Resume()
→ Gets avg_price result
3. SpawnREPL(task_id="near_avg", task_type="search", custom_prompt=f"Find near ${avg_price}")
4. MessageToUser(results)
```

**Pattern 2: Parallel Independence**
```
Query: "Analyze RV prices by region and by manufacturer"

Master LLM:
1. SpawnREPL(task_id="by_region", task_type="analyze", ...)
2. SpawnREPL(task_id="by_manufacturer", task_type="analyze", ...)
3. Resume()
→ Gets both results concurrently
4. MessageToUser(synthesized_results)
```

---

### 4. Integration Architecture

#### New BAML Files to Create

```
baml_src/
├── generators.baml      # Existing
├── clients.baml         # Existing
├── resume.baml          # Existing (sample)
├── repl_tools.baml      # NEW - SpawnREPL tool definition
└── repl_orchestration.baml  # NEW - Orchestration functions
```

#### `baml_src/repl_tools.baml`

```baml
// REPL Task Types
enum REPLTaskType {
  Analyze @description("Data analysis and pattern detection")
  Compute @description("Mathematical calculations and aggregations")
  Summarize @description("Text summarization and condensation")
  Search @description("Data search and filtering")
  Transform @description("Data transformation and reformatting")
}

// SpawnREPL Tool - Triggers REPL execution
class SpawnREPL {
  type "spawn_repl"
  task_id string @description("Unique task identifier (alphanumeric, _, -)")
  task_type REPLTaskType
  context_data string @description("JSON-encoded context data")
  code_to_execute string @description("Python code to run in REPL")
  timeout_seconds int? @description("Execution timeout (default: 30)")
  @@stream.done  // Atomic streaming
}

// REPL Result - Returned after execution
class REPLResult {
  task_id string
  success bool
  stdout string
  stderr string?
  execution_time float
  actor_id string?  // Ray actor that executed the task
}

// Extended State with REPL results
class REPLState {
  recent_messages Message[]
  active_tasks string[]  // Task IDs currently executing
  completed_results REPLResult[]  // Results from completed tasks
  session_id string?  // For session-scoped REPL state persistence
}
```

#### `baml_src/repl_orchestration.baml`

```baml
// Orchestration function for REPL tasks
function OrchestrateREPLTasks(
  state: REPLState,
  query: Query
) -> (SpawnREPL | MessageToUser | Resume)[] {
  client CustomGPT5
  prompt #"
    {{ REPLInstructions() }}

    You can decompose complex queries into parallel REPL tasks.
    Each SpawnREPL runs Python code in an isolated environment.

    Available task types:
    - Analyze: Pattern detection, statistical analysis
    - Compute: Math operations, aggregations
    - Summarize: Text condensation
    - Search: Data filtering
    - Transform: Data reshaping

    Return SpawnREPL for each subtask, then Resume to wait for results.
    After all results received, return MessageToUser with synthesis.

    Current state: {{ state }}
    User query: {{ query }}

    {{ ctx.output_format }}
  "#
}

// Template for REPL-specific instructions
template_string REPLInstructions() #"
  You are orchestrating Python REPL tasks for data analysis.

  Rules:
  1. Decompose complex queries into independent subtasks
  2. Use SpawnREPL for each subtask with appropriate task_type
  3. Include complete Python code in code_to_execute
  4. Use unique task_id for each SpawnREPL
  5. After spawning, use Resume to wait for results
  6. Synthesize results with MessageToUser

  Security: REPLs have restricted imports (json, csv, math, pandas, numpy)
  and isolated file access. Do not attempt to import os, subprocess, etc.
"#
```

#### Python Handler for SpawnREPL

```python
# python-chatbot/server/app/repl_handler.py

from typing import cast
from baml_client.types import SpawnREPL, REPLResult, REPLState
from rlm.ray_repl_pool import RayREPLPool, RayPoolConfig

class REPLToolHandler:
    """Handles SpawnREPL tool invocations from BAML."""

    def __init__(self, pool_config: RayPoolConfig = None):
        self.pool_config = pool_config or RayPoolConfig(pool_size=200)
        self._pool: RayREPLPool = None

    async def initialize(self):
        """Initialize Ray REPL pool."""
        if self._pool is None:
            self._pool = RayREPLPool(self.pool_config)
            await self._pool.initialize()

    async def handle_spawn_repl(
        self,
        tool: SpawnREPL,
        state: REPLState
    ) -> REPLResult:
        """Execute SpawnREPL tool and return result."""
        await self.initialize()

        timeout = tool.timeout_seconds or 30.0

        result = await self._pool.execute(
            code=tool.code_to_execute,
            session_id=state.session_id,  # Session-scoped state
            timeout=timeout
        )

        return REPLResult(
            task_id=tool.task_id,
            success=result["success"],
            stdout=result["stdout"],
            stderr=result.get("stderr"),
            execution_time=result["execution_time"],
            actor_id=result.get("actor_id")
        )

    async def handle_batch_spawn(
        self,
        tools: list[SpawnREPL],
        state: REPLState
    ) -> list[REPLResult]:
        """Execute multiple SpawnREPL tools in parallel."""
        await self.initialize()

        codes = [t.code_to_execute for t in tools]
        timeout = max(t.timeout_seconds or 30.0 for t in tools)

        results = await self._pool.execute_batch(codes, timeout=timeout)

        return [
            REPLResult(
                task_id=tools[i].task_id,
                success=r["success"],
                stdout=r["stdout"],
                stderr=r.get("stderr"),
                execution_time=r["execution_time"],
                actor_id=r.get("actor_id")
            )
            for i, r in enumerate(results)
        ]

    async def shutdown(self):
        """Shutdown REPL pool."""
        if self._pool:
            await self._pool.shutdown()
```

#### Integration in FastAPI Server

```python
# python-chatbot/server/app/main.py (additions)

from app.repl_handler import REPLToolHandler
from baml_client import b
from baml_client.types import SpawnREPL, REPLState, Query

repl_handler = REPLToolHandler()

@app.on_event("startup")
async def startup_event():
    await repl_handler.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    await repl_handler.shutdown()

@app.post("/api/orchestrate")
async def orchestrate_repl_tasks(query: str, session_id: str = None):
    """Orchestrate REPL tasks via BAML."""
    state = REPLState(
        recent_messages=[],
        active_tasks=[],
        completed_results=[],
        session_id=session_id
    )
    q = Query(message=query, timestamp=int(time.time()))

    async for chunk in b.stream.OrchestrateREPLTasks(state, q):
        for tool in chunk:
            if tool.type == "spawn_repl":
                spawn = cast(SpawnREPL, tool)
                result = await repl_handler.handle_spawn_repl(spawn, state)
                state.completed_results.append(result)

            if tool.type == "message_to_user":
                # Return final message
                return {"message": tool.message}

            if tool.type == "resume":
                # Continue orchestration with updated state
                continue
```

---

### 5. Code References

| Component | File Path | Key Lines |
|-----------|-----------|-----------|
| BAML generator config | `baml_src/generators.baml:1-18` | Output type, version |
| BAML clients | `baml_src/clients.baml:1-142` | GPT-5, Claude, retry policies |
| Chatbot ChooseTools | `python-chatbot/server/baml_src/agent.baml:61-73` | Union return types |
| Streaming handler | `python-chatbot/server/app/main.py:169-321` | Tool execution loop |
| SecureREPLEnv | `rlm/secure_repl_env.py:138-179` | Import whitelist, file isolation |
| SimplifiedREPLPool | `rlm/repl_pool.py:55-315` | Pool management, acquire/release |
| REPLState machine | `rlm/repl_state.py:21-85` | IDLE → ACTIVE → CLEANING |
| Phase 3 Ray plan | `thoughts/shared/plans/.../03-phase-3.md` | RayREPLPool, ActorPool |
| Prior BAML+REPL research | `thoughts/shared/research/2026-01-13-repl-architecture-tool-calls.md` | SpawnREPL pattern |

---

### 6. Implementation Phases

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  BAML INTEGRATION IMPLEMENTATION PHASES                                     ║
╚═════════════════════════════════════════════════════════════════════════════╝

Phase A: BAML Tool Definitions
├── Create baml_src/repl_tools.baml with SpawnREPL, REPLResult types
├── Create baml_src/repl_orchestration.baml with OrchestrateREPLTasks
├── Run baml-cli generate to update baml_client/
└── Verify types in baml_client/types.py

Phase B: Handler Implementation
├── Create python-chatbot/server/app/repl_handler.py
├── Implement REPLToolHandler with RayREPLPool integration
├── Add batch execution support for parallel SpawnREPL
└── Write unit tests with mocked pool

Phase C: FastAPI Integration
├── Add /api/orchestrate endpoint to main.py
├── Connect streaming BAML to REPLToolHandler
├── Implement session state management
└── Add authentication via existing auth.py

Phase D: Testing & Validation
├── Integration tests with real Ray pool (10, 50, 200 scale)
├── BAML function tests in baml_src/tests/
├── End-to-end orchestration tests
└── Performance benchmarks
```

---

### 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER REQUEST                                       │
│                    POST /api/orchestrate { query }                          │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BAML OrchestrateREPLTasks                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Input: REPLState + Query                                             │  │
│  │  Output: (SpawnREPL | MessageToUser | Resume)[]                       │  │
│  │  Client: CustomGPT5 (openai-responses/gpt-5)                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
     ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
     │  SpawnREPL #1  │      │  SpawnREPL #2  │      │  SpawnREPL #N  │
     │  task: analyze │      │  task: compute │      │  task: search  │
     │  code: "..."   │      │  code: "..."   │      │  code: "..."   │
     └───────┬────────┘      └───────┬────────┘      └───────┬────────┘
             │                       │                       │
             └───────────────────────┼───────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REPLToolHandler                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  handle_batch_spawn(tools, state)                                     │  │
│  │    → RayREPLPool.execute_batch(codes, timeout)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RayREPLPool                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      ray.util.ActorPool                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ REPLActor   │  │ REPLActor   │  │ REPLActor   │  │ REPLActor   │  │  │
│  │  │ (pid 1)     │  │ (pid 2)     │  │ (pid 3)     │  │ (pid N)     │  │  │
│  │  │ SecureREPL  │  │ SecureREPL  │  │ SecureREPL  │  │ SecureREPL  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │              ...up to 200 actors...                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REPLResult[]                                        │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ task_id: "analyze" │  │ task_id: "compute" │  │ task_id: "search"  │     │
│  │ success: true      │  │ success: true      │  │ success: true      │     │
│  │ stdout: "..."      │  │ stdout: "..."      │  │ stdout: "..."      │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BAML OrchestrateREPLTasks (Resume)                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Updated state with completed_results                                 │  │
│  │  Returns: MessageToUser(synthesized_response)                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RESPONSE TO USER                                    │
│                  { message: "Analysis complete: ..." }                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Historical Context (from thoughts/)

| Document | Content |
|----------|---------|
| `thoughts/shared/research/2026-01-13-repl-architecture-tool-calls.md` | Comprehensive research on SpawnREPL pattern, formal contracts, execution guarantees |
| `thoughts/shared/plans/2026-01-13-tdd-200-repl-pool-system/` | 4-phase TDD plan for REPL pool implementation |
| `thoughts/shared/plans/2026-01-11-tdd-writing-agent-backend-improved.md` | BAML integration for writing agent |
| `thoughts/shared/plans/2026-01-10-tdd-writing-agent-ui-04-theme-extraction.md` | BAML-based theme extraction patterns |

---

## Related Research

- [REPL Architecture and Tool Calls](./2026-01-13-repl-architecture-tool-calls.md) - Foundation document for SpawnREPL pattern
- [200-REPL Pool TDD Plan](../plans/2026-01-13-tdd-200-repl-pool-system/2026-01-13-tdd-200-repl-pool-system-00-overview.md) - Implementation phases

---

## Open Questions

1. **BAML Version Alignment**: Root project uses 0.217.0, python-chatbot uses 0.207.1. Should these be unified?

2. **Session Scope**: Should REPL state persist across multiple `OrchestrateREPLTasks` calls for a session, or reset per request?

3. **Error Handling**: How should partial failures (some SpawnREPL succeed, others fail) be communicated back to the master LLM?

4. **Context Size Limits**: What's the maximum `context_data` size for SpawnREPL? Current research suggests 10MB limit.

5. **Rate Limiting**: Should quota enforcement from `quota_manager.py` apply per SpawnREPL tool call or per orchestration request?
