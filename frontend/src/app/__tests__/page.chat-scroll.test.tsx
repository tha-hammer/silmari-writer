import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../page';

const mockUseConversationStore = vi.hoisted(() => vi.fn());
const mockUseRealtimeSession = vi.hoisted(() => vi.fn());
const mockUseAutoReadAloud = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/store', () => ({
  useConversationStore: mockUseConversationStore,
}));

vi.mock('@/hooks/useRealtimeSession', () => ({
  useRealtimeSession: mockUseRealtimeSession,
}));

vi.mock('@/hooks/useAutoReadAloud', () => ({
  useAutoReadAloud: mockUseAutoReadAloud,
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock('@/components/layout/ProjectSidebar', () => ({
  default: () => <div data-testid="project-sidebar" />,
}));

vi.mock('@/components/chat/ConversationView', () => ({
  default: () => <div data-testid="conversation-view-stub" />,
}));

vi.mock('@/components/chat/MessageInput', () => ({
  default: () => <div data-testid="message-input-stub" />,
}));

vi.mock('@/components/chat/FileAttachment', () => ({
  default: () => <div data-testid="file-attachment-stub" />,
}));

vi.mock('@/components/chat/AudioRecorder', () => ({
  default: () => <div data-testid="audio-recorder-stub" />,
}));

vi.mock('@/components/chat/ReadAloudToggle', () => ({
  default: () => <div data-testid="read-aloud-stub" />,
}));

vi.mock('@/components/chat/VoiceEditPanel', () => ({
  default: () => <div data-testid="voice-edit-stub" />,
}));

describe('HomePage chat workspace layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseConversationStore.mockReturnValue({
      projects: [
        {
          id: 'project-1',
          name: 'My First Project',
          createdAt: new Date('2026-03-04T00:00:00.000Z'),
          updatedAt: new Date('2026-03-04T00:00:00.000Z'),
        },
      ],
      activeProjectId: 'project-1',
      createProject: vi.fn(),
      setActiveProject: vi.fn(),
      addMessage: vi.fn(),
      getMessages: vi.fn(() => []),
      _hasHydrated: true,
      readAloudEnabled: false,
    });

    mockUseRealtimeSession.mockReturnValue({
      sessionState: 'disconnected',
      sendEvent: vi.fn(),
      setOnEvent: vi.fn(),
    });

    mockUseAutoReadAloud.mockReturnValue({
      onNewAssistantMessage: vi.fn(),
      handleResponseDone: vi.fn(),
    });
  });

  it('keeps conversation container as flex column for scroll constraints', () => {
    render(<HomePage />);

    const conversationView = screen.getByTestId('conversation-view-stub');
    const container = conversationView.parentElement;

    expect(container).not.toBeNull();
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('flex-1');
    expect(container).toHaveClass('flex-col');
    expect(container).toHaveClass('min-h-0');
    expect(container).toHaveClass('overflow-hidden');
  });
});
