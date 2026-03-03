import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ArtifactCopyButton from '../ArtifactCopyButton';

const emitNewPathClientEventMock = vi.fn().mockResolvedValue(true);

vi.mock('@/lib/newPathTelemetryClient', () => ({
  emitNewPathClientEvent: (...args: unknown[]) => emitNewPathClientEventMock(...args),
}));

describe('ArtifactCopyButton (Path 341)', () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: clipboardWriteText,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('copies exact rendered text and shows immediate Copied feedback', async () => {
    render(
      <ArtifactCopyButton
        artifactType="outreach"
        content="Hello from outreach draft"
        status="completed"
        sessionId="session-1"
        userId="user-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await act(async () => {});

    expect(clipboardWriteText).toHaveBeenCalledWith('Hello from outreach draft');
    expect(screen.getByRole('button', { name: /copy/i })).toHaveTextContent('Copied!');
    expect(emitNewPathClientEventMock).toHaveBeenCalledWith(
      'artifact_copied_to_clipboard',
      expect.objectContaining({
        artifact_type: 'outreach',
        copy_success: true,
        session_id: 'session-1',
        user_id: 'user-1',
      }),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: /copy/i })).toHaveTextContent('Copy');
  });

  it('hides copy control for non-completed artifact status', () => {
    render(
      <ArtifactCopyButton
        artifactType="summary"
        content="Summary draft"
        status="in_progress"
      />,
    );

    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it('shows failure feedback and emits failure event when clipboard write fails', async () => {
    clipboardWriteText.mockRejectedValueOnce(new Error('Clipboard permission denied'));

    render(
      <ArtifactCopyButton
        artifactType="linkedin_post"
        content="LinkedIn post content"
        status="completed"
        sessionId="session-2"
        userId="user-2"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await act(async () => {});

    expect(screen.getByRole('button', { name: /copy/i })).toHaveTextContent('Copy failed');
    expect(emitNewPathClientEventMock).toHaveBeenCalledWith(
      'artifact_copied_to_clipboard',
      expect.objectContaining({
        artifact_type: 'linkedin_post',
        copy_success: false,
        error_code: 'CLIPBOARD_WRITE_FAILED',
      }),
    );
  });
});
