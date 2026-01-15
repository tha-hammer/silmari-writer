import { NextRequest, NextResponse } from 'next/server'

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', code: 'NO_FILE' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`, code: 'FILE_TOO_LARGE', retryable: false },
        { status: 400 }
      )
    }

    // Validate API key exists server-side
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Transcription service not configured', code: 'CONFIG_ERROR', retryable: false },
        { status: 500 }
      )
    }

    // Get optional language parameter
    const language = formData.get('language') as string | null

    // Build OpenAI request FormData
    const openaiFormData = new FormData()
    const extension = file.type.includes('mp4') ? 'mp4' : 'webm'
    openaiFormData.append('file', file, `recording.${extension}`)
    openaiFormData.append('model', 'whisper-1')
    if (language) {
      openaiFormData.append('language', language)
    }

    // Call OpenAI with retry logic
    const text = await transcribeWithRetry(openaiFormData, apiKey, 0)

    return NextResponse.json({ text })
  } catch (error) {
    console.error('Transcription error:', error)

    if (error instanceof TranscriptionError) {
      const statusCodes: Record<string, number> = {
        FILE_TOO_LARGE: 400,
        INVALID_API_KEY: 401,
        RATE_LIMIT: 429,
        NETWORK: 502,
        API_ERROR: 500,
      }

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
        },
        { status: statusCodes[error.code] || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean
  ) {
    super(message)
    this.name = 'TranscriptionError'
  }
}

async function transcribeWithRetry(
  formData: FormData,
  apiKey: string,
  retries: number
): Promise<string> {
  try {
    return await makeOpenAIRequest(formData, apiKey)
  } catch (error) {
    if (error instanceof TranscriptionError && error.retryable && retries < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retries)
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return transcribeWithRetry(formData, apiKey, retries + 1)
    }
    throw error
  }
}

async function makeOpenAIRequest(formData: FormData, apiKey: string): Promise<string> {
  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
