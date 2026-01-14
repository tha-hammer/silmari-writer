# Phase 3: Svelte Frontend UI

**Date:** 2026-01-10
**Phase:** 3 of 4
**Human-Testable Function:** Can view conversation UI with sidebar, messages, and input area

## Overview

Build SvelteKit frontend with three-column layout: sidebar for projects/conversations, main area for chat messages, and input area with file attachments and audio recording.

## Dependencies

### Requires
- Phase 1 (Backend API) - needs API endpoints for data
- Phase 2 (Audio Transcription) - needs transcription endpoint for recording feature

### Blocks
- Phase 4 (Theme Extraction) - provides UI for theme display

## Changes Required

### New Files to Create

| File | Purpose |
|------|---------|
| `frontend/package.json:1` | SvelteKit dependencies |
| `frontend/svelte.config.js:1` | SvelteKit configuration |
| `frontend/vite.config.ts:1` | Vite build configuration |
| `frontend/src/routes/+layout.svelte:1` | App shell with sidebar |
| `frontend/src/routes/+page.svelte:1` | Landing/conversation list |
| `frontend/src/routes/conversation/[id]/+page.svelte:1` | Conversation view |
| `frontend/src/lib/components/Sidebar.svelte:1` | Left sidebar component |
| `frontend/src/lib/components/MessageList.svelte:1` | Chat messages display |
| `frontend/src/lib/components/MessageInput.svelte:1` | User input with attachments |
| `frontend/src/lib/components/FileUpload.svelte:1` | Drag & drop file zone |
| `frontend/src/lib/components/AudioRecorder.svelte:1` | Recording widget |
| `frontend/src/lib/components/Message.svelte:1` | Single message component |
| `frontend/src/lib/stores/conversation.ts:1` | Conversation state store |
| `frontend/src/lib/stores/messages.ts:1` | Messages state store |
| `frontend/src/lib/api/client.ts:1` | API client wrapper |
| `frontend/src/lib/types.ts:1` | TypeScript type definitions |
| `frontend/src/app.css:1` | Global styles |

### Directory Structure

```
frontend/
├── package.json
├── svelte.config.js
├── vite.config.ts
├── src/
│   ├── app.html
│   ├── app.css
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   └── conversation/
│   │       └── [id]/
│   │           └── +page.svelte
│   └── lib/
│       ├── components/
│       │   ├── Sidebar.svelte
│       │   ├── MessageList.svelte
│       │   ├── MessageInput.svelte
│       │   ├── FileUpload.svelte
│       │   ├── AudioRecorder.svelte
│       │   └── Message.svelte
│       ├── stores/
│       │   ├── conversation.ts
│       │   └── messages.ts
│       ├── api/
│       │   └── client.ts
│       └── types.ts
```

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                         App Shell                            │
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│   Sidebar    │              Conversation View                │
│              │                                               │
│  ┌─────────┐ │  ┌─────────────────────────────────────────┐ │
│  │Projects │ │  │                                         │ │
│  ├─────────┤ │  │            MessageList                  │ │
│  │Convos   │ │  │                                         │ │
│  │  - Chat1│ │  │  ┌─────────────────────────────────┐   │ │
│  │  - Chat2│ │  │  │ Message (user)                  │   │ │
│  │         │ │  │  └─────────────────────────────────┘   │ │
│  └─────────┘ │  │  ┌─────────────────────────────────┐   │ │
│              │  │  │ Message (assistant)             │   │ │
│              │  │  └─────────────────────────────────┘   │ │
│              │  │                                         │ │
│              │  └─────────────────────────────────────────┘ │
│              │                                               │
│              │  ┌─────────────────────────────────────────┐ │
│              │  │            MessageInput                  │ │
│              │  │  [Attach] [Record] [________] [Send]    │ │
│              │  └─────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

### Key Code Patterns

```svelte
<!-- frontend/src/routes/+layout.svelte:1 -->
<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';
  import '../app.css';
</script>

<div class="app">
  <Sidebar />
  <main>
    <slot />
  </main>
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100vh;
  }
</style>
```

```svelte
<!-- frontend/src/lib/components/MessageInput.svelte:1 -->
<script lang="ts">
  import FileUpload from './FileUpload.svelte';
  import AudioRecorder from './AudioRecorder.svelte';

  let message = '';
  let files: File[] = [];

  async function handleSubmit() {
    // Send message with attachments
  }

  function handleFiles(event: CustomEvent<File[]>) {
    files = [...files, ...event.detail];
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <FileUpload on:files={handleFiles} />
  <AudioRecorder on:transcription={handleTranscription} />
  <textarea bind:value={message} />
  <button type="submit">Send</button>
</form>
```

```svelte
<!-- frontend/src/lib/components/AudioRecorder.svelte:1 -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let recording = false;
  let mediaRecorder: MediaRecorder | null = null;

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      await uploadAndTranscribe(blob);
    };

    mediaRecorder.start();
    recording = true;
  }

  async function stopRecording() {
    mediaRecorder?.stop();
    recording = false;
  }

  async function uploadAndTranscribe(blob: Blob) {
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    const { text } = await response.json();
    dispatch('transcription', text);
  }
</script>

<button on:click={recording ? stopRecording : startRecording}>
  {recording ? '⏹ Stop' : '🎤 Record'}
</button>
```

```typescript
// frontend/src/lib/api/client.ts:1
const API_BASE = 'http://localhost:8000';

export async function fetchConversations() {
  const res = await fetch(`${API_BASE}/api/conversations`);
  return res.json();
}

export async function sendMessage(conversationId: string, message: string, files: File[]) {
  const formData = new FormData();
  formData.append('message', message);
  files.forEach(f => formData.append('files', f));

  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: formData
  });
  return res.json();
}
```

## Success Criteria

### Functional Tests
1. **Layout:** Three-column layout renders correctly
2. **Sidebar:** Displays project/conversation list
3. **Navigation:** Clicking conversation navigates to conversation view
4. **Messages:** Messages display with proper styling (user vs assistant)
5. **Input:** Text input accepts and submits messages
6. **File Upload:** Drag & drop and click-to-upload work
7. **Audio Recording:** Record button captures audio and transcribes

### Human Verification Steps
1. Run `npm run dev` in frontend directory
2. Open browser to `http://localhost:5173`
3. **Verify Layout:**
   - Sidebar visible on left (280px width)
   - Main content area fills remaining space
4. **Verify Sidebar:**
   - Shows "Conversations" heading
   - Lists existing conversations
   - "New Conversation" button present
5. **Verify Conversation View:**
   - Click on a conversation
   - Messages display in scrollable area
   - User messages aligned right (or styled differently)
   - Assistant messages aligned left
6. **Verify Input:**
   - Type a message in input area
   - Press Enter or click Send
   - Message appears in message list
7. **Verify File Upload:**
   - Click attachment button
   - Select a file
   - File appears as attachment preview
   - Or: Drag file onto input area
8. **Verify Audio Recording:**
   - Click record button
   - Browser prompts for microphone permission
   - Recording indicator shows
   - Click stop
   - Transcribed text appears in input

### Test Commands
```bash
# Install dependencies
cd frontend && npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Notes

- Use SvelteKit for routing and SSR capabilities
- Consider Tailwind CSS for styling consistency
- MediaRecorder API requires HTTPS in production (or localhost)
- Store conversation state in Svelte stores for reactivity
- Implement optimistic updates for better UX
- Consider WebSocket for real-time message updates
