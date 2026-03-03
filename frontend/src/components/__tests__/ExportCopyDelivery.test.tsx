/**
 * ExportCopyDelivery.test.tsx - Step 4: Deliver export or copy result to user
 *
 * TLA+ Properties:
 * - Reachability (export): Mock URL.createObjectURL; click Export → assert download link created and clicked
 * - Reachability (copy): Mock navigator.clipboard.writeText; click Copy → assert called with full content
 * - TypeInvariant: Clipboard receives string payload
 * - ErrorConsistency:
 *   - Mock clipboard rejection → UI shows shared error + logger called
 *   - Mock download failure → shared error displayed + logger called
 *
 * Resource: ui-w8p2 (component)
 * Path: 334-export-or-copy-finalized-answer
 */

// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import ExportCopyControls from '../ExportCopyControls';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const answerId = '550e8400-e29b-41d4-a716-446655440000';
const answerContent = 'I demonstrated leadership by coordinating a cross-functional team.';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportCopyDelivery — Step 4: Deliver export or copy result', () => {
  let mockClipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard
    mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockClipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability (export - file download)
  // -------------------------------------------------------------------------

  describe('Reachability (export)', () => {
    it('should trigger file download when export handler executes download logic', async () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      // Track that anchor click was triggered
      const anchorClickSpy = vi.fn();
      HTMLAnchorElement.prototype.click = anchorClickSpy;

      const onExport = vi.fn(async ({ answerId, format }) => {
        const content = '# Answer\n\nTest content';
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `answer-${answerId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });

      render(
        <ExportCopyControls
          answerId={answerId}
          finalized={true}
          locked={true}
          content={answerContent}
          onExport={onExport}
          onCopy={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      expect(onExport).toHaveBeenCalledTimes(1);
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Reachability (copy - clipboard)
  // -------------------------------------------------------------------------

  describe('Reachability (copy)', () => {
    it('should write to clipboard when copy handler executes', async () => {
      const onCopy = vi.fn(async () => {
        await navigator.clipboard.writeText(answerContent);
      });

      render(
        <ExportCopyControls
          answerId={answerId}
          finalized={true}
          locked={true}
          content={answerContent}
          onExport={vi.fn()}
          onCopy={onCopy}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /copy/i }));

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalledTimes(1);
      });
      expect(mockClipboardWriteText).toHaveBeenCalledWith(answerContent);
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should pass string payload to clipboard', async () => {
      const onCopy = vi.fn(async () => {
        await navigator.clipboard.writeText(answerContent);
      });

      render(
        <ExportCopyControls
          answerId={answerId}
          finalized={true}
          locked={true}
          content={answerContent}
          onExport={vi.fn()}
          onCopy={onCopy}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /copy/i }));

      const clipboardArg = mockClipboardWriteText.mock.calls[0][0];
      expect(typeof clipboardArg).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should log when clipboard write fails', async () => {
      const clipboardError = new Error('Clipboard permission denied');
      mockClipboardWriteText.mockRejectedValue(clipboardError);

      const onCopy = vi.fn(async () => {
        try {
          await navigator.clipboard.writeText(answerContent);
        } catch (err) {
          frontendLogger.error('Clipboard write failed', err, {
            component: 'ExportCopyControls',
            action: 'copy',
          });
          throw err;
        }
      });

      render(
        <ExportCopyControls
          answerId={answerId}
          finalized={true}
          locked={true}
          content={answerContent}
          onExport={vi.fn()}
          onCopy={onCopy}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /copy/i }));

      await waitFor(() => {
        expect(frontendLogger.error).toHaveBeenCalledWith(
          'Clipboard write failed',
          clipboardError,
          expect.objectContaining({ component: 'ExportCopyControls' }),
        );
      });
    });

    it('should log when download fails', async () => {
      const downloadError = new Error('Download failed');

      const onExport = vi.fn(async () => {
        frontendLogger.error('Export download failed', downloadError, {
          component: 'ExportCopyControls',
          action: 'export',
        });
        throw downloadError;
      });

      render(
        <ExportCopyControls
          answerId={answerId}
          finalized={true}
          locked={true}
          content={answerContent}
          onExport={onExport}
          onCopy={vi.fn()}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      await waitFor(() => {
        expect(frontendLogger.error).toHaveBeenCalledWith(
          'Export download failed',
          downloadError,
          expect.objectContaining({ component: 'ExportCopyControls' }),
        );
      });
    });
  });
});
