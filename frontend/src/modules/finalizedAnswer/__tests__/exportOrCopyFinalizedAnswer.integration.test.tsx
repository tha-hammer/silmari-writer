/**
 * Integration test for the export-or-copy-finalized-answer flow.
 *
 * Path: 334-export-or-copy-finalized-answer
 *
 * Exercises the full path:
 * 1. Render UI with finalized, locked answer
 * 2. Click Export (markdown) → API route invoked → Transformer applied → Download triggered
 * 3. Click Copy → Clipboard write → Success message shown
 *
 * TLA+ properties:
 * - Reachability: Trigger → Step1 → Step2 → Step3 → Step4
 * - TypeInvariant: Types preserved across UI → API → Service → Transformer → UI
 * - ErrorConsistency: All error branches produce defined shared or backend errors
 */

// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportFinalizedAnswerResponseSchema } from '@/api_contracts/exportFinalizedAnswer';

// Mock fetch at the network level — simulates full backend
const mockFetch = vi.fn();

// Mock frontendLogger
vi.mock('@/logging/index', () => ({
  frontendLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/newPathTelemetryClient', () => ({
  emitNewPathClientEvent: vi.fn().mockResolvedValue(true),
}));

import { frontendLogger } from '@/logging/index';
import FinalizedAnswerModule from '../FinalizedAnswerModule';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const answerId = '550e8400-e29b-41d4-a716-446655440000';

const finalizedLockedAnswer = {
  id: answerId,
  status: 'FINALIZED',
  finalized: true,
  editable: false,
  locked: true,
  content: 'I demonstrated leadership by coordinating a cross-functional team to deliver a critical project under tight deadlines.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Export or Copy Finalized Answer Integration (Path 334)', () => {
  let mockClipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    vi.clearAllMocks();

    // Mock clipboard
    mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockClipboardWriteText },
      writable: true,
      configurable: true,
    });

    // Mock URL methods for download
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock anchor click
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability: Full successful export path
  // -------------------------------------------------------------------------

  describe('Reachability: Full successful export flow', () => {
    it('should complete full path: UI → API → Transform → Download', async () => {
      // Simulate backend returning transformed markdown content
      const exportResponse = {
        content: '# Answer\n\nI demonstrated leadership by coordinating a cross-functional team to deliver a critical project under tight deadlines.',
        format: 'markdown',
        answerId,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => exportResponse,
      });

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      // Pre-condition: answer status shows Finalized
      expect(screen.getByTestId('answer-status')).toHaveTextContent('Finalized');

      // Action: click Export Markdown
      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      // Verify API was called correctly
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(`/api/answers/${answerId}/export`);
      expect(url).toContain('format=markdown');

      // Verify download was triggered
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();

      // Verify success message
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toHaveTextContent('exported as Markdown');
      });

      // No error state present
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should export as plain text when plain text button clicked', async () => {
      const exportResponse = {
        content: finalizedLockedAnswer.content,
        format: 'plain_text',
        answerId,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => exportResponse,
      });

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /export.*plain text/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('format=plain_text');

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toHaveTextContent('exported as Plain Text');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Reachability: Copy to clipboard
  // -------------------------------------------------------------------------

  describe('Reachability: Full successful copy flow', () => {
    it('should copy content to clipboard and show success message', async () => {
      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      // Action: click Copy
      await userEvent.click(screen.getByRole('button', { name: /copy/i }));

      // Verify clipboard was written
      expect(mockClipboardWriteText).toHaveBeenCalledWith(finalizedLockedAnswer.content);

      // Verify success message shown
      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toHaveTextContent('copied to clipboard');
      });

      // No error state
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant: Response shapes
  // -------------------------------------------------------------------------

  describe('TypeInvariant: Types preserved across layers', () => {
    it('should validate response against ExportFinalizedAnswerResponseSchema', async () => {
      const exportResponse = {
        content: '# Answer\n\nTest content',
        format: 'markdown',
        answerId,
      };

      // Verify test data matches the schema
      const parsed = ExportFinalizedAnswerResponseSchema.safeParse(exportResponse);
      expect(parsed.success).toBe(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => exportResponse,
      });

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency: Error handling
  // -------------------------------------------------------------------------

  describe('ErrorConsistency: All error branches produce defined errors', () => {
    it('should display error when API returns 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          code: 'ANSWER_NOT_FOUND',
          message: 'Answer not found',
        }),
      });

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Logger should have been called
      expect(frontendLogger.error).toHaveBeenCalled();
    });

    it('should display error and log when clipboard write fails', async () => {
      mockClipboardWriteText.mockRejectedValue(new Error('Clipboard permission denied'));

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /copy/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Logger should have been called
      expect(frontendLogger.error).toHaveBeenCalledWith(
        'Clipboard write failed',
        expect.any(Error),
        expect.objectContaining({ module: 'FinalizedAnswerModule', action: 'copy' }),
      );
    });

    it('should display error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={finalizedLockedAnswer}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('should not show export controls when answer is not finalized', () => {
      const notFinalizedAnswer = {
        ...finalizedLockedAnswer,
        finalized: false,
        locked: false,
      };

      render(
        <FinalizedAnswerModule
          answerId={answerId}
          initialAnswer={notFinalizedAnswer}
        />,
      );

      // Export controls should not be rendered
      expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    });
  });
});
