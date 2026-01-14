# Phase 4: Audio Recording & Transcription

**Phase**: 4 of 8
**Estimated Effort**: 6-8 hours
**Dependencies**: Phase 1 (setup, env vars)
**Blocks**: Phase 7 (integration)

## Overview

Implement MediaRecorder API integration for browser-based audio recording with waveform visualization, playback preview, and 5-minute recording limit. Integrate OpenAI Whisper API for transcription with retry logic, error handling, and 25MB file size validation.

## Behaviors

### Behavior 4.1: User Can Record Audio

**Testable Function**: `AudioRecorder` component with `onRecordingComplete(audioBlob: Blob)` callback

**Test Coverage**:
- ✅ Microphone permission requested
- ✅ Recording starts on button click
- ✅ Recording indicator shows elapsed time
- ✅ Recording stops at 5-minute limit
- ✅ Audio blob returned on completion
- ✅ Playback preview works before send
- ✅ Re-record clears previous recording

### Behavior 4.2: Audio Transcribes via Whisper API

**Testable Function**: `transcribeAudio(audioBlob, options)` - async function with retry logic

**Test Coverage**:
- ✅ Audio blob converts to FormData
- ✅ POST request to OpenAI Whisper API
- ✅ Successful response returns transcription text
- ✅ Retry logic on 429 (rate limit) errors
- ✅ File size >25MB rejected with error
- ✅ Network errors handled gracefully
- ✅ API key validation before request

## Dependencies

### Requires
- ✅ Phase 1: Environment variables (OPENAI_API_KEY)
- MediaRecorder API (browser support check needed)
- OpenAI API account with Whisper access

### Blocks
- Phase 7: Integration (needs audio recording for complete flow)

## Changes Required

### New Files Created

#### `/components/chat/AudioRecorder.tsx`
- Lines 1527-1669: Basic MediaRecorder integration (Green)
  - State: `isRecording`, `audioBlob`, `mediaRecorder`, `recordingTime`
  - `startRecording()`: Request mic permission, initialize MediaRecorder
  - `stopRecording()`: Stop recording, save blob
  - Constants: `MAX_RECORDING_TIME_MS = 5 * 60 * 1000` (5 minutes)

- Lines 1674-1824: Enhanced with playback and visualization (Refactor)
  - Playback preview using HTML5 `<audio>` element
  - Timer display: MM:SS format
  - Auto-stop at 5-minute limit
  - Re-record functionality
  - Error handling for permission denied

#### `/lib/transcription.ts`
- Lines 1934-2010: Basic Whisper API call (Green)
  ```typescript
  export async function transcribeAudio(
    audioBlob: Blob,
    options?: TranscriptionOptions
  ): Promise<string> {
    // Validate file size
    if (audioBlob.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();
    return data.text;
  }
  ```

- Lines 2015-2109: Enhanced with retry logic and error handling (Refactor)
  - Constants: `MAX_FILE_SIZE_MB = 25`, `MAX_RETRIES = 3`, `RETRY_DELAY_MS = 1000`
  - Exponential backoff: delay = 1s, 2s, 4s
  - Error types: `TranscriptionError` with codes (RATE_LIMIT, FILE_TOO_LARGE, NETWORK)
  - Retry on 429 and 500 errors
  - Log warnings on retries

### Test Files Created

#### `/__tests__/components/AudioRecorder.test.tsx`
- Lines 1397-1553: Audio recorder tests
- Mock MediaRecorder API
- Permission request handling
- Recording state transitions
- Timer functionality
- Blob creation

#### `/__tests__/lib/transcription.test.ts`
- Lines 1848-2010: Transcription tests
- Mock fetch API
- File size validation test
- Successful transcription test
- Retry logic test (429 error → retry → success)
- Error handling test (invalid API key)

### Types/Interfaces

#### `/lib/types.ts`
```typescript
export interface TranscriptionOptions {
  language?: string;        // ISO 639-1 code (e.g., 'en', 'es')
  prompt?: string;          // Context hint for Whisper
  temperature?: number;     // 0-1, sampling temperature
}

export interface TranscriptionError extends Error {
  code: 'RATE_LIMIT' | 'FILE_TOO_LARGE' | 'NETWORK' | 'INVALID_API_KEY';
  retryable: boolean;
}
```

### Dependencies to Install
```bash
npm install lucide-react  # Icons: Mic, Square, Play, RotateCcw
```

## Success Criteria

### Automated Tests
- [ ] Tests fail without AudioRecorder (Red): `npm test -- AudioRecorder.test`
- [ ] Tests pass with AudioRecorder (Green): `npm test -- AudioRecorder.test`
- [ ] Permission handling works
- [ ] Tests fail without transcription (Red): `npm test -- transcription.test`
- [ ] Tests pass with transcription (Green): `npm test -- transcription.test`
- [ ] File size validation works
- [ ] Retry logic works (3 retries with backoff)

### Manual Verification

**Human-Testable Function**: `transcribeAudio()` with real audio

1. **Setup Demo Page**:
   ```typescript
   // app/test-audio/page.tsx
   import AudioRecorder from '@/components/chat/AudioRecorder';
   import { transcribeAudio } from '@/lib/transcription';

   export default function TestAudioPage() {
     const [transcription, setTranscription] = useState('');
     const [loading, setLoading] = useState(false);

     const handleRecordingComplete = async (blob: Blob) => {
       setLoading(true);
       try {
         const text = await transcribeAudio(blob, { language: 'en' });
         setTranscription(text);
       } catch (error) {
         console.error('Transcription failed:', error);
       } finally {
         setLoading(false);
       }
     };

     return (
       <div className="p-8">
         <AudioRecorder onRecordingComplete={handleRecordingComplete} />
         {loading && <p>Transcribing...</p>}
         {transcription && <p>Transcription: {transcription}</p>}
       </div>
     );
   }
   ```

2. **Recording Testing**:
   - Click "Record" button
   - Browser prompts for microphone permission → Click "Allow"
   - Recording indicator shows (red dot + timer: "00:01", "00:02", ...)
   - Speak: "This is a test recording for the writing agent"
   - Click "Stop" after 10 seconds
   - Timer stops at "00:10"
   - Playback button appears

3. **Playback Testing**:
   - Click "Play" button
   - Audio plays back through speakers
   - Verify voice is clear and correct

4. **Re-record Testing**:
   - Click "Re-record" button
   - Previous recording cleared
   - Click "Record" again → New recording starts
   - Timer resets to "00:00"

5. **5-Minute Limit Testing**:
   - Start recording
   - Wait or fast-forward timer to 4:59
   - At 5:00, recording auto-stops
   - Verify audio blob created

6. **Transcription Testing** (requires OPENAI_API_KEY):
   - Record audio: "The quick brown fox jumps over the lazy dog"
   - Click "Send" or trigger `onRecordingComplete`
   - Loading indicator shows: "Transcribing..."
   - After 2-5 seconds, transcription appears
   - Verify text accuracy: Should match spoken words closely

7. **Error Handling Testing**:
   - **File Too Large**:
     - Create >25MB audio file
     - Attempt transcription
     - Expect error: "File size exceeds 25MB limit"

   - **Invalid API Key**:
     - Set `OPENAI_API_KEY=invalid-key`
     - Attempt transcription
     - Expect error with code `INVALID_API_KEY`

   - **Rate Limit** (hard to test, mock instead):
     - Verify retry logic in tests
     - 429 error → wait 1s → retry

### Files to Verify
- [ ] `components/chat/AudioRecorder.tsx` exports default
- [ ] `lib/transcription.ts` exports `transcribeAudio()`
- [ ] `.env.local` has valid `OPENAI_API_KEY`
- [ ] Test files in `__tests__/`
- [ ] No TypeScript errors
- [ ] MediaRecorder works in Chrome/Firefox/Safari
- [ ] Whisper API returns accurate transcriptions

## Implementation Notes

### MediaRecorder API Support
- **Supported**: Chrome 49+, Firefox 25+, Safari 14+
- **MIME Type**: `audio/webm` (Chrome/Firefox), `audio/mp4` (Safari)
- Detection:
  ```typescript
  const mimeType = MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : 'audio/mp4';
  ```

### Timer Implementation
```typescript
const [recordingTime, setRecordingTime] = useState(0);

useEffect(() => {
  if (!isRecording) return;

  const interval = setInterval(() => {
    setRecordingTime(prev => {
      const next = prev + 1;
      if (next >= MAX_RECORDING_TIME_MS / 1000) {
        stopRecording();
      }
      return next;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isRecording]);

// Format: MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
```

### Retry Logic with Exponential Backoff
```typescript
async function transcribeWithRetry(blob: Blob, retries = 0): Promise<string> {
  try {
    return await transcribeAudio(blob);
  } catch (error) {
    if (retries < MAX_RETRIES && error.code === 'RATE_LIMIT') {
      const delay = RETRY_DELAY_MS * Math.pow(2, retries);
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return transcribeWithRetry(blob, retries + 1);
    }
    throw error;
  }
}
```

### OpenAI Whisper API Endpoint
- **URL**: `https://api.openai.com/v1/audio/transcriptions`
- **Method**: POST
- **Auth**: `Bearer ${OPENAI_API_KEY}`
- **Body**: FormData with `file` and `model=whisper-1`
- **Response**: `{ text: "transcribed text..." }`

## Next Phase

Once `transcribeAudio()` successfully transcribes audio with retry logic:
→ [Phase 5: Conversation State & Messages](./2026-01-09-tdd-writing-agent-ui-05-phase-5.md)
