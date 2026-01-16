/**
 * Message action handlers for ButtonRibbon operations
 */

import { Message } from './types';

export interface RegenerateMessageOptions {
  signal?: AbortSignal;
}

/**
 * Regenerate an assistant message by re-sending the conversation context
 * @param messageId - ID of the message to regenerate
 * @param _projectId - Active project ID (unused, kept for API compatibility)
 * @param messages - All messages in the conversation
 * @param options - Optional AbortSignal for cancellation
 * @returns New assistant message from API
 */
export async function regenerateMessage(
  messageId: string,
  _projectId: string,
  messages: Message[],
  options?: RegenerateMessageOptions
): Promise<Message> {
  // 1. Find the message to regenerate
  const messageIndex = messages.findIndex(m => m.id === messageId);
  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // 2. Get context up to (but not including) this message
  const context = messages.slice(0, messageIndex);

  // 3. Find the last user message
  const lastUserMessage = [...context].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) {
    throw new Error('No user message found for regeneration');
  }

  // 4. Call API with context and abort signal
  // API expects: { message: string, history: Message[] }
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: lastUserMessage.content,
      history: context,
    }),
    signal: options?.signal, // Support cancellation
  });

  if (!response.ok) {
    throw new Error('API call failed');
  }

  const data = await response.json();

  // API returns { content: string }, construct a Message object
  const newMessage: Message = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: data.content,
    timestamp: new Date(),
  };

  return newMessage;
}
