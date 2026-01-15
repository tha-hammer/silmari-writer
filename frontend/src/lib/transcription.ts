import { TranscriptionOptions, TranscriptionError } from './types'

// Constants
export const MAX_FILE_SIZE_MB = 25
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Transcribes audio using OpenAI Whisper API with retry logic
 *
 * @param audioBlob - Audio file as a Blob (max 25MB)
 * @param options - Optional transcription settings (language, prompt, temperature)
 * @returns Transcribed text
 * @throws TranscriptionError with appropriate error code
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options?: TranscriptionOptions
): Promise<string> {
  // Validate file size
  if (audioBlob.size > MAX_FILE_SIZE_BYTES) {
    throw new TranscriptionError(
      `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
      'FILE_TOO_LARGE',
      false
    )
  }

  return transcribeWithRetry(audioBlob, options, 0)
}

async function transcribeWithRetry(
  audioBlob: Blob,
  options: TranscriptionOptions | undefined,
  retries: number
): Promise<string> {
  try {
    return await makeTranscriptionRequest(audioBlob, options)
  } catch (error) {
    if (error instanceof TranscriptionError && error.retryable && retries < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retries)
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return transcribeWithRetry(audioBlob, options, retries + 1)
    }
    throw error
  }
}

async function makeTranscriptionRequest(
  audioBlob: Blob,
  options?: TranscriptionOptions
): Promise<string> {
  const formData = new FormData()

  // Determine file extension based on blob type
  const extension = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
  formData.append('file', audioBlob, `recording.${extension}`)
  formData.append('model', 'whisper-1')

  // Add optional parameters
  if (options?.language) {
    formData.append('language', options.language)
  }
  if (options?.prompt) {
    formData.append('prompt', options.prompt)
  }
  if (options?.temperature !== undefined) {
    formData.append('temperature', options.temperature.toString())
  }

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    })
  } catch (error) {
    throw new TranscriptionError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK',
      true
    )
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    const errorMessage = errorData.error?.message || 'Unknown API error'

    switch (response.status) {
      case 401:
        throw new TranscriptionError(
          `Invalid API key: ${errorMessage}`,
          'INVALID_API_KEY',
          false
        )
      case 429:
        throw new TranscriptionError(
          `Rate limit exceeded: ${errorMessage}`,
          'RATE_LIMIT',
          true
        )
      case 500:
      case 502:
      case 503:
      case 504:
        throw new TranscriptionError(
          `Server error: ${errorMessage}`,
          'API_ERROR',
          true
        )
      default:
        throw new TranscriptionError(
          `API error (${response.status}): ${errorMessage}`,
          'API_ERROR',
          false
        )
    }
  }

  const data = await response.json()
  return data.text
}
