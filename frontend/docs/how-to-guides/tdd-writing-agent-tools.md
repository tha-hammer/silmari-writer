---
date: 2026-01-17T11:30:00-05:00
researcher: Claude Opus 4.5
git_commit: f1b79dfd4abc8da84b981a5ed1c50a9b32785d1c
branch: main
repository: silmari-writer
topic: "TDD Writing Agent Tools API Guide"
tags: [how-to, api, deep-research, image-generation, document-generation, tools]
status: complete
last_updated: 2026-01-17
last_updated_by: Claude Opus 4.5
---

# How to Use the Writing Agent Tool APIs

## Introduction

This guide covers how to integrate with and use the four tool APIs in the Writing Agent system: Deep Research, Image Generation, Document Generation, and Chat Completion. Each API endpoint accepts JSON requests and returns structured responses.

## Prerequisites

- OPENAI_API_KEY environment variable configured
- BLOB_READ_WRITE_TOKEN environment variable configured (for file uploads)
- Running Next.js development or production server
- Basic understanding of REST APIs and async JavaScript

---

## How to Submit a Deep Research Request

### Steps

1. **Construct the request payload**

   ```typescript
   const request = {
     query: "What are the latest developments in quantum computing?",
     depth: "thorough", // or "quick"
     model: "o3-deep-research-2025-06-26" // or "o4-mini-deep-research-2025-06-26"
   }
   ```

2. **Send POST request to the Deep Research endpoint**

   ```typescript
   const response = await fetch('/api/tools/deep-research', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(request)
   })
   ```

3. **Handle the async job response**

   The API returns immediately with job metadata since research runs in background mode:

   ```typescript
   const { jobId, status, statusUrl } = await response.json()
   // jobId: unique identifier for polling
   // status: 'pending' | 'processing' | 'completed' | 'failed'
   // statusUrl: endpoint to check job progress
   ```

4. **Poll for completion**

   ```typescript
   async function pollForResult(jobId: string): Promise<DeepResearchResult> {
     let status = 'pending'
     while (status === 'pending' || status === 'processing') {
       await new Promise(r => setTimeout(r, 5000)) // Wait 5 seconds
       const response = await fetch(`/api/tools/deep-research/${jobId}/status`)
       const data = await response.json()
       status = data.status
       if (status === 'completed') return data.result
       if (status === 'failed') throw new Error(data.error.message)
     }
   }
   ```

5. **Process the result**

   The completed result contains:
   - `text`: The research report with inline citations
   - `citations`: Array of URL citations with start/end indices
   - `reasoningSteps`: Intermediate thinking steps
   - `usage`: Token counts for cost tracking

---

## How to Generate Images

### Steps

1. **Construct the image generation request**

   ```typescript
   const request = {
     prompt: "A futuristic cityscape at sunset with flying vehicles",
     model: "gpt-image-1.5", // or "gpt-image-1", "gpt-image-1-mini"
     size: "1024x1024", // or "1536x1024", "1024x1536", "auto"
     quality: "high", // or "medium", "low"
     n: 1 // Number of images (1-10)
   }
   ```

2. **Send POST request to the Image Generation endpoint**

   ```typescript
   const response = await fetch('/api/tools/image-generation', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(request)
   })
   ```

3. **Retrieve the generated image(s)**

   ```typescript
   const { images, model, quality, estimatedCost } = await response.json()

   // Each image contains:
   // - url: Vercel Blob storage URL
   // - revisedPrompt: AI-enhanced prompt if modified
   // - format: 'png' | 'jpeg' | 'webp'
   // - size: requested size
   // - generatedAt: ISO timestamp
   ```

4. **Display or download the image**

   ```typescript
   images.forEach(image => {
     const img = document.createElement('img')
     img.src = image.url
     img.alt = image.revisedPrompt || request.prompt
     container.appendChild(img)
   })
   ```

---

## How to Generate Documents

### Steps

1. **Construct the document generation request**

   ```typescript
   const request = {
     prompt: "Create a quarterly sales report with revenue breakdown by region",
     documentType: "report", // or "spreadsheet", "letter", "proposal", "invoice"
     format: "pdf", // or "docx", "xlsx"
     model: "gpt-4o", // or "gpt-4-turbo", "gpt-4o-mini"
     context: "Q4 2025 data" // Optional additional context
   }
   ```

2. **Send POST request to the Document Generation endpoint**

   ```typescript
   const response = await fetch('/api/tools/document-generation', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(request)
   })
   ```

3. **Retrieve the generated document**

   ```typescript
   const { document, model, usage, generationTime } = await response.json()

   // document contains:
   // - url: Vercel Blob storage URL for download
   // - filename: Generated filename
   // - format: 'pdf' | 'docx' | 'xlsx'
   // - title: Document title
   // - sizeBytes: File size
   // - generatedAt: ISO timestamp
   ```

4. **Provide download link to user**

   ```typescript
   const link = document.createElement('a')
   link.href = document.url
   link.download = document.filename
   link.textContent = `Download ${document.title}`
   container.appendChild(link)
   ```

### Format-Specific Considerations

- **PDF**: Supports sections, tables, lists, and page numbers. Uses PDFKit.
- **DOCX**: Supports heading styles, tables, lists, headers/footers. Uses docx library.
- **XLSX**: Requires `documentType: "spreadsheet"` or `"invoice"`. Supports multiple sheets, formatting, frozen headers. Uses ExcelJS.

---

## How to Use the Tool Registry

The Tool Registry provides unified access to all tools with consistent error handling.

### Steps

1. **Import the registry functions**

   ```typescript
   import {
     invokeToolHandler,
     getToolByName,
     getAllTools,
     hasToolByName
   } from '@/lib/tool-registry'
   ```

2. **Check available tools**

   ```typescript
   const tools = getAllTools()
   // Returns: [deep_research, image_generation, document_generation, chat_completion]

   if (hasToolByName('deep_research')) {
     const tool = getToolByName('deep_research')
     console.log(tool.description) // Tool description
     console.log(tool.responseType) // 'text' | 'image' | 'file'
   }
   ```

3. **Invoke a tool with unified error handling**

   ```typescript
   import { invokeToolHandler, ToolError } from '@/lib/tool-registry'

   try {
     const result = await invokeToolHandler('document_generation', {
       contentDescription: "Monthly expense report",
       format: "xlsx",
       title: "January 2026 Expenses"
     }, {
       timeout: 60000, // 60 second timeout
       onStart: () => console.log('Starting...'),
       onProgress: (pct, msg) => console.log(`${pct}%: ${msg}`),
       onComplete: (result) => console.log('Done:', result),
       onError: (err) => console.error('Failed:', err)
     })

     // Result is typed: TextToolResult | ImageToolResult | FileToolResult
     if (result.type === 'file') {
       window.open(result.url, '_blank')
     }
   } catch (error) {
     if (error instanceof ToolError) {
       if (error.retryable) {
         // Implement retry logic
       }
       console.error(`${error.code}: ${error.message}`)
     }
   }
   ```

4. **Handle cancellation**

   ```typescript
   const controller = new AbortController()

   // User clicks cancel button
   cancelButton.onclick = () => controller.abort()

   await invokeToolHandler('deep_research',
     { query: "Research topic" },
     { signal: controller.signal }
   )
   ```

---

## How to Use Intent Classification

Route user messages to the appropriate tool automatically.

### Steps

1. **Send message to Intent Classification endpoint**

   ```typescript
   const response = await fetch('/api/tools/intent-classification', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userMessage: "Create a PDF report about climate change",
       conversationHistory: [] // Optional prior messages for context
     })
   })
   ```

2. **Process the classified intent**

   ```typescript
   import {
     ClassifiedIntent,
     shouldRequestClarification,
     getConfidenceLevel
   } from '@/lib/types'

   const intent: ClassifiedIntent = await response.json()

   // intent contains:
   // - tool: 'deep_research' | 'image_generation' | 'document_generation' | 'chat_completion'
   // - confidence: 0.0 to 1.0
   // - extractedParams: Parameters for the detected tool
   // - alternativeIntents: Other possible interpretations (when ambiguous)
   ```

3. **Handle low confidence classifications**

   ```typescript
   if (shouldRequestClarification(intent)) {
     // confidence < 0.5, ask user to confirm
     const confirmed = await showClarificationDialog(intent)
     if (!confirmed) return
   }

   const level = getConfidenceLevel(intent.confidence)
   // 'high' (>= 0.8), 'medium' (>= 0.5), 'low' (< 0.5)
   ```

4. **Execute the detected tool with extracted parameters**

   ```typescript
   import { isDocumentGenerationParams } from '@/lib/types'

   if (intent.tool === 'document_generation' && isDocumentGenerationParams(intent.extractedParams)) {
     const { type, contentDescription, title } = intent.extractedParams

     await invokeToolHandler('document_generation', {
       format: type,
       contentDescription,
       title
     })
   }
   ```

---

## How to Handle API Errors

All tool APIs use consistent error response format.

### Steps

1. **Check response status and parse error**

   ```typescript
   const response = await fetch('/api/tools/document-generation', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(request)
   })

   if (!response.ok) {
     const error = await response.json()
     // error contains:
     // - error: Human-readable message
     // - code: Error code (RATE_LIMIT, VALIDATION_ERROR, etc.)
     // - retryable: Boolean indicating if retry might succeed
     // - suggestedAction: Optional suggestion for user
   }
   ```

2. **Implement retry logic for retryable errors**

   ```typescript
   const MAX_RETRIES = 3
   const BASE_DELAY = 10000 // 10 seconds

   async function fetchWithRetry(url: string, options: RequestInit, attempt = 0) {
     const response = await fetch(url, options)

     if (!response.ok) {
       const error = await response.json()

       if (error.retryable && attempt < MAX_RETRIES) {
         const delay = BASE_DELAY * Math.pow(2, attempt)
         await new Promise(r => setTimeout(r, delay))
         return fetchWithRetry(url, options, attempt + 1)
       }

       throw new Error(error.error)
     }

     return response
   }
   ```

3. **Handle specific error codes**

   | Code | Meaning | Action |
   |------|---------|--------|
   | `RATE_LIMIT` | API quota exceeded | Wait and retry |
   | `VALIDATION_ERROR` | Invalid request | Fix request parameters |
   | `INVALID_API_KEY` | Missing/invalid key | Check environment config |
   | `TIMEOUT` | Request took too long | Simplify request or retry |
   | `NETWORK` | Network failure | Check connection and retry |

---

## Conclusion / Next Steps

- For full API parameter reference, consult the TypeScript types in `src/lib/types.ts`
- For tool registry implementation details, see `src/lib/tool-registry.ts`
- For cost tracking and display, refer to the Cost Tracking API documentation
