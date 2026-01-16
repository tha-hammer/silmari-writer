import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationView from '@/components/chat/ConversationView'
import { useConversationStore } from '@/lib/store'
import { Message } from '@/lib/types'

// Create a mock store that will be updated in beforeEach
let globalMockStore: any = null

vi.mock('@/lib/store', () => ({
  useConversationStore: vi.fn((selector?: any) => {
    if (selector && globalMockStore) {
      return selector(globalMockStore)
    }
    return globalMockStore
  }),
}))

// Mock messageActions
vi.mock('@/lib/messageActions', () => ({
  regenerateMessage: vi.fn(),
}))

// Mock analytics - make these resolve immediately
vi.mock('@/lib/analytics', () => ({
  trackButtonClick: vi.fn(async () => {}),
  trackButtonOutcome: vi.fn(async () => {}),
  trackButtonTiming: vi.fn(async () => {}),
}))

// Don't mock useButtonAnalytics - let it use the mocked analytics functions

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
  let mockWriteText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock clipboard with vi.fn()
    mockWriteText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    })

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()

    // Create fresh mock store
    mockStore = {
      buttonStates: {},
      setNonBlockingOperation: vi.fn(),
      clearNonBlockingOperation: vi.fn(),
      startBlockingOperation: vi.fn(),
      completeBlockingOperation: vi.fn(),
      failBlockingOperation: vi.fn(),
      isMessageBlocked: vi.fn(() => false),
      messages: mockMessages,
      activeProjectId: 'project-1',
      getActiveMessages: vi.fn(() => mockMessages),
    }

    // Update global mock store
    globalMockStore = mockStore

    // Mock getState for Zustand pattern (used by regenerate handler)
    ;(useConversationStore as any).getState = () => mockStore
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('Copy Flow', () => {
    it('renders copy button', () => {
      render(<ConversationView messages={mockMessages} />)
      const copyButtons = screen.getAllByRole('button', { name: /copy/i })
      expect(copyButtons).toHaveLength(1)
    })

    it('completes full copy flow', async () => {
      const user = userEvent.setup()
      render(<ConversationView messages={mockMessages} />)

      // Find assistant message
      const assistantMessage = screen.getByText(/hello! how can i help you?/i)
      expect(assistantMessage).toBeInTheDocument()

      // Find and click copy button
      const copyButtons = screen.getAllByRole('button', { name: /copy/i })
      const copyButton = copyButtons[0] // First copy button (for assistant message)
      await user.click(copyButton)

      // Verify clipboard updated
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Hello! How can I help you?')
      })

      // Verify store action called
      await waitFor(() => {
        expect(mockStore.setNonBlockingOperation).toHaveBeenCalledWith('msg-2', 'copy')
      })
    })

    it('shows "Copied!" feedback after clicking copy', async () => {
      // Set up mock store with copy state active
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            copy: { isActive: true, timestamp: Date.now() },
          },
        },
      })

      render(<ConversationView messages={mockMessages} />)

      // Check for "Copied!" feedback
      expect(screen.getByText(/copied!/i)).toBeInTheDocument()
    })

    it('clears copy state after timeout', async () => {
      vi.useFakeTimers()

      // Set up mock store with copy state active
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            copy: { isActive: true, timestamp: Date.now() },
          },
        },
      })

      render(<ConversationView messages={mockMessages} />)

      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000)

      await waitFor(() => {
        expect(mockStore.clearNonBlockingOperation).toHaveBeenCalledWith('msg-2', 'copy')
      })

      vi.useRealTimers()
    })

    it('allows copy during blocking operation (non-blocking)', async () => {
      const user = userEvent.setup()

      // Set up mock store with blocking operation
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: true,
            },
          },
        },
        isMessageBlocked: vi.fn(() => true),
      })

      render(<ConversationView messages={mockMessages} />)

      const copyButtons = screen.getAllByRole('button', { name: /copy/i })
      const copyButton = copyButtons[0]
      expect(copyButton).not.toBeDisabled()

      await user.click(copyButton)

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled()
      })
    })
  })

  describe('Regenerate Flow', () => {
    it('shows loading state during regeneration', async () => {
      // Set up mock store with loading state
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: true,
            },
          },
        },
        isMessageBlocked: vi.fn(() => true),
      })

      render(<ConversationView messages={mockMessages} />)

      // Verify loading spinner is shown
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      // Verify buttons are in correct state
      const regenerateButtons = screen.getAllByRole('button', { name: /regenerate/i })
      expect(regenerateButtons[0]).toBeDisabled()
    })

    it('disables blocking buttons during regeneration', async () => {
      // Set up mock store with loading state
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: true,
            },
          },
        },
        isMessageBlocked: vi.fn(() => true),
      })

      render(<ConversationView messages={mockMessages} />)

      const regenerateButtons = screen.getAllByRole('button', { name: /regenerate/i })
      const sendToApiButtons = screen.getAllByRole('button', { name: /send to api/i })
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const copyButtons = screen.getAllByRole('button', { name: /copy/i })

      // Verify blocking buttons disabled
      expect(regenerateButtons[0]).toBeDisabled()
      expect(sendToApiButtons[0]).toBeDisabled()
      expect(editButtons[0]).toBeDisabled()

      // Copy should still be enabled (non-blocking)
      expect(copyButtons[0]).not.toBeDisabled()
    })

    it('shows error message when regeneration fails', () => {
      // Set up mockStore with error state before rendering
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: false,
              error: 'Failed to regenerate message',
            },
          },
        },
      })

      render(<ConversationView messages={mockMessages} />)

      expect(screen.getByText(/failed to regenerate message/i)).toBeInTheDocument()
    })

    it('prevents regeneration when another operation is active', () => {
      // Set up mockStore with blocking operation before rendering
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            blockingOperation: {
              type: 'edit',
              isLoading: true,
            },
          },
        },
        isMessageBlocked: vi.fn(() => true),
      })

      render(<ConversationView messages={mockMessages} />)

      const regenerateButtons = screen.getAllByRole('button', { name: /regenerate/i })
      expect(regenerateButtons[0]).toBeDisabled()
    })
  })

  describe('Edit Flow', () => {
    it('calls startBlockingOperation when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<ConversationView messages={mockMessages} />)

      // Verify the button is present
      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      expect(editButtons).toHaveLength(1)
      expect(editButtons[0]).not.toBeDisabled()

      // Click the button
      await user.click(editButtons[0])

      // Wait a bit for async operations
      await waitFor(() => {
        expect(mockStore.startBlockingOperation).toHaveBeenCalled()
      }, { timeout: 2000 })

      // Verify it was called with correct args
      expect(mockStore.startBlockingOperation).toHaveBeenCalledWith('msg-2', 'edit')
    })

    it('opens modal, edits, and saves', async () => {
      const user = userEvent.setup()
      render(<ConversationView messages={mockMessages} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const editButton = editButtons[0]

      // Click and wait for the async handler to complete
      await user.click(editButton)

      // Flush promises to ensure async handler completes
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Wait for modal to appear (findByRole has built-in retry)
      const modal = await screen.findByRole('dialog', {}, { timeout: 5000 })
      expect(modal).toBeInTheDocument()

      // Verify blocking operation started
      expect(mockStore.startBlockingOperation).toHaveBeenCalledWith('msg-2', 'edit')

      // Edit content
      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveValue('Hello! How can I help you?')

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
    }, 10000)

    it('closes modal on cancel without saving', async () => {
      const user = userEvent.setup()
      render(<ConversationView messages={mockMessages} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const editButton = editButtons[0]
      await user.click(editButton)

      // Flush promises to ensure async handler completes
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Wait for modal to appear
      const modal = await screen.findByRole('dialog', {}, { timeout: 5000 })
      expect(modal).toBeInTheDocument()

      // Edit content
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Edited but not saved')

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Verify modal closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Verify completion called (cancel also completes the operation)
      expect(mockStore.completeBlockingOperation).toHaveBeenCalledWith('msg-2')
    }, 10000)

    it('closes modal on Escape key', async () => {
      const user = userEvent.setup()
      render(<ConversationView messages={mockMessages} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const editButton = editButtons[0]
      await user.click(editButton)

      // Flush promises to ensure async handler completes
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Wait for modal to appear
      const modal = await screen.findByRole('dialog', {}, { timeout: 5000 })
      expect(modal).toBeInTheDocument()

      // Press Escape
      await user.keyboard('{Escape}')

      // Verify modal closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    }, 10000)

    it('disables Save button when content is empty', async () => {
      const user = userEvent.setup()
      render(<ConversationView messages={mockMessages} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      const editButton = editButtons[0]
      await user.click(editButton)

      // Flush promises to ensure async handler completes
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Wait for modal to appear
      const modal = await screen.findByRole('dialog', {}, { timeout: 5000 })
      expect(modal).toBeInTheDocument()

      // Clear content
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)

      // Verify save button is disabled
      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    }, 10000)

    it('prevents edit when another operation is active', () => {
      // Set up mockStore with blocking operation before rendering
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        buttonStates: {
          'msg-2': {
            blockingOperation: {
              type: 'regenerate',
              isLoading: true,
            },
          },
        },
        isMessageBlocked: vi.fn(() => true),
      })

      render(<ConversationView messages={mockMessages} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      expect(editButtons[0]).toBeDisabled()
    })
  })

  describe('Multiple Messages', () => {
    it('handles button operations on different messages independently', async () => {
      const user = userEvent.setup()
      const multipleMessages: Message[] = [
        ...mockMessages,
        {
          id: 'msg-3',
          role: 'user',
          content: 'Another question',
          timestamp: new Date('2026-01-16T10:02:00Z'),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: 'Another response',
          timestamp: new Date('2026-01-16T10:03:00Z'),
        },
      ]

      // Update mockStore with multiple messages
      vi.mocked(useConversationStore).mockReturnValue({
        ...mockStore,
        messages: multipleMessages,
      })

      render(<ConversationView messages={multipleMessages} />)

      // Click copy on first assistant message
      const copyButtons = screen.getAllByRole('button', { name: /copy/i })
      await user.click(copyButtons[0]) // First assistant message (msg-2)

      await waitFor(() => {
        expect(mockStore.setNonBlockingOperation).toHaveBeenCalledWith('msg-2', 'copy')
      })

      // Click regenerate on second assistant message
      const regenerateButtons = screen.getAllByRole('button', { name: /regenerate/i })
      await user.click(regenerateButtons[1]) // Second assistant message (msg-4)

      await waitFor(() => {
        expect(mockStore.startBlockingOperation).toHaveBeenCalledWith('msg-4', 'regenerate')
      })

      // Verify both operations were tracked independently
      expect(mockStore.setNonBlockingOperation).toHaveBeenCalledTimes(1)
      expect(mockStore.startBlockingOperation).toHaveBeenCalledTimes(1)
    }, 10000)
  })

  describe('User Messages', () => {
    it('does not show ButtonRibbon for user messages', () => {
      render(<ConversationView messages={mockMessages} />)

      // User message should be visible
      expect(screen.getByText(/^Hello$/i)).toBeInTheDocument()

      // ButtonRibbon should only appear once (for assistant message, not user)
      const copyButtons = screen.getAllByRole('button', { name: /copy/i })
      expect(copyButtons).toHaveLength(1) // Only one ButtonRibbon for assistant message
    })
  })
})
