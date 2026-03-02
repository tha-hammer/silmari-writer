'use client';

import { useLayoutEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { Message } from '@/lib/types';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageBubble from './MessageBubble';

interface ConversationViewProps {
  messages: Message[];
}

export default function ConversationView({ messages }: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScrollRef = useRef(false);

  useLayoutEffect(() => {
    if (messages.length === 0) {
      didAutoScrollRef.current = false;
      return;
    }

    const container = scrollRef.current;
    if (!container) return;

    const behavior: ScrollBehavior = didAutoScrollRef.current ? 'smooth' : 'auto';
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: container.scrollHeight, behavior });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    didAutoScrollRef.current = true;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 p-4">
        <Card
          className="flex h-full min-h-0 items-center justify-center border-dashed bg-muted/25"
          data-testid="empty-state"
        >
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
            <CardTitle>No messages yet</CardTitle>
            <CardDescription>Start a conversation to get started.</CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 p-4">
      <ScrollArea
        ref={scrollRef}
        className="h-full min-h-0 rounded-xl border bg-card/85 px-4 pb-6 pt-4 shadow-sm"
        data-testid="conversation-view"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div className="h-px" data-testid="messages-end" />
        </div>
      </ScrollArea>
    </div>
  );
}
