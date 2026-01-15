import { TranscriptionOptions, TranscriptionError } from './types'

// Constants
export const MAX_FILE_SIZE_MB = 25
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/**
 * Transcribes audio using the server-side API route
 * The API route handles the OpenAI Whisper call with the API key securely
 *
 * @param audioBlob - Audio file as a Blob (max 25MB)
 * @param options - Optional transcription settings (language)
 * @returns Transcribed text
 * @throws TranscriptionError with appropriate error code
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options?: TranscriptionOptions
): Promise<string> {
  // Validate file size client-side for immediate feedback
  if (audioBlob.size > MAX_FILE_SIZE_BYTES) {
    throw new TranscriptionError(
      `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
      'FILE_TOO_LARGE',
      false
    )
  }

  const formData = new FormData()

  // Determine file extension based on blob type
  const extension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
  formData.append('file', audioBlob, `recording.${extension}`)

  // Add optional language parameter
  if (options?.language) {
    formData.append('language', options.language)
  }

  let response: Response
  try {
    // Call the server-side API route (which has access to OPENAI_API_KEY)
    response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    })
  } catch (error) {
    throw new TranscriptionError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK',
      true
    )
  }

  const data = await response.json()

  if (!response.ok) {
    throw new TranscriptionError(
      data.error || 'Transcription failed',
      data.code || 'API_ERROR',
      data.retryable ?? false
    )
  }

  return data.text
}
