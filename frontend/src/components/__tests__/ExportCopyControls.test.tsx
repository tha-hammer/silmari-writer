/**
 * ExportCopyControls.test.tsx - Step 1: Capture export or copy action
 *
 * TLA+ Properties:
 * - Reachability: Render with finalized=true, locked=true; click "Export (markdown)" → assert handler called with { answerId, format: 'markdown' }
 * - TypeInvariant: Assert emitted request satisfies ExportFinalizedAnswerRequest (TS type + runtime Zod parse)
 * - ErrorConsistency: Render with finalized=false; click Export → assert shared error message from SharedErrors.ANSWER_NOT_FINALIZED is displayed
 *
 * Resource: ui-w8p2 (component)
 * Path: 334-export-or-copy-finalized-answer
 */

// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportFinalizedAnswerRequestSchema } from '@/api_contracts/exportFinalizedAnswer';

vi.mock('@/lib/newPathTelemetryClient', () => ({
  emitNewPathClientEvent: vi.fn().mockResolvedValue(true),
}));

import ExportCopyControls from '../ExportCopyControls';

describe('ExportCopyControls — Step 1: Capture export or copy action', () => {
  const answerId = '550e8400-e29b-41d4-a716-446655440000';

  const defaultProps = {
    answerId,
    finalized: true,
    locked: true,
    content: 'My finalized answer about leadership experience.',
    onExport: vi.fn(),
    onCopy: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Reachability
  // -------------------------------------------------------------------------

  describe('Reachability', () => {
    it('should call onExport with answerId and format when finalized and locked', async () => {
      render(<ExportCopyControls {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      expect(defaultProps.onExport).toHaveBeenCalledTimes(1);
      expect(defaultProps.onExport).toHaveBeenCalledWith({
        answerId,
        format: 'markdown',
      });
    });

    it('should call onExport with plain_text format when plain text button clicked', async () => {
      render(<ExportCopyControls {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /export.*plain text/i }));

      expect(defaultProps.onExport).toHaveBeenCalledWith({
        answerId,
        format: 'plain_text',
      });
    });

    it('should call onCopy with answerId when copy button clicked', async () => {
      render(<ExportCopyControls {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /copy/i }));

      await waitFor(() => {
        expect(defaultProps.onCopy).toHaveBeenCalledTimes(1);
      });
      expect(defaultProps.onCopy).toHaveBeenCalledWith({
        answerId,
      });
    });
  });

  // -------------------------------------------------------------------------
  // TypeInvariant
  // -------------------------------------------------------------------------

  describe('TypeInvariant', () => {
    it('should emit request that satisfies ExportFinalizedAnswerRequestSchema for markdown', async () => {
      render(<ExportCopyControls {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      const emittedRequest = defaultProps.onExport.mock.calls[0][0];
      const parsed = ExportFinalizedAnswerRequestSchema.safeParse(emittedRequest);
      expect(parsed.success).toBe(true);
    });

    it('should emit request that satisfies ExportFinalizedAnswerRequestSchema for plain_text', async () => {
      render(<ExportCopyControls {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /export.*plain text/i }));

      const emittedRequest = defaultProps.onExport.mock.calls[0][0];
      const parsed = ExportFinalizedAnswerRequestSchema.safeParse(emittedRequest);
      expect(parsed.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // ErrorConsistency
  // -------------------------------------------------------------------------

  describe('ErrorConsistency', () => {
    it('should display ANSWER_NOT_FINALIZED error when finalized is false', async () => {
      render(<ExportCopyControls {...defaultProps} finalized={false} />);

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      // Should NOT call handlers
      expect(defaultProps.onExport).not.toHaveBeenCalled();

      // Should display error
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement.textContent).toContain('finalized and locked');
      });
    });

    it('should display ANSWER_NOT_FINALIZED error when locked is false', async () => {
      render(<ExportCopyControls {...defaultProps} locked={false} />);

      await userEvent.click(screen.getByRole('button', { name: /export.*markdown/i }));

      expect(defaultProps.onExport).not.toHaveBeenCalled();

      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement.textContent).toContain('finalized and locked');
      });
    });

    it('should hide copy button when not finalized', async () => {
      render(<ExportCopyControls {...defaultProps} finalized={false} />);

      expect(defaultProps.onCopy).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    });
  });
});
