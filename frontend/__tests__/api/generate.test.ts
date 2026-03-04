import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/generate/route'
import { MAX_ROUTE_ATTACHMENTS, MAX_ROUTE_PAYLOAD_BYTES } from '@/app/api/generate/constants'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('/api/generate', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'Generated response' }),
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('handles text-only requests', async () => {
    const response = await POST(makeRequest({ message: 'Hello', history: [] }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.content).toBe('Generated response')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('builds attachment-aware user content for text + image attachments', async () => {
    await POST(
      makeRequest({
        message: 'Please review',
        attachments: [
          { filename: 'notes.txt', contentType: 'text/plain', textContent: 'Important notes' },
          { filename: 'photo.png', contentType: 'image/png', base64Data: 'data:image/png;base64,abc' },
        ],
      }),
    )

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    const userMessage = body.input[body.input.length - 1]

    expect(Array.isArray(userMessage.content)).toBe(true)
    expect(userMessage.content).toContainEqual(
      expect.objectContaining({ type: 'input_image', image_url: 'data:image/png;base64,abc' }),
    )

    const textPart = userMessage.content.find((part: { type: string }) => part.type === 'input_text')
    expect(textPart.text).toContain('Important notes')
    expect(textPart.text).toContain('Please review')
  })

  it('skips truly unsupported attachment MIME types safely', async () => {
    await POST(
      makeRequest({
        message: 'Just this text',
        attachments: [
          { filename: 'archive.zip', contentType: 'application/zip', textContent: 'PK' },
        ],
      }),
    )

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    const userMessage = body.input[body.input.length - 1]
    expect(userMessage.content).toBe('Just this text')
  })

  it('forwards PDF attachment as input_file content part', async () => {
    await POST(
      makeRequest({
        message: 'Summarize this',
        attachments: [
          {
            filename: 'report.pdf',
            contentType: 'application/pdf',
            rawBlob: 'JVBERi0xLjQ=',  // base64 of %PDF-1.4
          },
        ],
      }),
    )

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    const userMessage = body.input[body.input.length - 1]

    expect(Array.isArray(userMessage.content)).toBe(true)
    expect(userMessage.content).toContainEqual(
      expect.objectContaining({
        type: 'input_file',
        filename: 'report.pdf',
        file_data: 'JVBERi0xLjQ=',
      }),
    )

    const textPart = userMessage.content.find((part: { type: string }) => part.type === 'input_text')
    expect(textPart.text).toContain('Summarize this')
  })

  it('includes CSV attachment content in user message as text prefix', async () => {
    await POST(
      makeRequest({
        message: 'Analyze this data',
        attachments: [
          { filename: 'data.csv', contentType: 'text/csv', textContent: 'name,age\nAlice,30' },
        ],
      }),
    )

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    const userMessage = body.input[body.input.length - 1]

    expect(userMessage.content).toContain('data.csv')
    expect(userMessage.content).toContain('name,age')
    expect(userMessage.content).toContain('Analyze this data')
  })

  it('assembles mixed text + document + image attachments correctly', async () => {
    await POST(
      makeRequest({
        message: 'Review all',
        attachments: [
          { filename: 'notes.txt', contentType: 'text/plain', textContent: 'Meeting notes' },
          { filename: 'report.pdf', contentType: 'application/pdf', rawBlob: 'JVBERi0=' },
          { filename: 'diagram.png', contentType: 'image/png', base64Data: 'data:image/png;base64,abc' },
        ],
      }),
    )

    const [, options] = mockFetch.mock.calls[0]
    const body = JSON.parse(options.body as string)
    const userMessage = body.input[body.input.length - 1]

    // Should be multipart (has image)
    expect(Array.isArray(userMessage.content)).toBe(true)

    const textPart = userMessage.content.find((p: { type: string }) => p.type === 'input_text')
    expect(textPart.text).toContain('Meeting notes')
    expect(textPart.text).toContain('Review all')

    expect(userMessage.content).toContainEqual(
      expect.objectContaining({
        type: 'input_file',
        filename: 'report.pdf',
        file_data: 'JVBERi0=',
      }),
    )

    expect(userMessage.content).toContainEqual(
      expect.objectContaining({ type: 'input_image' }),
    )
  })

  it('returns ATTACHMENT_LIMIT when attachment count exceeds max', async () => {
    const attachments = Array.from({ length: MAX_ROUTE_ATTACHMENTS + 1 }, (_, index) => ({
      filename: `f-${index}.txt`,
      contentType: 'text/plain',
      textContent: 'x',
    }))
    const response = await POST(makeRequest({ message: 'Too many', attachments }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('ATTACHMENT_LIMIT')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns PAYLOAD_TOO_LARGE when attachment payload exceeds limit', async () => {
    const largeText = 'x'.repeat(MAX_ROUTE_PAYLOAD_BYTES + 1)
    const response = await POST(
      makeRequest({
        message: 'Too large',
        attachments: [
          { filename: 'big.txt', contentType: 'text/plain', textContent: largeText },
        ],
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('PAYLOAD_TOO_LARGE')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 for missing message', async () => {
    const response = await POST(makeRequest({ history: [] }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('INVALID_MESSAGE')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
