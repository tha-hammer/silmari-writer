# Phase 5: Conversation State & Messages

**Phase**: 5 of 8
**Estimated Effort**: 3-4 hours
**Dependencies**: Phase 1 (setup), Phase 2 (layout)
**Blocks**: Phase 6 (state management), Phase 7 (integration)

## Overview

Implement conversation view component to display messages with role differentiation (user vs AI), markdown rendering with syntax highlighting, auto-scroll to latest message, and empty state handling.

## Behaviors

### Behavior 5.1: Messages Display in Conversation View

**Testable Function**: `ConversationView` component with markdown rendering and auto-scroll

**Test Coverage**:
- ✅ Empty state shows "No messages yet"
- ✅ User messages render right-aligned with blue background
- ✅ AI messages render left-aligned with gray background
- ✅ Markdown renders correctly (bold, italic, lists, code blocks)
- ✅ Code blocks have syntax highlighting
- ✅ Auto-scrolls to bottom on new message
- ✅ Timestamps display in relative format ("2 minutes ago")

## Dependencies

### Requires
- ✅ Phase 1: Project setup, TypeScript
- ✅ Phase 2: Layout (main content area for conversation)

### Blocks
- Phase 6: State management (needs message display logic)
- Phase 7: Integration (needs conversation view for complete flow)

## Changes Required

### New Files Created

#### `/lib/types.ts`
- Lines 2209-2216: Message interface
  ```typescript
  export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: Attachment[];  // For future file attachments
  }

  export interface Attachment {
    id: string;
    filename: string;
    size: number;
    type: string;
  }
  ```

#### `/components/chat/ConversationView.tsx`
- Lines 2220-2297: Basic message list (Green)
  - Props: `messages: Message[]`
  - Empty state when no messages
  - Map over messages, render based on role
  - Basic styling: user=right, assistant=left

- Lines 2302-2369: Enhanced with markdown and auto-scroll (Refactor)
  - ReactMarkdown integration
  - Syntax highlighting with `react-syntax-highlighter`
  - Auto-scroll: `useEffect` with `scrollIntoView()`
  - Relative timestamps: "Just now", "5 minutes ago"
  - Avatar icons (user icon, AI icon)

#### `/components/chat/MessageBubble.tsx`
- Lines 2373-2430: Reusable message bubble component
  - Props: `message: Message`, `align: 'left' | 'right'`
  - Markdown rendering
  - Code block styling
  - Timestamp formatting

#### `/lib/utils.ts`
- Add `formatRelativeTime(date: Date): string`
  ```typescript
  export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  ```

### Test Files Created

#### `/__tests__/components/ConversationView.test.tsx`
- Lines 2130-2267: Conversation view tests
- Empty state test
- Message rendering test (user vs assistant)
- Markdown rendering test
- Auto-scroll test (mock `scrollIntoView`)
- Timestamp formatting test

#### `/__tests__/lib/utils.test.ts`
- Test `formatRelativeTime()` utility
- "Just now" (< 60s)
- "5 minutes ago"
- "2 hours ago"
- "3 days ago"

### Dependencies to Install
```bash
npm install react-markdown remark-gfm  # Markdown rendering with GitHub Flavored Markdown
npm install react-syntax-highlighter @types/react-syntax-highlighter  # Code syntax highlighting
npm install @tailwindcss/typography  # Better markdown styling
npm install lucide-react  # Icons: User, Bot
```

### Tailwind Configuration Update
```javascript
// tailwind.config.ts
module.exports = {
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
```

## Success Criteria

### Automated Tests
- [ ] Tests fail without ConversationView (Red): `npm test -- ConversationView.test`
- [ ] Tests pass with ConversationView (Green): `npm test -- ConversationView.test`
- [ ] Empty state renders correctly
- [ ] User/assistant messages differentiated
- [ ] Markdown renders (headings, lists, code)
- [ ] Auto-scroll works

### Manual Verification

**Human-Testable Function**: `ConversationView` with markdown rendering and auto-scroll

1. **Setup Demo Page**:
   ```typescript
   // app/test-conversation/page.tsx
   import ConversationView from '@/components/chat/ConversationView';
   import { Message } from '@/lib/types';

   const demoMessages: Message[] = [
     {
       id: '1',
       role: 'user',
       content: 'Can you show me a code example in Python?',
       timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
     },
     {
       id: '2',
       role: 'assistant',
       content: `Sure! Here's a simple example:\n\n\`\`\`python\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("World"))\n\`\`\`\n\nThis function takes a **name** parameter and returns a greeting.`,
       timestamp: new Date(Date.now() - 4 * 60 * 1000), // 4 min ago
     },
     {
       id: '3',
       role: 'user',
       content: 'Thanks! Can you explain *list comprehensions*?',
       timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
     },
     {
       id: '4',
       role: 'assistant',
       content: `Of course! List comprehensions are a concise way to create lists:\n\n1. Basic syntax: \`[expression for item in iterable]\`\n2. With condition: \`[expression for item in iterable if condition]\`\n\nExample:\n\`\`\`python\nsquares = [x**2 for x in range(10)]\neven_squares = [x**2 for x in range(10) if x % 2 == 0]\n\`\`\``,
       timestamp: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
     },
   ];

   export default function TestConversationPage() {
     return (
       <div className="h-screen flex flex-col">
         <ConversationView messages={demoMessages} />
       </div>
     );
   }
   ```

2. **Empty State Testing**:
   - Pass empty array: `messages={[]}`
   - Verify message: "No messages yet" or similar
   - Verify centered, grayed out text

3. **Message Alignment Testing**:
   - User messages (role='user'):
     - Aligned to right side
     - Blue background (e.g., `bg-blue-500`)
     - White text
   - Assistant messages (role='assistant'):
     - Aligned to left side
     - Gray background (e.g., `bg-gray-200`)
     - Dark text

4. **Markdown Rendering Testing**:
   - **Bold**: "**name**" → <strong>name</strong>
   - **Italic**: "*list comprehensions*" → <em>list comprehensions</em>
   - **Code inline**: `` `[expression for item]` `` → monospace styling
   - **Code block**:
     ```python
     def greet(name):
         return f"Hello, {name}!"
     ```
     - Syntax highlighting (Python keywords colored)
     - Line numbers (optional)
     - Copy button (optional)

5. **Auto-Scroll Testing**:
   - Add 20 messages to make conversation scrollable
   - Open page → Scrolled to bottom (latest message visible)
   - Manually scroll to top
   - Add new message → Auto-scrolls to bottom
   - Verify smooth scroll animation

6. **Timestamp Testing**:
   - Message from 5 minutes ago → "5 minutes ago"
   - Message from 2 hours ago → "2 hours ago"
   - Message from just now (< 60s) → "Just now"
   - Hover timestamp → Show full date (optional)

### Files to Verify
- [ ] `components/chat/ConversationView.tsx` exports default
- [ ] `components/chat/MessageBubble.tsx` exports default
- [ ] `lib/types.ts` defines Message and Attachment interfaces
- [ ] `lib/utils.ts` exports `formatRelativeTime()`
- [ ] Test files in `__tests__/`
- [ ] No TypeScript errors
- [ ] Markdown renders correctly with syntax highlighting

## Implementation Notes

### ReactMarkdown Configuration
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
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
```

### Auto-Scroll Implementation
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

return (
  <div className="flex-1 overflow-y-auto">
    {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
    <div ref={messagesEndRef} />
  </div>
);
```

### Message Bubble Styling
```typescript
<div className={cn(
  'flex mb-4',
  message.role === 'user' ? 'justify-end' : 'justify-start'
)}>
  <div className={cn(
    'max-w-[70%] rounded-lg px-4 py-2',
    message.role === 'user'
      ? 'bg-blue-500 text-white'
      : 'bg-gray-200 text-gray-900'
  )}>
    <div className="prose prose-sm">
      <ReactMarkdown>{message.content}</ReactMarkdown>
    </div>
    <div className="text-xs opacity-70 mt-1">
      {formatRelativeTime(message.timestamp)}
    </div>
  </div>
</div>
```

## Next Phase

Once `ConversationView` correctly displays messages with markdown rendering:
→ [Phase 6: State Management & API Integration](./2026-01-09-tdd-writing-agent-ui-06-phase-6.md)
