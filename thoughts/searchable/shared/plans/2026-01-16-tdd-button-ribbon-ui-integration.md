# ButtonRibbon UI Integration TDD Implementation Plan

## Overview
Implement ButtonRibbon component for assistant messages with four action buttons: Copy, Regenerate, Send to API, and Edit. Connect MessageBubble to the existing button state management store and add E2E tests for user interactions, plus analytics/telemetry tracking.

## Beads Tracking

**Epic**: `silmari-writer-smq` - ButtonRibbon UI Integration

### Implementation Tasks (7 Behaviors)

| Behavior | Beads Issue | Description |
|----------|-------------|-------------|
| Behavior 1 | `silmari-writer-hs4` | ButtonRibbon Component - Initial Render |
| Behavior 2 | `silmari-writer-e1m` | Copy Button Interaction |
| Behavior 3 | `silmari-writer-5jn` | Regenerate Button Interaction |
| Behavior 4 | `silmari-writer-w8v` | Edit Button with Modal |
| Behavior 5 | `silmari-writer-9rw` | MessageBubble Integration |
| Behavior 6 | `silmari-writer-q5w` | Analytics/Telemetry Integration |
| E2E Tests | `silmari-writer-m6f` | E2E Button Interaction Tests |

**Dependency Chain**: Each behavior depends on the previous one (Epic→1→2→3→4→5→6→E2E)

**Check Status**: `bd show silmari-writer-smq` or `bd ready`

## Current State Analysis

### What Exists:
- **Button State Management (COMPLETE)**: `frontend/src/lib/store.ts:144-248`
  - Zustand store with `buttonStates: Record<string, MessageButtonState>`
  - Actions: `setNonBlockingOperation`, `clearNonBlockingOperation`, `startBlockingOperation`, `completeBlockingOperation`, `failBlockingOperation`, `isMessageBlocked`
  - 71 passing tests covering all 9 behaviors
  - State persistence with localStorage cleanup

- **Type Definitions (COMPLETE)**: `frontend/src/lib/types.ts:58-91`
  - `NonBlockingOperationType = 'copy'`
  - `BlockingOperationType = 'regenerate' | 'sendToAPI' | 'edit'`
  - `MessageButtonState` interface with `copy?` and `blockingOperation?`

- **MessageBubble Component**: `frontend/src/components/chat/MessageBubble.tsx:15-82`
  - Renders user/assistant messages with markdown support
  - Has avatar, content area, and timestamp
  - No button integration yet (stateless component)

- **UI Component Pattern**:
  - Plain HTML `<button>` elements with Tailwind CSS
  - Icons from Lucide React (v0.562.0)
  - Color system: `bg-primary`, `text-primary-foreground`, `hover:opacity-80`
  - Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`

- **Test Infrastructure**:
  - Vitest 4.0.17 with @testing-library/react 16.3.1
  - Test pattern in `MessageInput.test.tsx`: render, screen, userEvent.setup()
  - Component tests mock stores with `vi.mock()`

### What's Missing:
- `ButtonRibbon` component (`frontend/src/components/chat/ButtonRibbon.tsx`)
- `EditMessageModal` component for edit functionality
- ButtonRibbon integration in MessageBubble
- Component tests for ButtonRibbon and EditMessageModal
- E2E interaction tests
- Analytics/telemetry infrastructure and integration
- API integration for regenerate functionality

### Key Discoveries:
- Store is 100% ready for UI integration (no backend work needed)
- Existing button pattern: `flex items-center gap-2 px-4 py-2 rounded-full transition-colors`
- Test pattern: Mock store, render component, use userEvent for interactions
- MessageBubble already has `data-testid={message-${message.id}}` for testing

## Desired End State

### Observable Behaviors:
1. **ButtonRibbon renders for assistant messages only** - 4 buttons with icons and labels
2. **Copy button copies message content** - Updates clipboard, shows "Copied!" for 2 seconds
3. **Regenerate button removes message and re-sends** - Loading state, message removal, API call
4. **Send to API button triggers external integration** - Placeholder/disabled until endpoints configured
5. **Edit button opens modal** - Editable textarea, save/cancel actions
6. **Button states reflect store state** - Loading spinners, disabled states, error messages
7. **Analytics tracks all interactions** - Click events, outcomes, timing metrics

### Verification:
- All component tests pass: `npm test -- ButtonRibbon.test.tsx`
- All integration tests pass: `npm test -- MessageBubble.test.tsx`
- All E2E tests pass: `npm test -- ButtonInteractions.test.tsx`
- Type checking passes: `npm run type-check`
- Visual regression: ButtonRibbon appears below assistant messages only

## What We're NOT Doing
- Keyboard shortcuts (Cmd/Ctrl+C for copy)
- Button tooltips or help text
- Undo/redo functionality
- External API endpoint implementation (Gmail, LinkedIn, n8n)
- Advanced analytics dashboards or visualization
- Button customization or theming
- Drag-and-drop reordering of messages
- Multi-message selection or bulk operations
- Analytics API endpoint implementation (backend route `/api/analytics`)
- Analytics data persistence and retrieval
- Retry logic for failed analytics events (fire-and-forget pattern)
- Schema versioning for persisted state (future-proofing for localStorage migrations)

## Testing Strategy

**Framework**: Vitest 4.0.17
- Component tests for ButtonRibbon and EditMessageModal
- Integration tests for MessageBubble with ButtonRibbon
- E2E tests for full user interaction flows
- Analytics tests for telemetry events

**Test Types**:
- **Unit**: ButtonRibbon rendering, button click handlers, state-based styling
- **Integration**: MessageBubble with ButtonRibbon, store integration
- **E2E**: Copy flow, regenerate flow, edit modal flow, error handling

**Mocking/Setup**:
- Mock `useConversationStore` with vi.mock (existing pattern)
- Mock `navigator.clipboard.writeText` for copy tests
- Mock API calls for regenerate/sendToAPI
- Mock analytics service for telemetry tests
- Use `userEvent.setup()` for realistic interactions

---

## Behavior 1: ButtonRibbon Component - Initial Render

### Test Specification
**Given**: An assistant message with no button state
**When**: ButtonRibbon renders
**Then**: Shows 4 buttons (Copy, Regenerate, Send to API, Edit) with icons and correct enabled/disabled states

**Edge Cases**:
- Message with blocking operation in progress (some buttons disabled)
- Message with error state (error message shown)
- Message with copy state active (shows "Copied!" feedback)

### Contract: Copy State Timeout Lifecycle

The ButtonRibbon component MUST manage copy state timeout lifecycle properly:
- Set timeout for 2000ms when `copyState.isActive` becomes true
- Clear timeout on component unmount to prevent memory leaks
- Clear timeout when `copyState.isActive` becomes false to prevent duplicate clears
- Verify `clearNonBlockingOperation` is stable (Zustand actions are stable by default)

**Implementation pattern**:
```typescript
useEffect(() => {
  if (copyState?.isActive) {
    const timer = setTimeout(() => clearNonBlockingOperation(messageId, 'copy'), 2000)
    return () => clearTimeout(timer) // Cleanup on unmount
  }
}, [copyState?.isActive, messageId, clearNonBlockingOperation])
```

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/ButtonRibbon.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ButtonRibbon from '@/components/chat/ButtonRibbon'
import { useConversationStore } from '@/lib/store'

// Mock the store
vi.mock('@/lib/store', () => ({
  useConversationStore: vi.fn(),
}))

describe('ButtonRibbon', () => {
  const mockMessageId = 'msg-123'
  const mockStore = {
    buttonStates: {},
    setNonBlockingOperation: vi.fn(),
    clearNonBlockingOperation: vi.fn(),
    startBlockingOperation: vi.fn(),
    completeBlockingOperation: vi.fn(),
    failBlockingOperation: vi.fn(),
    isMessageBlocked: vi.fn(() => false),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useConversationStore).mockReturnValue(mockStore as any)
  })

  it('renders all four buttons', () => {
    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send to api/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows button icons', () => {
    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    // Check that icons are rendered (Lucide React icons have aria-hidden)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)

    // Each button should have an icon (svg element)
    buttons.forEach(button => {
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  it('all buttons are enabled when no blocking operation', () => {
    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    expect(screen.getByRole('button', { name: /copy/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /regenerate/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /send to api/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /edit/i })).not.toBeDisabled()
  })

  it('blocking buttons are disabled when message is blocked', () => {
    mockStore.isMessageBlocked = vi.fn(() => true)
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'regenerate',
          isLoading: true,
        },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    // Copy is non-blocking, should still be enabled
    expect(screen.getByRole('button', { name: /copy/i })).not.toBeDisabled()

    // Blocking buttons should be disabled
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /send to api/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
  })

  it('shows loading spinner on active operation button', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'regenerate',
          isLoading: true,
        },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    // Check for loading indicator (we'll use a data-testid)
    expect(regenerateButton.querySelector('[data-testid="loading-spinner"]')).toBeInTheDocument()
  })

  it('shows error message when operation failed', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'sendToAPI',
          isLoading: false,
          error: 'API call failed',
        },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    expect(screen.getByText(/api call failed/i)).toBeInTheDocument()
  })

  it('shows "Copied!" when copy state is active', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        copy: {
          isActive: true,
          timestamp: Date.now(),
        },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test message" />)

    expect(screen.getByText(/copied!/i)).toBeInTheDocument()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/chat/ButtonRibbon.tsx`
```typescript
'use client';

import { Copy, RefreshCw, Send, Edit } from 'lucide-react';
import { useConversationStore } from '@/lib/store';

interface ButtonRibbonProps {
  messageId: string;
  content: string;
}

export default function ButtonRibbon({ messageId, content }: ButtonRibbonProps) {
  const { buttonStates, isMessageBlocked } = useConversationStore();

  const buttonState = buttonStates[messageId];
  const isBlocked = isMessageBlocked(messageId);
  const blockingOperation = buttonState?.blockingOperation;
  const copyState = buttonState?.copy;

  return (
    <div className="mt-2 flex items-center gap-2">
      {/* Copy button (non-blocking) */}
      <button
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={false}
        aria-label="Copy message"
      >
        <Copy className="w-4 h-4" />
        {copyState?.isActive ? 'Copied!' : 'Copy'}
      </button>

      {/* Regenerate button (blocking) */}
      <button
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isBlocked}
        aria-label="Regenerate message"
      >
        {blockingOperation?.type === 'regenerate' && blockingOperation.isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" data-testid="loading-spinner" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        Regenerate
      </button>

      {/* Send to API button (blocking) */}
      <button
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isBlocked}
        aria-label="Send to API"
      >
        {blockingOperation?.type === 'sendToAPI' && blockingOperation.isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" data-testid="loading-spinner" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Send to API
      </button>

      {/* Edit button (blocking) */}
      <button
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isBlocked}
        aria-label="Edit message"
      >
        {blockingOperation?.type === 'edit' && blockingOperation.isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" data-testid="loading-spinner" />
        ) : (
          <Edit className="w-4 h-4" />
        )}
        Edit
      </button>

      {/* Error message display */}
      {blockingOperation?.error && (
        <div className="text-sm text-red-600 ml-2">
          {blockingOperation.error}
        </div>
      )}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code
Extract button styling and LoadingSpinner component to reduce duplication:
```typescript
// Add at top of file
const buttonBaseClasses = "flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner = ({ size = 'sm', className }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={`${sizeClasses[size]} border-2 border-current border-t-transparent rounded-full animate-spin ${className || ''}`}
      data-testid="loading-spinner"
    />
  );
};

// Use in buttons:
<button className={buttonBaseClasses} ...>
  {isLoading ? <LoadingSpinner /> : <Icon />}
  Label
</button>
```

### Success Criteria
**Automated:**
- [ ] Test fails initially (Red): ButtonRibbon component does not exist
- [ ] Tests pass after implementation (Green): `npm test -- ButtonRibbon.test.tsx`
- [ ] All existing tests still pass: `npm test`
- [ ] Type checking passes: `npm run type-check`

**Manual:**
- [ ] ButtonRibbon renders below assistant messages in UI
- [ ] 4 buttons visible with correct icons
- [ ] Buttons have hover states
- [ ] Loading spinners animate smoothly

---

## Behavior 2: ButtonRibbon - Copy Button Interaction

### Test Specification
**Given**: ButtonRibbon rendered with message content
**When**: User clicks Copy button
**Then**: Message content copied to clipboard, "Copied!" feedback shown for 2 seconds, then cleared

**Edge Cases**:
- Clipboard API not available (fallback behavior)
- Copy during blocking operation (should work - non-blocking)
- Rapid repeated clicks (should restart timeout)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/ButtonRibbon.test.tsx` (add to existing file)
```typescript
describe('Copy button', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    })

    // Mock timers for testing timeouts
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('copies message content to clipboard when clicked', async () => {
    const user = userEvent.setup({ delay: null })
    const content = 'Test message content'

    render(<ButtonRibbon messageId={mockMessageId} content={content} />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content)
  })

  it('calls setNonBlockingOperation when copy clicked', async () => {
    const user = userEvent.setup({ delay: null })

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)

    expect(mockStore.setNonBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'copy')
  })

  it('shows "Copied!" feedback after clicking copy', async () => {
    const user = userEvent.setup({ delay: null })

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)

    // After click, setNonBlockingOperation is called which updates store
    // We need to re-render with updated state
    mockStore.buttonStates = {
      [mockMessageId]: {
        copy: { isActive: true, timestamp: Date.now() },
      },
    }

    // Re-render
    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    expect(screen.getByText(/copied!/i)).toBeInTheDocument()
  })

  it('clears copy state after 2 seconds', async () => {
    const user = userEvent.setup({ delay: null })

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000)

    expect(mockStore.clearNonBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'copy')
  })

  it('can copy during blocking operation (non-blocking)', async () => {
    const user = userEvent.setup({ delay: null })
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'regenerate',
          isLoading: true,
        },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    expect(copyButton).not.toBeDisabled()

    await user.click(copyButton)
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('handles clipboard write failure gracefully', async () => {
    const user = userEvent.setup({ delay: null })

    // Mock clipboard failure
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'))

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)

    // Should not crash, should log error
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/chat/ButtonRibbon.tsx`
```typescript
'use client';

import { useEffect } from 'react';
import { Copy, RefreshCw, Send, Edit } from 'lucide-react';
import { useConversationStore } from '@/lib/store';

interface ButtonRibbonProps {
  messageId: string;
  content: string;
}

export default function ButtonRibbon({ messageId, content }: ButtonRibbonProps) {
  const {
    buttonStates,
    isMessageBlocked,
    setNonBlockingOperation,
    clearNonBlockingOperation,
  } = useConversationStore();

  const buttonState = buttonStates[messageId];
  const isBlocked = isMessageBlocked(messageId);
  const blockingOperation = buttonState?.blockingOperation;
  const copyState = buttonState?.copy;

  // Auto-clear copy state after 2 seconds
  // Note: clearNonBlockingOperation is stable (from Zustand), safe to depend on
  useEffect(() => {
    if (copyState?.isActive) {
      const timer = setTimeout(() => {
        clearNonBlockingOperation(messageId, 'copy');
      }, 2000);

      return () => clearTimeout(timer); // Cleanup on unmount
    }
  }, [copyState?.isActive, messageId, clearNonBlockingOperation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setNonBlockingOperation(messageId, 'copy');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const buttonBaseClasses = "flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
  }

  const LoadingSpinner = ({ size = 'sm', className }: LoadingSpinnerProps) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
    };

    return (
      <div
        className={`${sizeClasses[size]} border-2 border-current border-t-transparent rounded-full animate-spin ${className || ''}`}
        data-testid="loading-spinner"
      />
    );
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      {/* Copy button (non-blocking) */}
      <button
        className={buttonBaseClasses}
        onClick={handleCopy}
        aria-label="Copy message"
      >
        <Copy className="w-4 h-4" />
        {copyState?.isActive ? 'Copied!' : 'Copy'}
      </button>

      {/* Regenerate button (blocking) */}
      <button
        className={buttonBaseClasses}
        disabled={isBlocked}
        aria-label="Regenerate message"
      >
        {blockingOperation?.type === 'regenerate' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        Regenerate
      </button>

      {/* Send to API button (blocking) */}
      <button
        className={buttonBaseClasses}
        disabled={isBlocked}
        aria-label="Send to API"
      >
        {blockingOperation?.type === 'sendToAPI' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Send to API
      </button>

      {/* Edit button (blocking) */}
      <button
        className={buttonBaseClasses}
        disabled={isBlocked}
        aria-label="Edit message"
      >
        {blockingOperation?.type === 'edit' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <Edit className="w-4 h-4" />
        )}
        Edit
      </button>

      {/* Error message display */}
      {blockingOperation?.error && (
        <div className="text-sm text-red-600 ml-2">
          {blockingOperation.error}
        </div>
      )}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code
No major refactoring needed - implementation is clean with useEffect for cleanup.

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): onClick handler not defined
- [ ] Tests pass after implementation (Green): `npm test -- ButtonRibbon.test.tsx`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Click copy button, verify content in clipboard (Cmd/Ctrl+V)
- [ ] "Copied!" feedback visible for exactly 2 seconds
- [ ] Can copy during regeneration (non-blocking)

---

## Behavior 3: ButtonRibbon - Regenerate Button Interaction

### Test Specification
**Given**: Assistant message with content
**When**: User clicks Regenerate button
**Then**: Starts blocking operation, shows loading state, removes assistant message, re-sends API call with context

**Edge Cases**:
- Regenerate while another operation is active (blocked)
- Regenerate succeeds (message removed, new message appears)
- Regenerate fails (error shown, message preserved)
- Multiple messages regenerating simultaneously (message isolation)

### Contract: Request Cancellation

The regenerate operation MUST support request cancellation to prevent wasted API calls:
- Use AbortController to cancel in-flight requests on component unmount
- Clean up controller on component unmount
- Silent fail on AbortError (user-initiated cancel, not a true error)
- Handle race conditions when multiple regenerate operations occur

**Implementation pattern**:
```typescript
const handleRegenerate = async () => {
  const controller = new AbortController()
  startBlockingOperation(messageId, 'regenerate')

  try {
    const newMessage = await regenerateMessage(messageId, projectId, messages, {
      signal: controller.signal
    })
    completeBlockingOperation(messageId)
  } catch (error) {
    if (error.name === 'AbortError') return // Silent fail on cancel
    failBlockingOperation(messageId, error.message)
  }

  return () => controller.abort() // Cleanup function
}
```

### API Contract: Regenerate Endpoint

```typescript
interface RegenerateRequest {
  projectId: string;
  messages: Message[];      // Context up to regenerated message
  userMessage: string;      // Last user message to regenerate from
}

interface RegenerateResponse {
  message: Message;         // New assistant message
  error?: string;
}

// Usage
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request satisfies RegenerateRequest),
  signal: abortController.signal, // Support cancellation
})
```

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/ButtonRibbon.test.tsx`
```typescript
describe('Regenerate button', () => {
  it('calls startBlockingOperation when clicked', async () => {
    const user = userEvent.setup()

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    await user.click(regenerateButton)

    expect(mockStore.startBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'regenerate')
  })

  it('shows loading spinner during regeneration', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'regenerate',
          isLoading: true,
        },
      },
    }
    mockStore.isMessageBlocked = vi.fn(() => true)

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    expect(regenerateButton.querySelector('[data-testid="loading-spinner"]')).toBeInTheDocument()
    expect(regenerateButton).toBeDisabled()
  })

  it('disables other blocking buttons during regeneration', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'regenerate',
          isLoading: true,
        },
      },
    }
    mockStore.isMessageBlocked = vi.fn(() => true)

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    expect(screen.getByRole('button', { name: /regenerate/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /send to api/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()

    // Copy should still be enabled (non-blocking)
    expect(screen.getByRole('button', { name: /copy/i })).not.toBeDisabled()
  })

  it('shows error message when regeneration fails', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'regenerate',
          isLoading: false,
          error: 'Failed to regenerate message',
        },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    expect(screen.getByText(/failed to regenerate message/i)).toBeInTheDocument()
  })

  it('cannot regenerate when another operation is active', () => {
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: {
          type: 'edit',
          isLoading: true,
        },
      },
    }
    mockStore.isMessageBlocked = vi.fn(() => true)

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    expect(regenerateButton).toBeDisabled()
  })

  it('clears error when starting new operation', async () => {
    const user = userEvent.setup()

    // Set error state
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: { type: 'regenerate', isLoading: false, error: 'Failed' }
      }
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    // Verify error is shown
    expect(screen.getByText(/failed/i)).toBeInTheDocument()

    // Start new operation (should clear error)
    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    await user.click(regenerateButton)

    // Update store to show loading without error
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: { type: 'regenerate', isLoading: true }
      }
    }

    // Re-render
    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    // Verify error cleared
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/chat/ButtonRibbon.tsx`
```typescript
// Add to imports
import { useState } from 'react';

// Add handleRegenerate function
const handleRegenerate = async () => {
  startBlockingOperation(messageId, 'regenerate');

  try {
    // TODO: Implement regenerate logic
    // 1. Get conversation context (all messages up to this one)
    // 2. Remove this assistant message from context
    // 3. Re-send API call with context + last user message
    // 4. Handle response

    // For now, simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    completeBlockingOperation(messageId);
  } catch (error) {
    failBlockingOperation(messageId, error instanceof Error ? error.message : 'Regeneration failed');
  }
};

// Update button
<button
  className={buttonBaseClasses}
  onClick={handleRegenerate}
  disabled={isBlocked}
  aria-label="Regenerate message"
>
  {blockingOperation?.type === 'regenerate' && blockingOperation.isLoading ? (
    <LoadingSpinner />
  ) : (
    <RefreshCw className="w-4 h-4" />
  )}
  Regenerate
</button>
```

#### 🔵 Refactor: Improve Code
Extract regenerate logic to separate API function with AbortController support:
```typescript
// Create new file: frontend/src/lib/messageActions.ts
export interface RegenerateMessageOptions {
  signal?: AbortSignal;
}

export async function regenerateMessage(
  messageId: string,
  projectId: string,
  messages: Message[],
  options?: RegenerateMessageOptions
): Promise<Message> {
  // 1. Find the message to regenerate
  const messageIndex = messages.findIndex(m => m.id === messageId);
  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // 2. Get context up to (but not including) this message
  const context = messages.slice(0, messageIndex);

  // 3. Find the last user message
  const lastUserMessage = [...context].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) {
    throw new Error('No user message found for regeneration');
  }

  // 4. Call API with context and abort signal
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      messages: context,
      userMessage: lastUserMessage.content,
    }),
    signal: options?.signal, // Support cancellation
  });

  if (!response.ok) {
    throw new Error('API call failed');
  }

  const data = await response.json();
  return data.message;
}

// Update ButtonRibbon.tsx
import { regenerateMessage } from '@/lib/messageActions';

const handleRegenerate = async () => {
  const controller = new AbortController();
  startBlockingOperation(messageId, 'regenerate');

  try {
    // Get current messages from store
    const messages = useConversationStore.getState().getActiveMessages();
    const projectId = useConversationStore.getState().activeProjectId;

    if (!projectId) {
      throw new Error('No active project');
    }

    // Call regenerate API with abort signal
    const newMessage = await regenerateMessage(messageId, projectId, messages, {
      signal: controller.signal
    });

    // Remove old message and add new one (handled by parent component or API)
    completeBlockingOperation(messageId);
  } catch (error) {
    // Silent fail on user-initiated abort
    if (error.name === 'AbortError') return;
    failBlockingOperation(messageId, error instanceof Error ? error.message : 'Regeneration failed');
  }

  // Return cleanup function for component unmount
  return () => controller.abort();
};
```

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): onClick handler not defined
- [ ] Tests pass (Green): `npm test -- ButtonRibbon.test.tsx`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Click Regenerate, see loading spinner
- [ ] Other blocking buttons disabled during regeneration
- [ ] Error message appears if regeneration fails
- [ ] Can regenerate different messages independently

---

## Behavior 4: ButtonRibbon - Edit Button with Modal

### Test Specification
**Given**: Assistant message with content
**When**: User clicks Edit button
**Then**: Modal opens with editable content, Save updates message, Cancel closes modal

**Edge Cases**:
- Edit while another operation is active (blocked)
- Save with empty content (validation)
- Cancel after making changes (no save)
- Press Escape to close modal

### Contract: Save Operation Behavior

The edit save operation behavior specification:
- **Local-only** (recommended for MVP): Synchronous store update, immediate close
- No API call required for MVP, edit is local modification only
- Future enhancement: Add sync to backend via separate API endpoint

**Implementation pattern**:
```typescript
const handleEditSave = (newContent: string) => {
  // Update message in store (synchronous)
  updateMessage(messageId, { content: newContent })
  setIsEditModalOpen(false)
  completeBlockingOperation(messageId)
}
```

**Future API contract** (not implemented in this plan):
```typescript
interface UpdateMessageRequest {
  messageId: string;
  content: string;
}

interface UpdateMessageResponse {
  message: Message;
  error?: string;
}
```

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/EditMessageModal.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditMessageModal from '@/components/chat/EditMessageModal'

describe('EditMessageModal', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()
  const defaultProps = {
    isOpen: true,
    content: 'Original message content',
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  }

  it('renders modal when open', () => {
    render(<EditMessageModal {...defaultProps} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/original message content/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<EditMessageModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows textarea with current content', () => {
    render(<EditMessageModal {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('Original message content')
  })

  it('calls onSave with edited content when Save clicked', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'Edited content')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith('Edited content')
  })

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('calls onCancel when Escape key pressed', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    await user.keyboard('{Escape}')

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('disables Save button when content is empty', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)

    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it('shows character count', () => {
    render(<EditMessageModal {...defaultProps} content="Test" />)

    expect(screen.getByText(/4 characters/i)).toBeInTheDocument()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/chat/EditMessageModal.tsx`
```typescript
'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditMessageModalProps {
  isOpen: boolean;
  content: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}

export default function EditMessageModal({
  isOpen,
  content,
  onSave,
  onCancel,
}: EditMessageModalProps) {
  const [editedContent, setEditedContent] = useState(content);

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(editedContent);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Message</h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          autoFocus
        />

        <div className="mt-2 text-sm text-gray-500">
          {editedContent.length} characters
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={editedContent.trim().length === 0}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Update ButtonRibbon.tsx**:
```typescript
// Add imports
import { useState } from 'react';
import EditMessageModal from './EditMessageModal';

// Add state
const [isEditModalOpen, setIsEditModalOpen] = useState(false);

// Add handlers
const handleEditClick = () => {
  setIsEditModalOpen(true);
  startBlockingOperation(messageId, 'edit');
};

const handleEditSave = (newContent: string) => {
  // Update message in store (synchronous operation)
  // Future: Add async API call here when backend sync is implemented
  try {
    // TODO: Get updateMessage from store
    // updateMessage(messageId, { content: newContent });
    setIsEditModalOpen(false);
    completeBlockingOperation(messageId);
  } catch (error) {
    failBlockingOperation(messageId, 'Failed to save changes');
  }
};

const handleEditCancel = () => {
  setIsEditModalOpen(false);
  completeBlockingOperation(messageId);
};

// Add modal to JSX
return (
  <>
    <div className="mt-2 flex items-center gap-2">
      {/* ... existing buttons ... */}
      <button
        className={buttonBaseClasses}
        onClick={handleEditClick}
        disabled={isBlocked}
        aria-label="Edit message"
      >
        {blockingOperation?.type === 'edit' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <Edit className="w-4 h-4" />
        )}
        Edit
      </button>
    </div>

    <EditMessageModal
      isOpen={isEditModalOpen}
      content={content}
      onSave={handleEditSave}
      onCancel={handleEditCancel}
    />
  </>
);
```

#### 🔵 Refactor: Improve Code
Extract modal backdrop to reusable component if needed, add animations.

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): EditMessageModal does not exist
- [ ] Tests pass (Green): `npm test -- EditMessageModal.test.tsx`
- [ ] ButtonRibbon integration tests pass
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Click Edit button, modal opens
- [ ] Edit content in textarea
- [ ] Save button updates message and closes modal
- [ ] Cancel button closes modal without saving
- [ ] Escape key closes modal

---

## Behavior 5: MessageBubble Integration

### Test Specification
**Given**: MessageBubble rendering assistant message
**When**: Component renders
**Then**: ButtonRibbon appears below message content (assistant only, not user)

**Edge Cases**:
- User messages (no ButtonRibbon)
- Assistant messages (ButtonRibbon present)
- Message content prop passed correctly to ButtonRibbon

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/MessageBubble.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MessageBubble from '@/components/chat/MessageBubble'
import { Message } from '@/lib/types'

// Mock ButtonRibbon
vi.mock('@/components/chat/ButtonRibbon', () => ({
  default: ({ messageId, content }: { messageId: string; content: string }) => (
    <div data-testid="button-ribbon" data-message-id={messageId}>
      ButtonRibbon: {content}
    </div>
  ),
}))

describe('MessageBubble with ButtonRibbon', () => {
  const assistantMessage: Message = {
    id: 'msg-123',
    role: 'assistant',
    content: 'This is an assistant message',
    timestamp: new Date('2026-01-16T10:00:00Z'),
  }

  const userMessage: Message = {
    id: 'msg-456',
    role: 'user',
    content: 'This is a user message',
    timestamp: new Date('2026-01-16T09:00:00Z'),
  }

  it('shows ButtonRibbon for assistant messages', () => {
    render(<MessageBubble message={assistantMessage} />)

    const buttonRibbon = screen.getByTestId('button-ribbon')
    expect(buttonRibbon).toBeInTheDocument()
    expect(buttonRibbon).toHaveAttribute('data-message-id', 'msg-123')
  })

  it('does not show ButtonRibbon for user messages', () => {
    render(<MessageBubble message={userMessage} />)

    expect(screen.queryByTestId('button-ribbon')).not.toBeInTheDocument()
  })

  it('passes message content to ButtonRibbon', () => {
    render(<MessageBubble message={assistantMessage} />)

    const buttonRibbon = screen.getByTestId('button-ribbon')
    expect(buttonRibbon).toHaveTextContent('This is an assistant message')
  })

  it('maintains existing message rendering', () => {
    render(<MessageBubble message={assistantMessage} />)

    // Message content still visible
    expect(screen.getByText(/this is an assistant message/i)).toBeInTheDocument()

    // Avatar still present
    expect(screen.getByLabelText(/ai/i)).toBeInTheDocument()

    // Timestamp still present
    expect(screen.getByTestId('message-timestamp')).toBeInTheDocument()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/chat/MessageBubble.tsx`
```typescript
'use client';

import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Message } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import ButtonRibbon from './ButtonRibbon';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
      data-testid={`message-${message.id}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 mr-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <Bot className="w-5 h-5 text-gray-600" aria-label="AI" />
          </div>
        </div>
      )}
      <div className="flex flex-col max-w-[70%]">
        <div
          className={`rounded-lg px-4 py-2 ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-900'
          }`}
          data-role={message.role}
        >
          <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  const isBlock = codeString.includes('\n') || match;
                  return isBlock && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                    >
                      {codeString}
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
          <div
            className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}
            data-testid="message-timestamp"
          >
            {formatRelativeTime(message.timestamp)}
          </div>
        </div>

        {/* ButtonRibbon for assistant messages only */}
        {!isUser && (
          <ButtonRibbon messageId={message.id} content={message.content} />
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 ml-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <User className="w-5 h-5 text-white" aria-label="User" />
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 🔵 Refactor: Improve Code
No major refactoring needed - clean integration.

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): ButtonRibbon not imported
- [ ] Tests pass (Green): `npm test -- MessageBubble.test.tsx`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Assistant messages show ButtonRibbon below content
- [ ] User messages do NOT show ButtonRibbon
- [ ] ButtonRibbon aligns correctly with message bubble
- [ ] No layout shifts or visual glitches

---

## Behavior 6: Analytics/Telemetry Integration

### Test Specification
**Given**: User interacts with buttons
**When**: Button clicked, operation completes/fails
**Then**: Analytics events sent with metadata (button type, message ID, outcome, timing)

**Edge Cases**:
- Analytics service unavailable (silent fail)
- Multiple rapid clicks (deduplicate events)
- Network errors (retry logic)

### API Contract: Analytics Endpoint (NOT IMPLEMENTED)

Analytics events are sent to `POST /api/analytics` but **endpoint is NOT implemented in this plan**.

**Expected payload format**:
```typescript
interface AnalyticsEvent {
  eventType: 'button_click' | 'button_outcome' | 'button_timing';
  buttonType: 'copy' | 'regenerate' | 'sendToAPI' | 'edit';
  messageId: string;
  timestamp: number;
  outcome?: 'success' | 'error';
  errorMessage?: string;
  duration?: number;
  startTime?: number;
  endTime?: number;
}

// Example: POST /api/analytics
// Body:
{
  "eventType": "button_click",
  "buttonType": "copy",
  "messageId": "msg-123",
  "timestamp": 1673894400000
}
```

**Behavior**: Events fail silently if endpoint not implemented. This is acceptable for MVP.

**Future work**:
- Implement `/api/analytics` route handler
- Add persistence layer for analytics data
- Consider adding session tracking: `sessionId`, `userId` fields
- Consider retry logic with exponential backoff for critical events

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/analytics.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  trackButtonClick,
  trackButtonOutcome,
  trackButtonTiming,
  AnalyticsEvent
} from '@/lib/analytics'

// Mock fetch
global.fetch = vi.fn()

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))
  })

  describe('trackButtonClick', () => {
    it('sends analytics event for button click', async () => {
      await trackButtonClick({
        buttonType: 'copy',
        messageId: 'msg-123',
        timestamp: Date.now(),
      })

      expect(fetch).toHaveBeenCalledWith('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"eventType":"button_click"'),
      })
    })

    it('includes button type and message ID', async () => {
      await trackButtonClick({
        buttonType: 'regenerate',
        messageId: 'msg-456',
        timestamp: 1234567890,
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.buttonType).toBe('regenerate')
      expect(body.messageId).toBe('msg-456')
      expect(body.timestamp).toBe(1234567890)
    })
  })

  describe('trackButtonOutcome', () => {
    it('sends analytics event for success outcome', async () => {
      await trackButtonOutcome({
        buttonType: 'regenerate',
        messageId: 'msg-123',
        outcome: 'success',
        timestamp: Date.now(),
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.eventType).toBe('button_outcome')
      expect(body.outcome).toBe('success')
    })

    it('sends analytics event for error outcome with message', async () => {
      await trackButtonOutcome({
        buttonType: 'sendToAPI',
        messageId: 'msg-123',
        outcome: 'error',
        errorMessage: 'API call failed',
        timestamp: Date.now(),
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.outcome).toBe('error')
      expect(body.errorMessage).toBe('API call failed')
    })
  })

  describe('trackButtonTiming', () => {
    it('sends analytics event with timing metrics', async () => {
      const startTime = 1000
      const endTime = 3000

      await trackButtonTiming({
        buttonType: 'regenerate',
        messageId: 'msg-123',
        startTime,
        endTime,
        duration: endTime - startTime,
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.eventType).toBe('button_timing')
      expect(body.duration).toBe(2000)
      expect(body.startTime).toBe(1000)
      expect(body.endTime).toBe(3000)
    })
  })

  describe('Error handling', () => {
    it('handles fetch errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(trackButtonClick({
        buttonType: 'copy',
        messageId: 'msg-123',
        timestamp: Date.now(),
      })).resolves.not.toThrow()
    })

    it('handles non-200 responses', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 500 }))

      // Should not throw
      await expect(trackButtonClick({
        buttonType: 'copy',
        messageId: 'msg-123',
        timestamp: Date.now(),
      })).resolves.not.toThrow()
    })
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/analytics.ts`
```typescript
export type ButtonType = 'copy' | 'regenerate' | 'sendToAPI' | 'edit';
export type EventType = 'button_click' | 'button_outcome' | 'button_timing';
export type Outcome = 'success' | 'error';

export interface ButtonClickEvent {
  buttonType: ButtonType;
  messageId: string;
  timestamp: number;
}

export interface ButtonOutcomeEvent {
  buttonType: ButtonType;
  messageId: string;
  outcome: Outcome;
  errorMessage?: string;
  timestamp: number;
}

export interface ButtonTimingEvent {
  buttonType: ButtonType;
  messageId: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface AnalyticsEvent {
  eventType: EventType;
  [key: string]: any;
}

// Analytics events are fire-and-forget, no retry on failure
// This is acceptable for MVP as analytics should not block user experience
async function sendAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.warn('Analytics event failed:', response.status);
    }
  } catch (error) {
    console.warn('Failed to send analytics event:', error);
    // Silent fail - don't disrupt user experience
    // Note: No retry logic for MVP. Future: implement exponential backoff if needed
  }
}

export async function trackButtonClick(data: ButtonClickEvent): Promise<void> {
  await sendAnalyticsEvent({
    eventType: 'button_click',
    ...data,
  });
}

export async function trackButtonOutcome(data: ButtonOutcomeEvent): Promise<void> {
  await sendAnalyticsEvent({
    eventType: 'button_outcome',
    ...data,
  });
}

export async function trackButtonTiming(data: ButtonTimingEvent): Promise<void> {
  await sendAnalyticsEvent({
    eventType: 'button_timing',
    ...data,
  });
}
```

**Integrate into ButtonRibbon.tsx**:
```typescript
import { trackButtonClick, trackButtonOutcome, trackButtonTiming } from '@/lib/analytics';

// Update handleCopy
const handleCopy = async () => {
  const startTime = Date.now();

  try {
    await trackButtonClick({
      buttonType: 'copy',
      messageId,
      timestamp: startTime,
    });

    await navigator.clipboard.writeText(content);
    setNonBlockingOperation(messageId, 'copy');

    await trackButtonOutcome({
      buttonType: 'copy',
      messageId,
      outcome: 'success',
      timestamp: Date.now(),
    });

    await trackButtonTiming({
      buttonType: 'copy',
      messageId,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);

    await trackButtonOutcome({
      buttonType: 'copy',
      messageId,
      outcome: 'error',
      errorMessage: error instanceof Error ? error.message : 'Copy failed',
      timestamp: Date.now(),
    });
  }
};

// Similar updates for handleRegenerate, handleEditSave, etc.
```

#### 🔵 Refactor: Improve Code
Create analytics hook for reusability with explicit interface:
```typescript
// frontend/src/hooks/useButtonAnalytics.ts
interface ButtonAnalytics {
  trackClick: () => Promise<void>;
  trackSuccess: (startTime: number) => Promise<void>;
  trackError: (error: Error | string) => Promise<void>;
}

export function useButtonAnalytics(
  buttonType: ButtonType,
  messageId: string
): ButtonAnalytics {
  const trackClick = async () => {
    await trackButtonClick({
      buttonType,
      messageId,
      timestamp: Date.now(),
    });
  };

  const trackSuccess = async (startTime: number) => {
    const endTime = Date.now();

    await trackButtonOutcome({
      buttonType,
      messageId,
      outcome: 'success',
      timestamp: endTime,
    });

    await trackButtonTiming({
      buttonType,
      messageId,
      startTime,
      endTime,
      duration: endTime - startTime,
    });
  };

  const trackError = async (error: Error | string) => {
    await trackButtonOutcome({
      buttonType,
      messageId,
      outcome: 'error',
      errorMessage: error instanceof Error ? error.message : error,
      timestamp: Date.now(),
    });
  };

  return { trackClick, trackSuccess, trackError };
}

// Use in ButtonRibbon:
const copyAnalytics = useButtonAnalytics('copy', messageId);

const handleCopy = async () => {
  const startTime = Date.now();
  await copyAnalytics.trackClick();

  try {
    await navigator.clipboard.writeText(content);
    setNonBlockingOperation(messageId, 'copy');
    await copyAnalytics.trackSuccess(startTime);
  } catch (error) {
    await copyAnalytics.trackError(error);
  }
};
```

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): analytics.ts does not exist
- [ ] Tests pass (Green): `npm test -- analytics.test.ts`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Check browser network tab for analytics events
- [ ] Verify events sent on button clicks
- [ ] Verify timing metrics are accurate
- [ ] Verify errors are tracked correctly

---

## E2E Integration Tests

### Test Specification
**Given**: Complete application with messages
**When**: User performs full interaction flows
**Then**: End-to-end behaviors work correctly (copy, regenerate, edit)

**File**: `frontend/__tests__/e2e/ButtonInteractions.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationView from '@/components/chat/ConversationView'
import { useConversationStore } from '@/lib/store'
import { Message } from '@/lib/types'

vi.mock('@/lib/store')

describe('E2E Button Interactions', () => {
  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date('2026-01-16T10:00:00Z'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      timestamp: new Date('2026-01-16T10:01:00Z'),
    },
  ]

  let mockStore: any

  beforeEach(() => {
    mockStore = {
      buttonStates: {},
      setNonBlockingOperation: vi.fn(),
      clearNonBlockingOperation: vi.fn(),
      startBlockingOperation: vi.fn(),
      completeBlockingOperation: vi.fn(),
      failBlockingOperation: vi.fn(),
      isMessageBlocked: vi.fn(() => false),
      getActiveMessages: vi.fn(() => mockMessages),
    }

    vi.mocked(useConversationStore).mockReturnValue(mockStore)

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    })
  })

  describe('Copy Flow', () => {
    it('completes full copy flow', async () => {
      const user = userEvent.setup()
      render(<ConversationView />)

      // Find assistant message
      const assistantMessage = screen.getByText(/hello! how can i help you?/i)
      expect(assistantMessage).toBeInTheDocument()

      // Find and click copy button
      const copyButton = screen.getByRole('button', { name: /copy/i })
      await user.click(copyButton)

      // Verify clipboard updated
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello! How can I help you?')

      // Verify store action called
      expect(mockStore.setNonBlockingOperation).toHaveBeenCalledWith('msg-2', 'copy')

      // Update store state to show "Copied!"
      mockStore.buttonStates = {
        'msg-2': {
          copy: { isActive: true, timestamp: Date.now() },
        },
      }

      // Re-render to see feedback
      render(<ConversationView />)
      expect(screen.getByText(/copied!/i)).toBeInTheDocument()
    })
  })

  describe('Regenerate Flow', () => {
    it('shows loading state during regeneration', async () => {
      const user = userEvent.setup()
      render(<ConversationView />)

      const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
      await user.click(regenerateButton)

      // Verify store action called
      expect(mockStore.startBlockingOperation).toHaveBeenCalledWith('msg-2', 'regenerate')

      // Update store to show loading
      mockStore.buttonStates = {
        'msg-2': {
          blockingOperation: {
            type: 'regenerate',
            isLoading: true,
          },
        },
      }
      mockStore.isMessageBlocked = vi.fn(() => true)

      // Re-render
      render(<ConversationView />)

      // Verify loading spinner
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      // Verify other blocking buttons disabled
      expect(screen.getByRole('button', { name: /send to api/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
    })
  })

  describe('Edit Flow', () => {
    it('opens modal, edits, and saves', async () => {
      const user = userEvent.setup()
      render(<ConversationView />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Edit content
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Edited message content')

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Verify modal closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Verify store action called
      expect(mockStore.completeBlockingOperation).toHaveBeenCalledWith('msg-2')
    })
  })
})
```

---

## Implementation Checklist

**Epic Status**: `bd show silmari-writer-smq` | **Ready Work**: `bd ready`

- [ ] **Behavior 1**: ButtonRibbon Component - Initial Render (`silmari-writer-hs4`)
  - [ ] 🔴 Red: Write failing tests
  - [ ] 🟢 Green: Implement ButtonRibbon component
  - [ ] 🔵 Refactor: Extract button styling
  - [ ] ✅ Verify: `npm test -- ButtonRibbon.test.tsx`
  - [ ] Update beads: `bd update silmari-writer-hs4 --status=in_progress` → `bd close silmari-writer-hs4`

- [ ] **Behavior 2**: Copy Button Interaction (`silmari-writer-e1m`)
  - [ ] 🔴 Red: Write failing tests
  - [ ] 🟢 Green: Implement handleCopy with clipboard API
  - [ ] 🔵 Refactor: Add useEffect cleanup
  - [ ] ✅ Verify: Copy tests pass
  - [ ] Update beads: `bd update silmari-writer-e1m --status=in_progress` → `bd close silmari-writer-e1m`

- [ ] **Behavior 3**: Regenerate Button Interaction (`silmari-writer-5jn`)
  - [ ] 🔴 Red: Write failing tests
  - [ ] 🟢 Green: Implement handleRegenerate
  - [ ] 🔵 Refactor: Extract regenerateMessage to lib/messageActions.ts
  - [ ] ✅ Verify: Regenerate tests pass
  - [ ] Update beads: `bd update silmari-writer-5jn --status=in_progress` → `bd close silmari-writer-5jn`

- [ ] **Behavior 4**: Edit Button with Modal (`silmari-writer-w8v`)
  - [ ] 🔴 Red: Write failing tests for EditMessageModal
  - [ ] 🟢 Green: Implement EditMessageModal component
  - [ ] 🟢 Green: Integrate modal with ButtonRibbon
  - [ ] 🔵 Refactor: Extract modal backdrop
  - [ ] ✅ Verify: EditMessageModal tests pass
  - [ ] Update beads: `bd update silmari-writer-w8v --status=in_progress` → `bd close silmari-writer-w8v`

- [ ] **Behavior 5**: MessageBubble Integration (`silmari-writer-9rw`)
  - [ ] 🔴 Red: Write failing tests
  - [ ] 🟢 Green: Add ButtonRibbon to MessageBubble (assistant only)
  - [ ] 🔵 Refactor: Adjust layout for ButtonRibbon
  - [ ] ✅ Verify: MessageBubble tests pass
  - [ ] Update beads: `bd update silmari-writer-9rw --status=in_progress` → `bd close silmari-writer-9rw`

- [ ] **Behavior 6**: Analytics/Telemetry (`silmari-writer-q5w`)
  - [ ] 🔴 Red: Write failing analytics tests
  - [ ] 🟢 Green: Implement analytics.ts
  - [ ] 🟢 Green: Integrate analytics into ButtonRibbon
  - [ ] 🔵 Refactor: Create useButtonAnalytics hook
  - [ ] ✅ Verify: Analytics tests pass
  - [ ] Update beads: `bd update silmari-writer-q5w --status=in_progress` → `bd close silmari-writer-q5w`

- [ ] **E2E Tests**: Button Interactions (`silmari-writer-m6f`)
  - [ ] 🔴 Red: Write failing E2E tests
  - [ ] 🟢 Green: Ensure E2E flows pass
  - [ ] ✅ Verify: All E2E tests pass
  - [ ] Update beads: `bd update silmari-writer-m6f --status=in_progress` → `bd close silmari-writer-m6f`

- [ ] **Final Verification**
  - [ ] All tests pass: `npm test`
  - [ ] Type checking passes: `npm run type-check`
  - [ ] Linting passes: `npm run lint`
  - [ ] Manual testing: Copy, Regenerate, Edit flows work in browser
  - [ ] Visual inspection: ButtonRibbon aligns correctly below assistant messages
  - [ ] Analytics events visible in network tab (expect 404 since endpoint not implemented)
  - [ ] Close epic: `bd close silmari-writer-smq`

- [ ] **Future Enhancements** (NOT in this plan)
  - [ ] Add schema versioning to Zustand persist config for future migrations
  - [ ] Implement `/api/analytics` route handler and persistence
  - [ ] Add retry logic for analytics with exponential backoff
  - [ ] Add session tracking fields to analytics events

---

## References
- Backend Implementation: `thoughts/searchable/shared/plans/2025-01-16-tdd-message-button-state-management.md`
- Plan Review: `thoughts/searchable/shared/plans/2026-01-16-tdd-button-ribbon-ui-integration-REVIEW.md`
- Store: `frontend/src/lib/store.ts:144-248`
- Types: `frontend/src/lib/types.ts:58-91`
- MessageBubble: `frontend/src/components/chat/MessageBubble.tsx:15-82`
- Test Pattern: `frontend/__tests__/components/MessageInput.test.tsx`
- Store Tests: `frontend/__tests__/lib/store.test.ts` (71 tests)

---

## Plan Review Summary

This plan has been reviewed and enhanced based on feedback from `2026-01-16-tdd-button-ribbon-ui-integration-REVIEW.md`.

**Review Status**: ⚠️ **Needs Minor Revision Addressed**

**Key Enhancements Made**:
1. ✅ **Added Contracts**: Copy timeout lifecycle, request cancellation, save behavior, analytics endpoint placeholder
2. ✅ **Defined Interfaces**: LoadingSpinner props, useButtonAnalytics return type, RegenerateRequest/Response, AnalyticsEvent schema
3. ✅ **Clarified Patterns**: Handler naming (use `handleCopy` not `handleCopyClick`), error clearing behavior
4. ✅ **Documented Limitations**: Analytics endpoint not implemented (fire-and-forget pattern acceptable for MVP)
5. ✅ **Added Test Case**: Error state clearing on retry

**Remaining Future Work** (explicitly out of scope):
- Schema versioning for localStorage migrations
- Analytics backend implementation
- Retry logic for analytics events
- Session tracking in analytics

**Review Assessment**: Plan is now ready for implementation with all critical contracts, interfaces, and edge cases documented.
