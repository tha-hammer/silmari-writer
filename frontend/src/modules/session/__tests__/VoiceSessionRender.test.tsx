/**
 * VoiceSessionRender Tests - Step 7: Frontend renders voice-assisted session interface
 *
 * Resource: ui-v3n6 (module)
 * Path: 306-initiate-voice-assisted-answer-session
 *
 * TLA+ properties tested:
 * - Reachability: Successful API response → navigation to /session/[id], UI displays state "initialized"
 * - TypeInvariant: Session state in UI equals "initialized"
 * - ErrorConsistency: State update throw → logger.error called, error message visible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VoiceSessionRender — Step 7: Frontend renders voice-assisted session interface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability', () => {
    it('should navigate to /session/[id] on successful creation', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      mockStartSessionFromUrl.mockResolvedValue({
        sessionId,
        state: 'initialized',
        canonicalUrl: sourceUrl,
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      });

      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={authenticatedUser}
          authToken={authToken}
          onNavigate={onNavigate}
        />,
      );

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onNavigate).toHaveBeenCalledWith(`/session/${sessionId}`);
      });
    });

    it('should display initialized state after successful creation', async () => {
      mockStartSessionFromUrl.mockResolvedValue({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        state: 'initialized',
        canonicalUrl: sourceUrl,
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      });

      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={authenticatedUser}
          authToken={authToken}
          onNavigate={onNavigate}
        />,
      );

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        const initEl = screen.getByTestId('session-init');
        expect(initEl).toBeInTheDocument();
        expect(initEl.textContent).toContain('initialized');
      });
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should set session state to initialized after successful creation', async () => {
      mockStartSessionFromUrl.mockResolvedValue({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        state: 'initialized',
        canonicalUrl: sourceUrl,
        contextSummary: 'Context extracted from example.greenhouse.io (direct URL).',
      });

      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={authenticatedUser}
          authToken={authToken}
          onNavigate={onNavigate}
        />,
      );

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        const initEl = screen.getByTestId('session-init');
        expect(initEl.textContent).toContain('initialized');
      });
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should call logger.error when session creation fails', async () => {
      mockStartSessionFromUrl.mockRejectedValue(new Error('State update failed'));

      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={authenticatedUser}
          authToken={authToken}
          onNavigate={onNavigate}
        />,
      );

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

    it('should display error message when session creation fails', async () => {
      mockStartSessionFromUrl.mockRejectedValue(new Error('State update failed'));

      const onNavigate = vi.fn();

      render(
        <StartVoiceSessionModule
          user={authenticatedUser}
          authToken={authToken}
          onNavigate={onNavigate}
        />,
      );

      fireEvent.change(screen.getByLabelText(/job posting url/i), {
        target: { value: sourceUrl },
      });
      const button = screen.getByRole('button', { name: /Start Voice-Assisted Session/i });
      fireEvent.click(button);

      await waitFor(() => {
        const errorEl = screen.getByRole('alert');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl.textContent).toContain('State update failed');
      });
    });
  });
});
