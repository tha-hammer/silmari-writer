/**
 * StartVoiceSessionModule Tests - Step 1: User initiates voice session
 *
 * Resource: ui-v3n6 (module)
 * Path: 306-initiate-voice-assisted-answer-session
 *
 * TLA+ properties tested:
 * - Reachability: Authenticated user submits URL → startSessionFromUrl() called once
 * - TypeInvariant: Request matches StartSessionFromUrlRequest Zod schema
 * - ErrorConsistency: Unauthenticated user → redirect to /login, startSessionFromUrl NOT called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock dependencies
vi.mock('@/api_contracts/startSessionFromUrl', () => ({
  startSessionFromUrl: vi.fn(),
}));

vi.mock('@/logging/index', () => ({
  frontendLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import StartVoiceSessionModule from '../StartVoiceSessionModule';
import { startSessionFromUrl } from '@/api_contracts/startSessionFromUrl';
import { frontendLogger } from '@/logging/index';

const mockStartSessionFromUrl = vi.mocked(startSessionFromUrl);
const mockLogger = vi.mocked(frontendLogger);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const authenticatedUser = { id: 'user-abc123' };
const authToken = 'valid-token-abc123';
const sourceUrl = 'https://example.greenhouse.io/job/123';

function renderModule(overrides: {
  user?: { id: string } | null;
  authToken?: string | null;
  onNavigate?: (path: string) => void;
} = {}) {
  const onNavigate = overrides.onNavigate ?? vi.fn();
  return {
    onNavigate,
    ...render(
      <StartVoiceSessionModule
        user={overrides.user ?? authenticatedUser}
        authToken={overrides.authToken ?? authToken}
        onNavigate={onNavigate}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StartVoiceSessionModule - Step 1: User initiates voice session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability', () => {
    it('should call startSessionFromUrl() when authenticated user submits URL', async () => {
      mockStartSessionFromUrl.mockResolvedValue({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        state: 'initialized',
        canonicalUrl: sourceUrl,
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      });

      renderModule();

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStartSessionFromUrl).toHaveBeenCalledTimes(1);
      });
    });

    it('should call startSessionFromUrl with auth token and URL', async () => {
      mockStartSessionFromUrl.mockResolvedValue({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        state: 'initialized',
        canonicalUrl: sourceUrl,
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      });

      renderModule();

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStartSessionFromUrl).toHaveBeenCalledWith(authToken, sourceUrl);
      });
    });

    it('should show loading state while creating session', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => { resolvePromise = resolve; });
      mockStartSessionFromUrl.mockReturnValue(pendingPromise as any);

      renderModule();

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      });

      // Clean up
      await act(async () => {
        resolvePromise!({
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          state: 'initialized',
          canonicalUrl: sourceUrl,
          contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should navigate to /session/[id] on success', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      mockStartSessionFromUrl.mockResolvedValue({
        sessionId,
        state: 'initialized',
        canonicalUrl: sourceUrl,
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      });

      const { onNavigate } = renderModule();

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalledWith(`/session/${sessionId}`);
      });
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should redirect to /login when user is not authenticated', () => {
      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={null}
          authToken={null}
          onNavigate={onNavigate}
        />,
      );

      expect(onNavigate).toHaveBeenCalledWith('/login');
    });

    it('should NOT call startSessionFromUrl when user is not authenticated', () => {
      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={null}
          authToken={null}
          onNavigate={onNavigate}
        />,
      );

      expect(mockStartSessionFromUrl).not.toHaveBeenCalled();
    });

    it('should redirect to /login when authToken is null and button clicked', async () => {
      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={authenticatedUser}
          authToken={null}
          onNavigate={onNavigate}
        />,
      );

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      expect(onNavigate).toHaveBeenCalledWith('/login');
      expect(mockStartSessionFromUrl).not.toHaveBeenCalled();
    });

    it('should display error when session creation fails', async () => {
      mockStartSessionFromUrl.mockRejectedValue(new Error('Network failure'));

      renderModule();

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorEl = screen.getByRole('alert');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl.textContent).toContain('Network failure');
      });
    });

    it('should log error via frontendLogger when session creation fails', async () => {
      mockStartSessionFromUrl.mockRejectedValue(new Error('Network failure'));

      renderModule();

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          'VOICE_SESSION_START_FAILED',
          expect.any(Error),
          expect.objectContaining({ module: 'StartVoiceSessionModule' }),
        );
      });
    });

    it('should require a URL before starting session', async () => {
      renderModule();

      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      expect(screen.getByRole('alert')).toHaveTextContent('Paste a job URL to continue.');
      expect(mockStartSessionFromUrl).not.toHaveBeenCalled();
    });
  });
});
