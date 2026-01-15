'use client';

import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { Message } from '@/lib/types';
import MessageBubble from './MessageBubble';

interface ConversationViewProps {
  messages: Message[];
}

export default function ConversationView({ messages }: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-gray-400"
        data-testid="empty-state"
      >
        <MessageSquare className="w-12 h-12 mb-2" />
        <p className="text-lg">No messages yet</p>
        <p className="text-sm">Start a conversation to get started</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4" data-testid="conversation-view">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={messagesEndRef} data-testid="messages-end" />
    </div>
  );
}
