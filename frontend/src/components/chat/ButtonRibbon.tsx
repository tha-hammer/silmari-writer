'use client';

import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Send, Edit } from 'lucide-react';
import { useConversationStore } from '@/lib/store';
import { regenerateMessage } from '@/lib/messageActions';
import EditMessageModal from './EditMessageModal';
import { useButtonAnalytics } from '@/hooks/useButtonAnalytics';

interface ButtonRibbonProps {
  messageId: string;
  content: string;
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner = ({ size = 'sm', className }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={`${sizeClasses[size]} border-2 border-current border-t-transparent rounded-full animate-spin ${className || ''}`}
      data-testid="loading-spinner"
    />
  );
};

export default function ButtonRibbon({ messageId, content }: ButtonRibbonProps) {
  const {
    buttonStates,
    isMessageBlocked,
    setNonBlockingOperation,
    clearNonBlockingOperation,
    startBlockingOperation,
    completeBlockingOperation,
    failBlockingOperation,
  } = useConversationStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const buttonState = buttonStates[messageId];
  const isBlocked = isMessageBlocked(messageId);
  const blockingOperation = buttonState?.blockingOperation;
  const copyState = buttonState?.copy;

  // Analytics hooks for each button type
  const copyAnalytics = useButtonAnalytics('copy', messageId);
  const regenerateAnalytics = useButtonAnalytics('regenerate', messageId);
  const editAnalytics = useButtonAnalytics('edit', messageId);

  // Auto-clear copy state after 2 seconds
  // Note: clearNonBlockingOperation is stable (from Zustand), safe to depend on
  useEffect(() => {
    if (copyState?.isActive) {
      const timer = setTimeout(() => {
        clearNonBlockingOperation(messageId, 'copy');
      }, 2000);

      return () => clearTimeout(timer); // Cleanup on unmount
    }
  }, [copyState?.isActive, messageId, clearNonBlockingOperation]);

  const handleCopy = async () => {
    const startTime = Date.now();
    await copyAnalytics.trackClick();

    try {
      await navigator.clipboard.writeText(content);
      setNonBlockingOperation(messageId, 'copy');
      await copyAnalytics.trackSuccess(startTime);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      await copyAnalytics.trackError(error instanceof Error ? error : 'Copy failed');
    }
  };

  const handleRegenerate = async () => {
    const startTime = Date.now();
    await regenerateAnalytics.trackClick();

    const controller = new AbortController();
    startBlockingOperation(messageId, 'regenerate');

    try {
      // Get current messages from store
      const messages = useConversationStore.getState().messages;
      const projectId = useConversationStore.getState().activeProjectId;

      if (!projectId) {
        throw new Error('No active project');
      }

      // Call regenerate API with abort signal
      const newMessage = await regenerateMessage(messageId, projectId, messages, {
        signal: controller.signal
      });

      // Remove old message and add new one (handled by parent component or API)
      completeBlockingOperation(messageId);
      await regenerateAnalytics.trackSuccess(startTime);
    } catch (error) {
      // Silent fail on user-initiated abort
      if (error instanceof Error && error.name === 'AbortError') return;
      const errorMessage = error instanceof Error ? error.message : 'Regeneration failed';
      failBlockingOperation(messageId, errorMessage);
      await regenerateAnalytics.trackError(errorMessage);
    }

    // Return cleanup function for component unmount
    return () => controller.abort();
  };

  const handleEditClick = async () => {
    await editAnalytics.trackClick();
    setIsEditModalOpen(true);
    startBlockingOperation(messageId, 'edit');
  };

  const handleEditSave = async (newContent: string) => {
    const startTime = Date.now();
    // Update message in store (synchronous operation)
    // Future: Add async API call here when backend sync is implemented
    try {
      // TODO: Get updateMessage from store
      // updateMessage(messageId, { content: newContent });
      setIsEditModalOpen(false);
      completeBlockingOperation(messageId);
      await editAnalytics.trackSuccess(startTime);
    } catch (error) {
      const errorMessage = 'Failed to save changes';
      failBlockingOperation(messageId, errorMessage);
      await editAnalytics.trackError(errorMessage);
    }
  };

  const handleEditCancel = () => {
    setIsEditModalOpen(false);
    completeBlockingOperation(messageId);
  };

  const buttonBaseClasses = "flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
    <div className="mt-2 flex items-center gap-2">
      {/* Copy button (non-blocking) */}
      <button
        className={buttonBaseClasses}
        onClick={handleCopy}
        aria-label="Copy message"
      >
        <Copy className="w-4 h-4" />
        {copyState?.isActive ? 'Copied!' : 'Copy'}
      </button>

      {/* Regenerate button (blocking) */}
      <button
        className={buttonBaseClasses}
        onClick={handleRegenerate}
        disabled={isBlocked}
        aria-label="Regenerate message"
      >
        {blockingOperation?.type === 'regenerate' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        Regenerate
      </button>

      {/* Send to API button (blocking) */}
      <button
        className={buttonBaseClasses}
        disabled={isBlocked}
        aria-label="Send to API"
      >
        {blockingOperation?.type === 'sendToAPI' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Send to API
      </button>

      {/* Edit button (blocking) */}
      <button
        className={buttonBaseClasses}
        onClick={handleEditClick}
        disabled={isBlocked}
        aria-label="Edit message"
      >
        {blockingOperation?.type === 'edit' && blockingOperation.isLoading ? (
          <LoadingSpinner />
        ) : (
          <Edit className="w-4 h-4" />
        )}
        Edit
      </button>

      {/* Error message display */}
      {blockingOperation?.error && (
        <div className="text-sm text-red-600 ml-2">
          {blockingOperation.error}
        </div>
      )}
    </div>

    <EditMessageModal
      isOpen={isEditModalOpen}
      content={content}
      onSave={handleEditSave}
      onCancel={handleEditCancel}
    />
    </>
  );
}
