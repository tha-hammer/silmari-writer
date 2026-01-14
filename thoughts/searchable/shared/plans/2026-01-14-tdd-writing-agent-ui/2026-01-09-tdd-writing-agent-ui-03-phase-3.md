# Phase 3: Message Input & File Attachments

**Phase**: 3 of 8
**Estimated Effort**: 4-6 hours
**Dependencies**: Phase 1 (setup), Phase 2 (layout)
**Blocks**: Phase 7 (integration)

## Overview

Implement message input with auto-resizing textarea, keyboard shortcuts (Enter to send, Shift+Enter for newline), and file attachment component with drag-and-drop, file size validation (10MB limit), and file preview.

## Behaviors

### Behavior 3.1: User Can Type and Send Messages

**Testable Function**: `MessageInput` component with `onSendMessage(content: string)` callback

**Test Coverage**:
- ✅ Textarea renders and accepts input
- ✅ Send button disabled when empty
- ✅ Send button enabled when text present
- ✅ Enter key triggers send (desktop)
- ✅ Shift+Enter adds newline
- ✅ Textarea clears after send
- ✅ Auto-resize as content grows

### Behavior 3.2: User Can Attach Files

**Testable Function**: `FileAttachment` component with `validateAndAddFiles()` and drag-drop handlers

**Test Coverage**:
- ✅ File input accepts clicks
- ✅ Drag-and-drop zone highlights on drag-over
- ✅ Files under 10MB accepted
- ✅ Files over 10MB rejected with error
- ✅ Multiple files can be attached
- ✅ Files can be removed before send
- ✅ File list displays names and sizes

## Dependencies

### Requires
- ✅ Phase 1: Project setup, testing framework
- ✅ Phase 2: Layout structure (main content area)

### Blocks
- Phase 7: Integration (needs message input for complete flow)

## Changes Required

### New Files Created

#### `/components/chat/MessageInput.tsx`
- Lines 849-917: Basic textarea with send button (Green)
- Lines 922-988: Enhanced with keyboard shortcuts and auto-resize (Refactor)
- Props: `onSendMessage`, `disabled`, `placeholder`
- State: `content` (textarea value)
- Handlers: `handleSubmit()`, `handleKeyDown()`
- Auto-resize: Adjust height based on scrollHeight

#### `/components/chat/FileAttachment.tsx`
- Lines 1114-1228: Basic file input (Green)
- Lines 1233-1358: Enhanced with drag-and-drop and validation (Refactor)
- Props: `onFilesChange`, `maxFiles`, `maxSizeBytes`
- State: `files`, `dragActive`, `error`
- Handlers: `validateAndAddFiles()`, `handleDrop()`, `handleDragOver()`, `removeFile()`
- Constants: `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024` (10MB)

#### `/lib/utils.ts`
- Lines 1362-1374: `formatBytes(bytes: number)` utility
  ```typescript
  export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  ```

### Test Files Created

#### `/__tests__/components/MessageInput.test.tsx`
- Lines 758-842: Message input tests
- Empty state: send button disabled
- Text input: send button enabled
- Enter key: triggers send
- Shift+Enter: adds newline
- Content clears after send

#### `/__tests__/components/FileAttachment.test.tsx`
- Lines 1008-1110: File attachment tests
- File size validation (accept <10MB, reject >10MB)
- Multiple file handling
- File removal
- Drag-and-drop zone activation
- Error message display

### Dependencies to Install
```bash
npm install lucide-react  # Icons: Send, Paperclip, X, Upload
```

## Success Criteria

### Automated Tests
- [ ] Tests fail without MessageInput (Red): `npm test -- MessageInput.test`
- [ ] Tests pass with MessageInput (Green): `npm test -- MessageInput.test`
- [ ] Enter key sends, Shift+Enter adds newline
- [ ] Tests fail without FileAttachment (Red): `npm test -- FileAttachment.test`
- [ ] Tests pass with FileAttachment (Green): `npm test -- FileAttachment.test`
- [ ] File size validation works (>10MB rejected)

### Manual Verification

**Human-Testable Function**: `FileAttachment` with drag-and-drop validation

1. **Setup Demo Page**:
   ```typescript
   // app/test/page.tsx
   import MessageInput from '@/components/chat/MessageInput';
   import FileAttachment from '@/components/chat/FileAttachment';

   export default function TestPage() {
     const [message, setMessage] = useState('');
     const [files, setFiles] = useState<File[]>([]);

     return (
       <div className="p-8 max-w-2xl mx-auto">
         <MessageInput
           onSendMessage={(content) => {
             console.log('Sending:', content, 'with files:', files);
             setMessage('');
             setFiles([]);
           }}
           placeholder="Type a message..."
         />
         <FileAttachment
           onFilesChange={setFiles}
           maxFiles={5}
           maxSizeBytes={10 * 1024 * 1024}
         />
       </div>
     );
   }
   ```

2. **Message Input Testing**:
   - Type "Hello world" → Send button enabled
   - Click Send → Message sent, textarea cleared
   - Type "Line 1" + Shift+Enter + "Line 2" → Two lines appear
   - Press Enter → Message sent with newline
   - Type long text → Textarea grows vertically (auto-resize)

3. **File Attachment Testing**:
   - **Click to Upload**:
     - Click "Attach files" button
     - File picker opens
     - Select file <10MB (e.g., 5MB image)
     - File appears in list with name and size

   - **Drag-and-Drop**:
     - Drag file over drop zone
     - Zone highlights with border/background change
     - Drop file → Added to list
     - Drop file >10MB → Error message: "File exceeds 10MB limit"

   - **File Management**:
     - Attach 3 files → All show in list
     - Click X on second file → Removed from list
     - Attach 5 files total → All accepted (maxFiles=5)

   - **Size Display**:
     - 1500 bytes → "1.46 KB"
     - 5242880 bytes → "5 MB"
     - Verify formatBytes() utility works

4. **Integration Testing**:
   - Type message + attach 2 files
   - Click Send
   - Console logs: "Sending: [message] with files: [File, File]"
   - Both message and files clear

### Files to Verify
- [ ] `components/chat/MessageInput.tsx` exports default
- [ ] `components/chat/FileAttachment.tsx` exports default
- [ ] `lib/utils.ts` exports `formatBytes()`
- [ ] Test files in `__tests__/components/`
- [ ] No TypeScript errors
- [ ] Textarea auto-resizes correctly
- [ ] File validation works as expected

## Implementation Notes

### Keyboard Shortcuts
- **Enter**: Submit message (unless Shift held)
- **Shift+Enter**: Insert newline
- Implementation: Check `event.shiftKey` in `handleKeyDown()`

### Auto-Resize Textarea
```typescript
const textareaRef = useRef<HTMLTextAreaElement>(null);

useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
  }
}, [content]);
```

### File Validation Logic
```typescript
function validateAndAddFiles(fileList: FileList) {
  const validFiles: File[] = [];
  const errors: string[] = [];

  Array.from(fileList).forEach(file => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`${file.name} exceeds 10MB limit`);
    } else {
      validFiles.push(file);
    }
  });

  if (errors.length) setError(errors.join(', '));
  setFiles(prev => [...prev, ...validFiles]);
}
```

### shadcn/ui Components Used
- `Button` (Send, Attach, Remove)
- `Textarea` (may need to create as shadcn component)
- `Card` (for file list items)

## Next Phase

Once `FileAttachment` correctly validates files and drag-and-drop works:
→ [Phase 4: Audio Recording & Transcription](./2026-01-09-tdd-writing-agent-ui-04-phase-4.md)
