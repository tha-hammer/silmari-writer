# Phase 6: State Management & API Integration

**Phase**: 6 of 8
**Estimated Effort**: 4-6 hours
**Dependencies**: Phase 1 (setup), Phase 5 (message types)
**Blocks**: Phase 7 (integration)

## Overview

Implement Zustand store for global state management with localStorage persistence. Manage projects, conversations, and messages with CRUD operations. Ensure state persists across page reloads and browser sessions.

## Behaviors

### Behavior 6.1: Conversation State Persists

**Testable Function**: `useConversationStore` - Zustand store with CRUD operations

**Test Coverage**:
- ✅ `createProject(name)` creates new project with unique ID
- ✅ `deleteProject(id)` removes project and its messages
- ✅ `updateProject(id, updates)` modifies project properties
- ✅ `addMessage(projectId, message)` adds message to project
- ✅ `getMessages(projectId)` retrieves messages for project
- ✅ `clearMessages(projectId)` removes all messages from project
- ✅ State persists to localStorage
- ✅ State rehydrates on page load
- ✅ Switching projects loads correct messages

## Dependencies

### Requires
- ✅ Phase 1: Project setup, Zustand installed
- ✅ Phase 5: Message and Project types defined

### Blocks
- Phase 7: Integration (needs state management for complete flow)

## Changes Required

### New Files Created

#### `/lib/store.ts`
- Lines 2502-2607: Basic Zustand store (Green)
  ```typescript
  import { create } from 'zustand';
  import { persist } from 'zustand/middleware';
  import { Message, Project } from './types';

  interface ConversationState {
    projects: Project[];
    activeProjectId: string | null;
    messages: Record<string, Message[]>; // projectId -> messages

    // Project actions
    createProject: (name: string) => string;
    deleteProject: (id: string) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    setActiveProject: (id: string) => void;

    // Message actions
    addMessage: (projectId: string, message: Omit<Message, 'id'>) => void;
    getMessages: (projectId: string) => Message[];
    clearMessages: (projectId: string) => void;
  }

  export const useConversationStore = create<ConversationState>()(
    persist(
      (set, get) => ({
        projects: [],
        activeProjectId: null,
        messages: {},

        createProject: (name) => {
          const id = crypto.randomUUID();
          const project: Project = {
            id,
            name,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          set(state => ({
            projects: [...state.projects, project],
            activeProjectId: id,
          }));
          return id;
        },

        deleteProject: (id) => {
          set(state => {
            const { [id]: _, ...remainingMessages } = state.messages;
            return {
              projects: state.projects.filter(p => p.id !== id),
              messages: remainingMessages,
              activeProjectId: state.activeProjectId === id
                ? state.projects[0]?.id ?? null
                : state.activeProjectId,
            };
          });
        },

        updateProject: (id, updates) => {
          set(state => ({
            projects: state.projects.map(p =>
              p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
            ),
          }));
        },

        setActiveProject: (id) => {
          set({ activeProjectId: id });
        },

        addMessage: (projectId, message) => {
          const fullMessage: Message = {
            ...message,
            id: crypto.randomUUID(),
          };
          set(state => ({
            messages: {
              ...state.messages,
              [projectId]: [...(state.messages[projectId] || []), fullMessage],
            },
          }));
        },

        getMessages: (projectId) => {
          return get().messages[projectId] || [];
        },

        clearMessages: (projectId) => {
          set(state => ({
            messages: {
              ...state.messages,
              [projectId]: [],
            },
          }));
        },
      }),
      {
        name: 'conversation-storage',
      }
    )
  );
  ```

- Lines 2612-2759: Enhanced with selectors and computed values (Refactor)
  - Add `getActiveProject()` selector
  - Add `getActiveMessages()` selector
  - Add `projectCount` computed value
  - Add `hasMessages(projectId)` helper
  - Add error boundaries for invalid IDs

### Test Files Created

#### `/__tests__/lib/store.test.ts`
- Lines 2403-2550: Store tests
- Project CRUD operations
  - Create project → returns ID, added to projects array
  - Delete project → removed from projects, messages cleared
  - Update project → properties changed, updatedAt updated
- Message operations
  - Add message → appears in getMessages()
  - Multiple messages → correct order
  - Clear messages → getMessages() returns empty
- Persistence
  - Create project → reload store → project still exists
  - Add message → reload → message persists
- Active project
  - Set active → getActiveProject() returns correct project
  - Delete active → switches to first remaining project

### Dependencies to Install
```bash
npm install zustand  # Already installed in Phase 1
```

## Success Criteria

### Automated Tests
- [ ] Tests fail without store (Red): `npm test -- store.test`
- [ ] Tests pass with store (Green): `npm test -- store.test`
- [ ] Project CRUD works correctly
- [ ] Message operations work correctly
- [ ] Persistence works (localStorage)
- [ ] Active project management works

### Manual Verification

**Human-Testable Function**: `useConversationStore` with localStorage persistence

1. **Setup Demo Page**:
   ```typescript
   // app/test-store/page.tsx
   'use client';

   import { useConversationStore } from '@/lib/store';
   import { Button } from '@/components/ui/button';

   export default function TestStorePage() {
     const {
       projects,
       activeProjectId,
       createProject,
       deleteProject,
       addMessage,
       getMessages,
       setActiveProject,
     } = useConversationStore();

     const activeMessages = activeProjectId
       ? getMessages(activeProjectId)
       : [];

     return (
       <div className="p-8 max-w-4xl mx-auto">
         <h1 className="text-2xl font-bold mb-4">Store Testing</h1>

         <div className="mb-6">
           <h2 className="text-xl mb-2">Projects ({projects.length})</h2>
           <Button onClick={() => createProject(`Project ${projects.length + 1}`)}>
             Create Project
           </Button>
           <ul className="mt-4 space-y-2">
             {projects.map(p => (
               <li key={p.id} className="flex items-center gap-2">
                 <Button
                   variant={activeProjectId === p.id ? 'default' : 'outline'}
                   onClick={() => setActiveProject(p.id)}
                 >
                   {p.name}
                 </Button>
                 <Button variant="destructive" onClick={() => deleteProject(p.id)}>
                   Delete
                 </Button>
               </li>
             ))}
           </ul>
         </div>

         {activeProjectId && (
           <div className="mb-6">
             <h2 className="text-xl mb-2">Messages ({activeMessages.length})</h2>
             <Button
               onClick={() =>
                 addMessage(activeProjectId, {
                   role: 'user',
                   content: `Message ${activeMessages.length + 1}`,
                   timestamp: new Date(),
                 })
               }
             >
               Add Message
             </Button>
             <ul className="mt-4 space-y-1">
               {activeMessages.map(m => (
                 <li key={m.id} className="border p-2 rounded">
                   <strong>{m.role}:</strong> {m.content}
                 </li>
               ))}
             </ul>
           </div>
         )}
       </div>
     );
   }
   ```

2. **Project CRUD Testing**:
   - **Create**:
     - Click "Create Project" → "Project 1" appears in list
     - Click again → "Project 2" appears
     - Verify both projects in list

   - **Select**:
     - Click "Project 1" → Highlighted (default variant)
     - Click "Project 2" → "Project 2" now highlighted
     - "Project 1" no longer highlighted

   - **Delete**:
     - Create 3 projects
     - Delete "Project 2" → Only "Project 1" and "Project 3" remain
     - If "Project 2" was active → Active switches to first project

3. **Message Operations Testing**:
   - Select "Project 1"
   - Click "Add Message" → "Message 1" appears
   - Click 3 more times → "Message 2", "Message 3", "Message 4" appear
   - Switch to "Project 2" → No messages shown
   - Click "Add Message" → "Message 1" appears (separate from Project 1)
   - Switch back to "Project 1" → All 4 messages still there

4. **Persistence Testing** (CRITICAL):
   - Create 2 projects: "Project A", "Project B"
   - Select "Project A"
   - Add 3 messages to "Project A"
   - Switch to "Project B"
   - Add 2 messages to "Project B"
   - **Refresh the page** (Ctrl+R / Cmd+R)
   - Verify:
     - Both projects still exist
     - "Project B" still active (or first project if state reset)
     - "Project A" has 3 messages
     - "Project B" has 2 messages
   - **Close browser tab and reopen**
   - Verify all data still persists

5. **localStorage Inspection**:
   - Open browser DevTools → Application → Local Storage
   - Find key: `conversation-storage`
   - Value should be JSON with `state.projects`, `state.messages`, `state.activeProjectId`
   - Manually edit JSON (add project) → Refresh → Verify changes reflected

6. **Edge Cases Testing**:
   - Delete all projects → Create new project → Should work
   - Delete active project → Should switch to first remaining
   - Delete last project → activeProjectId should be null
   - Add message to non-existent projectId → Should handle gracefully (no crash)

### Files to Verify
- [ ] `lib/store.ts` exports `useConversationStore`
- [ ] Test files in `__tests__/lib/`
- [ ] No TypeScript errors
- [ ] localStorage key `conversation-storage` exists after operations
- [ ] State persists across page reloads
- [ ] All CRUD operations work correctly

## Implementation Notes

### Zustand Persist Middleware
The `persist` middleware automatically:
- Saves state to localStorage on every change
- Rehydrates state on page load
- Handles serialization/deserialization (JSON)
- Uses `name` as localStorage key

**Important**: Dates serialize as ISO strings and need to be converted back:
```typescript
persist(
  (set, get) => ({ /* store */ }),
  {
    name: 'conversation-storage',
    // Optional: custom serialization for Date objects
    serialize: (state) => JSON.stringify(state),
    deserialize: (str) => {
      const state = JSON.parse(str);
      // Convert date strings back to Date objects
      state.projects = state.projects?.map(p => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
      return state;
    },
  }
)
```

### Selector Pattern for Performance
```typescript
// Good: Efficient selector
const activeProject = useConversationStore(
  state => state.projects.find(p => p.id === state.activeProjectId)
);

// Bad: Re-renders on every state change
const { projects, activeProjectId } = useConversationStore();
const activeProject = projects.find(p => p.id === activeProjectId);
```

### Store DevTools (Optional)
```bash
npm install -D @redux-devtools/extension
```

```typescript
import { devtools } from 'zustand/middleware';

create(
  devtools(
    persist(
      (set, get) => ({ /* store */ }),
      { name: 'conversation-storage' }
    ),
    { name: 'ConversationStore' }
  )
);
```

## Next Phase

Once `useConversationStore` correctly persists state across reloads:
→ [Phase 7: End-to-End Integration](./2026-01-09-tdd-writing-agent-ui-07-phase-7.md)
