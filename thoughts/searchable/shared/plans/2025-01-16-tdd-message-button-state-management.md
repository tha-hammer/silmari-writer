# Per-Message Button State Management TDD Implementation Plan

## Overview
Implement per-message button state management in the Zustand store to support:
- **Non-blocking operations** (copy): Can execute anytime with temporary UI feedback
- **Blocking operations** (regenerate, sendToAPI, edit): Mutually exclusive per message to prevent conflicts

The implementation prevents race conditions where multiple operations try to modify the same message simultaneously, while allowing operations on different messages to run in parallel.

## Beads Tracking

**Epic**: `silmari-writer-cxo` - Per-Message Button State Management

### Implementation Tasks (9 Behaviors)

| Behavior | Beads Issue | Description |
|----------|-------------|-------------|
| Behavior 1 | `silmari-writer-5vy` | Add Button State Type Definitions |
| Behavior 2 | `silmari-writer-g6m` | Set Non-Blocking Copy Operation State |
| Behavior 3 | `silmari-writer-3fb` | Clear Non-Blocking Copy Operation State |
| Behavior 4 | `silmari-writer-3ns` | Start Blocking Operation |
| Behavior 5 | `silmari-writer-9ul` | Complete Blocking Operation |
| Behavior 6 | `silmari-writer-mqz` | Fail Blocking Operation |
| Behavior 7 | `silmari-writer-u4l` | Check if Message is Blocked |
| Behavior 8 | `silmari-writer-ege` | Message Isolation - Parallel Operations |
| Behavior 9 | `silmari-writer-x03` | State Persistence with localStorage |

**Dependency Chain**: Each behavior depends on the previous one (1→2→3→4→5→6→7→8→9)

**Check Status**: `bd show silmari-writer-cxo` or `bd ready`

## Key Decisions Summary

✅ **Persistence Strategy**: Persist button states BUT clean up loading states on hydration
- Error states persist across page reloads (users can see what failed)
- Loading states are cleaned up (operations won't complete after reload)
- Copy states are cleaned up (temporary UI feedback only)

✅ **Copy State Timeout**: Component responsibility, NOT store responsibility
- Store provides state, component handles 2-second timeout via `useEffect`
- Keeps store logic simple and testable

✅ **Error Persistence**: Keep errors until user starts new operation or explicitly dismisses
- Errors don't auto-clear (important user feedback)
- Starting new operation on same message clears previous error
- Future: UI can add explicit dismiss button

✅ **Type Extensibility**: `BlockingOperationType` uses union type, extensible as needed
- Current: `'regenerate' | 'sendToAPI' | 'edit'`
- Future: Add new operations to union type when needed
- Type safety maintained while allowing growth

## Current State Analysis

### What Exists:
- **Zustand Store**: `frontend/src/lib/store.ts:32-141`
  - Uses `create()` from zustand with `persist()` middleware
  - Stores messages as `Record<string, Message[]>` (projectId → messages)
  - Each message has unique UUID via `crypto.randomUUID()`
  - Persistence to localStorage with name `'conversation-storage'`

- **Message Type**: `frontend/src/lib/types.ts:49-56`
  ```typescript
  interface Message {
    id: string;                     // UUID
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: Attachment[];
    isVoiceTranscription?: boolean;
  }
  ```

- **Test Infrastructure**:
  - Vitest 4.0.17 with @testing-library/react
  - Comprehensive store tests: `frontend/__tests__/lib/store.test.ts` (575 lines)
  - Test patterns: renderHook, act, mock localStorage, mock crypto.randomUUID

### What's Missing:
- `buttonStates: Record<string, MessageButtonState>` in store
- State management actions for button operations
- Type definitions for button state
- Tests for button state management
- Integration with MessageBubble component

### Key Discoveries:
- Store uses immutable updates with spread operators (store.ts:92-96)
- Persist middleware configured with onRehydrateStorage hook (store.ts:136-138)
- Existing tests mock localStorage and crypto.randomUUID (store.test.ts:6-34)
- Test pattern: beforeEach clears state and resets mocks (store.test.ts:37-48)

## Desired End State

### Observable Behaviors:
1. **Non-blocking operations run without interference** - Copy can execute during any blocking operation
2. **Blocking operations are mutually exclusive per message** - Only one blocking operation per message at a time
3. **Messages operate independently** - Message A regenerating doesn't block Message B's operations
4. **State persists across page reloads** - Button states saved to localStorage
5. **Clean state management** - Completed operations remove their state (no memory leaks)

### Verification:
- All unit tests pass: `npm test -- store.test.ts`
- Type checking passes: `npm run type-check`
- Store maintains <100ms response time for state updates
- State persists correctly in localStorage

## What We're NOT Doing
- UI implementation of buttons (separate task)
- API endpoint implementations for button actions
- Button styling or animations
- Error recovery strategies (retry logic)
- Undo/redo functionality
- Button permission/authorization logic
- Analytics/telemetry for button usage

## Testing Strategy

**Framework**: Vitest 4.0.17
- Unit tests for store actions and selectors
- Integration tests for persist middleware
- Edge case tests for race conditions and cleanup

**Test Types**:
- **Unit**: Each store action (setNonBlockingOperation, startBlockingOperation, etc.)
- **Integration**: Persist middleware with button states
- **Edge Cases**: Rapid operations, non-existent messages, cleanup

**Mocking/Setup**:
- Mock `localStorage` with in-memory object (existing pattern in store.test.ts:6-28)
- Mock `crypto.randomUUID` with counter (existing pattern in store.test.ts:30-34)
- Mock `Date.now()` for timestamp testing
- Use `renderHook` from @testing-library/react
- Use `act()` for state updates

---

## Behavior 1: Add Button State Type Definitions

**Beads**: `silmari-writer-5vy` | **Epic**: `silmari-writer-cxo`

### Test Specification
**Given**: TypeScript definitions in types.ts
**When**: Types are imported
**Then**: MessageButtonState and related types are available for type checking

**Edge Cases**: None (type-level only)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/types.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import type { MessageButtonState } from '@/lib/types'

describe('MessageButtonState Types', () => {
  it('should have MessageButtonState type with copy property', () => {
    const state: MessageButtonState = {
      copy: {
        isActive: true,
        timestamp: Date.now(),
      },
    }

    expect(state.copy).toBeDefined()
    expect(state.copy?.isActive).toBe(true)
    expect(typeof state.copy?.timestamp).toBe('number')
  })

  it('should have MessageButtonState type with blockingOperation property', () => {
    const state: MessageButtonState = {
      blockingOperation: {
        type: 'regenerate',
        isLoading: true,
      },
    }

    expect(state.blockingOperation).toBeDefined()
    expect(state.blockingOperation?.type).toBe('regenerate')
    expect(state.blockingOperation?.isLoading).toBe(true)
  })

  it('should allow blockingOperation with error', () => {
    const state: MessageButtonState = {
      blockingOperation: {
        type: 'sendToAPI',
        isLoading: false,
        error: 'API call failed',
      },
    }

    expect(state.blockingOperation?.error).toBe('API call failed')
  })

  it('should allow empty MessageButtonState', () => {
    const state: MessageButtonState = {}
    expect(Object.keys(state)).toHaveLength(0)
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/types.ts`
```typescript
// Add after Message interface (after line 56)

/**
 * Non-blocking operation types (can run alongside blocking operations)
 */
export type NonBlockingOperationType = 'copy';

/**
 * Button operation types (mutually exclusive per message)
 */
export type BlockingOperationType = 'regenerate' | 'sendToAPI' | 'edit';

/**
 * State for non-blocking copy operation
 */
export interface CopyState {
  isActive: boolean;
  timestamp: number;
}

/**
 * State for blocking operations (mutually exclusive)
 */
export interface BlockingOperationState {
  type: BlockingOperationType;
  isLoading: boolean;
  error?: string;
}

/**
 * Per-message button state tracking
 */
export interface MessageButtonState {
  copy?: CopyState;
  blockingOperation?: BlockingOperationState;
}
```

#### 🔵 Refactor: Improve Code
No refactoring needed - types are clean and well-documented.

### Success Criteria
**Automated:**
- [ ] Test fails initially (Red): `npm test -- types.test.ts`
- [ ] Test passes after implementation (Green): `npm test -- types.test.ts`
- [ ] Type checking passes: `npm run type-check`
- [ ] No type errors when importing types

**Manual:**
- [ ] Types are intuitive and self-documenting
- [ ] Optional properties allow flexible state representation

---

## Behavior 2: Set Non-Blocking Copy Operation State

**Beads**: `silmari-writer-g6m` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 1

### Test Specification
**Given**: A message with no button state
**When**: `setNonBlockingOperation(messageId, 'copy')` is called
**Then**: `buttonStates[messageId].copy` has `isActive: true` and current timestamp

**Edge Cases**:
- Message doesn't exist in messages array (orphaned state is OK)
- Setting copy while blocking operation is active (should work)
- Setting copy multiple times (updates timestamp)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts` (add to existing file)
```typescript
describe('Button State Management', () => {
  describe('Non-blocking Operations', () => {
    it('setNonBlockingOperation sets copy state with timestamp', () => {
      const { result } = renderHook(() => useConversationStore())
      const mockNow = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(mockNow)

      act(() => {
        result.current.setNonBlockingOperation('msg-1', 'copy')
      })

      expect(result.current.buttonStates['msg-1']).toBeDefined()
      expect(result.current.buttonStates['msg-1'].copy).toEqual({
        isActive: true,
        timestamp: mockNow,
      })
    })

    it('setNonBlockingOperation works for non-existent message', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        result.current.setNonBlockingOperation('non-existent-msg', 'copy')
      })

      expect(result.current.buttonStates['non-existent-msg'].copy?.isActive).toBe(true)
    })

    it('setNonBlockingOperation works alongside blocking operation', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        result.current.startBlockingOperation('msg-1', 'regenerate')
        result.current.setNonBlockingOperation('msg-1', 'copy')
      })

      expect(result.current.buttonStates['msg-1'].copy?.isActive).toBe(true)
      expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')
    })

    it('setNonBlockingOperation updates timestamp on repeated calls', () => {
      const { result } = renderHook(() => useConversationStore())
      const firstTimestamp = 1000
      const secondTimestamp = 2000

      const dateSpy = vi.spyOn(Date, 'now')
      dateSpy.mockReturnValue(firstTimestamp)

      act(() => {
        result.current.setNonBlockingOperation('msg-1', 'copy')
      })

      expect(result.current.buttonStates['msg-1'].copy?.timestamp).toBe(firstTimestamp)

      dateSpy.mockReturnValue(secondTimestamp)

      act(() => {
        result.current.setNonBlockingOperation('msg-1', 'copy')
      })

      expect(result.current.buttonStates['msg-1'].copy?.timestamp).toBe(secondTimestamp)
    })
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/store.ts`

1. Add import:
```typescript
import { Message, Project, MessageButtonState } from './types'
```

2. Add to ConversationState interface (after line 8):
```typescript
interface ConversationState {
  projects: Project[]
  activeProjectId: string | null
  messages: Record<string, Message[]>
  buttonStates: Record<string, MessageButtonState>  // NEW
  _hasHydrated: boolean

  // ... existing actions

  // Button state actions (synchronous - updates are immediate)
  setNonBlockingOperation: (messageId: string, operation: NonBlockingOperationType) => void
  clearNonBlockingOperation: (messageId: string, operation: NonBlockingOperationType) => void
  startBlockingOperation: (messageId: string, type: BlockingOperationType) => void
  completeBlockingOperation: (messageId: string) => void
  failBlockingOperation: (messageId: string, error: string) => void
  isMessageBlocked: (messageId: string) => boolean
}
```

3. Add to store implementation (after line 37):
```typescript
export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      messages: {},
      buttonStates: {},  // NEW
      _hasHydrated: false,

      // ... existing actions

      setNonBlockingOperation: (messageId, operation) => {
        set((state) => ({
          buttonStates: {
            ...state.buttonStates,
            [messageId]: {
              ...state.buttonStates[messageId],
              [operation]: {
                isActive: true,
                timestamp: Date.now(),
              },
            },
          },
        }))
      },

      // Placeholder implementations (will implement in next behaviors)
      clearNonBlockingOperation: (messageId, operation) => {},
      startBlockingOperation: (messageId, type) => {},
      completeBlockingOperation: (messageId) => {},
      failBlockingOperation: (messageId, error) => {},
      isMessageBlocked: (messageId) => false,
    }),
    {
      name: 'conversation-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
```

#### 🔵 Refactor: Improve Code
No refactoring needed - implementation follows existing patterns in the store.

### Success Criteria
**Automated:**
- [ ] Test fails for right reason (Red): Property 'setNonBlockingOperation' does not exist
- [ ] Test passes (Green): `npm test -- store.test.ts`
- [ ] All existing tests still pass: `npm test`
- [ ] Type checking passes: `npm run type-check`

**Manual:**
- [ ] State updates are immediate (no async delays)
- [ ] State structure matches type definitions
- [ ] Timestamp is current time in milliseconds

---

## Behavior 3: Clear Non-Blocking Copy Operation State

**Beads**: `silmari-writer-3fb` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 2

### Test Specification
**Given**: A message with active copy state
**When**: `clearNonBlockingOperation(messageId, 'copy')` is called
**Then**: `buttonStates[messageId].copy` is undefined

**Edge Cases**:
- Message has no copy state (no-op)
- Message has blocking operation (shouldn't affect it)
- Message doesn't exist in buttonStates (no-op)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
it('clearNonBlockingOperation removes copy state', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.setNonBlockingOperation('msg-1', 'copy')
  })

  expect(result.current.buttonStates['msg-1'].copy).toBeDefined()

  act(() => {
    result.current.clearNonBlockingOperation('msg-1', 'copy')
  })

  expect(result.current.buttonStates['msg-1'].copy).toBeUndefined()
})

it('clearNonBlockingOperation is safe for non-existent state', () => {
  const { result } = renderHook(() => useConversationStore())

  // Should not throw
  act(() => {
    result.current.clearNonBlockingOperation('non-existent', 'copy')
  })

  expect(result.current.buttonStates['non-existent']).toBeUndefined()
})

it('clearNonBlockingOperation preserves blocking operation', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.startBlockingOperation('msg-1', 'regenerate')
    result.current.setNonBlockingOperation('msg-1', 'copy')
  })

  act(() => {
    result.current.clearNonBlockingOperation('msg-1', 'copy')
  })

  expect(result.current.buttonStates['msg-1'].copy).toBeUndefined()
  expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/store.ts`

Replace placeholder implementation:
```typescript
clearNonBlockingOperation: (messageId, operation) => {
  set((state) => ({
    buttonStates: {
      ...state.buttonStates,
      [messageId]: {
        ...state.buttonStates[messageId],
        [operation]: undefined,
      },
    },
  }))
},
```

#### 🔵 Refactor: Improve Code
Consider cleaning up empty state objects:
```typescript
// Note: Components are responsible for calling clearNonBlockingOperation
// after timeout (typically 2 seconds). Store does not auto-clear copy states.
clearNonBlockingOperation: (messageId, operation) => {
  set((state) => {
    const messageState = state.buttonStates[messageId]
    if (!messageState) return state

    const updatedMessageState = {
      ...messageState,
      [operation]: undefined,
    }

    // Clean up if no state remains
    const hasAnyState = updatedMessageState.copy || updatedMessageState.blockingOperation
    if (!hasAnyState) {
      const { [messageId]: _removed, ...remainingStates } = state.buttonStates
      return { buttonStates: remainingStates }
    }

    return {
      buttonStates: {
        ...state.buttonStates,
        [messageId]: updatedMessageState,
      },
    }
  })
},
```

### Success Criteria
**Automated:**
- [ ] Test fails initially (Red): Expected undefined, received { isActive: true, timestamp: ... }
- [ ] Test passes after minimal implementation (Green): `npm test -- store.test.ts`
- [ ] Test passes after refactor: `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] State cleanup prevents memory leaks
- [ ] No orphaned empty objects in buttonStates
- [ ] Blocking operations remain unaffected

---

## Behavior 4: Start Blocking Operation

**Beads**: `silmari-writer-3ns` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 3

### Test Specification
**Given**: A message with no blocking operation
**When**: `startBlockingOperation(messageId, type)` is called
**Then**: `buttonStates[messageId].blockingOperation` has correct type and `isLoading: true`

**Edge Cases**:
- Starting operation while another is in progress (replaces existing)
- Starting operation after previous operation failed (clears error)
- Non-existent message (creates state)
- All three operation types (regenerate, sendToAPI, edit)

**Note**: Starting a new operation clears any previous error state (implements Decision 3)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
describe('Blocking Operations', () => {
  it('startBlockingOperation sets regenerate state', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation).toEqual({
      type: 'regenerate',
      isLoading: true,
    })
  })

  it('startBlockingOperation sets sendToAPI state', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'sendToAPI')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation).toEqual({
      type: 'sendToAPI',
      isLoading: true,
    })
  })

  it('startBlockingOperation sets edit state', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'edit')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation).toEqual({
      type: 'edit',
      isLoading: true,
    })
  })

  it('startBlockingOperation replaces existing blocking operation', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')

    act(() => {
      result.current.startBlockingOperation('msg-1', 'sendToAPI')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('sendToAPI')
  })

  it('startBlockingOperation preserves copy state', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.setNonBlockingOperation('msg-1', 'copy')
      result.current.startBlockingOperation('msg-1', 'regenerate')
    })

    expect(result.current.buttonStates['msg-1'].copy?.isActive).toBe(true)
    expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')
  })

  it('startBlockingOperation clears previous error state', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'sendToAPI')
      result.current.failBlockingOperation('msg-1', 'API call failed')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation?.error).toBe('API call failed')

    // Starting new operation should clear error
    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation).toEqual({
      type: 'regenerate',
      isLoading: true,
      // No error property
    })
    expect(result.current.buttonStates['msg-1'].blockingOperation?.error).toBeUndefined()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/store.ts`

Replace placeholder:
```typescript
startBlockingOperation: (messageId, type) => {
  set((state) => ({
    buttonStates: {
      ...state.buttonStates,
      [messageId]: {
        ...state.buttonStates[messageId],
        blockingOperation: {
          type,
          isLoading: true,
        },
      },
    },
  }))
},
```

#### 🔵 Refactor: Improve Code
No refactoring needed - implementation is clean and minimal.

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): Expected { type: ..., isLoading: true }, received undefined
- [ ] Tests pass (Green): `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`
- [ ] Type checking passes: `npm run type-check`

**Manual:**
- [ ] Operation type is correctly set
- [ ] isLoading flag is true
- [ ] No error property on initial start

---

## Behavior 5: Complete Blocking Operation

**Beads**: `silmari-writer-9ul` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 4

### Test Specification
**Given**: A message with active blocking operation
**When**: `completeBlockingOperation(messageId)` is called
**Then**: `buttonStates[messageId].blockingOperation` is undefined

**Edge Cases**:
- Message has no blocking operation (no-op)
- Message has copy state (preserved)
- Message doesn't exist (no-op)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
it('completeBlockingOperation removes blocking state', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.startBlockingOperation('msg-1', 'regenerate')
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation).toBeDefined()

  act(() => {
    result.current.completeBlockingOperation('msg-1')
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation).toBeUndefined()
})

it('completeBlockingOperation is safe for non-existent state', () => {
  const { result } = renderHook(() => useConversationStore())

  // Should not throw
  act(() => {
    result.current.completeBlockingOperation('non-existent')
  })

  expect(result.current.buttonStates['non-existent']).toBeUndefined()
})

it('completeBlockingOperation preserves copy state', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.setNonBlockingOperation('msg-1', 'copy')
    result.current.startBlockingOperation('msg-1', 'regenerate')
  })

  act(() => {
    result.current.completeBlockingOperation('msg-1')
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation).toBeUndefined()
  expect(result.current.buttonStates['msg-1'].copy?.isActive).toBe(true)
})

it('completeBlockingOperation cleans up empty state objects', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.startBlockingOperation('msg-1', 'regenerate')
  })

  act(() => {
    result.current.completeBlockingOperation('msg-1')
  })

  // Should remove the entire messageId key since no state remains
  expect(result.current.buttonStates['msg-1']).toBeUndefined()
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/store.ts`

Replace placeholder:
```typescript
completeBlockingOperation: (messageId) => {
  set((state) => ({
    buttonStates: {
      ...state.buttonStates,
      [messageId]: {
        ...state.buttonStates[messageId],
        blockingOperation: undefined,
      },
    },
  }))
},
```

#### 🔵 Refactor: Improve Code
Add cleanup for empty state:
```typescript
completeBlockingOperation: (messageId) => {
  set((state) => {
    const messageState = state.buttonStates[messageId]
    if (!messageState) return state

    const updatedMessageState = {
      ...messageState,
      blockingOperation: undefined,
    }

    // Clean up if no state remains
    const hasAnyState = updatedMessageState.copy || updatedMessageState.blockingOperation
    if (!hasAnyState) {
      const { [messageId]: _removed, ...remainingStates } = state.buttonStates
      return { buttonStates: remainingStates }
    }

    return {
      buttonStates: {
        ...state.buttonStates,
        [messageId]: updatedMessageState,
      },
    }
  })
},
```

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): Expected undefined, received { type: ..., isLoading: true }
- [ ] Tests pass with minimal implementation (Green): `npm test -- store.test.ts`
- [ ] Cleanup test passes after refactor: `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] State is fully removed on completion
- [ ] No memory leaks from orphaned states
- [ ] Copy state is preserved

---

## Behavior 6: Fail Blocking Operation

**Beads**: `silmari-writer-mqz` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 5

### Test Specification
**Given**: A message with active blocking operation
**When**: `failBlockingOperation(messageId, error)` is called
**Then**: `blockingOperation` has `isLoading: false`, error message, and preserved type

**Edge Cases**:
- Empty error message (should store empty string)
- Message has no blocking operation (no-op or creates error state?)
- Error contains special characters

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
it('failBlockingOperation sets error and stops loading', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.startBlockingOperation('msg-1', 'sendToAPI')
  })

  act(() => {
    result.current.failBlockingOperation('msg-1', 'API call failed')
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation).toEqual({
    type: 'sendToAPI',
    isLoading: false,
    error: 'API call failed',
  })
})

it('failBlockingOperation preserves operation type', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.startBlockingOperation('msg-1', 'regenerate')
  })

  act(() => {
    result.current.failBlockingOperation('msg-1', 'Generation failed')
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')
  expect(result.current.buttonStates['msg-1'].blockingOperation?.isLoading).toBe(false)
})

it('failBlockingOperation handles empty error message', () => {
  const { result } = renderHook(() => useConversationStore())

  act(() => {
    result.current.startBlockingOperation('msg-1', 'edit')
  })

  act(() => {
    result.current.failBlockingOperation('msg-1', '')
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation?.error).toBe('')
})

it('failBlockingOperation is safe when no blocking operation exists', () => {
  const { result } = renderHook(() => useConversationStore())

  // Should not throw, but behavior is debatable - for now, no-op
  act(() => {
    result.current.failBlockingOperation('msg-1', 'Error')
  })

  // No blocking operation was started, so nothing should happen
  expect(result.current.buttonStates['msg-1']).toBeUndefined()
})

it('failBlockingOperation handles special characters in error', () => {
  const { result } = renderHook(() => useConversationStore())
  const errorMsg = 'Error: "Could not connect" (code: 500) <internal>'

  act(() => {
    result.current.startBlockingOperation('msg-1', 'sendToAPI')
  })

  act(() => {
    result.current.failBlockingOperation('msg-1', errorMsg)
  })

  expect(result.current.buttonStates['msg-1'].blockingOperation?.error).toBe(errorMsg)
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/store.ts`

Replace placeholder:
```typescript
failBlockingOperation: (messageId, error) => {
  set((state) => {
    const messageState = state.buttonStates[messageId]
    if (!messageState?.blockingOperation) return state

    return {
      buttonStates: {
        ...state.buttonStates,
        [messageId]: {
          ...messageState,
          blockingOperation: {
            ...messageState.blockingOperation,
            isLoading: false,
            error,
          },
        },
      },
    }
  })
},
```

#### 🔵 Refactor: Improve Code
No refactoring needed - implementation correctly handles edge cases.

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): Expected error property, received undefined
- [ ] Tests pass (Green): `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`
- [ ] Type checking passes: `npm run type-check`

**Manual:**
- [ ] Error message is preserved exactly as provided
- [ ] isLoading transitions to false
- [ ] Operation type is preserved for retry logic

---

## Behavior 7: Check if Message is Blocked

**Beads**: `silmari-writer-u4l` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 6

### Test Specification
**Given**: Messages with various states
**When**: `isMessageBlocked(messageId)` is called
**Then**: Returns true only when blocking operation is loading

**Edge Cases**:
- Message doesn't exist (returns false)
- Blocking operation failed (not loading, returns false)
- Copy operation active (returns false - non-blocking)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
describe('isMessageBlocked', () => {
  it('returns false when no button state exists', () => {
    const { result } = renderHook(() => useConversationStore())

    expect(result.current.isMessageBlocked('msg-1')).toBe(false)
  })

  it('returns true when blocking operation is loading', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(true)
  })

  it('returns false when blocking operation failed', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'sendToAPI')
      result.current.failBlockingOperation('msg-1', 'Error')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(false)
  })

  it('returns false when blocking operation completed', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
      result.current.completeBlockingOperation('msg-1')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(false)
  })

  it('returns false when only copy state exists', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.setNonBlockingOperation('msg-1', 'copy')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(false)
  })

  it('returns true when both copy and blocking operation exist', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.setNonBlockingOperation('msg-1', 'copy')
      result.current.startBlockingOperation('msg-1', 'regenerate')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(true)
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/store.ts`

Replace placeholder:
```typescript
isMessageBlocked: (messageId) => {
  return !!get().buttonStates[messageId]?.blockingOperation?.isLoading
},
```

#### 🔵 Refactor: Improve Code
No refactoring needed - implementation is already optimal.

### Success Criteria
**Automated:**
- [ ] Tests fail initially (Red): Expected true, received false
- [ ] Tests pass (Green): `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`

**Manual:**
- [ ] Fast execution (boolean check with no loops)
- [ ] Accurate blocking detection
- [ ] Correctly handles undefined states

---

## Behavior 8: Message Isolation - Parallel Operations

**Beads**: `silmari-writer-ege` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 7

### Test Specification
**Given**: Multiple messages exist
**When**: Different blocking operations start on different messages
**Then**: Each message has independent state, operations don't interfere

**Edge Cases**:
- 10+ messages with simultaneous operations
- Same operation type on different messages
- Mixed operation types

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
describe('Message Isolation', () => {
  it('allows independent blocking operations on different messages', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
      result.current.startBlockingOperation('msg-2', 'sendToAPI')
      result.current.startBlockingOperation('msg-3', 'edit')
    })

    expect(result.current.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')
    expect(result.current.buttonStates['msg-2'].blockingOperation?.type).toBe('sendToAPI')
    expect(result.current.buttonStates['msg-3'].blockingOperation?.type).toBe('edit')

    expect(result.current.isMessageBlocked('msg-1')).toBe(true)
    expect(result.current.isMessageBlocked('msg-2')).toBe(true)
    expect(result.current.isMessageBlocked('msg-3')).toBe(true)
  })

  it('completing one operation does not affect others', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
      result.current.startBlockingOperation('msg-2', 'sendToAPI')
    })

    act(() => {
      result.current.completeBlockingOperation('msg-1')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(false)
    expect(result.current.isMessageBlocked('msg-2')).toBe(true)
  })

  it('handles many concurrent operations', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.startBlockingOperation(`msg-${i}`, 'regenerate')
      }
    })

    // All should be blocked
    for (let i = 0; i < 20; i++) {
      expect(result.current.isMessageBlocked(`msg-${i}`)).toBe(true)
    }

    // Complete even numbered messages
    act(() => {
      for (let i = 0; i < 20; i += 2) {
        result.current.completeBlockingOperation(`msg-${i}`)
      }
    })

    // Check isolation
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        expect(result.current.isMessageBlocked(`msg-${i}`)).toBe(false)
      } else {
        expect(result.current.isMessageBlocked(`msg-${i}`)).toBe(true)
      }
    }
  })

  it('allows same operation type on different messages', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
      result.current.startBlockingOperation('msg-2', 'regenerate')
      result.current.startBlockingOperation('msg-3', 'regenerate')
    })

    expect(result.current.isMessageBlocked('msg-1')).toBe(true)
    expect(result.current.isMessageBlocked('msg-2')).toBe(true)
    expect(result.current.isMessageBlocked('msg-3')).toBe(true)
  })

  it('copy operations are independent per message', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.setNonBlockingOperation('msg-1', 'copy')
      result.current.setNonBlockingOperation('msg-2', 'copy')
    })

    expect(result.current.buttonStates['msg-1'].copy?.isActive).toBe(true)
    expect(result.current.buttonStates['msg-2'].copy?.isActive).toBe(true)

    act(() => {
      result.current.clearNonBlockingOperation('msg-1', 'copy')
    })

    expect(result.current.buttonStates['msg-1']?.copy).toBeUndefined()
    expect(result.current.buttonStates['msg-2'].copy?.isActive).toBe(true)
  })

  it('handles large state efficiently (1000+ messages)', () => {
    const { result } = renderHook(() => useConversationStore())

    const startTime = performance.now()

    act(() => {
      for (let i = 0; i < 1000; i++) {
        result.current.startBlockingOperation(`msg-${i}`, 'regenerate')
      }
    })

    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(100) // 100ms for 1000 operations

    // Verify random sampling
    expect(result.current.isMessageBlocked('msg-0')).toBe(true)
    expect(result.current.isMessageBlocked('msg-500')).toBe(true)
    expect(result.current.isMessageBlocked('msg-999')).toBe(true)
  })
})
```

#### 🟢 Green: Minimal Implementation
No new implementation needed - existing code already supports this through the Record structure.

#### 🔵 Refactor: Improve Code
No refactoring needed - the Record<string, MessageButtonState> structure inherently provides message isolation.

### Success Criteria
**Automated:**
- [ ] Tests pass immediately (Green): `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`
- [ ] Performance test: 20+ concurrent operations complete in <50ms

**Manual:**
- [ ] Visual verification: Multiple messages can have operations simultaneously in UI
- [ ] No cross-contamination between message states

---

## Behavior 9: State Persistence with localStorage

**Beads**: `silmari-writer-x03` | **Epic**: `silmari-writer-cxo` | **Depends on**: Behavior 8

### Test Specification
**Given**: Button states in the store
**When**: Page reloads (or store rehydrates)
**Then**: Button states are restored from localStorage

**Edge Cases**:
- Empty buttonStates (should persist as {})
- Large number of button states
- State with errors
- Malformed data in localStorage

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/store.test.ts`
```typescript
describe('Button State Persistence', () => {
  it('persists buttonStates to localStorage', () => {
    const { result } = renderHook(() => useConversationStore())

    act(() => {
      result.current.startBlockingOperation('msg-1', 'regenerate')
      result.current.setNonBlockingOperation('msg-2', 'copy')
    })

    // Check localStorage was updated
    const stored = localStorage.getItem('conversation-storage')
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored!)
    expect(parsed.state.buttonStates).toBeDefined()
    expect(parsed.state.buttonStates['msg-1'].blockingOperation?.type).toBe('regenerate')
    expect(parsed.state.buttonStates['msg-2'].copy?.isActive).toBe(true)
  })

  it('restores buttonStates from localStorage on rehydration', () => {
    // Setup localStorage with button states including loading and error states
    const mockState = {
      state: {
        projects: [],
        activeProjectId: null,
        messages: {},
        buttonStates: {
          'msg-1': {
            blockingOperation: {
              type: 'sendToAPI',
              isLoading: true, // Should be cleaned up
            },
          },
          'msg-2': {
            copy: {
              isActive: true,
              timestamp: 1234567890, // Should be cleaned up
            },
          },
          'msg-3': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: false,
              error: 'Failed to regenerate', // Should persist
            },
          },
        },
        _hasHydrated: false,
      },
      version: 0,
    }
    localStorage.setItem('conversation-storage', JSON.stringify(mockState))

    // Create new store instance (simulates page reload)
    const { result } = renderHook(() => useConversationStore())

    // After hydration, loading states should be cleaned up
    expect(result.current.buttonStates['msg-1']).toBeUndefined() // Loading state cleaned
    expect(result.current.buttonStates['msg-2']).toBeUndefined() // Copy state cleaned
    expect(result.current.buttonStates['msg-3'].blockingOperation).toEqual({
      type: 'regenerate',
      isLoading: false,
      error: 'Failed to regenerate',
    }) // Error state persisted
  })

  it('handles empty buttonStates in localStorage', () => {
    const mockState = {
      state: {
        projects: [],
        activeProjectId: null,
        messages: {},
        buttonStates: {},
        _hasHydrated: false,
      },
      version: 0,
    }
    localStorage.setItem('conversation-storage', JSON.stringify(mockState))

    const { result } = renderHook(() => useConversationStore())

    expect(result.current.buttonStates).toEqual({})
  })

  it('handles missing buttonStates in old localStorage data', () => {
    // Old data format without buttonStates
    const mockState = {
      state: {
        projects: [],
        activeProjectId: null,
        messages: {},
        _hasHydrated: false,
        // buttonStates is missing
      },
      version: 0,
    }
    localStorage.setItem('conversation-storage', JSON.stringify(mockState))

    const { result } = renderHook(() => useConversationStore())

    // Should initialize with empty buttonStates
    expect(result.current.buttonStates).toBeDefined()
    expect(result.current.buttonStates).toEqual({})
  })

  it('only cleans loading states on hydration, not error states', () => {
    const mockState = {
      state: {
        projects: [],
        activeProjectId: null,
        messages: {},
        buttonStates: {
          'msg-loading': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: true,
            },
          },
          'msg-error': {
            blockingOperation: {
              type: 'sendToAPI',
              isLoading: false,
              error: 'Network timeout',
            },
          },
        },
        _hasHydrated: false,
      },
      version: 0,
    }
    localStorage.setItem('conversation-storage', JSON.stringify(mockState))

    const { result } = renderHook(() => useConversationStore())

    // Loading state should be removed
    expect(result.current.buttonStates['msg-loading']).toBeUndefined()

    // Error state should persist
    expect(result.current.buttonStates['msg-error'].blockingOperation).toEqual({
      type: 'sendToAPI',
      isLoading: false,
      error: 'Network timeout',
    })
  })
})
```

#### 🟢 Green: Minimal Implementation
No new implementation needed - Zustand's persist middleware automatically handles buttonStates because it's in the state object.

#### 🔵 Refactor: Improve Code
**DECISION MADE**: Persist button states but clean up loading states on hydration (Option B).

Implement cleanup in `onRehydrateStorage` hook:
```typescript
// In store.ts, update onRehydrateStorage in persist config
onRehydrateStorage: () => (state) => {
  if (state) {
    // Clean up any loading states from previous session
    const cleanedButtonStates: Record<string, MessageButtonState> = {}
    Object.entries(state.buttonStates).forEach(([messageId, buttonState]) => {
      const cleaned: MessageButtonState = {}

      // Don't restore loading operations (they won't complete after page reload)
      if (buttonState.blockingOperation && !buttonState.blockingOperation.isLoading) {
        cleaned.blockingOperation = buttonState.blockingOperation
      }

      // Don't restore copy states (they're temporary UI feedback)
      // Copy states are cleared after 2 seconds by component anyway

      if (cleaned.blockingOperation) {
        cleanedButtonStates[messageId] = cleaned
      }
    })

    state.buttonStates = cleanedButtonStates
    state.setHasHydrated(true)
  }
},
```

**Why this approach**:
- Error states persist across reloads (user can see what failed)
- Loading states don't persist (operations won't complete after reload)
- Copy states don't persist (temporary visual feedback only)
- Memory efficient: only persists error states

### Success Criteria
**Automated:**
- [ ] Tests pass (Green): `npm test -- store.test.ts`
- [ ] All tests pass: `npm test`
- [ ] Hydration cleanup tests pass (loading states removed, errors persist)
- [ ] Type checking passes: `npm run type-check`

**Manual:**
- [ ] Error states visible after page reload
- [ ] Loading states do NOT persist after page reload
- [ ] Copy states do NOT persist after page reload
- [ ] No console errors during hydration

---

## Integration & Component Testing

### Behavior 10: MessageBubble Integration (Future Work)

This behavior is out of scope for the current TDD plan but documented for future reference:

**Test Specification**:
- Given assistant message with button state
- When MessageBubble renders
- Then buttons show correct state (loading, disabled, etc.)

**Files to create/modify**:
- `frontend/src/components/chat/ButtonRibbon.tsx` - New component
- `frontend/__tests__/components/ButtonRibbon.test.tsx` - Component tests
- `frontend/src/components/chat/MessageBubble.tsx` - Add ButtonRibbon for assistant messages

**Test approach**:
- Mock useConversationStore
- Test button rendering based on buttonStates
- Test button click handlers calling store actions
- Test disabled states based on isMessageBlocked

---

## Performance Considerations

### State Update Performance
- Each action uses immutable updates (spread operators)
- `isMessageBlocked` is O(1) lookup
- No iteration over all messages
- buttonStates only stores active states (auto-cleanup)

### Memory Management
- Cleanup empty state objects after operations complete
- No memory leaks from orphaned states
- Consider implementing max age for copy states (auto-clear after 5 seconds)

### Testing Performance
- All tests should complete in <2 seconds
- Individual test suites run in parallel via Vitest

---

## Implementation Checklist

**Epic Status**: `bd show silmari-writer-cxo` | **Ready Work**: `bd ready`

- [ ] Behavior 1: Type definitions (`silmari-writer-5vy`)
  - [ ] Red: Write failing type tests
  - [ ] Green: Add types to types.ts
  - [ ] Refactor: N/A
  - [ ] Verify: `npm test -- types.test.ts` passes
  - [ ] Update beads: `bd update silmari-writer-5vy --status=in_progress` → `bd close silmari-writer-5vy`

- [ ] Behavior 2: Set non-blocking operation (`silmari-writer-g6m`)
  - [ ] Red: Write failing tests
  - [ ] Green: Implement setNonBlockingOperation
  - [ ] Refactor: N/A
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-g6m --status=in_progress` → `bd close silmari-writer-g6m`

- [ ] Behavior 3: Clear non-blocking operation (`silmari-writer-3fb`)
  - [ ] Red: Write failing tests
  - [ ] Green: Implement clearNonBlockingOperation
  - [ ] Refactor: Add cleanup for empty states
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-3fb --status=in_progress` → `bd close silmari-writer-3fb`

- [ ] Behavior 4: Start blocking operation (`silmari-writer-3ns`)
  - [ ] Red: Write failing tests
  - [ ] Green: Implement startBlockingOperation
  - [ ] Refactor: N/A
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-3ns --status=in_progress` → `bd close silmari-writer-3ns`

- [ ] Behavior 5: Complete blocking operation (`silmari-writer-9ul`)
  - [ ] Red: Write failing tests
  - [ ] Green: Implement completeBlockingOperation
  - [ ] Refactor: Add cleanup for empty states
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-9ul --status=in_progress` → `bd close silmari-writer-9ul`

- [ ] Behavior 6: Fail blocking operation (`silmari-writer-mqz`)
  - [ ] Red: Write failing tests
  - [ ] Green: Implement failBlockingOperation
  - [ ] Refactor: N/A
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-mqz --status=in_progress` → `bd close silmari-writer-mqz`

- [ ] Behavior 7: Check if blocked (`silmari-writer-u4l`)
  - [ ] Red: Write failing tests
  - [ ] Green: Implement isMessageBlocked
  - [ ] Refactor: N/A
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-u4l --status=in_progress` → `bd close silmari-writer-u4l`

- [ ] Behavior 8: Message isolation (`silmari-writer-ege`)
  - [ ] Red: Write failing tests (should pass immediately)
  - [ ] Green: N/A (existing implementation)
  - [ ] Refactor: N/A
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-ege --status=in_progress` → `bd close silmari-writer-ege`

- [ ] Behavior 9: Persistence (`silmari-writer-x03`)
  - [ ] Red: Write failing tests
  - [ ] Green: N/A or add partialize/cleanup
  - [ ] Refactor: Implement onRehydrateStorage cleanup
  - [ ] Verify: All tests pass
  - [ ] Update beads: `bd update silmari-writer-x03 --status=in_progress` → `bd close silmari-writer-x03`

- [ ] Final Verification
  - [ ] All tests pass: `npm test`
  - [ ] Type checking passes: `npm run type-check`
  - [ ] Linting passes: `npm run lint`
  - [ ] Test coverage for button state ≥90%
  - [ ] No console warnings or errors
  - [ ] Close epic: `bd close silmari-writer-cxo`

---

## Decisions Made

1. **Persistence Strategy**: ✅ **Option B** - Persist but clean up loading states on hydration
   - **Rationale**: Users want to see previous errors after page reload
   - **Implementation**: Use `onRehydrateStorage` hook to clean up loading states
   - See Behavior 9 refactor section for implementation details

2. **Auto-clear Copy State**: ✅ **Component responsibility**
   - **Rationale**: Store provides state; component handles timeout via useEffect
   - Store doesn't implement timeout logic
   - Component uses 2-second timeout to call `clearNonBlockingOperation`

3. **Error State Persistence**: ✅ **Keep errors until user starts new operation or explicitly dismisses**
   - **Rationale**: Errors are important feedback that shouldn't disappear automatically
   - Errors cleared when:
     - User starts a new blocking operation on the same message
     - User explicitly dismisses the error (future component feature)
   - Errors persist across page reloads (via Decision 1)

4. **Type Safety**: ✅ **BlockingOperationType should be extensible**
   - **Current**: `'regenerate' | 'sendToAPI' | 'edit'`
   - **Future**: Can extend union type when needed
   - **Approach**: Keep as union type for type safety; add new operations to union as needed
   - Consider `type BlockingOperationType = 'regenerate' | 'sendToAPI' | 'edit'` with potential for plugin extensions

---

## Plan Review Integration

**Review Date**: 2026-01-16
**Review Status**: ✅ Ready for Implementation

### Amendments Incorporated
1. ✅ **Added `NonBlockingOperationType`** type alias for consistency with `BlockingOperationType`
2. ✅ **Documented timeout responsibility** in `clearNonBlockingOperation` implementation comments
3. ✅ **Added performance test** for large state (1000+ messages) in Behavior 8
4. ✅ **Added synchronous action comment** to store interface

### Review Summary
- **Contracts**: All component boundaries, ownership, and guarantees clearly defined
- **Interfaces**: Complete method signatures with consistency improvements applied
- **Promises**: Synchronous guarantees, idempotency, and isolation explicitly tested
- **Data Models**: Full TypeScript schemas with backward compatibility
- **APIs**: All 6 store actions fully specified with comprehensive tests
- **No blocking issues identified** - plan is production-ready

**Full Review**: `thoughts/searchable/shared/plans/2025-01-16-tdd-message-button-state-management-REVIEW.md`

---

## References
- Review: `thoughts/searchable/shared/plans/2025-01-16-tdd-message-button-state-management-REVIEW.md`
- Research: `thoughts/searchable/research/2025-01-16-button-ribbon-assistant-responses.md`
- Store: `frontend/src/lib/store.ts:32-141`
- Types: `frontend/src/lib/types.ts:49-56`
- Tests: `frontend/__tests__/lib/store.test.ts`
- MessageBubble: `frontend/src/components/chat/MessageBubble.tsx:11-82`
