import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transcribeAudio, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '@/lib/transcription'
import { TranscriptionError } from '@/lib/types'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set default API key for tests
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-key-123')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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
    it('should POST to OpenAI Whisper API with correct FormData', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'transcribed text' }),
      })

      await transcribeAudio(audioBlob)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key-123',
          }),
        })
      )

      // Verify FormData contains file and model
      const [, options] = mockFetch.mock.calls[0]
      expect(options.body).toBeInstanceOf(FormData)
      const formData = options.body as FormData
      expect(formData.get('model')).toBe('whisper-1')
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

    it('should pass prompt option to API', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'transcribed text' }),
      })

      await transcribeAudio(audioBlob, { prompt: 'This is a technical discussion' })

      const [, options] = mockFetch.mock.calls[0]
      const formData = options.body as FormData
      expect(formData.get('prompt')).toBe('This is a technical discussion')
    })
  })

  describe('error handling', () => {
    it('should throw INVALID_API_KEY error on 401 response', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      })

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'INVALID_API_KEY',
        retryable: false,
      })
    })

    it('should throw NETWORK error on network failure after retries', async () => {
      vi.useFakeTimers()
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      // All calls fail with network error
      mockFetch.mockRejectedValue(new Error('Network error'))

      const promise = transcribeAudio(audioBlob)

      // Advance through all retry delays: 1000ms + 2000ms + 4000ms
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      await expect(promise).rejects.toMatchObject({
        code: 'NETWORK',
        retryable: true,
      })
      // Initial call + 3 retries = 4 total calls
      expect(mockFetch).toHaveBeenCalledTimes(4)

      vi.useRealTimers()
    })

    it('should throw API_ERROR on other API errors', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: 'Bad request' } }),
      })

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'API_ERROR',
        retryable: false,
      })
    })
  })

  describe('retry logic', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(async () => {
      // Run all pending timers to avoid unhandled promise rejections
      await vi.runAllTimersAsync()
      vi.useRealTimers()
    })

    it('should retry on 429 rate limit error with exponential backoff', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      // First two calls return 429, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ text: 'success after retry' }),
        })

      const promise = transcribeAudio(audioBlob)

      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000)
      // Second retry after 2000ms (exponential backoff)
      await vi.advanceTimersByTimeAsync(2000)

      const result = await promise
      expect(result).toBe('success after retry')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should retry on 500 server errors', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Internal server error' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ text: 'success after retry' }),
        })

      const promise = transcribeAudio(audioBlob)
      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise
      expect(result).toBe('success after retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries exceeded', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      // All calls return 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
      })

      const promise = transcribeAudio(audioBlob)

      // Advance through all retry delays: 1000ms + 2000ms + 4000ms
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      await expect(promise).rejects.toMatchObject({
        code: 'RATE_LIMIT',
        retryable: true,
      })
      // Initial call + 3 retries = 4 total calls
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('should not retry on non-retryable errors', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      })

      await expect(transcribeAudio(audioBlob)).rejects.toMatchObject({
        code: 'INVALID_API_KEY',
      })
      expect(mockFetch).toHaveBeenCalledTimes(1)
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
