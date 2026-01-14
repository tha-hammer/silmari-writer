# Phase 7: End-to-End Integration

**Phase**: 7 of 8
**Estimated Effort**: 6-8 hours
**Dependencies**: Phases 1-6 (all previous phases)
**Blocks**: Phase 8 (deployment)

## Overview

Integrate all components into complete user flows. Connect UI components to state management, implement AI response generation API, and create comprehensive end-to-end tests using Playwright. This phase brings everything together into a working application.

## Behaviors

### Behavior 7.1: Complete User Flow Works

**Testable Function**: `HomePage` component orchestrating complete flows

**Test Coverage (E2E with Playwright)**:
- ✅ **Flow 1: Text Message**
  - Create project → Type message → Send → Receive AI response → Display in conversation
- ✅ **Flow 2: File Attachment**
  - Create project → Attach file → Send message → AI receives file context → Response considers file
- ✅ **Flow 3: Audio Transcription**
  - Record audio → Transcribe → Send as message → Receive response → Display conversation
- ✅ **Flow 4: State Persistence**
  - Create project → Send messages → Reload page → Messages persist → Conversation continues
- ✅ **Flow 5: Multi-Project**
  - Create 2 projects → Add messages to each → Switch between → Correct messages display

## Dependencies

### Requires
- ✅ Phase 1: Project setup, environment variables
- ✅ Phase 2: Layout components (AppLayout, ProjectSidebar)
- ✅ Phase 3: Message input, file attachments
- ✅ Phase 4: Audio recording, transcription
- ✅ Phase 5: Conversation view, message display
- ✅ Phase 6: State management (Zustand store)

### Blocks
- Phase 8: Deployment (needs working application)

## Changes Required

### New Files Created

#### `/app/page.tsx`
- Lines 2927-3007: Basic integration (Green)
  ```typescript
  'use client';

  import { useState } from 'react';
  import AppLayout from '@/components/layout/AppLayout';
  import ProjectSidebar from '@/components/layout/ProjectSidebar';
  import ConversationView from '@/components/chat/ConversationView';
  import MessageInput from '@/components/chat/MessageInput';
  import FileAttachment from '@/components/chat/FileAttachment';
  import AudioRecorder from '@/components/chat/AudioRecorder';
  import { useConversationStore } from '@/lib/store';
  import { transcribeAudio } from '@/lib/transcription';
  import { generateResponse } from '@/lib/api';

  export default function HomePage() {
    const {
      projects,
      activeProjectId,
      createProject,
      setActiveProject,
      addMessage,
      getMessages,
    } = useConversationStore();

    const [files, setFiles] = useState<File[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const activeMessages = activeProjectId ? getMessages(activeProjectId) : [];

    const handleSendMessage = async (content: string) => {
      if (!activeProjectId) return;

      // Add user message
      addMessage(activeProjectId, {
        role: 'user',
        content,
        timestamp: new Date(),
      });

      setIsGenerating(true);

      try {
        // Generate AI response
        const response = await generateResponse(content, activeMessages);

        addMessage(activeProjectId, {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Failed to generate response:', error);
      } finally {
        setIsGenerating(false);
        setFiles([]);
      }
    };

    return (
      <AppLayout>
        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProject}
          onNewProject={() => createProject('New Project')}
        />
        <div className="flex-1 flex flex-col">
          <ConversationView messages={activeMessages} />
          <div className="border-t p-4">
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={isGenerating || !activeProjectId}
            />
            <div className="mt-2 flex gap-2">
              <FileAttachment onFilesChange={setFiles} />
              <AudioRecorder
                onRecordingComplete={async (blob) => {
                  const text = await transcribeAudio(blob);
                  handleSendMessage(text);
                }}
              />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }
  ```

- Lines 3012-3136: Enhanced with loading states and error handling (Refactor)
  - Loading spinner during AI generation
  - Error boundaries for failed requests
  - File attachment integration with message context
  - Auto-create first project on initial load
  - Empty state when no active project

#### `/lib/api.ts`
- Lines 3139-3177: AI response generation
  ```typescript
  import { Message } from './types';

  export async function generateResponse(
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<string> {
    // TODO: Replace with actual BAML + Claude integration
    // For now, mock response for testing

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        history: conversationHistory.slice(-10), // Last 10 messages for context
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate response');
    }

    const data = await response.json();
    return data.content;
  }
  ```

#### `/app/api/generate/route.ts`
- Next.js API route for AI generation
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';

  export async function POST(request: NextRequest) {
    try {
      const { message, history } = await request.json();

      // TODO: Integrate with BAML + Claude from planning_pipeline
      // For now, return mock response

      const mockResponse = `You said: "${message}". This is a placeholder response. In production, this will use the BAML + Claude pipeline from planning_pipeline/claude_runner.py.`;

      return NextResponse.json({
        content: mockResponse,
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }
  }
  ```

### E2E Test Files Created

#### `/playwright.config.ts`
- Lines 2894-2922: Playwright configuration
  ```typescript
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  });
  ```

#### `/e2e/conversation-flow.spec.ts`
- Lines 2800-2884: End-to-end tests
  ```typescript
  import { test, expect } from '@playwright/test';

  test.describe('Conversation Flow', () => {
    test('should create project and send message', async ({ page }) => {
      await page.goto('/');

      // Create new project
      await page.click('text=New Project');
      await expect(page.locator('text=New Project')).toBeVisible();

      // Type and send message
      await page.fill('textarea[placeholder*="message"]', 'Hello, AI!');
      await page.click('button:has-text("Send")');

      // Wait for user message to appear
      await expect(page.locator('text=Hello, AI!')).toBeVisible();

      // Wait for AI response
      await expect(page.locator('text=You said:')).toBeVisible({ timeout: 10000 });
    });

    test('should attach file and send', async ({ page }) => {
      await page.goto('/');
      await page.click('text=New Project');

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test file content'),
      });

      // Verify file attached
      await expect(page.locator('text=test.txt')).toBeVisible();

      // Send message with file
      await page.fill('textarea', 'Analyze this file');
      await page.click('button:has-text("Send")');

      // Verify message sent
      await expect(page.locator('text=Analyze this file')).toBeVisible();
    });

    test('should persist state on reload', async ({ page }) => {
      await page.goto('/');

      // Create project and send message
      await page.click('text=New Project');
      await page.fill('textarea', 'Test message');
      await page.click('button:has-text("Send")');
      await expect(page.locator('text=Test message')).toBeVisible();

      // Reload page
      await page.reload();

      // Verify project and message still exist
      await expect(page.locator('text=New Project')).toBeVisible();
      await expect(page.locator('text=Test message')).toBeVisible();
    });

    test('should switch between projects', async ({ page }) => {
      await page.goto('/');

      // Create two projects
      await page.click('text=New Project');
      await page.fill('textarea', 'Message in Project 1');
      await page.click('button:has-text("Send")');

      await page.click('text=New Project');
      await page.fill('textarea', 'Message in Project 2');
      await page.click('button:has-text("Send")');

      // Verify messages in each project
      await page.click('text=New Project').first();
      await expect(page.locator('text=Message in Project 1')).toBeVisible();
      await expect(page.locator('text=Message in Project 2')).not.toBeVisible();

      await page.click('text=New Project').last();
      await expect(page.locator('text=Message in Project 2')).toBeVisible();
      await expect(page.locator('text=Message in Project 1')).not.toBeVisible();
    });
  });
  ```

### Dependencies to Install
```bash
npm install -D @playwright/test  # E2E testing framework
npx playwright install  # Install browsers
```

## Success Criteria

### Automated Tests (E2E)
- [ ] E2E tests fail before integration (Red): `npm run test:e2e`
- [ ] E2E tests pass after integration (Green): `npm run test:e2e`
- [ ] All user flows covered:
  - Create project → send message → receive response
  - Attach files → send → response
  - State persists on reload
  - Switch between projects

### Manual Verification

**Human-Testable Function**: Complete user flow from project creation to AI response

1. **Initial Load Testing**:
   - Navigate to http://localhost:3000
   - Verify empty state or auto-created first project
   - Sidebar shows "Projects" header
   - Main area shows empty conversation or prompt

2. **Flow 1: Text Message**:
   - Click "New Project" → "Project 1" created and selected
   - Type in textarea: "What is the meaning of life?"
   - Click "Send" (or press Enter)
   - Verify:
     - User message appears right-aligned: "What is the meaning of life?"
     - Loading indicator shows (spinner or "Generating...")
     - After 1-3 seconds, AI response appears left-aligned
     - Response contains: "You said: 'What is the meaning of life?'..."

3. **Flow 2: File Attachment**:
   - Click "Attach files" button
   - Select a text file (< 10MB)
   - Verify file appears in attachment list with name and size
   - Type message: "Summarize this file"
   - Click "Send"
   - Verify:
     - User message shows with file icon or attachment indicator
     - AI response acknowledges file (in future: will analyze content)
     - File cleared from attachment list after send

4. **Flow 3: Audio Transcription**:
   - Click microphone icon
   - Allow microphone permission
   - Record 5-second voice message: "This is a test recording"
   - Click "Stop"
   - Verify:
     - Transcription indicator shows: "Transcribing..."
     - After 2-5 seconds, transcribed text appears
     - Message sent automatically or "Send" button enabled
   - Click "Send" (if needed)
   - Verify:
     - User message shows transcribed text
     - AI responds to transcribed content

5. **Flow 4: State Persistence**:
   - Create "Project A"
   - Send 3 messages
   - Create "Project B"
   - Send 2 messages
   - **Refresh page** (Ctrl+R)
   - Verify:
     - Both projects still in sidebar
     - Active project preserved (or first project selected)
     - All messages still visible when switching projects
   - **Close tab, reopen**
   - Verify all data still persists

6. **Flow 5: Multi-Project Management**:
   - Create 3 projects: "Work", "Personal", "Research"
   - Add different messages to each:
     - Work: "Draft email to client"
     - Personal: "Recipe for lasagna"
     - Research: "Explain quantum computing"
   - Click "Work" → Verify only work messages show
   - Click "Personal" → Verify only personal messages show
   - Click "Research" → Verify only research messages show
   - Delete "Personal" project → Verify removed, others intact

7. **Error Handling Testing**:
   - Disconnect internet (airplane mode)
   - Try to send message
   - Verify error message: "Failed to generate response"
   - Reconnect internet
   - Retry → Should work

8. **UI/UX Testing**:
   - Long message (500 words) → Textarea auto-resizes
   - 20+ messages → Conversation auto-scrolls to bottom
   - Mobile viewport (< 768px) → Sidebar collapses, hamburger menu works
   - Empty project → Shows "No messages yet" placeholder

### Files to Verify
- [ ] `app/page.tsx` exists and renders correctly
- [ ] `lib/api.ts` exports `generateResponse()`
- [ ] `app/api/generate/route.ts` handles POST requests
- [ ] `playwright.config.ts` configured correctly
- [ ] `e2e/conversation-flow.spec.ts` has all tests
- [ ] All tests pass: `npm run test:e2e`
- [ ] No TypeScript errors
- [ ] No console errors during flows

## Implementation Notes

### Auto-Create First Project
```typescript
// app/page.tsx
useEffect(() => {
  if (projects.length === 0) {
    createProject('My First Project');
  }
}, [projects.length]);
```

### Loading State
```typescript
{isGenerating && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    Generating response...
  </div>
)}
```

### Error Boundary
```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Playwright Best Practices
- Use `data-testid` attributes for stable selectors
- Wait for network requests: `page.waitForResponse()`
- Use `expect().toBeVisible({ timeout: 10000 })` for async content
- Test in CI: `npm run test:e2e -- --headed=false`

## Next Phase

Once all E2E tests pass and complete user flows work:
→ [Phase 8: Deployment to Vercel](./2026-01-09-tdd-writing-agent-ui-08-phase-8.md)
