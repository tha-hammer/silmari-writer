import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Message, Project, MessageButtonState, NonBlockingOperationType, BlockingOperationType } from './types'

interface ConversationState {
  projects: Project[]
  activeProjectId: string | null
  messages: Record<string, Message[]> // projectId -> messages
  buttonStates: Record<string, MessageButtonState> // messageId -> button state
  _hasHydrated: boolean

  // Hydration
  setHasHydrated: (state: boolean) => void

  // Project actions
  createProject: (name: string) => string
  deleteProject: (id: string) => void
  updateProject: (id: string, updates: Partial<Omit<Project, 'id'>>) => void
  setActiveProject: (id: string) => void

  // Message actions
  addMessage: (projectId: string, message: Omit<Message, 'id'>) => void
  getMessages: (projectId: string) => Message[]
  clearMessages: (projectId: string) => void

  // Button state actions (synchronous - updates are immediate)
  setNonBlockingOperation: (messageId: string, operation: NonBlockingOperationType) => void
  clearNonBlockingOperation: (messageId: string, operation: NonBlockingOperationType) => void
  startBlockingOperation: (messageId: string, type: BlockingOperationType) => void
  completeBlockingOperation: (messageId: string) => void
  failBlockingOperation: (messageId: string, error: string) => void
  isMessageBlocked: (messageId: string) => boolean

  // Selectors
  getActiveProject: () => Project | undefined
  getActiveMessages: () => Message[]
  hasMessages: (projectId: string) => boolean
  projectCount: () => number
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      messages: {},
      buttonStates: {},
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      createProject: (name) => {
        const id = crypto.randomUUID()
        const project: Project = {
          id,
          name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: id,
        }))
        return id
      },

      deleteProject: (id) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _deleted, ...remainingMessages } = state.messages
          const remainingProjects = state.projects.filter((p) => p.id !== id)
          return {
            projects: remainingProjects,
            messages: remainingMessages,
            activeProjectId:
              state.activeProjectId === id
                ? remainingProjects[0]?.id ?? null
                : state.activeProjectId,
          }
        })
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
          ),
        }))
      },

      setActiveProject: (id) => {
        set({ activeProjectId: id })
      },

      addMessage: (projectId, message) => {
        const fullMessage: Message = {
          ...message,
          id: crypto.randomUUID(),
        }
        set((state) => ({
          messages: {
            ...state.messages,
            [projectId]: [...(state.messages[projectId] || []), fullMessage],
          },
        }))
      },

      getMessages: (projectId) => {
        return get().messages[projectId] || []
      },

      clearMessages: (projectId) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [projectId]: [],
          },
        }))
      },

      // Selectors
      getActiveProject: () => {
        const state = get()
        return state.projects.find((p) => p.id === state.activeProjectId)
      },

      getActiveMessages: () => {
        const state = get()
        if (!state.activeProjectId) return []
        return state.messages[state.activeProjectId] || []
      },

      hasMessages: (projectId) => {
        const messages = get().messages[projectId]
        return messages !== undefined && messages.length > 0
      },

      projectCount: () => {
        return get().projects.length
      },

      // Button state actions
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
      isMessageBlocked: (messageId) => {
        return !!get().buttonStates[messageId]?.blockingOperation?.isLoading
      },
    }),
    {
      name: 'conversation-storage',
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
    }
  )
)
