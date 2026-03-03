'use client';

/**
 * FinalizedAnswerModule - Frontend module managing export and copy flows
 * for finalized answers.
 *
 * Resource: ui-v3n6 (module)
 * Path: 334-export-or-copy-finalized-answer
 *
 * Manages:
 * - Finalized answer state (finalized, locked)
 * - Export flow: API → transform → file download
 * - Copy flow: clipboard write → success confirmation
 * - Error display and logging
 */

import { useState } from 'react';
import ExportCopyControls from '@/components/ExportCopyControls';
import { loadFinalizedAnswer } from '@/data_loaders/loadFinalizedAnswer';
import { frontendLogger } from '@/logging/index';
import { SharedErrors } from '@/server/error_definitions/SharedErrors';
import type { ExportFormat } from '@/server/data_structures/ExportFormat';

export interface FinalizedAnswerState {
  id: string;
  status: string;
  finalized: boolean;
  locked: boolean;
  editable: boolean;
  content: string;
}

export interface FinalizedAnswerModuleProps {
  answerId: string;
  initialAnswer: FinalizedAnswerState;
}

export default function FinalizedAnswerModule({
  answerId,
  initialAnswer,
}: FinalizedAnswerModuleProps) {
  const [answer] = useState<FinalizedAnswerState>(initialAnswer);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async (request: { answerId: string; format: ExportFormat }) => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Step 2: Load finalized answer content via API
      const response = await loadFinalizedAnswer({
        answerId: request.answerId,
        format: request.format,
      });

      // Step 4: Deliver export - trigger file download
      const mimeType = request.format === 'markdown' ? 'text/markdown' : 'text/plain';
      const extension = request.format === 'markdown' ? 'md' : 'txt';
      const blob = new Blob([response.content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `answer-${request.answerId}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Answer exported as ${request.format === 'markdown' ? 'Markdown' : 'Plain Text'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      frontendLogger.error('Export failed', err, {
        module: 'FinalizedAnswerModule',
        action: 'export',
        answerId: request.answerId,
        format: request.format,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (request: { answerId: string }) => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Step 4: Deliver copy - write to clipboard
      await navigator.clipboard.writeText(answer.content);
      setSuccess('Answer copied to clipboard');
    } catch (err) {
      const sharedError = SharedErrors.ExportFailed('Failed to copy answer to clipboard');
      setError(sharedError.message);
      frontendLogger.error('Clipboard write failed', err, {
        module: 'FinalizedAnswerModule',
        action: 'copy',
        answerId: request.answerId,
      });
      throw sharedError;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Answer Status */}
      <div data-testid="answer-status" className="text-sm font-medium">
        {answer.finalized ? 'Finalized' : answer.status}
      </div>

      {/* Answer Content */}
      <div className="prose" data-testid="answer-content">
        {answer.content}
      </div>

      {/* Export/Copy Controls */}
      {answer.finalized && answer.locked && (
        <ExportCopyControls
          answerId={answerId}
          finalized={answer.finalized}
          locked={answer.locked}
          content={answer.content}
          onExport={handleExport}
          onCopy={handleCopy}
          onCopyResult={({ success, errorMessage }) => {
            if (success) {
              setSuccess('Answer copied to clipboard');
              setError(null);
              return;
            }

            setSuccess(null);
            setError(errorMessage ?? SharedErrors.ExportFailed().message);
          }}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div data-testid="loading-indicator" className="text-sm text-gray-500">
          Processing...
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div data-testid="success-message" className="text-sm text-green-600" role="status">
          {success}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-600" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
