---
date: 2026-01-13T21:02:42-05:00
researcher: Claude
git_commit: 3825eef047ae37f0bb37ffd520fe05b643242536
branch: feature/phase3-ray-repl-pool
repository: silmari-writer
topic: "REPL-based LLM Workflow Architecture & Rust Exploration"
tags: [research, codebase, repl, ray, rust, llm-workflow, orchestration]
status: complete
last_updated: 2026-01-13
last_updated_by: Claude
---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SILMARI-WRITER ARCHITECTURE RESEARCH                      │
│                 REPL-based LLM Workflow & Rust Exploration                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Status: COMPLETE                              Date: 2026-01-13             │
└─────────────────────────────────────────────────────────────────────────────┘
```

# Research: REPL-based LLM Workflow Architecture & Rust Exploration

**Date**: 2026-01-13T21:02:42-05:00
**Researcher**: Claude
**Git Commit**: 3825eef047ae37f0bb37ffd520fe05b643242536
**Branch**: feature/phase3-ray-repl-pool
**Repository**: silmari-writer

---

## Research Question

This is an experimental codebase designed to test a REPL-based LLM workflow. The idea is to have a master LLM which can spawn REPL environments to answer the user's query using deterministic behavior. Next, I want to explore using Rust for the REPL environment for speed and memory safety.

---

## Summary

This codebase implements a **multi-phase REPL-based LLM orchestration system** where a master LLM (via BAML-defined functions) spawns Python REPL environments to execute deterministic code. The architecture consists of:

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Orchestration** | BAML `OrchestrateREPLTasks` | LLM decides which tools to call |
| **Bridge** | `REPLToolHandler` | Routes BAML tools to execution |
| **Distribution** | `RayREPLPool` + `ActorPool` | Manages 200+ distributed actors |
| **Execution** | `REPLActor` → `SecureREPLEnv` | Sandboxed Python execution |

The system is currently **100% Python-based** with Ray for distribution. Rust integration would replace the inner `SecureREPLEnv` execution layer while preserving the Ray orchestration.

---

## Detailed Findings

### 1. Master LLM Orchestration Pattern

The "master LLM" is implemented as a **BAML function** that returns typed tool calls:

```baml
// baml_src/repl_tools.baml:60-103
function OrchestrateREPLTasks(
  state: REPLState,
  query: Query
) -> (SpawnREPL | MessageToUser | Resume)[]
```

**How it works:**
1. User query arrives at FastAPI endpoint
2. BAML function called with current state + query
3. LLM generates array of tool calls (discriminated union)
4. Handler routes `SpawnREPL` tools to Ray pool
5. `Resume` tool signals "wait for results then continue"

**Key file references:**
| File | Lines | Description |
|------|-------|-------------|
| `baml_src/repl_tools.baml` | 60-103 | Orchestration function definition |
| `baml_src/repl_tools.baml` | 1-59 | Tool type definitions |
| `rlm/repl_tool_handler.py` | 63-97 | SpawnREPL execution |

---

### 2. REPL Environment Architecture

The REPL system follows a **layered inheritance pattern**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Layer Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: REPLEnv (repl.py)                                     │
│           └─ Basic synchronous execution with threading.Lock     │
│                                                                  │
│  Layer 2: AsyncREPLEnv (async_repl_env.py)                      │
│           └─ No lock, ProcessPoolExecutor, true concurrency     │
│                                                                  │
│  Layer 3: SecureREPLEnv (secure_repl_env.py)                    │
│           └─ Import whitelist, file path isolation              │
│                                                                  │
│  Layer 4: REPLActor (ray_repl_actor.py)                         │
│           └─ Ray @remote decorator, lazy initialization         │
│                                                                  │
│  Layer 5: RayREPLPool (ray_repl_pool.py)                        │
│           └─ ActorPool for load balancing, session binding      │
└─────────────────────────────────────────────────────────────────┘
```

**Security mechanisms (current Python implementation):**

| Security Feature | Implementation | Location |
|-----------------|----------------|----------|
| Import whitelist | `make_safe_import()` | `secure_repl_env.py:43-73` |
| File isolation | `make_safe_open()` | `secure_repl_env.py:76-136` |
| Path traversal prevention | `resolved_path.startswith(temp_dir)` | `secure_repl_env.py:114-121` |
| Dangerous builtins blocked | `eval=None, exec=None, input=None` | `repl.py:115-117` |

---

### 3. Ray Distribution Model

The system uses Ray's **ActorPool pattern** for scalable parallel execution:

```python
# rlm/ray_repl_pool.py:102-115
actor_cls = REPLActor.options(
    num_cpus=0.5,              # Fractional CPU per actor
    memory=500 * 1024 * 1024,  # 500MB per actor
    max_restarts=3             # Auto-restart on failure
)

self._actors = [
    actor_cls.remote(actor_id=str(uuid.uuid4()))
    for _ in range(200)  # Default pool size
]

self._pool = ActorPool(self._actors)
```

**Execution patterns:**

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Load-balanced | Stateless queries | `ActorPool.submit()` round-robin |
| Session-bound | Stateful conversations | `_session_actors` dict + `pop_idle()` |
| Batch parallel | Multiple SpawnREPL tools | `ActorPool.map()` |

**Resource requirements for 200 actors:**
- CPUs: 200 × 0.5 = 100 CPUs (or use oversubscription)
- Memory: 200 × 500MB = 100GB RAM
- Ray handles placement across cluster nodes

---

### 4. Data Flow: Query to Execution

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Execution Flow                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User Query                                                                │
│      │                                                                     │
│      ▼                                                                     │
│  FastAPI Endpoint (python-chatbot/server/app/main.py:129)                  │
│      │                                                                     │
│      ▼                                                                     │
│  BAML Orchestrator (b.OrchestrateREPLTasks)                               │
│      │                                                                     │
│      ▼                                                                     │
│  Tool Array: [SpawnREPL, SpawnREPL, Resume]                               │
│      │                                                                     │
│      ▼                                                                     │
│  REPLToolHandler.handle_batch_spawn()                                      │
│      │                                                                     │
│      ▼                                                                     │
│  RayREPLPool.execute_batch()                                               │
│      │                                                                     │
│      ▼                                                                     │
│  ActorPool.map() ──────┬──────────┬──────────┐                            │
│                        │          │          │                             │
│                        ▼          ▼          ▼                             │
│                   Actor 1    Actor 2    Actor 3                            │
│                        │          │          │                             │
│                        ▼          ▼          ▼                             │
│                 SecureREPLEnv executions (parallel)                        │
│                        │          │          │                             │
│                        └──────────┼──────────┘                             │
│                                   ▼                                        │
│                           Results returned                                 │
│                                   │                                        │
│                                   ▼                                        │
│                    Update state.completed_results                          │
│                                   │                                        │
│                                   ▼                                        │
│                    If Resume: call orchestrator again                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Current Implementation Files

<details>
<summary><b>Core REPL Components (11 files)</b></summary>

| File | Purpose | Lines |
|------|---------|-------|
| `rlm/repl.py` | Original sync REPL with threading.Lock | ~356 |
| `rlm/async_repl_env.py` | Async REPL without lock | ~317 |
| `rlm/secure_repl_env.py` | Security-hardened REPL | ~179 |
| `rlm/ray_repl_actor.py` | Ray actor wrapper | ~180 |
| `rlm/ray_repl_pool.py` | Ray ActorPool manager | ~289 |
| `rlm/repl_pool.py` | Local pool (Phase 2) | ~315 |
| `rlm/repl_state.py` | State machine definition | ~86 |
| `rlm/session_manager.py` | TTL-based session tracking | ~195 |
| `rlm/task_queue.py` | FIFO task queue | ~100 |
| `rlm/repl_tool_handler.py` | BAML tool bridge | ~149 |
| `rlm/logger/repl_logger.py` | Execution logging | ~80 |

</details>

<details>
<summary><b>Test Files (26 REPL-specific tests)</b></summary>

| Test File | Coverage |
|-----------|----------|
| `test_async_repl_env.py` | Async REPL (13 tests) |
| `test_secure_repl_env.py` | Security features (8 tests) |
| `test_ray_repl_actor.py` | Actor behavior |
| `test_ray_repl_pool.py` | Pool management |
| `test_repl_pool.py` | Local pooling |
| `test_repl_state.py` | State machine |
| `test_session_lifecycle.py` | Session TTL |
| `test_concurrent_execution.py` | Parallelism |
| `test_phase1_integration.py` | Phase 1 E2E |
| `test_phase2_integration.py` | Phase 2 E2E |
| `test_phase3_ray_integration.py` | Phase 3 E2E |
| `test_ray_scale_10.py` | 10 actor scale |
| `test_ray_scale_50.py` | 50 actor scale |
| `test_ray_scale_200.py` | 200 actor scale |

</details>

---

### 6. Rust Integration Analysis

The user wants to explore **Rust for the REPL environment** for speed and memory safety. Here's an analysis of the current architecture and where Rust would fit:

#### What Rust Would Replace

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rust Integration Points                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────┐                      │
│  │         KEEP IN PYTHON                 │                      │
│  ├───────────────────────────────────────┤                      │
│  │  • FastAPI server                      │                      │
│  │  • BAML client/orchestration           │                      │
│  │  • Ray cluster management              │                      │
│  │  • Session/state management            │                      │
│  │  • REPLToolHandler                     │                      │
│  └───────────────────────────────────────┘                      │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────┐                      │
│  │         REPLACE WITH RUST              │                      │
│  ├───────────────────────────────────────┤                      │
│  │  • SecureREPLEnv execution core        │                      │
│  │  • Code sandboxing/isolation           │                      │
│  │  • Import/file access control          │                      │
│  │  • stdout/stderr capture               │                      │
│  └───────────────────────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Rust REPL Implementation Options

| Approach | Description | Complexity |
|----------|-------------|------------|
| **PyO3 Extension** | Rust module called from Python | Medium |
| **Separate Process** | Rust binary spawned per execution | Medium |
| **Ray Rust Actor** | Native Ray actor in Rust | High |
| **gRPC Service** | Standalone Rust REPL service | Medium-High |

#### What Rust Would Execute

The current REPL executes **Python code** from the LLM:

```python
# Example SpawnREPL code_to_execute
code = """
import math
import pandas as pd
data = [1, 2, 3, 4, 5]
result = sum(data) / len(data)
print(f"Average: {result}")
"""
```

**Options for Rust execution:**

1. **Embed Python interpreter** (RustPython, PyO3): Execute Python in Rust process
2. **Execute Rust code instead**: Change LLM to generate Rust code
3. **DSL interpretation**: Define limited DSL that Rust executes natively
4. **WASM sandbox**: Run code in WASM runtime with Rust host

#### Relevant Rust Ecosystem

| Crate | Purpose | Relevance |
|-------|---------|-----------|
| `pyo3` | Rust/Python interop | Call Rust from Python actors |
| `rustpython` | Python interpreter in Rust | Full Python execution in Rust |
| `wasmtime` | WASM runtime | Sandbox arbitrary code |
| `deno_core` | V8 JavaScript runtime | Alternative JS sandbox |
| `rhai` | Embedded scripting | Safe DSL for Rust |
| `mlua` | Lua bindings | Sandboxed Lua execution |
| `ray-rs` (experimental) | Rust Ray client | Native Ray actors |
| `tokio` | Async runtime | Concurrent execution |
| `tonic` | gRPC framework | Service communication |

#### Architecture Comparison

<table>
<tr>
<th>Current (Python)</th>
<th>Proposed (Rust Core)</th>
</tr>
<tr>
<td>

```
Ray Actor (Python)
    │
    ▼
SecureREPLEnv (Python)
    │
    ▼
ThreadPoolExecutor
    │
    ▼
exec(code, globals)
```

</td>
<td>

```
Ray Actor (Python)
    │
    ▼
PyO3 Rust Extension
    │
    ▼
Rust Sandbox
    │
    ▼
RustPython/WASM exec
```

</td>
</tr>
</table>

#### Performance Characteristics

| Metric | Current Python | Potential Rust |
|--------|---------------|----------------|
| Startup time | ~10-50ms | ~1-5ms |
| Memory per instance | ~50-100MB | ~10-30MB |
| GC pauses | Yes | No |
| Type safety | Runtime | Compile-time |
| Isolation | Process/namespace | Memory-safe by default |

---

### 7. Existing Documentation

The `thoughts/` directory contains extensive planning documents:

| Document | Purpose |
|----------|---------|
| `thoughts/shared/plans/2026-01-13-tdd-200-repl-pool-system.md` | Main TDD plan |
| `thoughts/shared/plans/2026-01-13-tdd-200-repl-pool-system/...-03-phase-3.md` | Ray integration phase |
| `thoughts/shared/plans/2026-01-13-tdd-baml-repl-pool-integration.md` | BAML integration |
| `thoughts/shared/research/2026-01-13-repl-architecture-tool-calls.md` | Architecture analysis |
| `thoughts/shared/research/2026-01-13-baml-repl-pool-integration.md` | BAML integration research |

---

## Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| Master orchestrator | `baml_src/repl_tools.baml` | 60-103 |
| Tool definitions | `baml_src/repl_tools.baml` | 1-59 |
| Tool handler | `rlm/repl_tool_handler.py` | 63-97 |
| Ray pool | `rlm/ray_repl_pool.py` | 88-117 |
| Ray actor | `rlm/ray_repl_actor.py` | 75-132 |
| Secure REPL | `rlm/secure_repl_env.py` | 138-179 |
| Import whitelist | `rlm/secure_repl_env.py` | 32-40, 43-73 |
| File isolation | `rlm/secure_repl_env.py` | 76-136 |
| Async execution | `rlm/async_repl_env.py` | 182-269 |
| State machine | `rlm/repl_state.py` | 21-86 |

---

## Architecture Documentation

### Current Patterns

1. **BAML Discriminated Union** - LLM returns `(SpawnREPL | MessageToUser | Resume)[]`
2. **Ray ActorPool** - Load-balanced distribution across 200 actors
3. **Session Affinity** - Stateful REPLs bound to sessions
4. **Layered Security** - AsyncREPLEnv → SecureREPLEnv inheritance
5. **State Machine** - IDLE → ACTIVE → CLEANING → IDLE lifecycle
6. **Lazy Initialization** - REPL created on first use within actor

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Ray over multiprocessing | Cluster scaling, fault tolerance |
| BAML over raw prompts | Type safety, streaming support |
| ProcessPool → ThreadPool | Security wrappers not picklable |
| No threading.Lock in async | Enable true parallelism |
| Fractional CPUs (0.5) | Allow 2x oversubscription |

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-01-13-tdd-200-repl-pool-system.md` - Phased development approach starting from single REPL to 200-REPL Ray distribution
- `thoughts/shared/plans/2026-01-13-tdd-baml-repl-pool-integration-REVIEW.md` - Review notes on REPLResult field mismatches and session binding
- `thoughts/shared/handoffs/general/2026-01-13_20-55-09_baml-repl-pool-integration.md` - Handoff with action items for BAML integration

---

## Open Questions

1. **Rust execution target**: Should Rust execute Python code (via RustPython/PyO3) or should the LLM generate Rust/DSL code instead?

2. **Integration approach**: PyO3 extension vs standalone process vs gRPC service?

3. **Security model**: How to replicate Python's import whitelist and file isolation in Rust?

4. **Ray compatibility**: Can Rust actors integrate with Ray's Python-centric ActorPool?

5. **LLM code generation**: What changes to BAML prompts are needed if switching to Rust code generation?

---

## Related Research

- [This document] `thoughts/shared/research/2026-01-13-repl-llm-workflow-rust-exploration.md`
- `thoughts/shared/research/2026-01-13-repl-architecture-tool-calls.md`
- `thoughts/shared/research/2026-01-13-baml-repl-pool-integration.md`
