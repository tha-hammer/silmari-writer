'use client';

import { User, Bot, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Message } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatBytes, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ButtonRibbon from './ButtonRibbon';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex w-full items-end gap-3', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`message-${message.id}`}
    >
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-secondary text-secondary-foreground">
            <Bot className="h-4 w-4" aria-label="AI" />
          </div>
        </div>
      )}
      <div className={cn('flex max-w-[82%] flex-col gap-1', isUser && 'items-end')}>
        {message.isVoiceTranscription && (
          <Badge variant={isUser ? 'secondary' : 'outline'} className="uppercase tracking-wide">
            Voice transcription
          </Badge>
        )}

        <Card
          className={cn(
            'overflow-hidden border shadow-sm',
            isUser ? 'border-primary/40 bg-primary text-primary-foreground' : 'bg-card',
          )}
          data-role={message.role}
        >
          <CardContent className="space-y-3 px-4 py-3">
            <div
              className={cn(
                'prose prose-sm max-w-none [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-3',
                isUser ? 'prose-invert' : 'prose-neutral',
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeString = String(children).replace(/\n$/, '');
                    // Only use SyntaxHighlighter for multi-line code blocks
                    const isBlock = codeString.includes('\n') || match;
                    return isBlock && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {message.attachments && message.attachments.length > 0 && (
              <div data-testid="attachment-list" className="space-y-1.5">
                {message.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
                      isUser
                        ? 'border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground'
                        : 'border-border bg-muted/60 text-muted-foreground',
                    )}
                  >
                    <Paperclip className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{attachment.filename}</span>
                    <span className="ml-auto flex-shrink-0 opacity-75">{formatBytes(attachment.size)}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              className={cn(
                'text-xs',
                isUser ? 'text-primary-foreground/75' : 'text-muted-foreground',
              )}
              data-testid="message-timestamp"
            >
              {formatRelativeTime(message.timestamp)}
            </div>
          </CardContent>
        </Card>

        {/* ButtonRibbon for assistant messages only */}
        {!isUser && (
          <ButtonRibbon messageId={message.id} content={message.content} />
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground">
            <User className="h-4 w-4" aria-label="User" />
          </div>
        </div>
      )}
    </div>
  );
}
