---
date: 2026-01-09 13:06:44 -05:00
researcher: tha-hammer
git_commit: ddeca4783b4921a38620b348b04cbd21aff50c4d
branch: main
repository: silmari-Context-Engine
topic: "Building a Writing Agent with Conversation UI, File Attachments, and Transcription"
tags: [research, codebase, writing-agent, conversation-ui, svelte, audio-transcription, file-attachments, agent-architecture]
status: complete
last_updated: 2026-01-09
last_updated_by: tha-hammer
---

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║              RESEARCH: BUILDING A WRITING AGENT WITH UI                   ║
║                                                                           ║
║              Conversation UI • File Attachments • Transcription           ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Date**: 2026-01-09 13:06:44 -05:00
**Researcher**: tha-hammer
**Git Commit**: `ddeca4783b4921a38620b348b04cbd21aff50c4d`
**Branch**: main
**Repository**: silmari-Context-Engine
**Status**: ✅ Complete

---

## 📋 Research Question

> I want to research how to build a writing agent. The UI should be a typical "conversation" UI using Svelte. a left column for project folders and conversations, a center column for the conversation and messages. the user message area should allow for attachments. The purpose of the agent is to ingest the writers raw text or recording, transcribe any recording, identify key themes in the object and write based on the user prompt

---

## 🎯 Executive Summary

After conducting comprehensive research across the **silmari-Context-Engine** codebase, I found that:

### ❌ **Components NOT Currently Implemented**

| Component | Status | Notes |
|-----------|--------|-------|
| Svelte Conversation UI | ❌ Not implemented | Planned for Next.js + React instead |
| File Upload/Attachments | ❌ Not implemented | No web UI components exist |
| Audio Transcription | ❌ Not implemented | No audio processing libraries integrated |
| Recording Capture | ❌ Not implemented | No browser audio APIs implemented |

### ✅ **Components That DO Exist**

| Component | Status | Location |
|-----------|--------|----------|
| Agent Architecture | ✅ Fully implemented | Python + Go orchestrators |
| Multi-Step Workflows | ✅ Fully implemented | 6-phase RLM-Act pipeline |
| Context Management | ✅ Fully implemented | Context Window Array (CWA) |
| Theme Extraction | ✅ Fully implemented | BAML-based requirement decomposition |
| Text Generation | ✅ Fully implemented | Claude/GPT-4 integration via BAML |
| Conversation State | ✅ Fully implemented | Checkpoint & resume system |

---

## 📊 Current Architecture vs. Desired Features

<table>
<tr>
<td width="50%">

### 🎯 **DESIRED: Writing Agent UI**
- Svelte conversation interface
- Left sidebar: projects & conversations
- Center panel: chat messages
- File attachment area
- Audio recording + transcription
- Theme identification
- Content generation

</td>
<td width="50%">

### 🏗️ **CURRENT: silmari-Context-Engine**
- CLI-based orchestration (Python + Go)
- Agent pipeline architecture
- Context management system
- BAML LLM integration
- Multi-step workflows
- State checkpointing
- **NO WEB UI**

</td>
</tr>
</table>

---

## 📚 Detailed Findings

### 🚫 1. SVELTE CONVERSATION UI (NOT FOUND)

#### Current State
```
❌ ZERO Svelte files found in codebase
❌ NO .svelte components
❌ NO frontend/ directory
❌ NO package.json for web project
```

#### What's Planned Instead

The project **has detailed sprint plans** for building a web UI, but using **Next.js + React (TypeScript)** with **shadcn/ui** components, **NOT Svelte**.

**📁 Planned UI Architecture** (from sprint files):

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          ← Main layout wrapper
│   │   ├── Sidebar.tsx            ← Left navigation (collapsible) ✅ MATCHES YOUR REQUEST
│   │   ├── TopBar.tsx             ← Header with user menu
│   │   └── PageHeader.tsx         ← Page titles
│   ├── chat/
│   │   ├── AIChat.tsx             ← Conversation view ✅ MATCHES YOUR REQUEST
│   │   ├── AIMessage.tsx          ← Message components ✅ MATCHES YOUR REQUEST
│   │   ├── StreamingMessage.tsx   ← Streaming responses
│   │   ├── ConversationList.tsx   ← Conversation history ✅ MATCHES YOUR REQUEST
│   │   └── MessageInput.tsx       ← User input area
│   ├── auth/
│   └── ui/ (shadcn components)
└── app/ (Next.js App Router)
```

**📖 Reference Documents:**
- `sprints/sprint_04_web_ui_shell.md` - Layout & sidebar specs
- `sprints/sprint_09_direct_messaging.md` - Three-column layout (conversations + chat + details)
- `sprints/sprint_10_ai_chat.md` - AI conversation interface with streaming
- `sprints/sprint_12_chat_memory.md` - Conversation context integration

**🎨 Planned Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| State | Zustand |
| Real-time | WebSockets + SSE |
| Icons | Lucide React |

---

### 🚫 2. FILE ATTACHMENTS & UPLOADS (NOT FOUND)

#### Current State
```
❌ NO file upload components
❌ NO drag-and-drop handlers
❌ NO FormData handling in UI
❌ NO attachment display components
❌ NO file preview components
```

#### What Exists Instead

The codebase only has **backend file I/O** for reading files from disk, not user uploads:

**📁 Backend File Handling:**

| Location | Purpose |
|----------|---------|
| `planning_pipeline/helpers.py` | File discovery and reading from filesystem |
| `go/internal/planning/claude_runner.go` | `RunClaudeWithFile()` - reads files from disk |
| `go/internal/fs/path.go` | Generic filesystem operations |

**Example:** Reading research files
```python
# planning_pipeline/helpers.py
def extract_file_paths(text: str) -> List[str]:
    """Extract file paths from text output"""

def read_file_content(file_path: str) -> str:
    """Read file from filesystem"""
```

**❌ NOT user-facing upload components** - Just backend utilities.

---

### 🚫 3. AUDIO TRANSCRIPTION (NOT FOUND)

#### Current State
```
❌ NO audio recording components
❌ NO transcription services integrated
❌ NO audio processing libraries
❌ NO MediaRecorder API usage
❌ NO Whisper/Speech-to-Text clients
```

#### Detailed Search Results

**Comprehensive search across:**
- ✅ Python files (`**/*.py`) - NO audio imports
- ✅ Go files (`**/*.go`) - NO audio packages
- ✅ TypeScript files (`**/*.ts`) - NO audio found
- ✅ BAML definitions (`baml_src/`) - NO audio types used
- ✅ Documentation - NO audio mentions

**🔍 What I Checked:**

| Search Target | Result |
|--------------|--------|
| Python audio libraries | ❌ No `librosa`, `pydub`, `sounddevice`, `soundfile` |
| Transcription services | ❌ No OpenAI Whisper, Google Speech-to-Text, Azure Speech |
| BAML audio types | ⚠️ `audio` type **exists** in BAML spec but **unused** |
| Frontend audio components | ❌ No `MediaRecorder`, `AudioContext`, recording UI |

**📖 BAML Audio Type (Available but Unused):**

```baml
// From CLAUDE.md documentation
### Multimodal Types
image    // for vision models
audio    // for audio models ← EXISTS BUT NOT USED
video    // for video models
pdf      // for document models
```

**Conclusion:** BAML **supports** audio types architecturally, but they're not configured or used anywhere in the application.

---

### ✅ 4. AGENT ARCHITECTURE (FULLY IMPLEMENTED)

This is where the codebase **shines**. Comprehensive agent orchestration exists.

#### 4.1 Core Orchestrators

<details>
<summary><b>📁 Primary Orchestrators (3 files)</b></summary>

| File | Lines | Purpose |
|------|-------|---------|
| `orchestrator.py` | 1,367 | Autonomous project builder using Claude Code |
| `loop-runner.py` | 1,382 | Continuous feature implementation loop |
| `planning_orchestrator.py` | 597 | 7-step planning pipeline orchestrator |

</details>

**🎯 Key Capabilities:**

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT ORCHESTRATION FEATURES                               │
├─────────────────────────────────────────────────────────────┤
│  ✅ Multi-session orchestration loops                       │
│  ✅ Feature complexity detection (high/medium/low)          │
│  ✅ Subagent invocation (@code-reviewer, @test-runner)      │
│  ✅ Dependency resolution (topological sort)                │
│  ✅ Blocked feature management                              │
│  ✅ Session logging and progress tracking                   │
│  ✅ Checkpoint-based resume capability                      │
│  ✅ Interactive and autonomous modes                        │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2 RLM-Act Pipeline (6-Phase Workflow)

**Location:** `silmari_rlm_act/pipeline.py`

```
╔═══════════════════════════════════════════════════════════════╗
║                    RLM-ACT PIPELINE                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Phase 1: RESEARCH            │ Gather context               ║
║  Phase 2: DECOMPOSITION        │ Break into testable pieces  ║
║  Phase 3: TDD_PLANNING         │ Red-Green-Refactor plan     ║
║  Phase 4: MULTI_DOC            │ Split into phase documents  ║
║  Phase 5: BEADS_SYNC           │ Task tracking integration   ║
║  Phase 6: IMPLEMENTATION       │ Execute TDD cycles          ║
╚═══════════════════════════════════════════════════════════════╝
```

**🎮 Autonomy Modes:**

| Mode | Description |
|------|-------------|
| `CHECKPOINT` | Pause at each phase for review |
| `FULLY_AUTONOMOUS` | Run without stopping |
| `BATCH` | Group phases with pauses between groups |

**📁 Phase Implementation Files:**
```
silmari_rlm_act/phases/
├── research.py         (400+ lines)
├── decomposition.py    (350+ lines)
├── tdd_planning.py     (430+ lines)
├── multi_doc.py        (500+ lines)
├── beads_sync.py       (300+ lines)
└── implementation.py   (250+ lines)
```

#### 4.3 State Management & Checkpointing

**📁 Checkpoint System:**

| Component | File | Purpose |
|-----------|------|---------|
| Checkpoint Manager | `silmari_rlm_act/checkpoints/manager.py` | Save/load pipeline state |
| Interactive Prompts | `silmari_rlm_act/checkpoints/interactive.py` | User menus at each phase |
| Pipeline State | `silmari_rlm_act/models.py` | State models & enums |

**💾 Checkpoint Features:**
- JSON checkpoint files in `.rlm-act-checkpoints/`
- Git commit tracking
- Phase result persistence
- Resume point detection
- Cleanup operations

**Example Checkpoint Structure:**
```json
{
  "id": "ckpt_abc123",
  "phase": "DECOMPOSITION",
  "timestamp": "2026-01-09T13:00:00Z",
  "state": { /* full pipeline state */ },
  "git_commit": "ddeca4783b4921a38620b348b04cbd21aff50c4d",
  "errors": []
}
```

---

### ✅ 5. CONTEXT MANAGEMENT (PROJECT/FOLDER ORGANIZATION)

#### 5.1 Context Window Array (CWA)

**Purpose:** Addressable context storage with semantic search for organizing conversation history and project artifacts.

**📁 Core Components:**

| Component | File | Purpose |
|-----------|------|---------|
| Central Store | `context_window_array/store.py` | Addressable entry storage with CRUD |
| Search Index | `context_window_array/search_index.py` | TF-IDF semantic search |
| Working Context | `context_window_array/working_context.py` | Summary-only views for orchestrator |
| Entry Models | `context_window_array/models.py` | Entry types & data structures |
| CWA Integration | `silmari_rlm_act/context/cwa_integration.py` | High-level interface |

**🗂️ Context Entry Types:**
```python
class EntryType(Enum):
    FILE = "file"
    COMMAND = "command"
    COMMAND_RESULT = "command_result"
    TASK = "task"
    TASK_RESULT = "task_result"
    SEARCH_RESULT = "search_result"
    SUMMARY = "summary"
    CONTEXT_REQUEST = "context_request"
```

**🔍 Key Features:**

```
┌───────────────────────────────────────────────────────────┐
│  CONTEXT MANAGEMENT CAPABILITIES                          │
├───────────────────────────────────────────────────────────┤
│  ✅ Addressable storage (ctx_XXXXXX IDs)                  │
│  ✅ Semantic search (TF-IDF + cosine similarity)          │
│  ✅ TTL-based lifecycle (expire after N turns)            │
│  ✅ Compression (keep summary, discard content)           │
│  ✅ Tiered context views (summary vs. full content)       │
│  ✅ Batch processing (group tasks respecting limits)      │
│  ✅ Entry type filtering                                  │
└───────────────────────────────────────────────────────────┘
```

#### 5.2 Conversation State Patterns

**📊 State Organization:**

| Layer | View Type | Content | Audience |
|-------|-----------|---------|----------|
| **Working Context** | Summary-only | Titles + summaries | Orchestrator LLM |
| **Implementation Context** | Full content | Complete details | Implementation agents |
| **Central Store** | Full storage | Everything | Backend system |

**Example Usage:**
```python
# Create central store
store = CentralContextStore()

# Add research entry
store.add(ContextEntry(
    id="ctx_001",
    type=EntryType.SUMMARY,
    content="Full research findings...",
    summary="Research on writing agents",
    source="research_phase"
))

# Search for relevant context
results = store.search("writing agent patterns")

# Build working context for orchestrator
working_ctx = WorkingLLMContext.from_store(store)
# ← Contains only summaries, not full content
```

---

### ✅ 6. THEME EXTRACTION & CONTENT ANALYSIS

#### 6.1 Requirement Decomposition (Theme Identification)

**Location:** `planning_pipeline/decomposition.py`

**Purpose:** Extract hierarchical requirements and themes from raw text using Claude.

**📊 Decomposition Process:**

```
Raw User Input
      ↓
  ┌─────────────────────────────────────┐
  │  decompose_requirements()           │
  │  via BAML + Claude                  │
  └─────────────────────────────────────┘
      ↓
  ┌─────────────────────────────────────┐
  │  3-Tier Requirement Hierarchy       │
  │  • Parent Requirements              │
  │  • Sub-Processes                    │
  │  • Implementation Details           │
  └─────────────────────────────────────┘
      ↓
  Stored in Context Window Array
```

**📁 Key Functions:**
```python
# planning_pipeline/decomposition.py
def decompose_requirements(
    raw_input: str,
    config: DecompositionConfig
) -> RequirementHierarchy:
    """Extract structured requirements from raw text"""
```

**📋 Requirement Structure:**
```python
@dataclass
class RequirementNode:
    id: str
    text: str
    acceptance_criteria: List[str]
    implementation_components: ImplementationComponents
    category: str  # ← Theme categorization
    parent: Optional[RequirementNode]
    children: List[RequirementNode]
```

#### 6.2 Category Analysis (Theme Schemas)

**Location:** `baml_src/schema/`

**Available Category Schemas:**

| Schema | Purpose |
|--------|---------|
| `CategoryAnalysisSchema.baml` | General requirement categorization |
| `CategoryFunctionalSchema.baml` | Functional features |
| `CategoryNonFunctionalSchema.baml` | Quality attributes |
| `CategoryIntegrationSchema.baml` | Integration patterns |
| `CategoryPerformanceSchema.baml` | Performance analysis |
| `CategorySecuritySchema.baml` | Security requirements |
| `CategoryUsabilitySchema.baml` | Usability features |

**Example Analysis Output:**
```json
{
  "categories": [
    {
      "name": "Content Generation",
      "theme": "Writing assistance and text generation",
      "requirements": ["..."],
      "priority": "high"
    },
    {
      "name": "Audio Processing",
      "theme": "Voice recording and transcription",
      "requirements": ["..."],
      "priority": "medium"
    }
  ]
}
```

#### 6.3 Semantic Search & Context Retrieval

**Location:** `context_window_array/search_index.py`

**Implementation:** TF-IDF with cosine similarity (no heavy embeddings)

```python
class VectorSearchIndex:
    def search(
        self,
        query: str,
        limit: int = 10
    ) -> List[SearchResult]:
        """
        Semantic search using TF-IDF vectors
        1. Tokenize query
        2. Compute TF-IDF vector
        3. Calculate cosine similarity with all entries
        4. Return top N results by score
        """
```

**Example Search:**
```python
# Find entries about "writing agent patterns"
results = index.search("writing agent patterns")

for result in results:
    print(f"{result.entry_id}: {result.score:.2f}")
    # ctx_123: 0.87
    # ctx_456: 0.64
```

---

### ✅ 7. TEXT GENERATION & LLM INTEGRATION

#### 7.1 BAML Integration

**Purpose:** Structured LLM interactions with type-safe outputs

**📁 BAML Configuration:**

| Component | File | Purpose |
|-----------|------|---------|
| Function Definitions | `baml_src/functions.baml` | Prompt templates |
| Type Schemas | `baml_src/types.baml` | Response structures |
| LLM Clients | `baml_src/clients.baml` | Provider configs |

**🤖 Configured LLM Providers:**

```
┌─────────────────────────────────────────────────────────┐
│  LLM PROVIDER CONFIGURATION                             │
├─────────────────────────────────────────────────────────┤
│  ✅ OpenAI (GPT-4o, GPT-4o-mini)                        │
│  ✅ Anthropic (Claude Sonnet, Claude Haiku)             │
│  ✅ Ollama (local models)                               │
│  ✅ Fallback strategies (round-robin, exponential)      │
│  ✅ Retry policies (constant, exponential backoff)      │
└─────────────────────────────────────────────────────────┘
```

**Example BAML Client:**
```baml
client<llm> GPT4o {
  provider openai
  options {
    model gpt-4o
    api_key env.OPENAI_API_KEY
    temperature 0.7
  }
}

retry_policy ExponentialBackoff {
  max_retries 3
  strategy exponential
  backoff_ms 1000
}
```

#### 7.2 Claude SDK Integration

**Location:** `planning_pipeline/claude_runner.py`

**Purpose:** Execute Claude commands with streaming output

**Key Functions:**
```python
def run_claude_sync(
    prompt: str,
    context_timeout: int = 120,
    stream: bool = True
) -> ClaudeResult:
    """
    Synchronous Claude invocation with streaming
    Returns structured result with output and exit code
    """
```

**🎯 Features:**
- ✅ Streaming output capture
- ✅ Context timeout management
- ✅ SDK-native vs subprocess execution
- ✅ Tool call formatting
- ✅ JSON event emission

#### 7.3 Prompt Building & Generation

**Location:** `orchestrator.py`

**Prompt Builders:**

| Function | Purpose |
|----------|---------|
| `build_init_prompt()` | Project initialization instructions |
| `build_implement_prompt()` | Feature implementation (complexity-aware) |
| `build_qa_prompt()` | QA testing prompts |
| `build_continue_prompt()` | Session continuation |

**Example:** Complexity-aware prompting
```python
def build_implement_prompt(
    feature: Feature,
    complexity: str  # high/medium/low
) -> str:
    """
    Build prompt with appropriate rules based on complexity:
    - HIGH: Strict planning, full decomposition
    - MEDIUM: Balanced approach
    - LOW: Quick implementation, minimal ceremony
    """
```

---

## 🏗️ Building Your Writing Agent: Gap Analysis

### ❌ What You Need to Build

<table>
<tr>
<th width="30%">Component</th>
<th width="35%">Current State</th>
<th width="35%">Required Work</th>
</tr>
<tr>
<td><b>🎨 Svelte UI</b></td>
<td>❌ Not planned (Next.js instead)</td>
<td>
• Build Svelte app from scratch<br>
• Create conversation components<br>
• Implement sidebar layout<br>
• Add message rendering
</td>
</tr>
<tr>
<td><b>📎 File Attachments</b></td>
<td>❌ No web components</td>
<td>
• File upload component<br>
• Drag & drop zone<br>
• Attachment preview<br>
• FormData handling<br>
• Backend upload endpoint
</td>
</tr>
<tr>
<td><b>🎤 Audio Transcription</b></td>
<td>❌ Not implemented</td>
<td>
• Browser audio recording (MediaRecorder)<br>
• Upload to transcription service<br>
• Integrate Whisper/Speech-to-Text<br>
• Display transcription results<br>
• Add BAML audio type usage
</td>
</tr>
<tr>
<td><b>🗂️ Project Management UI</b></td>
<td>✅ Backend exists (CWA)</td>
<td>
• UI for browsing projects<br>
• Conversation list component<br>
• Project selection state
</td>
</tr>
</table>

### ✅ What You Can Leverage

| Component | Location | How to Use |
|-----------|----------|------------|
| **Agent Orchestration** | `orchestrator.py`, `silmari_rlm_act/` | Use RLM-Act pipeline for multi-step writing workflow |
| **Theme Extraction** | `planning_pipeline/decomposition.py` | Extract themes from raw text input |
| **Context Management** | `context_window_array/` | Store conversation history & project artifacts |
| **LLM Integration** | `baml_src/`, `planning_pipeline/claude_runner.py` | Generate content via Claude/GPT-4 |
| **State Persistence** | `silmari_rlm_act/checkpoints/` | Save conversation state |

---

## 🛠️ Recommended Architecture

### Option 1: Extend Current System (Backend-focused)

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR WRITING AGENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐     ┌──────────────────┐             │
│  │  Svelte Frontend │────▶│  FastAPI Backend │             │
│  │  (NEW)           │     │  (NEW)           │             │
│  │                  │     │                  │             │
│  │  • Conversation  │     │  • File uploads  │             │
│  │  • Attachments   │     │  • Whisper API   │             │
│  │  • Recording     │     │  • Theme extract │             │
│  └──────────────────┘     └────────┬─────────┘             │
│                                    │                        │
│                            ┌───────▼───────────┐            │
│                            │ silmari-Context-  │            │
│                            │    Engine         │            │
│                            │                   │            │
│                            │  • CWA            │            │
│                            │  • RLM-Act        │            │
│                            │  • BAML           │            │
│                            │  • Orchestration  │            │
│                            └───────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

**Approach:**
1. Build Svelte frontend (conversations + attachments + recording)
2. Create FastAPI backend for web endpoints
3. Integrate with existing Context Engine for:
   - Theme extraction via decomposition pipeline
   - Content generation via BAML + Claude
   - Conversation state via CWA
   - Multi-turn workflow via RLM-Act

### Option 2: Standalone Writing Agent

```
┌──────────────────────────────────────────────────────────┐
│              STANDALONE WRITING AGENT                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐                                        │
│  │   Svelte UI  │                                        │
│  │              │                                        │
│  │  • Sidebar   │                                        │
│  │  • Messages  │                                        │
│  │  • Upload    │                                        │
│  │  • Record    │                                        │
│  └───────┬──────┘                                        │
│          │                                               │
│  ┌───────▼───────────────────────────────────┐          │
│  │         FastAPI Backend                    │          │
│  │                                            │          │
│  │  ┌──────────────┐  ┌──────────────┐      │          │
│  │  │ File Handler │  │ Audio Module │      │          │
│  │  └──────────────┘  └──────────────┘      │          │
│  │                                            │          │
│  │  ┌──────────────┐  ┌──────────────┐      │          │
│  │  │ Theme Extract│  │ Writing Agent│      │          │
│  │  │ (BAML)       │  │ (Claude)     │      │          │
│  │  └──────────────┘  └──────────────┘      │          │
│  │                                            │          │
│  │  ┌──────────────────────────────────┐    │          │
│  │  │   PostgreSQL / SQLite            │    │          │
│  │  │   (conversations + projects)     │    │          │
│  │  └──────────────────────────────────┘    │          │
│  └───────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

**Approach:**
1. Build from scratch as standalone app
2. Borrow code patterns from Context Engine:
   - CWA for conversation storage
   - BAML integration for LLM calls
   - Checkpoint pattern for state
3. Simpler architecture without full pipeline

---

## 💡 Implementation Roadmap

### Phase 1: Core Backend (API Server)

```
┌──────────────────────────────────────────────────┐
│  🎯 Goal: REST API for writing agent             │
├──────────────────────────────────────────────────┤
│  1. FastAPI server setup                         │
│  2. File upload endpoint (/api/upload)           │
│  3. Audio upload + Whisper transcription         │
│  4. Theme extraction endpoint                    │
│  5. Content generation endpoint                  │
│  6. Conversation CRUD endpoints                  │
└──────────────────────────────────────────────────┘
```

**Reference Code to Adapt:**
- `planning_pipeline/decomposition.py` → Theme extraction
- `planning_pipeline/claude_runner.py` → LLM invocation
- `context_window_array/store.py` → Conversation storage

### Phase 2: Audio Transcription

```
┌──────────────────────────────────────────────────┐
│  🎯 Goal: Record + transcribe audio              │
├──────────────────────────────────────────────────┤
│  1. Choose transcription service:                │
│     • OpenAI Whisper API (easiest)               │
│     • Google Speech-to-Text                      │
│     • Azure Speech Services                      │
│  2. Add BAML audio type usage                    │
│  3. Create audio upload handler                  │
│  4. Store transcription results                  │
└──────────────────────────────────────────────────┘
```

**Example Integration:**
```python
# New file: audio_service.py
import openai

async def transcribe_audio(file_path: str) -> str:
    """Transcribe audio using OpenAI Whisper"""
    with open(file_path, "rb") as audio_file:
        transcript = await openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file
        )
    return transcript.text
```

### Phase 3: Svelte Frontend

```
┌──────────────────────────────────────────────────┐
│  🎯 Goal: Conversation UI with attachments       │
├──────────────────────────────────────────────────┤
│  1. SvelteKit project setup                      │
│  2. Layout components:                           │
│     • Sidebar (projects + conversations)         │
│     • ConversationView (messages)                │
│     • MessageInput (text + attachments)          │
│  3. File upload component                        │
│  4. Audio recording component (MediaRecorder)    │
│  5. WebSocket or SSE for streaming responses     │
└──────────────────────────────────────────────────┘
```

**Component Structure:**
```
src/
├── routes/
│   ├── +layout.svelte           ← App shell
│   └── conversation/
│       └── [id]/
│           └── +page.svelte     ← Conversation view
├── lib/
│   ├── components/
│   │   ├── Sidebar.svelte       ← Project + conversation list
│   │   ├── MessageList.svelte   ← Chat messages
│   │   ├── MessageInput.svelte  ← User input + attachments
│   │   ├── FileUpload.svelte    ← Drag & drop file zone
│   │   └── AudioRecorder.svelte ← Recording widget
│   ├── stores/
│   │   └── conversation.ts      ← Conversation state
│   └── api/
│       └── client.ts             ← API client
```

### Phase 4: Theme Extraction Integration

```
┌──────────────────────────────────────────────────┐
│  🎯 Goal: Identify key themes in user input      │
├──────────────────────────────────────────────────┤
│  1. Adapt decomposition.py for writing context  │
│  2. Extract themes from transcribed audio        │
│  3. Extract themes from text input               │
│  4. Display themes in UI                         │
│  5. Use themes to guide content generation       │
└──────────────────────────────────────────────────┘
```

**API Endpoint:**
```python
@app.post("/api/extract-themes")
async def extract_themes(request: ThemeRequest):
    """Extract key themes from input text"""
    # Use decomposition pipeline
    hierarchy = decompose_requirements(
        raw_input=request.text,
        config=DecompositionConfig()
    )

    # Return themes
    return {
        "themes": [node.category for node in hierarchy.nodes],
        "key_points": [node.text for node in hierarchy.nodes]
    }
```

---

## 📖 Code References

### Agent Architecture

| File | Lines | Purpose |
|------|-------|---------|
| `orchestrator.py` | 1,367 | Autonomous project builder |
| `loop-runner.py` | 1,382 | Continuous feature implementation |
| `planning_orchestrator.py` | 597 | 7-step planning pipeline |
| `silmari_rlm_act/pipeline.py` | 200+ | 6-phase RLM-Act orchestrator |
| `silmari_rlm_act/phases/research.py` | 400+ | Research phase |
| `silmari_rlm_act/phases/decomposition.py` | 350+ | Decomposition phase |

### Context Management

| File | Lines | Purpose |
|------|-------|---------|
| `context_window_array/store.py` | 300+ | Central context storage |
| `context_window_array/search_index.py` | 200+ | Semantic search (TF-IDF) |
| `context_window_array/working_context.py` | 150+ | Working context for LLMs |
| `context_window_array/models.py` | 200+ | Entry models & types |
| `silmari_rlm_act/context/cwa_integration.py` | 250+ | CWA high-level interface |

### LLM Integration

| File | Lines | Purpose |
|------|-------|---------|
| `baml_src/functions.baml` | 80+ | BAML function definitions |
| `baml_src/clients.baml` | 50+ | LLM client configurations |
| `baml_src/types.baml` | 500+ | Response type schemas |
| `planning_pipeline/claude_runner.py` | 300+ | Claude SDK integration |
| `planning_pipeline/decomposition.py` | 250+ | Requirement decomposition |

### State & Checkpointing

| File | Lines | Purpose |
|------|-------|---------|
| `silmari_rlm_act/models.py` | 200+ | Pipeline state models |
| `silmari_rlm_act/checkpoints/manager.py` | 150+ | Checkpoint persistence |
| `silmari_rlm_act/checkpoints/interactive.py` | 200+ | Interactive prompts |
| `planning_pipeline/checkpoint_manager.py` | 100+ | Legacy checkpoint functions |

---

## 🗂️ Historical Context (from thoughts/)

### Agent Architecture Documentation

| Document | Topic |
|----------|-------|
| `shared/plans/2026-01-05-tdd-silmari-rlm-act/00-overview.md` | RLM-Act pipeline overview |
| `shared/plans/2026-01-05-tdd-silmari-rlm-act/01-core-models.md` | Core agent models |
| `shared/plans/2026-01-05-tdd-silmari-rlm-act/04-cwa-integration.md` | Context integration |
| `shared/research/2026-01-01-loop-runner-integrated-orchestrator-analysis.md` | Loop runner architecture |
| `shared/research/2026-01-06-implementation-phase-runner-gap.md` | Implementation phase gaps |

### UI & Output Patterns

| Document | Topic |
|----------|-------|
| `shared/research/2026-01-04-terminal-streaming-output-flow.md` | Streaming output patterns |
| `shared/research/2026-01-02-delta-first-docs-express-integration.md` | Express.js web integration |
| `shared/docs/2026-01-01-how-to-use-cli-commands.md` | CLI command docs |
| `shared/research/2026-01-06-cli-checkpoint-resume-gaps.md` | CLI checkpoint options |

### Context Management

| Document | Topic |
|----------|-------|
| `shared/docs/2026-01-05-how-to-use-context-window-array.md` | CWA usage guide |
| `shared/docs/2026-01-06-how-to-build-and-run-go-context-engine.md` | Go implementation |

---

## 🎯 Key Architectural Patterns to Reuse

### 1️⃣ Phase-Based Workflow
```python
# From silmari_rlm_act/pipeline.py
class WritingAgentPipeline:
    phases = [
        IngestPhase(),      # ← Accept text/audio/files
        TranscribePhase(),  # ← Convert audio to text
        AnalyzePhase(),     # ← Extract themes
        GeneratePhase(),    # ← Create content
        ReviewPhase()       # ← User review
    ]
```

### 2️⃣ Context Window Management
```python
# From context_window_array/
store = CentralContextStore()

# Store conversation turns
store.add(ContextEntry(
    type=EntryType.TASK,
    content="User input...",
    summary="Writing request about X"
))

# Retrieve relevant context
context = store.search("previous writing about X")
```

### 3️⃣ Checkpoint & Resume
```python
# From silmari_rlm_act/checkpoints/
manager = CheckpointManager()

# Save state
manager.save_checkpoint(
    phase="generate",
    state=current_state
)

# Resume later
state = manager.load_checkpoint("generate")
```

### 4️⃣ LLM Integration
```python
# From planning_pipeline/
result = run_claude_sync(
    prompt=build_writing_prompt(
        theme=themes,
        context=conversation_context,
        user_input=input_text
    ),
    stream=True
)
```

---

## 🚀 Quick Start: Minimal Viable Writing Agent

### Backend (FastAPI)

```python
# app.py
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import openai

app = FastAPI()

class GenerateRequest(BaseModel):
    text: str
    themes: list[str] = []

@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Transcribe audio using Whisper"""
    transcript = await openai.Audio.transcribe(
        model="whisper-1",
        file=file.file
    )
    return {"text": transcript.text}

@app.post("/api/generate")
async def generate(req: GenerateRequest):
    """Generate content based on input"""
    prompt = f"""
    User input: {req.text}
    Themes: {', '.join(req.themes)}

    Generate well-written content addressing these themes.
    """

    response = await openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )

    return {"content": response.choices[0].message.content}
```

### Frontend (Svelte)

```svelte
<!-- routes/+page.svelte -->
<script>
  let input = '';
  let recording = false;
  let response = '';

  async function handleSubmit() {
    const res = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ text: input }),
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    response = data.content;
  }

  async function startRecording() {
    // MediaRecorder API
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    // ... recording logic
  }
</script>

<div class="app">
  <aside class="sidebar">
    <!-- Projects & conversations -->
  </aside>

  <main class="conversation">
    <div class="messages">
      {#if response}
        <div class="message assistant">{response}</div>
      {/if}
    </div>

    <form on:submit|preventDefault={handleSubmit}>
      <textarea bind:value={input} />
      <button type="button" on:click={startRecording}>🎤 Record</button>
      <button type="submit">Send</button>
    </form>
  </main>
</div>
```

---

## 📊 Summary Table

| Feature | Exists in Codebase | Ready to Use | Needs Building |
|---------|-------------------|--------------|----------------|
| **Conversation UI (Svelte)** | ❌ | No | ✅ Build from scratch |
| **File Attachments** | ❌ | No | ✅ Build components + backend |
| **Audio Recording** | ❌ | No | ✅ MediaRecorder API |
| **Transcription** | ❌ | No | ✅ Integrate Whisper API |
| **Agent Architecture** | ✅ | Yes | 🔄 Adapt for writing workflow |
| **Theme Extraction** | ✅ | Yes | 🔄 Use decomposition pipeline |
| **Content Generation** | ✅ | Yes | 🔄 Use BAML + Claude |
| **Context Management** | ✅ | Yes | 🔄 Use CWA for conversations |
| **State Persistence** | ✅ | Yes | 🔄 Use checkpoint system |

**Legend:**
- ✅ **Exists** - Fully implemented
- ❌ **Missing** - Not implemented
- 🔄 **Adapt** - Exists but needs modification

---

## 🔗 Related Research

- No prior research documents found on this specific topic
- This is the first comprehensive investigation of building a writing agent UI

---

## ❓ Open Questions

1. **UI Framework:** Svelte (requested) vs. Next.js (planned) - which to use?
2. **Audio Storage:** Where to store audio files? Local filesystem? S3? Database?
3. **Transcription Service:** OpenAI Whisper vs. Google Speech-to-Text vs. local Whisper?
4. **Context Limit:** How many conversation turns to maintain in context?
5. **Theme Granularity:** How deep should theme extraction go? Top-level only or hierarchical?
6. **Content Generation:** Streaming responses or complete responses?
7. **Integration Depth:** Deeply integrate with Context Engine or build standalone?

---

## 🎓 Lessons Learned

### What This Codebase Does Well
✅ **Agent orchestration** - Multi-phase workflows with checkpointing
✅ **Context management** - Semantic search and addressable storage
✅ **LLM integration** - Type-safe BAML functions with multiple providers
✅ **State persistence** - Robust checkpoint/resume system

### What's Missing for a Writing Agent
❌ **Web UI** - No frontend components at all
❌ **Real-time communication** - No WebSocket/SSE infrastructure
❌ **Audio processing** - No transcription services integrated
❌ **File upload handling** - No web-based file management

### Recommended Path Forward

**🎯 For Writing Agent:** Build **Standalone App** (Option 2)
- Simpler architecture for specific use case
- Borrow patterns from Context Engine
- Avoid unnecessary complexity of full pipeline

**📚 Patterns to Borrow:**
1. Context Window Array for conversation storage
2. BAML integration for theme extraction + generation
3. Checkpoint pattern for state management
4. Claude runner pattern for LLM invocation

---

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║                         RESEARCH COMPLETE ✅                              ║
║                                                                           ║
║  Next Steps:                                                              ║
║  1. Choose architecture (Standalone vs. Extension)                        ║
║  2. Set up Svelte + FastAPI project                                       ║
║  3. Integrate Whisper API for transcription                               ║
║  4. Adapt decomposition.py for theme extraction                           ║
║  5. Build conversation UI with attachments + recording                    ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

**Document Path:** `thoughts/shared/research/2026-01-09-building-writing-agent-ui.md`
**Generated:** 2026-01-09 13:06:44 -05:00
**Commit:** `ddeca4783b4921a38620b348b04cbd21aff50c4d`
