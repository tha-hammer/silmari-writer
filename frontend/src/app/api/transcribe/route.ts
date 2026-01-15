import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/transcription'
import { TranscriptionError } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit` },
        { status: 400 }
      )
    }

    // Convert File to Blob for transcription
    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: file.type })

    // Get optional language parameter
    const language = formData.get('language') as string | null

    const text = await transcribeAudio(blob, {
      language: language || undefined,
    })

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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
