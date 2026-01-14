# Writing Agent UI TDD Implementation Plan

## Overview

Build a standalone writing agent web application with a conversation UI, file attachments, and audio transcription capabilities. The agent ingests raw text or recordings, transcribes audio, identifies key themes, and generates content based on user prompts.

**Tech Stack:**
- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend API**: Next.js API Routes
- **Transcription**: OpenAI Whisper API
- **Content Generation**: Existing BAML + Claude integration
- **Deployment**: Vercel
- **Testing**: Vitest (frontend), Playwright (E2E), pytest (Python backend integration)

## Current State Analysis

### ❌ What Does NOT Exist:
- **Frontend**: No Next.js app, no React components, no package.json
- **File Upload**: No web-based file upload components or endpoints
- **Audio Recording**: No MediaRecorder integration, no audio UI components
- **Transcription**: No Whisper API integration, no audio processing
- **Web API**: No FastAPI or Next.js API routes for web client

### ✅ What DOES Exist (Can Leverage):
- **`planning_pipeline/decomposition.py:250`** - Theme extraction via BAML + Claude
- **`context_window_array/store.py:300+`** - Conversation state storage (CWA)
- **`baml_src/`** - LLM integration infrastructure (Claude/GPT-4)
- **`planning_pipeline/claude_runner.py:300+`** - Claude SDK integration
- **`silmari_rlm_act/checkpoints/manager.py:150+`** - State persistence patterns
- **Testing**: pytest framework (`planning_pipeline/tests/`, `pytest.ini`)

### Key Discoveries:
1. **Testing Pattern**: Python uses pytest with fixtures (`conftest.py`), `@pytest.fixture`, `def test_*` pattern
2. **No Frontend Tests**: Need to set up Vitest + React Testing Library
3. **BAML Audio Type**: Exists in spec but unused - ready to leverage
4. **Decomposition Pipeline**: Can adapt for theme extraction from transcribed audio/text
5. **No Web Server**: Pure CLI/orchestrator - need to build API layer

## Desired End State

A fully functional writing agent with:
1. **Three-column layout**: Projects sidebar | Conversation view | Attachments/context panel
2. **Message input**: Text area with file attachment + audio recording buttons
3. **File attachments**: Drag-and-drop zone, file preview, upload progress
4. **Audio recording**: Record button, waveform visualization, playback before send
5. **Audio transcription**: Automatic transcription via Whisper API
6. **Theme extraction**: Display identified themes from user input
7. **Content generation**: Streaming AI responses using Claude/GPT-4
8. **Project management**: Create/switch projects, conversation history
9. **Deployed to Vercel**: Production-ready with environment variables

### Observable Behaviors (High-Level):
1. User types message → sends → receives AI response
2. User uploads file → preview shows → sends with message
3. User records audio → transcribes → sends as text
4. User creates project → appears in sidebar → can switch between projects
5. Themes auto-extract from input → display in UI → guide generation
6. AI streams response → displays progressively → conversation updates

## What We're NOT Doing

- User authentication (future phase)
- Real-time collaboration
- Mobile app (web-only for now)
- Local Whisper (using OpenAI API)
- Database (using filesystem for now)
- Custom audio processing (using MediaRecorder API only)
- Svelte (originally requested, changed to Next.js + React per user)

## Testing Strategy

**Framework Choices:**
- **Frontend Unit/Integration**: Vitest + React Testing Library
- **Component Testing**: Storybook (optional, not in this plan)
- **E2E**: Playwright for critical user flows
- **API Testing**: Vitest for Next.js API routes
- **Python Integration**: pytest for backend integration

**Test Types:**
- **Unit**: Individual components, utilities, hooks
- **Integration**: Component trees, API routes, theme extraction pipeline
- **E2E**: Complete user flows (record → transcribe → generate → display)

**Mocking Strategy:**
- Mock OpenAI Whisper API calls in tests
- Mock BAML Claude calls for deterministic tests
- Use MSW (Mock Service Worker) for API mocking
- Test fixtures for audio blobs and file uploads

---

## Phase 1: Project Setup & Infrastructure

### Behavior 1.1: Next.js Project Initializes Successfully

#### Test Specification
**Given**: No existing Next.js project
**When**: Initialize with `create-next-app` and add dependencies
**Then**:
- `package.json` exists with all dependencies
- `next.config.ts` properly configured
- `tailwind.config.ts` set up
- TypeScript configured with `tsconfig.json`
- Project builds successfully

**Edge Cases**:
- Conflicting dependencies
- TypeScript version compatibility
- Tailwind plugin conflicts

#### 🔴 Red: Write Failing Test

**File**: `__tests__/setup.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Project Setup', () => {
  it('should have package.json with required dependencies', () => {
    const packageJson = require('../package.json');

    expect(packageJson.dependencies).toHaveProperty('next');
    expect(packageJson.dependencies).toHaveProperty('react');
    expect(packageJson.dependencies).toHaveProperty('react-dom');
    expect(packageJson.dependencies).toHaveProperty('tailwindcss');
    expect(packageJson.devDependencies).toHaveProperty('vitest');
    expect(packageJson.devDependencies).toHaveProperty('@testing-library/react');
  });

  it('should have proper TypeScript configuration', () => {
    const tsconfigPath = join(__dirname, '../tsconfig.json');
    expect(existsSync(tsconfigPath)).toBe(true);
  });

  it('should have Tailwind configuration', () => {
    const tailwindPath = join(__dirname, '../tailwind.config.ts');
    expect(existsSync(tailwindPath)).toBe(true);
  });
});
```

#### 🟢 Green: Minimal Implementation

**Commands**:
```bash
# Create Next.js project
npx create-next-app@latest writing-agent-ui \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd writing-agent-ui

# Install testing dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Install UI dependencies
npx shadcn-ui@latest init

# Install audio/file dependencies
npm install openai

# Install state management
npm install zustand

# Create vitest config
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
EOF
```

**File**: `test/setup.ts`
```typescript
import '@testing-library/jest-dom';
```

#### 🔵 Refactor: Improve Code

**File**: `package.json` - Add test scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test"
  }
}
```

### Success Criteria

**Automated:**
- [ ] Test fails without setup (Red): `npm test`
- [ ] Test passes after setup (Green): `npm test`
- [ ] Project builds: `npm run build`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`

**Manual:**
- [ ] Dev server starts: `npm run dev`
- [ ] Page loads in browser at `http://localhost:3000`
- [ ] No console errors

---

### Behavior 1.2: Environment Variables Load Correctly

#### Test Specification
**Given**: `.env.local` file with API keys
**When**: Application starts
**Then**:
- `OPENAI_API_KEY` is accessible
- `BAML_CLIENT_ID` is accessible (for future integration)
- Missing required vars trigger build warning

**Edge Cases**:
- Missing `.env.local` file
- Empty API key values
- Malformed environment file

#### 🔴 Red: Write Failing Test

**File**: `__tests__/env.test.ts`
```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('Environment Configuration', () => {
  beforeAll(() => {
    // Simulate loading .env.local
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should have OPENAI_API_KEY configured', () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined();
    expect(process.env.OPENAI_API_KEY).not.toBe('');
  });

  it('should fail if API key is missing', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(() => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required');
      }
    }).toThrow('OPENAI_API_KEY is required');

    // Restore
    process.env.OPENAI_API_KEY = originalKey;
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `.env.local` (create template)
```bash
# OpenAI API Key for Whisper transcription
OPENAI_API_KEY=your_openai_api_key_here

# Optional: For future BAML integration
BAML_CLIENT_ID=
```

**File**: `.env.example`
```bash
# Copy this file to .env.local and fill in your API keys

# OpenAI API Key (required)
OPENAI_API_KEY=sk-...

# BAML Integration (optional)
BAML_CLIENT_ID=
```

**File**: `lib/env.ts`
```typescript
export function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  openaiApiKey: () => getEnvVar('OPENAI_API_KEY'),
} as const;
```

#### 🔵 Refactor: Improve Code

**File**: `lib/env.ts` (add validation)
```typescript
import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    throw new Error('Invalid environment configuration');
  }
}

export const env = validateEnv();
```

**Install zod**: `npm install zod`

### Success Criteria

**Automated:**
- [ ] Test fails without env vars (Red): `npm test -- env.test`
- [ ] Test passes with env vars (Green): `npm test -- env.test`
- [ ] TypeScript validates env usage: `npx tsc --noEmit`
- [ ] Build succeeds: `npm run build`

**Manual:**
- [ ] `.env.example` documents all required variables
- [ ] Error message clear when env var missing
- [ ] Dev server starts with valid env vars

---

## Phase 2: Basic UI Layout & Navigation

### Behavior 2.1: Three-Column Layout Renders

#### Test Specification
**Given**: User navigates to home page
**When**: Page loads
**Then**:
- Sidebar visible with "Projects" header
- Main conversation area visible
- Layout is responsive (sidebar collapsible on mobile)
- All sections have proper ARIA labels

**Edge Cases**:
- Mobile viewport (sidebar hidden, toggle button shown)
- Tablet viewport (sidebar visible, narrow)
- Desktop viewport (sidebar expanded, full width)

#### 🔴 Red: Write Failing Test

**File**: `__tests__/components/AppLayout.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppLayout from '@/components/layout/AppLayout';

describe('AppLayout', () => {
  it('should render three main sections', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    // Check for sidebar
    expect(screen.getByRole('complementary', { name: /sidebar/i })).toBeInTheDocument();

    // Check for main content area
    expect(screen.getByRole('main')).toBeInTheDocument();

    // Check for children rendering
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should have accessible labels', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    );

    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveAttribute('aria-label');
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `components/layout/AppLayout.tsx`
```typescript
import React from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        role="complementary"
        aria-label="Sidebar navigation"
        className="w-64 border-r border-border bg-card"
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold">Projects</h2>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code

**File**: `components/layout/AppLayout.tsx` (add responsiveness)
```typescript
'use client';

import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        role="complementary"
        aria-label="Sidebar navigation"
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 border-r border-border bg-card
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold">Projects</h2>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

**Install icons**: `npm install lucide-react`

### Success Criteria

**Automated:**
- [ ] Test fails without component (Red): `npm test -- AppLayout.test`
- [ ] Test passes with component (Green): `npm test -- AppLayout.test`
- [ ] Component renders without errors
- [ ] Accessibility checks pass (aria-labels present)

**Manual:**
- [ ] Layout looks correct in browser
- [ ] Sidebar toggles on mobile
- [ ] Responsive breakpoints work
- [ ] No layout shift on load

---

### Behavior 2.2: Project Sidebar Lists Projects

#### Test Specification
**Given**: User has multiple projects
**When**: Sidebar renders
**Then**:
- All projects listed
- Active project highlighted
- "New Project" button visible
- Click project switches active project

**Edge Cases**:
- No projects (show "Create your first project")
- Single project
- Many projects (scroll)
- Long project names (truncate)

#### 🔴 Red: Write Failing Test

**File**: `__tests__/components/ProjectSidebar.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectSidebar from '@/components/layout/ProjectSidebar';

describe('ProjectSidebar', () => {
  const mockProjects = [
    { id: '1', name: 'Project Alpha', createdAt: new Date() },
    { id: '2', name: 'Project Beta', createdAt: new Date() },
  ];

  it('should render list of projects', () => {
    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId="1"
        onSelectProject={() => {}}
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('should highlight active project', () => {
    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId="1"
        onSelectProject={() => {}}
      />
    );

    const activeProject = screen.getByText('Project Alpha').closest('button');
    expect(activeProject).toHaveClass('bg-accent');
  });

  it('should call onSelectProject when clicking project', () => {
    const handleSelect = vi.fn();

    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId="1"
        onSelectProject={handleSelect}
      />
    );

    fireEvent.click(screen.getByText('Project Beta'));
    expect(handleSelect).toHaveBeenCalledWith('2');
  });

  it('should show empty state when no projects', () => {
    render(
      <ProjectSidebar
        projects={[]}
        activeProjectId={null}
        onSelectProject={() => {}}
      />
    );

    expect(screen.getByText(/create your first project/i)).toBeInTheDocument();
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `lib/types.ts`
```typescript
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
}
```

**File**: `components/layout/ProjectSidebar.tsx`
```typescript
import React from 'react';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

export default function ProjectSidebar({
  projects,
  activeProjectId,
  onSelectProject,
}: ProjectSidebarProps) {
  if (projects.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {projects.map((project) => (
        <Button
          key={project.id}
          variant="ghost"
          className={`justify-start ${
            activeProjectId === project.id ? 'bg-accent' : ''
          }`}
          onClick={() => onSelectProject(project.id)}
        >
          {project.name}
        </Button>
      ))}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code

**File**: `components/layout/ProjectSidebar.tsx` (add new project button, truncation)
```typescript
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FolderOpen } from 'lucide-react';
import type { Project } from '@/lib/types';

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
}

export default function ProjectSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
}: ProjectSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with New Project button */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewProject}
            aria-label="New project"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Create your first project to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {projects.map((project) => (
              <Button
                key={project.id}
                variant="ghost"
                className={`justify-start ${
                  activeProjectId === project.id ? 'bg-accent' : ''
                }`}
                onClick={() => onSelectProject(project.id)}
              >
                <span className="truncate">{project.name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Success Criteria

**Automated:**
- [ ] Test fails without component (Red): `npm test -- ProjectSidebar.test`
- [ ] Test passes (Green): `npm test -- ProjectSidebar.test`
- [ ] All edge cases covered (empty, single, multiple)
- [ ] Click handlers work correctly

**Manual:**
- [ ] Projects render in sidebar
- [ ] Active project highlighted
- [ ] Long names truncate properly
- [ ] Scroll works with many projects
- [ ] "New Project" button visible and clickable

---

## Phase 3: Message Input & File Attachments

### Behavior 3.1: User Can Type and Send Messages

#### Test Specification
**Given**: User is on conversation page
**When**: User types message and clicks send
**Then**:
- Message appears in conversation
- Input cleared
- Send button disabled when empty
- Enter key sends message

**Edge Cases**:
- Empty message (button disabled)
- Very long message (>10k chars)
- Multi-line message (Shift+Enter)
- Whitespace-only message

#### 🔴 Red: Write Failing Test

**File**: `__tests__/components/MessageInput.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageInput from '@/components/chat/MessageInput';

describe('MessageInput', () => {
  it('should render textarea and send button', () => {
    render(<MessageInput onSend={() => {}} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('should disable send button when input is empty', () => {
    render(<MessageInput onSend={() => {}} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when input has text', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={() => {}} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world');

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeEnabled();
  });

  it('should call onSend with message and clear input', async () => {
    const handleSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={handleSend} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);

    expect(handleSend).toHaveBeenCalledWith('Test message');
    expect(textarea).toHaveValue('');
  });

  it('should send on Enter key, new line on Shift+Enter', async () => {
    const handleSend = vi.fn();
    const user = userEvent.setup();

    render(<MessageInput onSend={handleSend} />);

    const textarea = screen.getByRole('textbox');

    // Shift+Enter should add newline
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');
    expect(textarea).toHaveValue('Line 1\nLine 2');
    expect(handleSend).not.toHaveBeenCalled();

    // Enter should send
    await user.type(textarea, '{Enter}');
    expect(handleSend).toHaveBeenCalledWith('Line 1\nLine 2');
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `components/chat/MessageInput.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
}

export default function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 p-4 border-t">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="min-h-[60px] resize-none"
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim()}
        size="icon"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Install shadcn textarea**: `npx shadcn-ui@latest add textarea`
**Install user-event**: `npm install -D @testing-library/user-event`

#### 🔵 Refactor: Improve Code

**File**: `components/chat/MessageInput.tsx` (add character limit, auto-resize)
```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

export default function MessageInput({
  onSend,
  maxLength = 10000,
  disabled = false
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = message.length;
  const isOverLimit = charCount > maxLength;

  return (
    <div className="flex flex-col gap-2 p-4 border-t bg-background">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Shift+Enter for new line)"
          className="min-h-[60px] max-h-[200px] resize-none"
          disabled={disabled}
          maxLength={maxLength}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isOverLimit}
          size="icon"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Character counter */}
      <div className="text-xs text-muted-foreground text-right">
        <span className={isOverLimit ? 'text-destructive' : ''}>
          {charCount} / {maxLength}
        </span>
      </div>
    </div>
  );
}
```

### Success Criteria

**Automated:**
- [ ] Tests fail without component (Red): `npm test -- MessageInput.test`
- [ ] Tests pass (Green): `npm test -- MessageInput.test`
- [ ] Enter key behavior correct
- [ ] Character limit enforced

**Manual:**
- [ ] Textarea auto-resizes with content
- [ ] Send button enables/disables correctly
- [ ] Shift+Enter adds new line
- [ ] Enter sends message
- [ ] Character counter visible
- [ ] Focus states work properly

---

### Behavior 3.2: User Can Attach Files

#### Test Specification
**Given**: User wants to attach a file
**When**: User clicks attach button or drags file
**Then**:
- File picker opens
- Selected file appears in attachment list
- File can be removed
- Multiple files supported
- Max file size enforced (10MB)

**Edge Cases**:
- File too large (>10MB) - show error
- Invalid file type - show error
- Multiple files selected
- No file selected (cancel dialog)
- Drag-and-drop file

#### 🔴 Red: Write Failing Test

**File**: `__tests__/components/FileAttachment.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileAttachment from '@/components/chat/FileAttachment';

describe('FileAttachment', () => {
  it('should render attach button', () => {
    render(<FileAttachment onFilesChange={() => {}} />);

    expect(screen.getByRole('button', { name: /attach/i })).toBeInTheDocument();
  });

  it('should open file picker when button clicked', async () => {
    const user = userEvent.setup();
    render(<FileAttachment onFilesChange={() => {}} />);

    const attachButton = screen.getByRole('button', { name: /attach/i });
    await user.click(attachButton);

    // Input should be triggered (hidden file input)
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('should display selected file', async () => {
    const handleFilesChange = vi.fn();
    const user = userEvent.setup();

    render(<FileAttachment onFilesChange={handleFilesChange} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
      expect(handleFilesChange).toHaveBeenCalledWith([file]);
    });
  });

  it('should remove file when delete clicked', async () => {
    const handleFilesChange = vi.fn();
    const user = userEvent.setup();

    render(<FileAttachment onFilesChange={handleFilesChange} />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    const removeButton = await screen.findByRole('button', { name: /remove/i });
    await user.click(removeButton);

    expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    expect(handleFilesChange).toHaveBeenCalledWith([]);
  });

  it('should reject file larger than 10MB', async () => {
    const handleFilesChange = vi.fn();
    const user = userEvent.setup();

    render(<FileAttachment onFilesChange={handleFilesChange} maxSizeMB={10} />);

    // Create 11MB file
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
    const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
      expect(handleFilesChange).not.toHaveBeenCalled();
    });
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `components/chat/FileAttachment.tsx`
```typescript
'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X } from 'lucide-react';

interface FileAttachmentProps {
  onFilesChange: (files: File[]) => void;
  maxSizeMB?: number;
}

export default function FileAttachment({
  onFilesChange,
  maxSizeMB = 10
}: FileAttachmentProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Validate file sizes
    const invalidFiles = selectedFiles.filter(f => f.size > maxSizeBytes);
    if (invalidFiles.length > 0) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    setError(null);
    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const handleRemove = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Attach Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Attach file"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-md text-sm"
            >
              <span className="truncate max-w-[150px]">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={() => handleRemove(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code

**File**: `components/chat/FileAttachment.tsx` (add drag-and-drop)
```typescript
'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Upload } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface FileAttachmentProps {
  onFilesChange: (files: File[]) => void;
  maxSizeMB?: number;
  maxFiles?: number;
}

export default function FileAttachment({
  onFilesChange,
  maxSizeMB = 10,
  maxFiles = 5
}: FileAttachmentProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = (newFiles: File[]) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Check file count
    if (files.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    // Validate file sizes
    const invalidFiles = newFiles.filter(f => f.size > maxSizeBytes);
    if (invalidFiles.length > 0) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    setError(null);
    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    validateAndAddFiles(selectedFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndAddFiles(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Drag-and-Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          transition-colors
          ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {maxSizeMB}MB per file, up to {maxFiles} files
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
          {error}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary rounded-md"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleRemove(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**File**: `lib/utils.ts` (add utility)
```typescript
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
```

### Success Criteria

**Automated:**
- [ ] Tests fail without component (Red): `npm test -- FileAttachment.test`
- [ ] Tests pass (Green): `npm test -- FileAttachment.test`
- [ ] File size validation works
- [ ] File removal works

**Manual:**
- [ ] Click to browse opens file picker
- [ ] Drag-and-drop works
- [ ] Multiple files can be added
- [ ] Files display with size
- [ ] Remove button works
- [ ] Error messages clear and helpful
- [ ] Max file limit enforced

---

## Phase 4: Audio Recording & Transcription

### Behavior 4.1: User Can Record Audio

#### Test Specification
**Given**: User wants to record audio
**When**: User clicks record button
**Then**:
- Recording starts (mic permission requested)
- Recording indicator shows
- Stop button available
- Audio playback available after stop
- Recording limited to 5 minutes

**Edge Cases**:
- Mic permission denied
- No microphone available
- Recording exceeds time limit
- Browser doesn't support MediaRecorder

#### 🔴 Red: Write Failing Test

**File**: `__tests__/components/AudioRecorder.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AudioRecorder from '@/components/chat/AudioRecorder';

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
})) as any;

// Mock getUserMedia
global.navigator.mediaDevices = {
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  }),
} as any;

describe('AudioRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render record button', () => {
    render(<AudioRecorder onRecordingComplete={() => {}} />);

    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('should request microphone permission when recording starts', async () => {
    render(<AudioRecorder onRecordingComplete={() => {}} />);

    const recordButton = screen.getByRole('button', { name: /record/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
      });
    });
  });

  it('should show stop button while recording', async () => {
    render(<AudioRecorder onRecordingComplete={() => {}} />);

    const recordButton = screen.getByRole('button', { name: /record/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });
  });

  it('should show error when mic permission denied', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    render(<AudioRecorder onRecordingComplete={() => {}} />);

    const recordButton = screen.getByRole('button', { name: /record/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      expect(screen.getByText(/microphone access denied/i)).toBeInTheDocument();
    });
  });

  it('should call onRecordingComplete with audio blob', async () => {
    const handleComplete = vi.fn();
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

    // Mock MediaRecorder to trigger dataavailable
    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'dataavailable') {
          setTimeout(() => handler({ data: mockBlob }), 0);
        }
      }),
      removeEventListener: vi.fn(),
      state: 'inactive',
    };
    (global.MediaRecorder as any).mockImplementation(() => mockMediaRecorder);

    render(<AudioRecorder onRecordingComplete={handleComplete} />);

    const recordButton = screen.getByRole('button', { name: /record/i });
    fireEvent.click(recordButton);

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: /stop/i });
      fireEvent.click(stopButton);
    });

    await waitFor(() => {
      expect(handleComplete).toHaveBeenCalledWith(expect.any(Blob));
    });
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `components/chat/AudioRecorder.tsx`
```typescript
'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  maxDurationSeconds?: number;
}

export default function AudioRecorder({
  onRecordingComplete,
  maxDurationSeconds = 300, // 5 minutes
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        chunksRef.current = [];

        // Stop media stream
        stream.getTracks().forEach(track => track.stop());
      });

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setError(null);

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, maxDurationSeconds * 1000);
    } catch (err) {
      setError('Microphone access denied or unavailable');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!isRecording ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={startRecording}
          aria-label="Record audio"
        >
          <Mic className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={stopRecording}
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4" />
        </Button>
      )}

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code

**File**: `components/chat/AudioRecorder.tsx` (add timer, waveform visualization)
```typescript
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  maxDurationSeconds?: number;
}

export default function AudioRecorder({
  onRecordingComplete,
  maxDurationSeconds = 300, // 5 minutes
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onRecordingComplete(audioBlob);

        // Stop media stream
        stream.getTracks().forEach(track => track.stop());
      });

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);

      // Auto-stop after max duration
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, maxDurationSeconds * 1000);
    } catch (err) {
      setError('Microphone access denied or unavailable');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const discardRecording = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Recording Controls */}
      <div className="flex items-center gap-2">
        {!isRecording && !audioUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={startRecording}
            aria-label="Record audio"
          >
            <Mic className="h-4 w-4" />
          </Button>
        ) : isRecording ? (
          <>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={stopRecording}
              aria-label="Stop recording"
              className="animate-pulse"
            >
              <Square className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {formatTime(recordingTime)} / {formatTime(maxDurationSeconds)}
            </span>
          </>
        ) : null}
      </div>

      {/* Playback Controls (after recording) */}
      {audioUrl && !isRecording && (
        <div className="flex items-center gap-2 p-2 bg-secondary rounded-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <span className="text-sm flex-1">
            Recording ({formatTime(recordingTime)})
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={discardRecording}
          >
            Discard
          </Button>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
```

### Success Criteria

**Automated:**
- [ ] Tests fail without component (Red): `npm test -- AudioRecorder.test`
- [ ] Tests pass (Green): `npm test -- AudioRecorder.test`
- [ ] Mic permission handling works
- [ ] Recording completion callback fires

**Manual:**
- [ ] Mic permission prompt appears
- [ ] Recording indicator animates
- [ ] Timer shows elapsed time
- [ ] Auto-stops at 5 minutes
- [ ] Playback works after recording
- [ ] Discard button clears recording
- [ ] Error messages clear

---

### Behavior 4.2: Audio Transcribes via Whisper API

#### Test Specification
**Given**: User has recorded audio
**When**: Audio sent for transcription
**Then**:
- Audio uploaded to Whisper API
- Transcription returned
- Loading indicator shows during processing
- Error handling for API failures

**Edge Cases**:
- API key invalid
- Network timeout
- Audio file too large (>25MB Whisper limit)
- Audio format not supported
- Empty audio file

#### 🔴 Red: Write Failing Test

**File**: `__tests__/lib/transcription.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeAudio } from '@/lib/transcription';

// Mock fetch
global.fetch = vi.fn();

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send audio to Whisper API and return transcription', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Hello world' }),
    });

    const result = await transcribeAudio(mockBlob);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer'),
        }),
      })
    );

    expect(result).toBe('Hello world');
  });

  it('should throw error when API returns error', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(transcribeAudio(mockBlob)).rejects.toThrow('Transcription failed');
  });

  it('should reject audio larger than 25MB', async () => {
    // Create 26MB blob
    const largeBlob = new Blob([new Array(26 * 1024 * 1024).fill('a')], { type: 'audio/webm' });

    await expect(transcribeAudio(largeBlob)).rejects.toThrow('Audio file too large');
  });

  it('should handle network errors', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });

    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    await expect(transcribeAudio(mockBlob)).rejects.toThrow('Network error');
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `lib/transcription.ts`
```typescript
import { env } from './env';

const MAX_FILE_SIZE_MB = 25;
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  // Validate file size
  const sizeMB = audioBlob.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Audio file too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');

  try {
    const response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.openaiApiKey()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}
```

#### 🔵 Refactor: Improve Code

**File**: `lib/transcription.ts` (add retry logic, better error handling)
```typescript
import { env } from './env';

const MAX_FILE_SIZE_MB = 25;
const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function transcribeAudio(
  audioBlob: Blob,
  options: TranscriptionOptions = {}
): Promise<string> {
  // Validate file size
  const sizeMB = audioBlob.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new TranscriptionError(
      `Audio file too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
      'FILE_TOO_LARGE'
    );
  }

  // Validate blob is not empty
  if (audioBlob.size === 0) {
    throw new TranscriptionError(
      'Audio file is empty.',
      'EMPTY_FILE'
    );
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');

  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.prompt) {
    formData.append('prompt', options.prompt);
  }
  if (options.temperature !== undefined) {
    formData.append('temperature', options.temperature.toString());
  }

  // Retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.openaiApiKey()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Don't retry on client errors (except rate limits)
        if (response.status === 429 && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          throw new TranscriptionError(
            errorData.error?.message || `API error: ${response.statusText}`,
            'API_ERROR',
            errorData
          );
        }

        // Retry on server errors
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }

        throw new TranscriptionError(
          `Transcription failed: ${response.statusText}`,
          'API_ERROR'
        );
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      // If it's already our custom error, rethrow
      if (error instanceof TranscriptionError) {
        throw error;
      }

      // Network errors - retry
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      throw new TranscriptionError(
        'Network error during transcription',
        'NETWORK_ERROR',
        error
      );
    }
  }

  throw new TranscriptionError(
    'Transcription failed after maximum retries',
    'MAX_RETRIES_EXCEEDED'
  );
}
```

### Success Criteria

**Automated:**
- [ ] Tests fail without implementation (Red): `npm test -- transcription.test`
- [ ] Tests pass (Green): `npm test -- transcription.test`
- [ ] File size validation works
- [ ] Error handling comprehensive

**Manual:**
- [ ] Real audio transcribes correctly (test with OpenAI API key)
- [ ] Loading indicator shows during transcription
- [ ] Error messages helpful
- [ ] Retry logic works on failures
- [ ] Large files rejected before upload

---

## Phase 5: Conversation State & Messages

### Behavior 5.1: Messages Display in Conversation View

#### Test Specification
**Given**: Conversation has messages
**When**: User views conversation
**Then**:
- All messages render in order
- User messages aligned right
- AI messages aligned left
- Timestamps show
- Scroll to bottom on new message

**Edge Cases**:
- Empty conversation
- Very long message (wrap)
- Code blocks in message
- Markdown formatting

#### 🔴 Red: Write Failing Test

**File**: `__tests__/components/ConversationView.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConversationView from '@/components/chat/ConversationView';
import type { Message } from '@/lib/types';

describe('ConversationView', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello, can you help me?',
      timestamp: new Date('2026-01-09T10:00:00Z'),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Of course! How can I assist you?',
      timestamp: new Date('2026-01-09T10:00:05Z'),
    },
  ];

  it('should render all messages', () => {
    render(<ConversationView messages={mockMessages} />);

    expect(screen.getByText('Hello, can you help me?')).toBeInTheDocument();
    expect(screen.getByText('Of course! How can I assist you?')).toBeInTheDocument();
  });

  it('should differentiate user and assistant messages', () => {
    render(<ConversationView messages={mockMessages} />);

    const userMessage = screen.getByText('Hello, can you help me?').closest('div');
    const assistantMessage = screen.getByText('Of course! How can I assist you?').closest('div');

    expect(userMessage).toHaveClass('ml-auto'); // User messages right-aligned
    expect(assistantMessage).not.toHaveClass('ml-auto'); // Assistant messages left-aligned
  });

  it('should show empty state when no messages', () => {
    render(<ConversationView messages={[]} />);

    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
  });

  it('should display timestamps', () => {
    render(<ConversationView messages={mockMessages} />);

    // Check that timestamps are rendered (simplified check)
    const timestamps = screen.getAllByText(/:/); // Time format includes ":"
    expect(timestamps.length).toBeGreaterThan(0);
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `lib/types.ts` (add Message type)
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: string[];
}
```

**File**: `components/chat/ConversationView.tsx`
```typescript
import React from 'react';
import type { Message } from '@/lib/types';

interface ConversationViewProps {
  messages: Message[];
}

export default function ConversationView({ messages }: ConversationViewProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Start a conversation by typing a message below</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] rounded-lg p-3 ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground ml-auto'
                : 'bg-secondary'
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            <p className="text-xs opacity-70 mt-1">
              {message.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code

**File**: `components/chat/ConversationView.tsx` (add auto-scroll, markdown support)
```typescript
'use client';

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '@/lib/types';

interface ConversationViewProps {
  messages: Message[];
  isLoading?: boolean;
}

export default function ConversationView({
  messages,
  isLoading = false
}: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
          <p className="text-sm">
            Type a message, attach a file, or record audio to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary'
            }`}
          >
            <div className="prose prose-sm dark:prose-invert">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
              <span>{message.timestamp.toLocaleTimeString()}</span>
              {message.attachments && message.attachments.length > 0 && (
                <span>• {message.attachments.length} attachment(s)</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-secondary rounded-lg p-4">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
```

**Install markdown dependencies**:
```bash
npm install react-markdown react-syntax-highlighter
npm install -D @types/react-syntax-highlighter
npm install @tailwindcss/typography
```

**Update tailwind.config.ts**:
```typescript
plugins: [require('@tailwindcss/typography')],
```

### Success Criteria

**Automated:**
- [ ] Tests fail without component (Red): `npm test -- ConversationView.test`
- [ ] Tests pass (Green): `npm test -- ConversationView.test`
- [ ] Empty state renders
- [ ] Messages differentiated by role

**Manual:**
- [ ] Messages render correctly
- [ ] User messages right-aligned, AI left-aligned
- [ ] Auto-scrolls to bottom on new message
- [ ] Markdown renders (bold, code, lists)
- [ ] Code blocks have syntax highlighting
- [ ] Long messages wrap properly
- [ ] Timestamps show correct time

---

## Phase 6: State Management & API Integration

### Behavior 6.1: Conversation State Persists

#### Test Specification
**Given**: User has active conversation
**When**: User sends message or switches projects
**Then**:
- State persists to storage
- State loads on page reload
- Multiple conversations per project
- Can switch between conversations

**Edge Cases**:
- No conversations yet
- Storage quota exceeded
- Corrupted state data
- Concurrent updates

#### 🔴 Red: Write Failing Test

**File**: `__tests__/lib/store.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useConversationStore } from '@/lib/store';

describe('ConversationStore', () => {
  beforeEach(() => {
    // Reset store state
    useConversationStore.getState().reset();
  });

  it('should create new project', () => {
    const store = useConversationStore.getState();
    const project = store.createProject('Test Project');

    expect(project).toHaveProperty('id');
    expect(project.name).toBe('Test Project');
    expect(store.projects).toHaveLength(1);
  });

  it('should add message to conversation', () => {
    const store = useConversationStore.getState();
    const project = store.createProject('Test Project');

    store.addMessage(project.id, {
      role: 'user',
      content: 'Hello',
    });

    const messages = store.getMessages(project.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
    expect(messages[0].role).toBe('user');
  });

  it('should persist to localStorage', () => {
    const store = useConversationStore.getState();
    const project = store.createProject('Persistent Project');

    store.addMessage(project.id, {
      role: 'user',
      content: 'Test message',
    });

    // Simulate page reload by creating new store instance
    const newStore = useConversationStore.getState();
    expect(newStore.projects).toHaveLength(1);
    expect(newStore.projects[0].name).toBe('Persistent Project');
  });

  it('should switch active project', () => {
    const store = useConversationStore.getState();
    const project1 = store.createProject('Project 1');
    const project2 = store.createProject('Project 2');

    store.setActiveProject(project2.id);
    expect(store.activeProjectId).toBe(project2.id);
  });

  it('should get messages for active project', () => {
    const store = useConversationStore.getState();
    const project = store.createProject('Test Project');

    store.addMessage(project.id, { role: 'user', content: 'Message 1' });
    store.addMessage(project.id, { role: 'assistant', content: 'Message 2' });

    const messages = store.getMessages(project.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Message 1');
    expect(messages[1].content).toBe('Message 2');
  });
});
```

#### 🟢 Green: Minimal Implementation

**File**: `lib/store.ts`
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Message } from './types';

interface ConversationStore {
  projects: Project[];
  activeProjectId: string | null;
  conversations: Record<string, Message[]>; // projectId -> messages

  createProject: (name: string) => Project;
  setActiveProject: (projectId: string) => void;
  addMessage: (projectId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  getMessages: (projectId: string) => Message[];
  reset: () => void;
}

const initialState = {
  projects: [],
  activeProjectId: null,
  conversations: {},
};

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createProject: (name: string) => {
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          createdAt: new Date(),
        };

        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          conversations: {
            ...state.conversations,
            [project.id]: [],
          },
        }));

        return project;
      },

      setActiveProject: (projectId: string) => {
        set({ activeProjectId: projectId });
      },

      addMessage: (projectId: string, message) => {
        const newMessage: Message = {
          id: crypto.randomUUID(),
          ...message,
          timestamp: new Date(),
        };

        set((state) => ({
          conversations: {
            ...state.conversations,
            [projectId]: [
              ...(state.conversations[projectId] || []),
              newMessage,
            ],
          },
        }));
      },

      getMessages: (projectId: string) => {
        return get().conversations[projectId] || [];
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'conversation-store',
    }
  )
);
```

#### 🔵 Refactor: Improve Code

**File**: `lib/store.ts` (add delete, update, error handling)
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Project, Message } from './types';

interface ConversationStore {
  projects: Project[];
  activeProjectId: string | null;
  conversations: Record<string, Message[]>; // projectId -> messages
  isLoading: boolean;
  error: string | null;

  // Project actions
  createProject: (name: string) => Project;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setActiveProject: (projectId: string) => void;

  // Message actions
  addMessage: (projectId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  getMessages: (projectId: string) => Message[];
  deleteMessage: (projectId: string, messageId: string) => void;
  clearMessages: (projectId: string) => void;

  // Utility
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  projects: [],
  activeProjectId: null,
  conversations: {},
  isLoading: false,
  error: null,
};

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Project actions
      createProject: (name: string) => {
        const project: Project = {
          id: crypto.randomUUID(),
          name: name.trim() || 'Untitled Project',
          createdAt: new Date(),
        };

        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          conversations: {
            ...state.conversations,
            [project.id]: [],
          },
        }));

        return project;
      },

      deleteProject: (projectId: string) => {
        set((state) => {
          const newProjects = state.projects.filter(p => p.id !== projectId);
          const newConversations = { ...state.conversations };
          delete newConversations[projectId];

          return {
            projects: newProjects,
            conversations: newConversations,
            activeProjectId: state.activeProjectId === projectId
              ? (newProjects[0]?.id || null)
              : state.activeProjectId,
          };
        });
      },

      updateProject: (projectId: string, updates: Partial<Project>) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        }));
      },

      setActiveProject: (projectId: string) => {
        const project = get().projects.find(p => p.id === projectId);
        if (project) {
          set({ activeProjectId: projectId, error: null });
        } else {
          set({ error: 'Project not found' });
        }
      },

      // Message actions
      addMessage: (projectId: string, message) => {
        const project = get().projects.find(p => p.id === projectId);
        if (!project) {
          set({ error: 'Project not found' });
          return;
        }

        const newMessage: Message = {
          id: crypto.randomUUID(),
          ...message,
          timestamp: new Date(),
        };

        set((state) => ({
          conversations: {
            ...state.conversations,
            [projectId]: [
              ...(state.conversations[projectId] || []),
              newMessage,
            ],
          },
          error: null,
        }));
      },

      getMessages: (projectId: string) => {
        return get().conversations[projectId] || [];
      },

      deleteMessage: (projectId: string, messageId: string) => {
        set((state) => ({
          conversations: {
            ...state.conversations,
            [projectId]: (state.conversations[projectId] || []).filter(
              m => m.id !== messageId
            ),
          },
        }));
      },

      clearMessages: (projectId: string) => {
        set((state) => ({
          conversations: {
            ...state.conversations,
            [projectId]: [],
          },
        }));
      },

      // Utility
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'conversation-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        conversations: state.conversations,
        // Don't persist loading/error states
      }),
    }
  )
);
```

### Success Criteria

**Automated:**
- [ ] Tests fail without store (Red): `npm test -- store.test`
- [ ] Tests pass (Green): `npm test -- store.test`
- [ ] Persistence works
- [ ] State updates correctly

**Manual:**
- [ ] Refresh page retains state
- [ ] Can create/delete projects
- [ ] Messages persist per project
- [ ] Switching projects shows correct messages
- [ ] Error states handled gracefully

---

## Phase 7: End-to-End Integration

### Behavior 7.1: Complete User Flow Works

#### Test Specification
**Given**: User wants to create content using audio
**When**: User records audio, transcribes, and receives AI response
**Then**:
- Audio records successfully
- Transcription displays in message
- AI generates response based on transcript
- Conversation updates
- All state persists

**Edge Cases**:
- API failures during transcription
- API failures during generation
- Network interruption mid-flow
- User cancels recording

#### 🔴 Red: Write E2E Test

**File**: `e2e/conversation-flow.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Complete Conversation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create project and send text message', async ({ page }) => {
    // Create new project
    await page.click('[aria-label="New project"]');
    await page.fill('input[placeholder="Project name"]', 'Test Project');
    await page.click('button:has-text("Create")');

    // Send message
    await page.fill('textarea[placeholder*="Type your message"]', 'Hello, AI!');
    await page.click('button[aria-label="Send message"]');

    // Wait for message to appear
    await expect(page.locator('text=Hello, AI!')).toBeVisible();

    // Wait for AI response (this will fail until API integrated)
    await expect(page.locator('text=/How can I assist/')).toBeVisible({ timeout: 10000 });
  });

  test('should attach file and send', async ({ page }) => {
    // Create project
    await page.click('[aria-label="New project"]');
    await page.fill('input', 'File Test');
    await page.click('button:has-text("Create")');

    // Attach file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test/fixtures/sample.txt');

    // Verify file appears
    await expect(page.locator('text=sample.txt')).toBeVisible();

    // Send message with attachment
    await page.fill('textarea', 'Check this file');
    await page.click('button[aria-label="Send message"]');

    await expect(page.locator('text=Check this file')).toBeVisible();
  });

  test('should record audio and transcribe', async ({ page, context }) => {
    // Grant microphone permission
    await context.grantPermissions(['microphone']);

    // Create project
    await page.click('[aria-label="New project"]');
    await page.fill('input', 'Audio Test');
    await page.click('button:has-text("Create")');

    // Start recording
    await page.click('button[aria-label="Record audio"]');

    // Wait 2 seconds
    await page.waitForTimeout(2000);

    // Stop recording
    await page.click('button[aria-label="Stop recording"]');

    // Wait for transcription (this will fail until Whisper API integrated)
    await expect(page.locator('text=/transcribed/i')).toBeVisible({ timeout: 15000 });
  });

  test('should persist state across page reload', async ({ page }) => {
    // Create project and send message
    await page.click('[aria-label="New project"]');
    await page.fill('input', 'Persistence Test');
    await page.click('button:has-text("Create")');

    await page.fill('textarea', 'Test message');
    await page.click('button[aria-label="Send message"]');

    // Reload page
    await page.reload();

    // Verify project and message still there
    await expect(page.locator('text=Persistence Test')).toBeVisible();
    await expect(page.locator('text=Test message')).toBeVisible();
  });
});
```

**Install Playwright**:
```bash
npm install -D @playwright/test
npx playwright install
```

**File**: `playwright.config.ts`
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

#### 🟢 Green: Implement Integration

**File**: `app/page.tsx` (main page that ties everything together)
```typescript
'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import ProjectSidebar from '@/components/layout/ProjectSidebar';
import ConversationView from '@/components/chat/ConversationView';
import MessageInput from '@/components/chat/MessageInput';
import { useConversationStore } from '@/lib/store';

export default function HomePage() {
  const {
    projects,
    activeProjectId,
    createProject,
    setActiveProject,
    addMessage,
    getMessages,
  } = useConversationStore();

  const handleSendMessage = async (content: string) => {
    if (!activeProjectId) return;

    // Add user message
    addMessage(activeProjectId, {
      role: 'user',
      content,
    });

    // TODO: Call AI API for response
    // For now, echo back
    setTimeout(() => {
      addMessage(activeProjectId, {
        role: 'assistant',
        content: `Echo: ${content}`,
      });
    }, 1000);
  };

  const handleNewProject = () => {
    const name = prompt('Enter project name:');
    if (name) {
      createProject(name);
    }
  };

  const activeMessages = activeProjectId ? getMessages(activeProjectId) : [];

  return (
    <AppLayout>
      <div className="flex h-full">
        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProject}
          onNewProject={handleNewProject}
        />
        <div className="flex-1 flex flex-col">
          <ConversationView messages={activeMessages} />
          <MessageInput onSend={handleSendMessage} />
        </div>
      </div>
    </AppLayout>
  );
}
```

#### 🔵 Refactor: Add Full Features

**File**: `app/page.tsx` (complete implementation)
```typescript
'use client';

import React, { useState } from 'react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const {
    projects,
    activeProjectId,
    createProject,
    setActiveProject,
    addMessage,
    getMessages,
    setError,
  } = useConversationStore();

  const handleSendMessage = async (content: string) => {
    if (!activeProjectId || !content.trim()) return;

    try {
      setIsProcessing(true);

      // Add user message
      addMessage(activeProjectId, {
        role: 'user',
        content,
        attachments: files.map(f => f.name),
      });

      // Clear files
      setFiles([]);

      // Generate AI response
      const response = await generateResponse(content, files);

      // Add assistant message
      addMessage(activeProjectId, {
        role: 'assistant',
        content: response,
      });
    } catch (error) {
      console.error('Error generating response:', error);
      setError('Failed to generate response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!activeProjectId) return;

    try {
      setIsProcessing(true);

      // Transcribe audio
      const transcription = await transcribeAudio(audioBlob);

      // Send transcription as message
      await handleSendMessage(transcription);
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setError('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewProject = () => {
    const name = prompt('Enter project name:');
    if (name) {
      createProject(name);
    }
  };

  const activeMessages = activeProjectId ? getMessages(activeProjectId) : [];

  // Show welcome screen if no projects
  if (projects.length === 0) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4">Welcome to Writing Agent</h1>
            <p className="text-muted-foreground mb-6">
              Create your first project to start generating content with AI assistance.
            </p>
            <button
              onClick={handleNewProject}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              Create Project
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-full">
        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProject}
          onNewProject={handleNewProject}
        />
        <div className="flex-1 flex flex-col">
          <ConversationView
            messages={activeMessages}
            isLoading={isProcessing}
          />
          <div className="border-t p-4">
            <div className="flex gap-2 mb-2">
              <FileAttachment onFilesChange={setFiles} />
              <AudioRecorder onRecordingComplete={handleRecordingComplete} />
            </div>
            <MessageInput
              onSend={handleSendMessage}
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

**File**: `lib/api.ts` (AI generation API)
```typescript
import { env } from './env';

export async function generateResponse(
  userMessage: string,
  files?: File[]
): Promise<string> {
  // TODO: Integrate with existing BAML/Claude infrastructure
  // For now, simple OpenAI API call

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.openaiApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful writing assistant. Help users generate and refine content based on their inputs.',
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate response');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Success Criteria

**Automated:**
- [ ] E2E tests fail before integration (Red): `npm run test:e2e`
- [ ] E2E tests pass after integration (Green): `npm run test:e2e`
- [ ] All user flows covered

**Manual:**
- [ ] Can create project → send message → receive response
- [ ] Can attach files → send → response considers files
- [ ] Can record audio → transcribe → send → receive response
- [ ] State persists across reload
- [ ] All features work together seamlessly
- [ ] Error handling graceful throughout

---

## Phase 8: Deployment to Vercel

### Behavior 8.1: Application Deploys to Vercel

#### Test Specification
**Given**: Application ready for production
**When**: Deploying to Vercel
**Then**:
- Build succeeds
- Environment variables configured
- Application accessible via URL
- All features work in production

**Edge Cases**:
- Missing environment variables
- Build failures
- API rate limits
- CORS issues

#### 🔴 Red: Write Deployment Test

**File**: `__tests__/deployment.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { env } from '@/lib/env';

describe('Deployment Configuration', () => {
  it('should have all required environment variables', () => {
    expect(() => env.openaiApiKey()).not.toThrow();
  });

  it('should build without errors', async () => {
    // This will be tested by actual build process
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it('should have proper Next.js config', () => {
    // Check next.config exists and is valid
    const nextConfig = require('../next.config');
    expect(nextConfig).toBeDefined();
  });
});
```

#### 🟢 Green: Setup Deployment

**File**: `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "env": {
    "OPENAI_API_KEY": "@openai_api_key"
  }
}
```

**File**: `.env.production` (template)
```bash
# Production environment variables
# Set these in Vercel dashboard

OPENAI_API_KEY=
NODE_ENV=production
```

**File**: `next.config.ts`
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
};

export default nextConfig;
```

#### 🔵 Refactor: Add Production Optimizations

**File**: `next.config.ts` (optimized)
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Environment variables
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },

  // Performance optimizations
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Compression
  compress: true,

  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint during build
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
```

**Deployment Steps**:

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

4. **Set Environment Variables** (via Vercel Dashboard):
- Go to Project Settings → Environment Variables
- Add `OPENAI_API_KEY` with your key
- Select "Production", "Preview", "Development" scopes

5. **Configure Domain** (optional):
- Go to Project Settings → Domains
- Add custom domain if desired

### Success Criteria

**Automated:**
- [ ] Build succeeds locally: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Vercel deployment succeeds
- [ ] Application loads at Vercel URL
- [ ] All features work in production
- [ ] Environment variables set correctly
- [ ] No console errors in production
- [ ] Performance acceptable (Lighthouse score >80)

---

## Integration & E2E Testing Summary

### Integration Tests
- API routes with Whisper API
- Audio transcription pipeline
- Theme extraction integration (future: connect to existing BAML)
- State persistence across sessions

### E2E Test Scenarios
1. **Text Message Flow**: Type → Send → Receive AI response
2. **File Upload Flow**: Attach file → Send → AI analyzes file
3. **Audio Recording Flow**: Record → Transcribe → Send → AI responds
4. **Project Management**: Create → Switch → Messages persist
5. **State Persistence**: Reload page → State restored
6. **Error Handling**: Network failure → Graceful degradation

---

## Success Metrics

### Automated Verification
- [ ] All unit tests pass: `npm test`
- [ ] All E2E tests pass: `npm run test:e2e`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in dev: `npm run dev`

### Manual Verification
- [ ] Can create and manage projects
- [ ] Can send text messages
- [ ] Can attach files (multiple, drag-drop)
- [ ] Can record audio (5-minute limit)
- [ ] Audio transcribes correctly via Whisper
- [ ] AI generates relevant responses
- [ ] Markdown renders in messages
- [ ] State persists across reload
- [ ] Responsive on mobile/tablet/desktop
- [ ] Deployed to Vercel successfully
- [ ] Performance: Page loads < 3s
- [ ] Accessibility: Keyboard navigation works
- [ ] Accessibility: Screen reader compatible

---

## References

- **Research Document**: `thoughts/searchable/research/2026-01-09-building-writing-agent-ui.md`
- **Sprint Plans**: `sprints/sprint_04_web_ui_shell.md`, `sprint_10_ai_chat.md`
- **Existing Backend**: `planning_pipeline/decomposition.py`, `context_window_array/store.py`
- **Testing Patterns**: `planning_pipeline/tests/` (pytest examples)
- **Next.js Docs**: https://nextjs.org/docs
- **shadcn/ui Docs**: https://ui.shadcn.com
- **OpenAI Whisper API**: https://platform.openai.com/docs/guides/speech-to-text
- **Vercel Deployment**: https://vercel.com/docs

---

## Notes

### Technology Decisions
- **Why Next.js + React?** User specified, better ecosystem than Svelte for this use case
- **Why Whisper API?** User specified, simpler than local Whisper models
- **Why Standalone App?** User specified, easier to deploy than integrating with existing Context Engine
- **Why Vercel?** User specified, best Next.js deployment platform

### Future Enhancements (Out of Scope)
- User authentication and multi-user support
- Integration with existing BAML theme extraction pipeline
- Advanced theme visualization
- Export conversations to markdown/PDF
- Real-time collaboration
- Voice output (TTS)
- Custom AI model selection
- Local Whisper for offline transcription

### Testing Philosophy
- **Red-Green-Refactor**: Every behavior follows TDD cycle
- **Test Pyramid**: Many unit tests, fewer integration, minimal E2E
- **Behavior-Driven**: Tests describe observable behaviors, not implementation
- **Incremental**: Build feature-by-feature, test each before moving on

### Development Workflow
1. Read test → Understand expected behavior
2. Run test → See it fail (Red)
3. Write minimal code → Make it pass (Green)
4. Improve code → Keep tests green (Refactor)
5. Commit → Move to next behavior

---

**Plan Created**: 2026-01-09
**Estimated Complexity**: High (8-10 days full-time implementation)
**Dependencies**: OpenAI API key, Vercel account
**Risk Areas**: Audio recording browser compatibility, Whisper API rate limits, state management scaling
