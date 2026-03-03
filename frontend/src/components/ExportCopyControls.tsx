'use client';

/**
 * ExportCopyControls - Provides export and copy controls for finalized answers.
 *
 * Resource: ui-w8p2 (component)
 * Path: 334-export-or-copy-finalized-answer
 *
 * On click:
 *   1. If not finalized || not locked → set error from SharedErrors.ANSWER_NOT_FINALIZED
 *   2. If export → emit validated request with answerId + format
 *   3. If copy → emit copy request with answerId
 */

import { useState } from 'react';
import ArtifactCopyButton from '@/components/ArtifactCopyButton';
import { SharedErrors } from '@/server/error_definitions/SharedErrors';
import type { ExportFormat } from '@/server/data_structures/ExportFormat';

export interface ExportCopyControlsProps {
  answerId: string;
  finalized: boolean;
  locked: boolean;
  content: string;
  onExport: (request: { answerId: string; format: ExportFormat }) => void;
  onCopy: (request: { answerId: string }) => Promise<void> | void;
  onCopyResult?: (result: { success: boolean; errorMessage?: string }) => void;
}

export default function ExportCopyControls({
  answerId,
  finalized,
  locked,
  content,
  onExport,
  onCopy,
  onCopyResult,
}: ExportCopyControlsProps) {
  const [error, setError] = useState<string | null>(null);

  const validateState = (): boolean => {
    if (!finalized || !locked) {
      const sharedError = SharedErrors.AnswerNotFinalized();
      setError(sharedError.message);
      return false;
    }
    setError(null);
    return true;
  };

  const handleExport = (format: ExportFormat) => {
    if (!validateState()) return;
    onExport({ answerId, format });
  };

  const artifactStatus = finalized && locked ? 'completed' : 'draft';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => handleExport('markdown')}
          aria-label="Export Markdown"
        >
          Export Markdown
        </button>

        <button
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-gray-50 transition-colors"
          onClick={() => handleExport('plain_text')}
          aria-label="Export Plain Text"
        >
          Export Plain Text
        </button>

        <ArtifactCopyButton
          artifactType="answer"
          status={artifactStatus}
          content={content}
          sessionId={answerId}
          label="Copy to Clipboard"
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-gray-50 transition-colors"
          copyHandler={async () => {
            if (!validateState()) {
              throw SharedErrors.AnswerNotFinalized();
            }

            await onCopy({ answerId });
          }}
          onCopyResult={onCopyResult}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
