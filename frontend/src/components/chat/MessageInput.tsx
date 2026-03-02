'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  placeholder?: string
  disabled?: boolean
}

export default function MessageInput({
  onSendMessage,
  placeholder = 'Type a message...',
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed) return

    onSendMessage(trimmed)
    setContent('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    // Shift+Enter is handled by default (adds newline)
  }

  const isEmpty = content.trim() === ''
  const isDisabled = disabled || isEmpty

  return (
    <div className="rounded-xl border bg-card/90 p-3 shadow-sm">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Message input"
        />
        <Button
          onClick={handleSubmit}
          disabled={isDisabled}
          aria-label="Send message"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
        >
        <Send className="h-5 w-5" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Press Enter to send. Use Shift+Enter for a newline.
      </p>
    </div>
  )
}
