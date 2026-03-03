'use client';

import { useEffect, useRef, useState } from 'react';
import { frontendLogger } from '@/logging/index';
import { emitNewPathClientEvent } from '@/lib/newPathTelemetryClient';
import type { NewPathEventPayload } from '@/server/data_structures/NewPathEvents';
import { SharedErrors } from '@/server/error_definitions/SharedErrors';

export type ArtifactType = NewPathEventPayload<'artifact_copied_to_clipboard'>['artifact_type'];
export type ArtifactStatus = 'completed' | 'draft' | 'in_progress' | 'failed';

export interface ArtifactCopyButtonProps {
  artifactType: ArtifactType;
  status: ArtifactStatus;
  content: string;
  sessionId?: string;
  userId?: string;
  label?: string;
  className?: string;
  copyHandler?: (content: string) => Promise<void> | void;
  onCopyResult?: (result: { success: boolean; errorMessage?: string }) => void;
}

type FeedbackState = 'idle' | 'copied' | 'failed';

function defaultCopyHandler(content: string): Promise<void> {
  return navigator.clipboard.writeText(content);
}

export function ArtifactCopyButton({
  artifactType,
  status,
  content,
  sessionId = 'unknown_session',
  userId = 'unknown_user',
  label = 'Copy',
  className,
  copyHandler = defaultCopyHandler,
  onCopyResult,
}: ArtifactCopyButtonProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>('idle');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
  }, []);

  if (status !== 'completed') {
    return null;
  }

  const scheduleFeedbackReset = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setFeedbackState('idle');
    }, 2000);
  };

  const handleCopy = async () => {
    if (isCopying) {
      return;
    }

    setIsCopying(true);

    try {
      await copyHandler(content);
      setFeedbackState('copied');
      onCopyResult?.({ success: true });

      void emitNewPathClientEvent('artifact_copied_to_clipboard', {
        artifact_type: artifactType,
        copy_success: true,
        session_id: sessionId,
        user_id: userId,
        source: 'ui',
      });
    } catch (error) {
      const sharedError = SharedErrors.ExportFailed('Failed to copy artifact to clipboard');
      setFeedbackState('failed');
      onCopyResult?.({ success: false, errorMessage: sharedError.message });

      frontendLogger.error('Artifact copy failed', error, {
        component: 'ArtifactCopyButton',
        action: 'copy',
        artifactType,
        sessionId,
      });

      void emitNewPathClientEvent('artifact_copied_to_clipboard', {
        artifact_type: artifactType,
        copy_success: false,
        session_id: sessionId,
        user_id: userId,
        source: 'ui',
        error_code: 'CLIPBOARD_WRITE_FAILED',
      });
    } finally {
      setIsCopying(false);
      scheduleFeedbackReset();
    }
  };

  const buttonText =
    feedbackState === 'copied'
      ? 'Copied!'
      : feedbackState === 'failed'
        ? 'Copy failed'
        : label;

  return (
    <button
      type="button"
      data-testid="artifact-copy-button"
      className={className}
      onClick={handleCopy}
      aria-label={label}
      disabled={isCopying}
    >
      {buttonText}
    </button>
  );
}

export default ArtifactCopyButton;
