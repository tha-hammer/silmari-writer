import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transcribeAudio, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/transcription'
import { TranscriptionError } from '@/lib/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('file size validation', () => {
    it('should reject files larger than 25MB', async () => {
      const largeBlob = new Blob([new ArrayBuffer(MAX_FILE_SIZE_BYTES + 1)], { type: 'audio/webm' })

      await expect(transcribeAudio(largeBlob)).rejects.toThrow(TranscriptionError)
      await expect(transcribeAudio(largeBlob)).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
        retryable: false,
      })
    })

    it('should accept files at exactly 25MB', async () => {
      const exactBlob = new Blob([new ArrayBuffer(MAX_FILE_SIZE_BYTES)], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'test transcription' }),
      })

      await expect(transcribeAudio(exactBlob)).resolves.toBe('test transcription')
    })

    it('should accept files smaller than 25MB', async () => {
      const smallBlob = new Blob(['test audio content'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'hello world' }),
      })

      const result = await transcribeAudio(smallBlob)
      expect(result).toBe('hello world')
    })
  })

  describe('successful transcription', () => {
    it('should POST to /api/transcribe with correct FormData', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'transcribed text' }),
      })

      await transcribeAudio(audioBlob)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/transcribe',
        expect.objectContaining({
          method: 'POST',
        })
      )

      // Verify FormData contains file
      const [, options] = mockFetch.mock.calls[0]
      expect(options.body).toBeInstanceOf(FormData)
      const formData = options.body as FormData
      expect(formData.get('file')).toBeInstanceOf(Blob)
    })

    it('should return transcription text from response', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'The quick brown fox jumps over the lazy dog' }),
      })

      const result = await transcribeAudio(audioBlob)
      expect(result).toBe('The quick brown fox jumps over the lazy dog')
    })

    it('should pass language option to API', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'transcribed text' }),
      })

      await transcribeAudio(audioBlob, { language: 'es' })

      const [, options] = mockFetch.mock.calls[0]
      const formData = options.body as FormData
      expect(formData.get('language')).toBe('es')
    })

    it('should use .webm extension for audio/webm files', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'transcribed text' }),
      })

      await transcribeAudio(audioBlob)

      const [, options] = mockFetch.mock.calls[0]
      const formData = options.body as FormData
      const file = formData.get('file') as File
      expect(file.name).toBe('recording.webm')
    })

    it('should use .mp4 extension for audio/mp4 files', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/mp4' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'transcribed text' }),
      })

      await transcribeAudio(audioBlob)

      const [, options] = mockFetch.mock.calls[0]
      const formData = options.body as FormData
      const file = formData.get('file') as File
      expect(file.name).toBe('recording.mp4')
    })
  })

  describe('error handling', () => {
    it('should throw INVALID_API_KEY error on 401 response', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
          retryable: false
        }),
      })

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'INVALID_API_KEY',
        retryable: false,
      })
    })

    it('should throw NETWORK error on network failure', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'NETWORK',
        retryable: true,
      })
    })

    it('should throw API_ERROR on other API errors', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Bad request',
          code: 'API_ERROR',
          retryable: false
        }),
      })

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'API_ERROR',
        retryable: false,
      })
    })

    it('should handle error responses with retryable flag', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          retryable: true
        }),
      })

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'RATE_LIMIT',
        retryable: true,
      })
    })
  })
})

describe('constants', () => {
  it('should export MAX_FILE_SIZE_MB as 25', () => {
    expect(MAX_FILE_SIZE_MB).toBe(25)
  })

  it('should export MAX_FILE_SIZE_BYTES as 25 * 1024 * 1024', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024)
  })
})
