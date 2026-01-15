import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConversationView from '@/components/chat/ConversationView';
import { Message } from '@/lib/types';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe('ConversationView', () => {
  it('should display all messages including voice transcriptions', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'This is a typed message',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: '2',
        role: 'user',
        content: 'This is a voice transcription',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        isVoiceTranscription: true,
      },
      {
        id: '3',
        role: 'assistant',
        content: 'Response to voice transcription',
        timestamp: new Date('2024-01-01T10:01:30Z'),
      },
    ];

    render(<ConversationView messages={messages} />);

    // All messages should be visible
    expect(screen.getByText('This is a typed message')).toBeInTheDocument();
    expect(screen.getByText('This is a voice transcription')).toBeInTheDocument();
    expect(screen.getByText('Response to voice transcription')).toBeInTheDocument();
  });

  it('should display all messages when none are voice transcriptions', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'First message',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'First response',
        timestamp: new Date('2024-01-01T10:00:30Z'),
      },
    ];

    render(<ConversationView messages={messages} />);

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('First response')).toBeInTheDocument();
  });
});
