'use client';

import { useState } from 'react';
import ConversationView from '@/components/chat/ConversationView';
import { Message } from '@/lib/types';

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'Can you show me a code example in Python?',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: '2',
    role: 'assistant',
    content: `Sure! Here's a simple example:

\`\`\`python
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
\`\`\`

This function takes a **name** parameter and returns a greeting.`,
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
  },
  {
    id: '3',
    role: 'user',
    content: 'Thanks! Can you explain *list comprehensions*?',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: '4',
    role: 'assistant',
    content: `Of course! List comprehensions are a concise way to create lists:

1. Basic syntax: \`[expression for item in iterable]\`
2. With condition: \`[expression for item in iterable if condition]\`

Example:
\`\`\`python
squares = [x**2 for x in range(10)]
even_squares = [x**2 for x in range(10) if x % 2 == 0]
\`\`\``,
    timestamp: new Date(Date.now() - 1 * 60 * 1000),
  },
];

export default function TestConversationPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [showEmpty, setShowEmpty] = useState(false);

  const addMessage = () => {
    const newMessage: Message = {
      id: String(messages.length + 1),
      role: messages.length % 2 === 0 ? 'user' : 'assistant',
      content: `This is message #${messages.length + 1}`,
      timestamp: new Date(),
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-100 p-4 border-b flex gap-2">
        <h1 className="text-lg font-bold flex-1">Test Conversation View</h1>
        <button
          onClick={() => setShowEmpty(!showEmpty)}
          className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
        >
          {showEmpty ? 'Show Messages' : 'Show Empty State'}
        </button>
        <button
          onClick={addMessage}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Add Message
        </button>
      </div>
      <ConversationView messages={showEmpty ? [] : messages} />
    </div>
  );
}
