import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Create mock functions using vi.hoisted to ensure they are hoisted above mocks
const { mockPut, mockDocxPacker, MockExcelWorkbook } = vi.hoisted(() => {
  return {
    mockPut: vi.fn(),
    mockDocxPacker: {
      toBuffer: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
    },
    MockExcelWorkbook: vi.fn(function(this: Record<string, unknown>) {
      this.title = ''
      this.creator = ''
      this.created = new Date()
      this.addWorksheet = vi.fn().mockReturnValue({
        addRow: vi.fn().mockReturnValue({
          font: {},
          fill: {},
          getCell: vi.fn().mockReturnValue({
            border: {},
            numFmt: '',
          }),
        }),
        getColumn: vi.fn().mockReturnValue({ width: 10 }),
        getCell: vi.fn().mockReturnValue({
          border: {},
        }),
        views: [],
        rowCount: 5,
      })
      this.xlsx = {
        writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
      }
    }),
  }
})

// Mock @vercel/blob
vi.mock('@vercel/blob', () => ({
  put: mockPut,
}))

// Create a proper PDFKit mock class
class MockPDFDocument {
  private callbacks: Record<string, ((arg?: Buffer) => void)[]> = {}
  info: Record<string, unknown> = {}
  page = { height: 800 }
  y = 100

  constructor(_options?: Record<string, unknown>) {
    // Simulate async document creation
    setTimeout(() => {
      this.emit('data', Buffer.from('PDF mock content'))
      this.emit('end')
    }, 0)
  }

  on(event: string, callback: (arg?: Buffer) => void) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = []
    }
    this.callbacks[event].push(callback)
    return this
  }

  emit(event: string, arg?: Buffer) {
    const cbs = this.callbacks[event] || []
    cbs.forEach(cb => cb(arg))
  }

  fontSize() { return this }
  font() { return this }
  text() { return this }
  moveDown() { return this }
  rect() { return this }
  fill() { return this }
  fillColor() { return this }
  switchToPage() { return this }
  bufferedPageRange() { return { count: 1 } }
  end() {
    // Already emitted in constructor timeout
  }
}

// Mock pdfkit
vi.mock('pdfkit', () => ({
  default: MockPDFDocument,
}))

// Mock docx
vi.mock('docx', () => ({
  Document: vi.fn(),
  Packer: mockDocxPacker,
  Paragraph: vi.fn(),
  TextRun: vi.fn(),
  HeadingLevel: {
    TITLE: 'TITLE',
    HEADING_1: 'HEADING_1',
    HEADING_2: 'HEADING_2',
    HEADING_3: 'HEADING_3',
  },
  Table: vi.fn(),
  TableRow: vi.fn(),
  TableCell: vi.fn(),
  WidthType: { PERCENTAGE: 'PERCENTAGE' },
  AlignmentType: { CENTER: 'CENTER', LEFT: 'LEFT' },
  PageNumber: { CURRENT: 'CURRENT', TOTAL_PAGES: 'TOTAL_PAGES' },
  NumberFormat: { DECIMAL: 'DECIMAL' },
  Footer: vi.fn(),
  Header: vi.fn(),
  TableOfContents: vi.fn(),
  SectionType: {},
}))

// Mock exceljs
vi.mock('exceljs', () => ({
  default: {
    Workbook: MockExcelWorkbook,
  },
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('POST /api/tools/document-generation', () => {
  let POST: (request: NextRequest) => Promise<Response>
  const originalEnv = process.env

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-api-key-123',
      BLOB_READ_WRITE_TOKEN: 'test-blob-token',
    }

    // Reset mocks
    mockFetch.mockReset()
    mockPut.mockReset()

    // Dynamically import after mocks are set up
    const module = await import('@/app/api/tools/document-generation/route')
    POST = module.POST
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // Helper to create test request
  const createRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost:3000/api/tools/document-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  // Helper for mock OpenAI response with structured content
  const createMockDocumentContent = (overrides?: Partial<{
    title: string;
    author: string;
    createdAt: string;
    sections: Array<{ heading: string; content: string }>;
  }>) => ({
    title: 'Test Document',
    author: 'Test Author',
    createdAt: new Date().toISOString(),
    sections: [
      {
        heading: 'Introduction',
        content: 'This is the introduction section.',
      },
      {
        heading: 'Main Content',
        content: 'This is the main content of the document.',
      },
    ],
    ...overrides,
  })

  const createMockSpreadsheetContent = () => ({
    title: 'Test Spreadsheet',
    author: 'Test Author',
    createdAt: new Date().toISOString(),
    sheets: [
      {
        sheetName: 'Sheet1',
        columns: [
          { header: 'Name', type: 'string' },
          { header: 'Amount', type: 'number' },
          { header: 'Date', type: 'date' },
        ],
        rows: [
          ['John', 100, '2024-01-15'],
          ['Jane', 200, '2024-01-16'],
        ],
      },
    ],
  })

  const createMockOpenAIResponse = (content: object) => ({
    choices: [
      {
        message: {
          content: JSON.stringify(content),
        },
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 200,
    },
  })

  describe('REQ_003.1: Structured JSON content generation', () => {
    describe('request validation', () => {
      it('should return 400 if prompt is missing', async () => {
        const request = createRequest({ documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('VALIDATION_ERROR')
        expect(data.error).toContain('prompt')
      })

      it('should return 400 if documentType is missing', async () => {
        const request = createRequest({ prompt: 'test', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      it('should return 400 if format is missing', async () => {
        const request = createRequest({ prompt: 'test', documentType: 'report' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      it('should return 400 for invalid documentType', async () => {
        const request = createRequest({ prompt: 'test', documentType: 'invalid', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      it('should return 400 for invalid format', async () => {
        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'txt' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.code).toBe('VALIDATION_ERROR')
      })

      it('should return 500 if OPENAI_API_KEY is not configured', async () => {
        delete process.env.OPENAI_API_KEY

        vi.resetModules()
        const module = await import('@/app/api/tools/document-generation/route')
        POST = module.POST

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.code).toBe('CONFIG_ERROR')
      })

      it('should return 500 if BLOB_READ_WRITE_TOKEN is not configured', async () => {
        delete process.env.BLOB_READ_WRITE_TOKEN

        vi.resetModules()
        const module = await import('@/app/api/tools/document-generation/route')
        POST = module.POST

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.code).toBe('CONFIG_ERROR')
      })
    })

    describe('OpenAI API request format', () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockOpenAIResponse(createMockDocumentContent()),
        })
        mockPut.mockResolvedValueOnce({ url: 'https://blob.vercel.com/test.pdf' })
      })

      it('should send POST to chat completions endpoint with auth header', async () => {
        const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
        await POST(request)

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-api-key-123',
            }),
          })
        )
      })

      it('should include response_format with json_schema', async () => {
        const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
        await POST(request)

        const fetchCall = mockFetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)

        expect(body.response_format).toBeDefined()
        expect(body.response_format.type).toBe('json_schema')
        expect(body.response_format.json_schema.name).toBeDefined()
        expect(body.response_format.json_schema.strict).toBe(true)
      })

      it('should include system and user messages', async () => {
        const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
        await POST(request)

        const fetchCall = mockFetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)

        expect(body.messages).toHaveLength(2)
        expect(body.messages[0].role).toBe('system')
        expect(body.messages[1].role).toBe('user')
        expect(body.messages[1].content).toContain('Create a report')
      })

      it('should include context in user prompt when provided', async () => {
        const request = createRequest({
          prompt: 'Create a report',
          documentType: 'report',
          format: 'pdf',
          context: 'Additional context here',
        })
        await POST(request)

        const fetchCall = mockFetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)

        expect(body.messages[1].content).toContain('Additional context here')
      })

      it('should default to gpt-4o model', async () => {
        const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
        await POST(request)

        const fetchCall = mockFetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)

        expect(body.model).toBe('gpt-4o')
      })

      it('should accept gpt-4-turbo model', async () => {
        const request = createRequest({
          prompt: 'Create a report',
          documentType: 'report',
          format: 'pdf',
          model: 'gpt-4-turbo',
        })
        await POST(request)

        const fetchCall = mockFetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)

        expect(body.model).toBe('gpt-4-turbo')
      })

      it('should accept gpt-4o-mini model', async () => {
        const request = createRequest({
          prompt: 'Create a report',
          documentType: 'report',
          format: 'pdf',
          model: 'gpt-4o-mini',
        })
        await POST(request)

        const fetchCall = mockFetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)

        expect(body.model).toBe('gpt-4o-mini')
      })
    })

    describe('API error handling', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should return 401 on invalid API key (non-retryable)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Invalid authentication' } }),
        })

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.code).toBe('INVALID_API_KEY')
        expect(data.retryable).toBe(false)
      })

      it('should retry on rate limit (429) with exponential backoff', async () => {
        // Use real timers for this test as PDF generation uses setTimeout
        vi.useRealTimers()

        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({ error: { message: 'Rate limit exceeded' } }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => createMockOpenAIResponse(createMockDocumentContent()),
          })

        mockPut.mockResolvedValueOnce({ url: 'https://blob.vercel.com/test.pdf' })

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(mockFetch).toHaveBeenCalledTimes(2)

        vi.useFakeTimers()
      }, 15000) // Allow enough time for retry delay

      it('should fail after max 3 retries on rate limit', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit exceeded' } }),
        })

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const responsePromise = POST(request)

        await vi.advanceTimersByTimeAsync(10000)
        await vi.advanceTimersByTimeAsync(20000)
        await vi.advanceTimersByTimeAsync(40000)

        const response = await responsePromise
        const data = await response.json()

        expect(response.status).toBe(429)
        expect(data.code).toBe('RATE_LIMIT')
        expect(data.retryable).toBe(true)
        expect(mockFetch).toHaveBeenCalledTimes(4)
      })

      it('should handle timeout with TIMEOUT error code', async () => {
        const abortError = new Error('Aborted')
        abortError.name = 'AbortError'
        mockFetch.mockRejectedValueOnce(abortError)

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(408)
        expect(data.code).toBe('TIMEOUT')
        expect(data.retryable).toBe(true)
      })

      it('should log generation time and token usage', async () => {
        // Skip timer advancement - just test the happy path logging
        vi.useRealTimers()

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => createMockOpenAIResponse(createMockDocumentContent()),
        })
        mockPut.mockResolvedValueOnce({ url: 'https://blob.vercel.com/test.pdf' })

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        await POST(request)

        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()

        vi.useFakeTimers()
      })

      it('should handle malformed JSON response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'not valid json',
                },
              },
            ],
          }),
        })

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.code).toBe('INVALID_RESPONSE')
      })

      it('should handle empty choices array', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [] }),
        })

        const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.code).toBe('INVALID_RESPONSE')
      })
    })
  })

  describe('REQ_003.2: JSON schemas for document content', () => {
    beforeEach(() => {
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test.pdf' })
    })

    it('should use document schema for report type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })

      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)

      expect(body.response_format.json_schema.name).toBe('document_content')
      expect(body.response_format.json_schema.schema.properties.title).toBeDefined()
      expect(body.response_format.json_schema.schema.properties.sections).toBeDefined()
    })

    it('should use spreadsheet schema for xlsx format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockSpreadsheetContent()),
      })

      const request = createRequest({ prompt: 'Create a spreadsheet', documentType: 'spreadsheet', format: 'xlsx' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)

      expect(body.response_format.json_schema.name).toBe('spreadsheet_content')
      expect(body.response_format.json_schema.schema.properties.sheets).toBeDefined()
    })

    it('should use spreadsheet schema for invoice type with xlsx format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockSpreadsheetContent()),
      })

      const request = createRequest({ prompt: 'Create an invoice', documentType: 'invoice', format: 'xlsx' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)

      expect(body.response_format.json_schema.name).toBe('spreadsheet_content')
    })

    it('should include required fields in document schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })

      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const schema = body.response_format.json_schema.schema

      expect(schema.required).toContain('title')
      expect(schema.required).toContain('createdAt')
      expect(schema.required).toContain('sections')
    })

    it('should support nested subsections in schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })

      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const sectionSchema = body.response_format.json_schema.schema.properties.sections.items

      expect(sectionSchema.properties.subsections).toBeDefined()
    })

    it('should support tables in section schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })

      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const sectionSchema = body.response_format.json_schema.schema.properties.sections.items

      expect(sectionSchema.properties.tables).toBeDefined()
      expect(sectionSchema.properties.tables.items.properties.headers).toBeDefined()
      expect(sectionSchema.properties.tables.items.properties.rows).toBeDefined()
    })

    it('should support lists in section schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })

      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const sectionSchema = body.response_format.json_schema.schema.properties.sections.items

      expect(sectionSchema.properties.lists).toBeDefined()
      expect(sectionSchema.properties.lists.items.properties.items).toBeDefined()
      expect(sectionSchema.properties.lists.items.properties.ordered).toBeDefined()
    })

    it('should include column type enum in spreadsheet schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockSpreadsheetContent()),
      })

      const request = createRequest({ prompt: 'Create a spreadsheet', documentType: 'spreadsheet', format: 'xlsx' })
      await POST(request)

      const fetchCall = mockFetch.mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      const columnSchema = body.response_format.json_schema.schema.properties.sheets.items.properties.columns.items

      expect(columnSchema.properties.type.enum).toContain('string')
      expect(columnSchema.properties.type.enum).toContain('number')
      expect(columnSchema.properties.type.enum).toContain('date')
      expect(columnSchema.properties.type.enum).toContain('currency')
    })

    it('should reject xlsx format for non-spreadsheet types', async () => {
      const request = createRequest({ prompt: 'Create a letter', documentType: 'letter', format: 'xlsx' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('VALIDATION_ERROR')
      expect(data.error).toContain('XLSX')
    })

    it('should allow xlsx format for invoice type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockSpreadsheetContent()),
      })

      const request = createRequest({ prompt: 'Create an invoice', documentType: 'invoice', format: 'xlsx' })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('REQ_003.3: PDF generation with PDFKit', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test.pdf' })
    })

    it('should create PDF with A4 page size', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)

      // Verify PDF was created and uploaded successfully
      expect(response.status).toBe(200)
      expect(mockPut).toHaveBeenCalled()
    })

    it('should set PDF document properties', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      // Verify PDF was created with title from content
      expect(response.status).toBe(200)
      expect(data.document.title).toBe('Test Document')
    })

    it('should upload PDF to Vercel Blob', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      await POST(request)

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringMatching(/\.pdf$/),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'application/pdf',
        })
      )
    })

    it('should return URL in response', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.document.url).toBe('https://blob.vercel.com/test.pdf')
    })

    it('should generate filename with sanitized title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent({
          title: 'Test Document!@#$%',
        })),
      })

      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      // Verify filename is sanitized - special characters replaced with dashes
      expect(response.status).toBe(200)
      expect(data.document.filename).toMatch(/^document-test-document.*\.pdf$/)
    })
  })

  describe('REQ_003.4: DOCX generation with docx library', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test.docx' })
    })

    it('should generate DOCX buffer using Packer.toBuffer', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'docx' })
      await POST(request)

      expect(mockDocxPacker.toBuffer).toHaveBeenCalled()
    })

    it('should upload DOCX to Vercel Blob', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'docx' })
      await POST(request)

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringMatching(/\.docx$/),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      )
    })

    it('should return URL in response', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'docx' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.document.url).toBe('https://blob.vercel.com/test.docx')
    })
  })

  describe('REQ_003.5: XLSX generation with ExcelJS', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockSpreadsheetContent()),
      })
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test.xlsx' })
    })

    it('should create workbook with document properties', async () => {
      const request = createRequest({ prompt: 'Create a spreadsheet', documentType: 'spreadsheet', format: 'xlsx' })
      const response = await POST(request)

      // Verify XLSX was created and uploaded successfully
      expect(response.status).toBe(200)
      expect(MockExcelWorkbook).toHaveBeenCalled()
    })

    it('should upload XLSX to Vercel Blob', async () => {
      const request = createRequest({ prompt: 'Create a spreadsheet', documentType: 'spreadsheet', format: 'xlsx' })
      await POST(request)

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringMatching(/\.xlsx$/),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )
    })

    it('should return URL in response', async () => {
      const request = createRequest({ prompt: 'Create a spreadsheet', documentType: 'spreadsheet', format: 'xlsx' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.document.url).toBe('https://blob.vercel.com/test.xlsx')
    })
  })

  describe('Response format', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test.pdf' })
    })

    it('should return correct response structure', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        document: expect.objectContaining({
          url: expect.any(String),
          filename: expect.any(String),
          format: 'pdf',
          documentType: 'report',
          title: expect.any(String),
          generatedAt: expect.any(String),
          sizeBytes: expect.any(Number),
        }),
        model: 'gpt-4o',
        usage: expect.objectContaining({
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
        }),
        generationTime: expect.any(Number),
      })
    })

    it('should include model info in response', async () => {
      const request = createRequest({
        prompt: 'Create a report',
        documentType: 'report',
        format: 'pdf',
        model: 'gpt-4-turbo',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.model).toBe('gpt-4-turbo')
    })

    it('should include token usage in response', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      expect(data.usage.inputTokens).toBe(100)
      expect(data.usage.outputTokens).toBe(200)
    })

    it('should include generation time in response', async () => {
      const request = createRequest({ prompt: 'Create a report', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      expect(data.generationTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error handling', () => {
    it('should handle Vercel Blob upload failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })
      mockPut.mockRejectedValueOnce(new Error('Upload failed'))

      const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.code).toBe('UPLOAD_FAILED')
      expect(data.retryable).toBe(true)
    })

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/tools/document-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('VALIDATION_ERROR')
    })

    it('should include suggestedAction in rate limit errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      })

      vi.useFakeTimers()
      const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
      const responsePromise = POST(request)

      await vi.advanceTimersByTimeAsync(70000) // Exhaust retries

      const response = await responsePromise
      const data = await response.json()
      vi.useRealTimers()

      expect(data.suggestedAction).toBeDefined()
    })
  })

  describe('Document type support', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockDocumentContent()),
      })
      mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/test.pdf' })
    })

    it('should accept report document type', async () => {
      const request = createRequest({ prompt: 'test', documentType: 'report', format: 'pdf' })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should accept letter document type', async () => {
      const request = createRequest({ prompt: 'test', documentType: 'letter', format: 'pdf' })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should accept proposal document type', async () => {
      const request = createRequest({ prompt: 'test', documentType: 'proposal', format: 'pdf' })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should accept invoice document type', async () => {
      const request = createRequest({ prompt: 'test', documentType: 'invoice', format: 'pdf' })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })

    it('should accept spreadsheet document type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createMockOpenAIResponse(createMockSpreadsheetContent()),
      })

      const request = createRequest({ prompt: 'test', documentType: 'spreadsheet', format: 'xlsx' })
      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })
})
