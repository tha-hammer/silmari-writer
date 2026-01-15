import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Message, Project } from './types'

interface ConversationState {
  projects: Project[]
  activeProjectId: string | null
  messages: Record<string, Message[]> // projectId -> messages
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
          const { [id]: _, ...remainingMessages } = state.messages
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
    }),
    {
      name: 'conversation-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
