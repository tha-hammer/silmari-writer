import { Message } from './types';

export async function generateResponse(
  userMessage: string,
  conversationHistory: Message[]
): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      history: conversationHistory.slice(-10), // Last 10 messages for context
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate response');
  }

  const data = await response.json();
  return data.content;
}
