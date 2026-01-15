import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { del } from '@vercel/blob'

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 2000 // Base delay for network errors
const RATE_LIMIT_BASE_DELAY_MS = 10000 // Base delay for rate limit errors (10s)

// Supported audio file types per OpenAI documentation
const SUPPORTED_AUDIO_TYPES = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpga': 'mpga',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
  'video/webm': 'webm',
} as const

export async function POST(request: NextRequest) {
  let blobUrl: string | null = null

  try {
    // Parse JSON body containing blob URL
    const body = await request.json()
    blobUrl = body.blobUrl

    if (!blobUrl) {
      return NextResponse.json(
        { error: 'No blob URL provided', code: 'NO_BLOB_URL' },
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

    // Fetch the file from Vercel Blob
    const fileResponse = await fetch(blobUrl)
    if (!fileResponse.ok) {
      throw new Error('Failed to fetch file from blob storage')
    }

    const fileBuffer = await fileResponse.arrayBuffer()
    const contentType = fileResponse.headers.get('content-type') || 'audio/webm'

    // Validate file size
    if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`, code: 'FILE_TOO_LARGE', retryable: false },
        { status: 400 }
      )
    }

    // Validate file type
    if (!SUPPORTED_AUDIO_TYPES[contentType as keyof typeof SUPPORTED_AUDIO_TYPES]) {
      const supportedTypes = Object.values(SUPPORTED_AUDIO_TYPES)
        .filter((v, i, a) => a.indexOf(v) === i) // unique values
        .join(', ')
      return NextResponse.json(
        {
          error: `Unsupported file type: ${contentType}. Supported types: ${supportedTypes}`,
          code: 'UNSUPPORTED_FILE_TYPE',
          retryable: false
        },
        { status: 400 }
      )
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey })

    // Get optional language parameter
    const language = body.language as string | null

    // Extract filename from blob URL
    const filename = blobUrl.split('/').pop() || 'recording.webm'

    // Convert buffer to file for OpenAI
    const extension = SUPPORTED_AUDIO_TYPES[contentType as keyof typeof SUPPORTED_AUDIO_TYPES] || 'webm'
    const fileForUpload = await toFile(
      new Uint8Array(fileBuffer),
      `${filename}.${extension}`,
      { type: contentType }
    )

    // Call OpenAI with retry logic
    const text = await transcribeWithRetry(openai, fileForUpload, language, 0)

    // Clean up: delete the blob after successful transcription
    try {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN
      if (blobToken) {
        await del(blobUrl, { token: blobToken })
      }
    } catch (cleanupError) {
      // Log but don't fail the request if cleanup fails
      console.warn('Failed to delete blob after transcription:', cleanupError)
    }

    return NextResponse.json({ text })
  } catch (error) {
    console.error('Transcription error:', error)

    // Clean up blob even on error
    if (blobUrl) {
      try {
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN
        if (blobToken) {
          await del(blobUrl, { token: blobToken })
        }
      } catch (cleanupError) {
        console.warn('Failed to delete blob after error:', cleanupError)
      }
    }

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
  openai: OpenAI,
  fileForUpload: Awaited<ReturnType<typeof toFile>>,
  language: string | null,
  retries: number
): Promise<string> {
  try {
    return await makeOpenAIRequest(openai, fileForUpload, language)
  } catch (error) {
    if (error instanceof TranscriptionError && error.retryable && retries < MAX_RETRIES) {
      // Use longer delays for rate limit errors
      const baseDelay = error.code === 'RATE_LIMIT'
        ? RATE_LIMIT_BASE_DELAY_MS
        : BASE_RETRY_DELAY_MS

      // Exponential backoff: baseDelay * 2^retries
      const delay = baseDelay * Math.pow(2, retries)
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms (${error.code})`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return transcribeWithRetry(openai, fileForUpload, language, retries + 1)
    }
    throw error
  }
}

async function makeOpenAIRequest(
  openai: OpenAI,
  fileForUpload: Awaited<ReturnType<typeof toFile>>,
  language: string | null
): Promise<string> {
  try {
    // Call OpenAI transcription API using the SDK
    const transcription = await openai.audio.transcriptions.create({
      file: fileForUpload,
      model: 'whisper-1',
      ...(language ? { language } : {}),
    })

    return transcription.text
  } catch (error: unknown) {
    // Handle OpenAI SDK errors
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status?: number }).status
      const message = (error as { message?: string }).message || 'Unknown error'

      switch (status) {
        case 401:
          throw new TranscriptionError(
            `Invalid API key: ${message}`,
            'INVALID_API_KEY',
            false
          )
        case 429:
          throw new TranscriptionError(
            `Rate limit exceeded: ${message}`,
            'RATE_LIMIT',
            true
          )
        case 500:
        case 502:
        case 503:
        case 504:
          throw new TranscriptionError(
            `Server error: ${message}`,
            'API_ERROR',
            true
          )
        default:
          throw new TranscriptionError(
            `API error: ${message}`,
            'API_ERROR',
            false
          )
      }
    }

    // Network or other errors
    throw new TranscriptionError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK',
      true
    )
  }
}
