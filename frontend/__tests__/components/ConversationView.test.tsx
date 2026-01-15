import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConversationView from '@/components/chat/ConversationView'
import { Message } from '@/lib/types'

// Mock scrollIntoView
const mockScrollIntoView = vi.fn()
window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView

describe('ConversationView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-14T12:00:00.000Z'))
    mockScrollIntoView.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows empty state when no messages', () => {
    render(<ConversationView messages={[]} />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No messages yet')).toBeInTheDocument()
    expect(screen.getByText('Start a conversation to get started')).toBeInTheDocument()
  })

  it('renders user messages with correct alignment', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    const messageElement = screen.getByTestId('message-1')
    expect(messageElement).toBeInTheDocument()
    expect(messageElement).toHaveClass('justify-end')

    const bubble = messageElement.querySelector('[data-role="user"]')
    expect(bubble).toHaveClass('bg-blue-500', 'text-white')
  })

  it('renders assistant messages with correct alignment', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    const messageElement = screen.getByTestId('message-1')
    expect(messageElement).toBeInTheDocument()
    expect(messageElement).toHaveClass('justify-start')

    const bubble = messageElement.querySelector('[data-role="assistant"]')
    expect(bubble).toHaveClass('bg-gray-200', 'text-gray-900')
  })

  it('renders multiple messages in order', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'First message',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Second message',
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
      },
      {
        id: '3',
        role: 'user',
        content: 'Third message',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(screen.getByText('First message')).toBeInTheDocument()
    expect(screen.getByText('Second message')).toBeInTheDocument()
    expect(screen.getByText('Third message')).toBeInTheDocument()
  })

  it('renders markdown content correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'This is **bold** and *italic* text',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    const strongElement = screen.getByText('bold')
    expect(strongElement.tagName).toBe('STRONG')

    const emElement = screen.getByText('italic')
    expect(emElement.tagName).toBe('EM')
  })

  it('renders code blocks with syntax highlighting', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: '```python\ndef hello():\n    print("Hello")\n```',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    // Code should be rendered
    expect(screen.getByText(/def/)).toBeInTheDocument()
    expect(screen.getByText(/hello/)).toBeInTheDocument()
  })

  it('renders inline code correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Use the `console.log` function',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    const codeElement = screen.getByText('console.log')
    expect(codeElement.tagName).toBe('CODE')
  })

  it('auto-scrolls to bottom on mount', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('auto-scrolls when new messages are added', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ]

    const { rerender } = render(<ConversationView messages={messages} />)

    mockScrollIntoView.mockClear()

    const newMessages: Message[] = [
      ...messages,
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
      },
    ]

    rerender(<ConversationView messages={newMessages} />)

    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('displays relative timestamps', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(screen.getByTestId('message-timestamp')).toHaveTextContent('5 minutes ago')
  })

  it('shows user icon for user messages', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(screen.getByLabelText('User')).toBeInTheDocument()
  })

  it('shows AI icon for assistant messages', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(screen.getByLabelText('AI')).toBeInTheDocument()
  })

  it('renders lists correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: '1. First item\n2. Second item\n3. Third item',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(screen.getByText('First item')).toBeInTheDocument()
    expect(screen.getByText('Second item')).toBeInTheDocument()
    expect(screen.getByText('Third item')).toBeInTheDocument()
  })

  it('hides empty state when messages exist', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ]

    render(<ConversationView messages={messages} />)

    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
    expect(screen.getByTestId('conversation-view')).toBeInTheDocument()
  })
})
