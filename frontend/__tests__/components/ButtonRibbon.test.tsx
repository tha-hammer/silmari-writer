import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

describe('Copy button', () => {
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

    // Reset mock store to initial state
    mockStore.buttonStates = {}
    mockStore.isMessageBlocked = vi.fn(() => false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useConversationStore).mockReturnValue(mockStore as any)

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      writable: true,
      configurable: true,
    })
  })

  it('copies message content to clipboard when clicked', async () => {
    const content = 'Test message content'

    render(<ButtonRibbon messageId={mockMessageId} content={content} />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    copyButton.click()

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(content)
    })
  })

  it('calls setNonBlockingOperation when copy clicked', async () => {
    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    copyButton.click()

    await waitFor(() => {
      expect(mockStore.setNonBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'copy')
    })
  })

  it('shows "Copied!" feedback after clicking copy', async () => {
    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    copyButton.click()

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
    vi.useFakeTimers()

    mockStore.buttonStates = {
      [mockMessageId]: {
        copy: { isActive: true, timestamp: Date.now() },
      },
    }

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000)

    expect(mockStore.clearNonBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'copy')

    vi.useRealTimers()
  })

  it('can copy during blocking operation (non-blocking)', async () => {
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

    const copyButton = screen.getByRole('button', { name: /copy/i })
    expect(copyButton).not.toBeDisabled()

    copyButton.click()

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  it('handles clipboard write failure gracefully', async () => {
    // Mock clipboard failure
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'))

    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    copyButton.click()

    // Should not crash, should log error
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    consoleErrorSpy.mockRestore()
  })
})

describe('Regenerate button', () => {
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

    // Reset mock store to initial state
    mockStore.buttonStates = {}
    mockStore.isMessageBlocked = vi.fn(() => false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useConversationStore).mockReturnValue(mockStore as any)
  })

  it('calls startBlockingOperation when clicked', async () => {
    render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    regenerateButton.click()

    await waitFor(() => {
      expect(mockStore.startBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'regenerate')
    })
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
    // Set error state
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: { type: 'regenerate', isLoading: false, error: 'Failed' }
      }
    }

    const { rerender } = render(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    // Verify error is shown
    expect(screen.getByText(/failed/i)).toBeInTheDocument()

    // Start new operation (should clear error)
    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    regenerateButton.click()

    await waitFor(() => {
      expect(mockStore.startBlockingOperation).toHaveBeenCalledWith(mockMessageId, 'regenerate')
    })

    // Update store to show loading without error
    mockStore.buttonStates = {
      [mockMessageId]: {
        blockingOperation: { type: 'regenerate', isLoading: true }
      }
    }

    // Re-render
    rerender(<ButtonRibbon messageId={mockMessageId} content="Test" />)

    // Verify error cleared
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  })
})
