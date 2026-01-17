import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { z } from 'zod'
import PDFDocument from 'pdfkit'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, PageNumber, NumberFormat, Footer, Header, TableOfContents, SectionType } from 'docx'
import ExcelJS from 'exceljs'
import type {
  DocumentGenerationModel,
  DocumentFormat,
  DocumentType,
  DocumentGenerationErrorCode,
  DocumentContent,
  SpreadsheetContent,
  DocumentSection,
  DocumentTable,
  DocumentList,
  GeneratedDocument,
  DocumentGenerationResponse,
  ColumnDefinition,
} from '@/lib/types'

// Constants
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MAX_RETRIES = 3
const RATE_LIMIT_BASE_DELAY_MS = 10000
const REQUEST_TIMEOUT_MS = 60000

// Valid models and document types
const VALID_MODELS = ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'] as const
const VALID_DOCUMENT_TYPES = ['report', 'spreadsheet', 'letter', 'proposal', 'invoice'] as const
const VALID_FORMATS = ['pdf', 'docx', 'xlsx'] as const

// Zod schema for request validation
const DocumentGenerationRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  documentType: z.enum(VALID_DOCUMENT_TYPES),
  format: z.enum(VALID_FORMATS),
  model: z.enum(VALID_MODELS).optional(),
  context: z.string().optional(),
})

// Error class
class DocumentGenerationApiError extends Error {
  constructor(
    message: string,
    public code: DocumentGenerationErrorCode,
    public retryable: boolean,
    public statusCode: number,
    public suggestedAction?: string
  ) {
    super(message)
    this.name = 'DocumentGenerationApiError'
  }
}

// Schema version registry
const SCHEMA_VERSION = '1.0.0'

/**
 * REQ_003.2: Document content JSON schema for OpenAI Structured Outputs
 */
const documentContentSchema = {
  name: 'document_content',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Document title' },
      author: { type: 'string', description: 'Document author (optional)' },
      createdAt: { type: 'string', description: 'ISO date string of creation' },
      sections: {
        type: 'array',
        description: 'Document sections',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string', description: 'Section heading' },
            content: { type: 'string', description: 'Section content' },
            subsections: {
              type: 'array',
              description: 'Nested subsections (optional)',
              items: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['heading', 'content'],
                additionalProperties: false,
              },
            },
            tables: {
              type: 'array',
              description: 'Tables in this section (optional)',
              items: {
                type: 'object',
                properties: {
                  headers: { type: 'array', items: { type: 'string' } },
                  rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
                  caption: { type: 'string' },
                },
                required: ['headers', 'rows'],
                additionalProperties: false,
              },
            },
            lists: {
              type: 'array',
              description: 'Lists in this section (optional)',
              items: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { type: 'string' } },
                  ordered: { type: 'boolean' },
                },
                required: ['items', 'ordered'],
                additionalProperties: false,
              },
            },
          },
          required: ['heading', 'content'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'createdAt', 'sections'],
    additionalProperties: false,
  },
}

/**
 * REQ_003.2: Spreadsheet content JSON schema
 */
const spreadsheetContentSchema = {
  name: 'spreadsheet_content',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Spreadsheet title' },
      author: { type: 'string', description: 'Document author (optional)' },
      createdAt: { type: 'string', description: 'ISO date string of creation' },
      sheets: {
        type: 'array',
        description: 'Worksheets in the spreadsheet',
        items: {
          type: 'object',
          properties: {
            sheetName: { type: 'string', description: 'Name of the worksheet' },
            columns: {
              type: 'array',
              description: 'Column definitions',
              items: {
                type: 'object',
                properties: {
                  header: { type: 'string' },
                  type: { type: 'string', enum: ['string', 'number', 'date', 'currency'] },
                  width: { type: 'number' },
                },
                required: ['header', 'type'],
                additionalProperties: false,
              },
            },
            rows: {
              type: 'array',
              description: 'Data rows',
              items: {
                type: 'array',
                items: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'null' },
                  ],
                },
              },
            },
          },
          required: ['sheetName', 'columns', 'rows'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'createdAt', 'sheets'],
    additionalProperties: false,
  },
}

/**
 * REQ_003.2: Get schema for document type
 */
function getSchemaForType(documentType: DocumentType, format: DocumentFormat): object {
  // Use spreadsheet schema for xlsx format or spreadsheet type
  if (format === 'xlsx' || documentType === 'spreadsheet') {
    return spreadsheetContentSchema
  }
  return documentContentSchema
}

/**
 * REQ_003.2: Get available schema types
 */
export function getAvailableSchemas(): { type: string; version: string }[] {
  return [
    { type: 'report', version: SCHEMA_VERSION },
    { type: 'spreadsheet', version: SCHEMA_VERSION },
    { type: 'letter', version: SCHEMA_VERSION },
    { type: 'proposal', version: SCHEMA_VERSION },
    { type: 'invoice', version: SCHEMA_VERSION },
  ]
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * REQ_003.1: Make OpenAI chat completion request with structured output
 */
async function generateStructuredContent(
  apiKey: string,
  prompt: string,
  documentType: DocumentType,
  format: DocumentFormat,
  model: DocumentGenerationModel,
  context?: string,
  attempt: number = 0
): Promise<{ content: DocumentContent | SpreadsheetContent; usage: { inputTokens: number; outputTokens: number } }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const schema = getSchemaForType(documentType, format)
  const isSpreadsheet = format === 'xlsx' || documentType === 'spreadsheet'

  const systemPrompt = isSpreadsheet
    ? `You are a document generation assistant. Generate structured spreadsheet content based on the user's request.
       Create realistic, professional data with appropriate column types.
       For dates, use ISO 8601 format (YYYY-MM-DD).
       For currency, include just the number without currency symbols.
       The createdAt field should be the current timestamp: ${new Date().toISOString()}`
    : `You are a document generation assistant. Generate structured document content based on the user's request.
       Create professional, well-organized content with appropriate sections and formatting.
       Include tables and lists where appropriate.
       The createdAt field should be the current timestamp: ${new Date().toISOString()}`

  const userPrompt = context ? `${prompt}\n\nAdditional context: ${context}` : prompt

  try {
    console.log('Document generation request:', {
      model,
      documentType,
      format,
      promptLength: prompt.length,
    })

    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: schema,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      const errorMessage = errorData.error?.message || 'Unknown error'

      if (response.status === 401) {
        throw new DocumentGenerationApiError(
          'Invalid API key',
          'INVALID_API_KEY',
          false,
          401
        )
      }

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt)
          await sleep(delay)
          return generateStructuredContent(apiKey, prompt, documentType, format, model, context, attempt + 1)
        }
        throw new DocumentGenerationApiError(
          `Rate limit exceeded: ${errorMessage}`,
          'RATE_LIMIT',
          true,
          429,
          'Wait a few moments and try again'
        )
      }

      if (response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt)
          await sleep(delay)
          return generateStructuredContent(apiKey, prompt, documentType, format, model, context, attempt + 1)
        }
        throw new DocumentGenerationApiError(
          `OpenAI API error: ${errorMessage}`,
          'API_ERROR',
          true,
          response.status
        )
      }

      throw new DocumentGenerationApiError(
        `API error: ${errorMessage}`,
        'API_ERROR',
        false,
        response.status
      )
    }

    const data = await response.json()

    if (!data.choices?.[0]?.message?.content) {
      throw new DocumentGenerationApiError(
        'No content in API response',
        'INVALID_RESPONSE',
        false,
        500
      )
    }

    let parsedContent: DocumentContent | SpreadsheetContent
    try {
      parsedContent = JSON.parse(data.choices[0].message.content)
    } catch {
      throw new DocumentGenerationApiError(
        'Failed to parse structured content from API',
        'INVALID_RESPONSE',
        false,
        500
      )
    }

    // REQ_003.1: Log generation metrics
    console.log('Document generation complete:', {
      title: parsedContent.title,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    })

    return {
      content: parsedContent,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DocumentGenerationApiError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new DocumentGenerationApiError(
          'Request timed out after 60 seconds',
          'TIMEOUT',
          true,
          408,
          'Try with a simpler document request'
        )
      }

      if (attempt < MAX_RETRIES) {
        const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt)
        await sleep(delay)
        return generateStructuredContent(apiKey, prompt, documentType, format, model, context, attempt + 1)
      }

      throw new DocumentGenerationApiError(
        `Network error: ${error.message}`,
        'NETWORK',
        true,
        502
      )
    }

    throw new DocumentGenerationApiError(
      'Unknown error occurred',
      'API_ERROR',
      false,
      500
    )
  }
}

/**
 * REQ_003.3: Generate PDF document using PDFKit
 */
async function generatePDF(content: DocumentContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const chunks: Buffer[] = []

    // Create PDF with A4 size (default)
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: content.title,
        Author: content.author || 'Document Generator',
        CreationDate: new Date(content.createdAt),
      },
    })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const duration = Date.now() - startTime
      console.log(`PDF generation completed in ${duration}ms, size: ${buffer.length} bytes`)
      resolve(buffer)
    })
    doc.on('error', reject)

    // REQ_003.3: Title centered at 24pt
    doc.fontSize(24).text(content.title, { align: 'center' })
    doc.moveDown(2)

    // Add author if present
    if (content.author) {
      doc.fontSize(12).text(`Author: ${content.author}`, { align: 'center' })
      doc.moveDown()
    }

    // Add date
    doc.fontSize(10).text(`Created: ${new Date(content.createdAt).toLocaleDateString()}`, { align: 'center' })
    doc.moveDown(2)

    // REQ_003.3: Render sections
    const renderSection = (section: DocumentSection, level: number = 0) => {
      const indent = level * 20
      const headingSize = level === 0 ? 18 : level === 1 ? 14 : 12

      // Section heading in bold
      doc.fontSize(headingSize).font('Helvetica-Bold')
      doc.text(section.heading, 50 + indent, undefined, { continued: false })
      doc.font('Helvetica')
      doc.moveDown(0.5)

      // Section content
      doc.fontSize(12).text(section.content, 50 + indent)
      doc.moveDown()

      // REQ_003.3: Render lists
      if (section.lists) {
        for (const list of section.lists) {
          renderList(list, indent)
        }
      }

      // REQ_003.3: Render tables
      if (section.tables) {
        for (const table of section.tables) {
          renderTable(table, indent)
        }
      }

      // Render subsections recursively
      if (section.subsections) {
        for (const subsection of section.subsections) {
          renderSection(subsection, level + 1)
        }
      }
    }

    const renderList = (list: DocumentList, indent: number) => {
      list.items.forEach((item, index) => {
        const prefix = list.ordered ? `${index + 1}. ` : '• '
        doc.fontSize(12).text(`${prefix}${item}`, 50 + indent + 20)
      })
      doc.moveDown()
    }

    const renderTable = (table: DocumentTable, indent: number) => {
      if (table.caption) {
        doc.fontSize(10).font('Helvetica-Oblique').text(table.caption, 50 + indent)
        doc.font('Helvetica')
        doc.moveDown(0.5)
      }

      const pageWidth = 500 - indent
      const colWidth = pageWidth / table.headers.length
      let y = doc.y

      // Header row with background
      doc.rect(50 + indent, y, pageWidth, 20).fill('#f0f0f0')
      doc.fillColor('black')

      table.headers.forEach((header, i) => {
        doc.fontSize(10).font('Helvetica-Bold')
        doc.text(header, 55 + indent + (i * colWidth), y + 5, { width: colWidth - 10 })
      })
      doc.font('Helvetica')
      y += 20

      // Data rows with alternating colors
      table.rows.forEach((row, rowIndex) => {
        if (rowIndex % 2 === 1) {
          doc.rect(50 + indent, y, pageWidth, 18).fill('#f9f9f9')
          doc.fillColor('black')
        }
        row.forEach((cell, i) => {
          doc.fontSize(10).text(cell, 55 + indent + (i * colWidth), y + 4, { width: colWidth - 10 })
        })
        y += 18
      })

      doc.y = y + 10
      doc.moveDown()
    }

    // Render all sections
    for (const section of content.sections) {
      renderSection(section)
    }

    // REQ_003.3: Add page numbers
    const pageCount = doc.bufferedPageRange().count
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i)
      doc.fontSize(10).text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 50, { align: 'center' })
    }

    doc.end()
  })
}

/**
 * REQ_003.4: Generate DOCX document using docx library
 */
async function generateDOCX(content: DocumentContent): Promise<Buffer> {
  const startTime = Date.now()

  const children: (Paragraph | Table)[] = []

  // REQ_003.4: Title using Title style
  children.push(
    new Paragraph({
      text: content.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  )

  // Author and date
  if (content.author) {
    children.push(
      new Paragraph({
        text: `Author: ${content.author}`,
        alignment: AlignmentType.CENTER,
      })
    )
  }

  children.push(
    new Paragraph({
      text: `Created: ${new Date(content.createdAt).toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
    })
  )

  children.push(new Paragraph({ text: '' })) // Spacer

  // REQ_003.4: Render sections with appropriate heading levels
  const renderDocxSection = (section: DocumentSection, level: number = 1): (Paragraph | Table)[] => {
    const items: (Paragraph | Table)[] = []

    const headingLevel = level === 1 ? HeadingLevel.HEADING_1
      : level === 2 ? HeadingLevel.HEADING_2
      : HeadingLevel.HEADING_3

    items.push(
      new Paragraph({
        text: section.heading,
        heading: headingLevel,
      })
    )

    items.push(
      new Paragraph({
        text: section.content,
      })
    )

    // REQ_003.4: Render lists
    if (section.lists) {
      for (const list of section.lists) {
        for (let i = 0; i < list.items.length; i++) {
          items.push(
            new Paragraph({
              text: list.items[i],
              bullet: list.ordered ? undefined : { level: 0 },
              numbering: list.ordered ? { reference: 'numbered-list', level: 0 } : undefined,
            })
          )
        }
      }
    }

    // REQ_003.4: Render tables
    if (section.tables) {
      for (const table of section.tables) {
        if (table.caption) {
          items.push(new Paragraph({ text: table.caption, italics: true }))
        }

        const tableRows: TableRow[] = []

        // Header row
        tableRows.push(
          new TableRow({
            children: table.headers.map(header =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
                shading: { fill: 'f0f0f0' },
              })
            ),
          })
        )

        // Data rows
        for (const row of table.rows) {
          tableRows.push(
            new TableRow({
              children: row.map(cell =>
                new TableCell({
                  children: [new Paragraph({ text: cell })],
                })
              ),
            })
          )
        }

        items.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        )
      }
    }

    // Render subsections recursively
    if (section.subsections) {
      for (const subsection of section.subsections) {
        items.push(...renderDocxSection(subsection, level + 1))
      }
    }

    return items
  }

  // Render all sections
  for (const section of content.sections) {
    children.push(...renderDocxSection(section))
  }

  // Create document with properties
  const doc = new Document({
    title: content.title,
    creator: content.author || 'Document Generator',
    description: `Generated document: ${content.title}`,
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [new Paragraph({ text: content.title, alignment: AlignmentType.CENTER })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun('Page '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' of '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const duration = Date.now() - startTime
  console.log(`DOCX generation completed in ${duration}ms, size: ${buffer.length} bytes`)

  return Buffer.from(buffer)
}

/**
 * REQ_003.5: Generate XLSX document using ExcelJS
 */
async function generateXLSX(content: SpreadsheetContent): Promise<Buffer> {
  const startTime = Date.now()

  const workbook = new ExcelJS.Workbook()
  workbook.title = content.title
  workbook.creator = content.author || 'Document Generator'
  workbook.created = new Date(content.createdAt)

  for (const sheet of content.sheets) {
    const worksheet = workbook.addWorksheet(sheet.sheetName)

    // REQ_003.5: Set column headers with formatting
    const headerRow = worksheet.addRow(sheet.columns.map(col => col.header))
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // REQ_003.5: Set column widths
    sheet.columns.forEach((col, index) => {
      const column = worksheet.getColumn(index + 1)
      // Auto-fit with min 10, max 50
      const width = col.width || Math.min(Math.max(col.header.length + 2, 10), 50)
      column.width = width
    })

    // REQ_003.5: Add data rows with type formatting
    sheet.rows.forEach((row, rowIndex) => {
      const dataRow = worksheet.addRow(row)

      // REQ_003.5: Apply alternating row colors
      if (rowIndex % 2 === 1) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9F9F9' },
        }
      }

      // Apply column type formatting
      row.forEach((cell, colIndex) => {
        const colDef = sheet.columns[colIndex]
        const excelCell = dataRow.getCell(colIndex + 1)

        if (colDef && cell !== null) {
          switch (colDef.type) {
            case 'number':
              excelCell.numFmt = '#,##0.00'
              break
            case 'currency':
              excelCell.numFmt = '$#,##0.00'
              break
            case 'date':
              excelCell.numFmt = 'yyyy-mm-dd'
              break
          }
        }
      })
    })

    // REQ_003.5: Add borders to data range
    const lastRow = worksheet.rowCount
    const lastCol = sheet.columns.length

    for (let row = 1; row <= lastRow; row++) {
      for (let col = 1; col <= lastCol; col++) {
        const cell = worksheet.getCell(row, col)
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      }
    }

    // REQ_003.5: Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const duration = Date.now() - startTime
  console.log(`XLSX generation completed in ${duration}ms, size: ${buffer.byteLength} bytes`)

  return Buffer.from(buffer)
}

async function uploadToBlob(
  buffer: Buffer,
  filename: string,
  contentType: string,
  blobToken: string
): Promise<string> {
  try {
    const blob = await put(filename, buffer, {
      access: 'public',
      token: blobToken,
      contentType,
    })
    return blob.url
  } catch (error) {
    console.error('Blob upload error:', error)
    throw new DocumentGenerationApiError(
      'Failed to upload document to storage',
      'UPLOAD_FAILED',
      true,
      500,
      'Try again in a few moments'
    )
  }
}

const CONTENT_TYPES: Record<DocumentFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now()

  try {
    // Validate environment variables
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured', code: 'CONFIG_ERROR', retryable: false },
        { status: 500 }
      )
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (!blobToken) {
      console.error('BLOB_READ_WRITE_TOKEN is not configured')
      return NextResponse.json(
        { error: 'Blob storage not configured', code: 'CONFIG_ERROR', retryable: false },
        { status: 500 }
      )
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR', retryable: false },
        { status: 400 }
      )
    }

    // Validate with Zod
    const parseResult = DocumentGenerationRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const issues = parseResult.error.issues || []
      const errorMessage = issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      return NextResponse.json(
        { error: errorMessage, code: 'VALIDATION_ERROR', retryable: false },
        { status: 400 }
      )
    }

    const validatedBody = parseResult.data
    const model: DocumentGenerationModel = validatedBody.model ?? 'gpt-4o'
    const format: DocumentFormat = validatedBody.format
    const documentType: DocumentType = validatedBody.documentType

    // Validate format compatibility
    if (format === 'xlsx' && documentType !== 'spreadsheet' && documentType !== 'invoice') {
      return NextResponse.json(
        { error: 'XLSX format is only supported for spreadsheet and invoice document types', code: 'VALIDATION_ERROR', retryable: false },
        { status: 400 }
      )
    }

    // REQ_003.1: Generate structured content
    const { content, usage } = await generateStructuredContent(
      apiKey,
      validatedBody.prompt,
      documentType,
      format,
      model,
      validatedBody.context
    )

    // Generate document based on format
    let buffer: Buffer
    try {
      if (format === 'pdf') {
        buffer = await generatePDF(content as DocumentContent)
      } else if (format === 'docx') {
        buffer = await generateDOCX(content as DocumentContent)
      } else if (format === 'xlsx') {
        buffer = await generateXLSX(content as SpreadsheetContent)
      } else {
        throw new DocumentGenerationApiError(
          `Unsupported format: ${format}`,
          'VALIDATION_ERROR',
          false,
          400
        )
      }
    } catch (error) {
      if (error instanceof DocumentGenerationApiError) {
        throw error
      }
      console.error('Document generation error:', error)
      throw new DocumentGenerationApiError(
        'Failed to generate document',
        'GENERATION_FAILED',
        false,
        500,
        'Try with different content or format'
      )
    }

    // Upload to blob storage
    const timestamp = Date.now()
    const sanitizedTitle = content.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 50)
    const filename = `document-${sanitizedTitle}-${timestamp}.${format}`
    const url = await uploadToBlob(buffer, filename, CONTENT_TYPES[format], blobToken)

    const generationTime = Date.now() - startTime

    const generatedDocument: GeneratedDocument = {
      url,
      filename,
      format,
      documentType,
      title: content.title,
      generatedAt: new Date().toISOString(),
      sizeBytes: buffer.length,
    }

    const response: DocumentGenerationResponse = {
      document: generatedDocument,
      model,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      },
      generationTime,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Document generation error:', error)

    if (error instanceof DocumentGenerationApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
          suggestedAction: error.suggestedAction,
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        code: 'API_ERROR',
        retryable: false,
      },
      { status: 500 }
    )
  }
}
