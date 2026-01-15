import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/transcribe/route'
import { NextRequest } from 'next/server'

// Create mock functions using vi.hoisted to avoid hoisting issues
const { mockCreate, mockToFile } = vi.hoisted(() => {
  return {
    mockCreate: vi.fn(),
    mockToFile: vi.fn((data: Uint8Array, filename: string, options: any) => {
      // Return a mock file object that includes the data for verification
      return Promise.resolve({
        name: filename,
        type: options.type,
        size: data.length,
        arrayBuffer: async () => data.buffer,
      })
    }),
  }
})

// Mock the OpenAI module
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      audio = {
        transcriptions: {
          create: mockCreate,
        },
      }
    },
  }
})

// Mock openai/uploads module
vi.mock('openai/uploads', () => {
  return {
    toFile: mockToFile,
  }
})

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear environment
    delete process.env.OPENAI_API_KEY
  })

  describe('validation', () => {
    it('should return 400 if no file is provided', async () => {
      const formData = new FormData()
      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        error: 'No file provided',
        code: 'NO_FILE',
      })
    })

    it('should return 400 if file type is unsupported', async () => {
      const formData = new FormData()
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('UNSUPPORTED_FILE_TYPE')
      expect(data.retryable).toBe(false)
    })

    it('should return 400 if file exceeds 25MB', async () => {
      const formData = new FormData()
      const largeFile = new File(
        [new ArrayBuffer(26 * 1024 * 1024)], // 26MB
        'large.webm',
        { type: 'audio/webm' }
      )
      formData.append('file', largeFile)

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('FILE_TOO_LARGE')
      expect(data.retryable).toBe(false)
    })

    it('should return 500 if OPENAI_API_KEY is not configured', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'audio.webm', { type: 'audio/webm' })
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.code).toBe('CONFIG_ERROR')
      expect(data.retryable).toBe(false)
    })
  })

  describe('successful transcription', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key-123'
    })

    it('should call OpenAI API with correct parameters', async () => {
      const formData = new FormData()
      const file = new File(['test audio content'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      mockCreate.mockResolvedValueOnce({
        text: 'This is the transcribed text',
      })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ text: 'This is the transcribed text' })
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-1',
          file: expect.objectContaining({
            name: 'recording.webm',
            type: 'audio/webm',
          }),
        })
      )
    })

    it('should pass language parameter to OpenAI', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)
      formData.append('language', 'es')

      mockCreate.mockResolvedValueOnce({
        text: 'Texto transcrito',
      })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      await POST(request)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-1',
          language: 'es',
        })
      )
    })

    it('should handle mp3 files correctly', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.mp3', { type: 'audio/mpeg' })
      formData.append('file', file)

      mockCreate.mockResolvedValueOnce({
        text: 'Transcribed from mp3',
      })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ text: 'Transcribed from mp3' })
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({
            name: 'recording.mp3',
            type: 'audio/mpeg',
          }),
        })
      )
    })

    it('should handle m4a files correctly', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.m4a', { type: 'audio/mp4' })
      formData.append('file', file)

      mockCreate.mockResolvedValueOnce({
        text: 'Transcribed from m4a',
      })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({
            name: 'recording.m4a',
            type: 'audio/mp4',
          }),
        })
      )
    })
  })

  describe('OpenAI API error handling', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key-123'
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return 401 on invalid API key (non-retryable)', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      const apiError = {
        status: 401,
        message: 'Invalid authentication',
      }
      mockCreate.mockRejectedValueOnce(apiError)

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.code).toBe('INVALID_API_KEY')
      expect(data.retryable).toBe(false)
      // Should not retry on non-retryable errors
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('should return 429 on rate limit error after max retries', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      const apiError = {
        status: 429,
        message: 'Rate limit exceeded',
      }
      // All calls fail with rate limit
      mockCreate.mockRejectedValue(apiError)

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const responsePromise = POST(request)

      // Fast-forward through all retries: 10s + 20s + 40s
      await vi.advanceTimersByTimeAsync(10000)
      await vi.advanceTimersByTimeAsync(20000)
      await vi.advanceTimersByTimeAsync(40000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('RATE_LIMIT')
      expect(data.retryable).toBe(true)
      // Initial call + 3 retries
      expect(mockCreate).toHaveBeenCalledTimes(4)
    })

    it('should return 502 on OpenAI server error after max retries', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      const apiError = {
        status: 503,
        message: 'Service unavailable',
      }
      // All calls fail with server error
      mockCreate.mockRejectedValue(apiError)

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const responsePromise = POST(request)

      // Fast-forward through all retries: 2s + 4s + 8s
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.advanceTimersByTimeAsync(8000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.code).toBe('API_ERROR')
      expect(data.retryable).toBe(true)
      // Initial call + 3 retries
      expect(mockCreate).toHaveBeenCalledTimes(4)
    })

    it('should handle network errors after max retries', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      mockCreate.mockRejectedValue(new Error('Connection refused'))

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const responsePromise = POST(request)

      // Fast-forward through all retries: 2s + 4s + 8s
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)
      await vi.advanceTimersByTimeAsync(8000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(502)
      expect(data.code).toBe('NETWORK')
      expect(data.retryable).toBe(true)
      // Initial call + 3 retries
      expect(mockCreate).toHaveBeenCalledTimes(4)
    })
  })

  describe('retry logic integration', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key-123'
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should retry on rate limit and succeed', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      // First call fails with rate limit, second succeeds
      mockCreate
        .mockRejectedValueOnce({ status: 429, message: 'Rate limit' })
        .mockResolvedValueOnce({ text: 'Success after retry' })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const responsePromise = POST(request)

      // Fast-forward through the retry delay (10 seconds for rate limit)
      await vi.advanceTimersByTimeAsync(10000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('Success after retry')
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('should retry on server errors and succeed', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      // First call fails with server error, second succeeds
      mockCreate
        .mockRejectedValueOnce({ status: 500, message: 'Internal server error' })
        .mockResolvedValueOnce({ text: 'Success after retry' })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const responsePromise = POST(request)

      // Fast-forward through the retry delay (2 seconds for network errors)
      await vi.advanceTimersByTimeAsync(2000)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('Success after retry')
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries', async () => {
      const formData = new FormData()
      const file = new File(['test audio'], 'recording.webm', { type: 'audio/webm' })
      formData.append('file', file)

      // All calls fail
      mockCreate.mockRejectedValue({ status: 429, message: 'Rate limit' })

      const request = new NextRequest('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const responsePromise = POST(request)

      // Fast-forward through all retries: 10s + 20s + 40s
      await vi.advanceTimersByTimeAsync(10000) // First retry
      await vi.advanceTimersByTimeAsync(20000) // Second retry
      await vi.advanceTimersByTimeAsync(40000) // Third retry

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.code).toBe('RATE_LIMIT')
      // Initial call + 3 retries = 4 total calls
      expect(mockCreate).toHaveBeenCalledTimes(4)
    })
  })
})
