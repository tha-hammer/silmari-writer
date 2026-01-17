/**
 * Tool Registry (REQ_007)
 *
 * Central registry for tool definitions including name, description,
 * trigger phrases, handler functions, and response types.
 */

import type { ExtractedParams, ToolIntent } from './types'

// =============================================================================
// REQ_007.3: ResponseType enum values (text/image/file)
// =============================================================================

/**
 * Response type for UI rendering determination
 * REQ_007.3: Union type with text, image, and file values
 */
export type ResponseType = 'text' | 'image' | 'file'

// =============================================================================
// REQ_007.4: Handler function types and results
// =============================================================================

/**
 * Error codes for tool operations
 * REQ_007.4: Error handling codes
 */
export type ToolErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'API_ERROR'
  | 'HANDLER_ERROR'
  | 'CANCELLED'

/**
 * Structured error for tool operations
 * REQ_007.4: Handlers catch and wrap errors in ToolError format
 */
export class ToolError extends Error {
  code: ToolErrorCode
  retryable: boolean

  constructor(message: string, code: ToolErrorCode, retryable: boolean = false) {
    super(message)
    this.name = 'ToolError'
    this.code = code
    this.retryable = retryable
  }
}

/**
 * Text response from a tool
 */
export interface TextToolResult {
  type: 'text'
  content: string
}

/**
 * Image response from a tool
 */
export interface ImageToolResult {
  type: 'image'
  url: string
  alt?: string
  width?: number
  height?: number
}

/**
 * File response from a tool
 */
export interface FileToolResult {
  type: 'file'
  url: string
  filename: string
  mimeType?: string
  size?: number
}

/**
 * Union type for all possible tool results
 * REQ_007.3: Type-safe response handling
 */
export type ToolResult = TextToolResult | ImageToolResult | FileToolResult

/**
 * Type guard for text response
 * REQ_007.3: Correctly narrow ToolResult to specific response types
 */
export function isTextResponse(result: ToolResult): result is TextToolResult {
  return result.type === 'text'
}

/**
 * Type guard for image response
 * REQ_007.3: Correctly narrow ToolResult to specific response types
 */
export function isImageResponse(result: ToolResult): result is ImageToolResult {
  return result.type === 'image'
}

/**
 * Type guard for file response
 * REQ_007.3: Correctly narrow ToolResult to specific response types
 */
export function isFileResponse(result: ToolResult): result is FileToolResult {
  return result.type === 'file'
}

/**
 * Execution context for tool handlers
 * REQ_007.4: Support cancellation via AbortController signal
 * REQ_007.5: Optional execution context with signal, callbacks
 */
export interface ToolExecutionContext {
  signal?: AbortSignal
  onStart?: () => void
  onProgress?: (progress: number, message?: string) => void
  onComplete?: (result: ToolResult) => void
  onError?: (error: ToolError) => void
  timeout?: number
}

/**
 * Parameters for tool handlers
 * REQ_007.4: ToolParams type for handler signature
 */
export interface ToolParams {
  [key: string]: unknown
  signal?: AbortSignal
  context?: ToolExecutionContext
}

/**
 * Handler function type
 * REQ_007.4: All handlers conform to (params: ToolParams) => Promise<ToolResult>
 */
export type ToolHandler = (params: ToolParams) => Promise<ToolResult>

// =============================================================================
// REQ_007.1: ToolDefinition interface
// =============================================================================

/**
 * Tool definition with required fields
 * REQ_007.1: name, description, triggerPhrases, handler, responseType
 */
export interface ToolDefinition {
  /** Unique identifier for the tool */
  name: ToolIntent
  /** Human-readable description of what the tool does */
  description: string
  /** Phrases that trigger this tool (ordered by specificity) */
  triggerPhrases: string[]
  /** Async function to execute the tool */
  handler: ToolHandler
  /** Type of response for UI rendering */
  responseType: ResponseType
}

// =============================================================================
// REQ_007.2: Trigger phrase arrays
// =============================================================================

/**
 * Trigger phrases for each tool
 * REQ_007.2: Comprehensive trigger phrase arrays ordered by specificity
 */
export const TOOL_TRIGGER_PHRASES: Record<ToolIntent, string[]> = {
  // Longer/more specific phrases first to avoid false positives
  deep_research: [
    'find out about',
    'dig into',
    'investigate',
    'research',
    'analyze',
    'look up',
    'explore',
  ],
  image_generation: [
    'generate picture',
    'create image',
    'make art',
    'illustrate',
    'visualize',
    'render',
    'design',
    'draw',
  ],
  document_generation: [
    'make spreadsheet',
    'generate report',
    'create document',
    'create pdf',
    'write a doc',
    'make a file',
    'export to',
  ],
  chat_completion: [
    'help me',
    'tell me',
    'explain',
    'suggest',
    'answer',
    'write',
    'chat',
  ],
}

/**
 * Result of phrase matching
 */
export interface PhraseMatchResult {
  score: number
  matchedPhrase?: string
  matchPosition?: number
}

/**
 * Check if input matches a trigger phrase
 * REQ_007.2: Case-insensitive, partial word matching, returns confidence score 0-1
 */
export function isPhraseMatch(input: string, phrase: string): PhraseMatchResult {
  if (!input || input.trim().length === 0) {
    return { score: 0 }
  }

  // Normalize input and phrase
  const normalizedInput = input.toLowerCase().replace(/[^\w\s]/g, ' ').trim()
  const normalizedPhrase = phrase.toLowerCase().trim()

  if (!normalizedInput || !normalizedPhrase) {
    return { score: 0 }
  }

  // Check for exact phrase match
  if (normalizedInput === normalizedPhrase) {
    return { score: 1.0, matchedPhrase: phrase, matchPosition: 0 }
  }

  // Check for phrase contained in input (as a substring)
  const index = normalizedInput.indexOf(normalizedPhrase)
  if (index !== -1) {
    // Higher score if at the start of input
    const positionBonus = index === 0 ? 0.05 : 0
    // Reduce score based on how much extra text there is
    const lengthRatio = normalizedPhrase.length / normalizedInput.length
    // Score: 0.8 base + up to 0.15 for length match + up to 0.05 for position
    return {
      score: 0.8 + (lengthRatio * 0.15) + positionBonus,
      matchedPhrase: phrase,
      matchPosition: index,
    }
  }

  // Check for partial word match (e.g., "researching" contains "research")
  const words = normalizedInput.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (word.startsWith(normalizedPhrase) || normalizedPhrase.startsWith(word)) {
      const positionBonus = i === 0 ? 0.05 : 0
      const matchRatio = Math.min(word.length, normalizedPhrase.length) /
        Math.max(word.length, normalizedPhrase.length)
      return {
        score: 0.6 + (matchRatio * 0.2) + positionBonus,
        matchedPhrase: phrase,
        matchPosition: i,
      }
    }
  }

  return { score: 0 }
}

// =============================================================================
// REQ_007.4: Handler implementations
// =============================================================================

/**
 * Parameter validation helper
 */
function validateParams(params: ToolParams, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (!(field in params) || params[field] === undefined || params[field] === null) {
      throw new ToolError(
        `Missing required parameter: ${field}`,
        'VALIDATION_ERROR',
        false
      )
    }
  }
}

/**
 * Check if operation was cancelled
 */
function checkCancellation(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ToolError('Operation cancelled', 'CANCELLED', false)
  }
}

/**
 * Handler for deep research tool
 * REQ_007.4: handleDeepResearch registered for deep_research
 */
export async function handleDeepResearch(params: ToolParams): Promise<ToolResult> {
  const context = params.context as ToolExecutionContext | undefined
  const signal = params.signal ?? context?.signal

  try {
    context?.onStart?.()
    checkCancellation(signal)

    validateParams(params, ['query'])

    const query = params.query as string
    const depth = (params.depth as string) ?? 'quick'

    // Call the Deep Research API
    const response = await fetch('/api/tools/deep-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, depth }),
      signal,
    })

    checkCancellation(signal)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ToolError(
        errorData.error ?? `API error: ${response.status}`,
        errorData.code ?? 'API_ERROR',
        errorData.retryable ?? response.status >= 500
      )
    }

    const data = await response.json()
    const result: TextToolResult = {
      type: 'text',
      content: data.report ?? data.content ?? JSON.stringify(data),
    }

    context?.onComplete?.(result)
    return result
  } catch (error) {
    if (error instanceof ToolError) {
      context?.onError?.(error)
      throw error
    }
    const toolError = new ToolError(
      error instanceof Error ? error.message : 'Unknown error',
      error instanceof DOMException && error.name === 'AbortError' ? 'CANCELLED' : 'HANDLER_ERROR',
      false
    )
    context?.onError?.(toolError)
    throw toolError
  }
}

/**
 * Handler for image generation tool
 * REQ_007.4: handleImageGeneration registered for image_generation
 */
export async function handleImageGeneration(params: ToolParams): Promise<ToolResult> {
  const context = params.context as ToolExecutionContext | undefined
  const signal = params.signal ?? context?.signal

  try {
    context?.onStart?.()
    checkCancellation(signal)

    validateParams(params, ['prompt'])

    const prompt = params.prompt as string
    const size = params.size as string | undefined
    const quality = params.quality as string | undefined

    // Call the Image Generation API
    const response = await fetch('/api/tools/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size, quality }),
      signal,
    })

    checkCancellation(signal)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ToolError(
        errorData.error ?? `API error: ${response.status}`,
        errorData.code ?? 'API_ERROR',
        errorData.retryable ?? response.status >= 500
      )
    }

    const data = await response.json()
    const result: ImageToolResult = {
      type: 'image',
      url: data.url ?? data.imageUrl,
      alt: prompt,
    }

    context?.onComplete?.(result)
    return result
  } catch (error) {
    if (error instanceof ToolError) {
      context?.onError?.(error)
      throw error
    }
    const toolError = new ToolError(
      error instanceof Error ? error.message : 'Unknown error',
      error instanceof DOMException && error.name === 'AbortError' ? 'CANCELLED' : 'HANDLER_ERROR',
      false
    )
    context?.onError?.(toolError)
    throw toolError
  }
}

/**
 * Handler for document generation tool
 * REQ_007.4: handleDocumentGeneration registered for document_generation
 */
export async function handleDocumentGeneration(params: ToolParams): Promise<ToolResult> {
  const context = params.context as ToolExecutionContext | undefined
  const signal = params.signal ?? context?.signal

  try {
    context?.onStart?.()
    checkCancellation(signal)

    validateParams(params, ['contentDescription'])

    const contentDescription = params.contentDescription as string
    const format = (params.format as string) ?? 'pdf'
    const title = params.title as string | undefined

    // Call the Document Generation API
    const response = await fetch('/api/tools/document-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentDescription, format, title }),
      signal,
    })

    checkCancellation(signal)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ToolError(
        errorData.error ?? `API error: ${response.status}`,
        errorData.code ?? 'API_ERROR',
        errorData.retryable ?? response.status >= 500
      )
    }

    const data = await response.json()
    const result: FileToolResult = {
      type: 'file',
      url: data.url ?? data.fileUrl,
      filename: data.filename ?? `document.${format}`,
      mimeType: data.mimeType,
    }

    context?.onComplete?.(result)
    return result
  } catch (error) {
    if (error instanceof ToolError) {
      context?.onError?.(error)
      throw error
    }
    const toolError = new ToolError(
      error instanceof Error ? error.message : 'Unknown error',
      error instanceof DOMException && error.name === 'AbortError' ? 'CANCELLED' : 'HANDLER_ERROR',
      false
    )
    context?.onError?.(toolError)
    throw toolError
  }
}

/**
 * Handler for chat completion tool
 * REQ_007.4: handleChatCompletion registered for chat_completion (refactored from /api/generate)
 */
export async function handleChatCompletion(params: ToolParams): Promise<ToolResult> {
  const context = params.context as ToolExecutionContext | undefined
  const signal = params.signal ?? context?.signal

  try {
    context?.onStart?.()
    checkCancellation(signal)

    validateParams(params, ['message'])

    const message = params.message as string

    // Call the Chat Completion API
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: message }),
      signal,
    })

    checkCancellation(signal)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ToolError(
        errorData.error ?? `API error: ${response.status}`,
        errorData.code ?? 'API_ERROR',
        errorData.retryable ?? response.status >= 500
      )
    }

    const data = await response.json()
    const result: TextToolResult = {
      type: 'text',
      content: data.response ?? data.content ?? JSON.stringify(data),
    }

    context?.onComplete?.(result)
    return result
  } catch (error) {
    if (error instanceof ToolError) {
      context?.onError?.(error)
      throw error
    }
    const toolError = new ToolError(
      error instanceof Error ? error.message : 'Unknown error',
      error instanceof DOMException && error.name === 'AbortError' ? 'CANCELLED' : 'HANDLER_ERROR',
      false
    )
    context?.onError?.(toolError)
    throw toolError
  }
}

// =============================================================================
// REQ_007.1: toolRegistry Map data structure
// =============================================================================

/**
 * Create the immutable tool registry
 * REQ_007.1: Map<string, ToolDefinition> for O(1) lookup performance
 * REQ_007.1: Immutable after initialization
 */
function createToolRegistry(): ReadonlyMap<string, ToolDefinition> {
  const registry = new Map<string, ToolDefinition>()

  // Register deep_research tool
  registry.set('deep_research', {
    name: 'deep_research',
    description: 'Performs in-depth research on a topic using OpenAI Deep Research API with web search and analysis capabilities',
    triggerPhrases: TOOL_TRIGGER_PHRASES.deep_research,
    handler: handleDeepResearch,
    responseType: 'text',
  })

  // Register image_generation tool
  registry.set('image_generation', {
    name: 'image_generation',
    description: 'Generates images using OpenAI Image Creation API based on text prompts',
    triggerPhrases: TOOL_TRIGGER_PHRASES.image_generation,
    handler: handleImageGeneration,
    responseType: 'image',
  })

  // Register document_generation tool
  registry.set('document_generation', {
    name: 'document_generation',
    description: 'Generates documents (PDF, DOCX, XLSX) using AI-generated structured content',
    triggerPhrases: TOOL_TRIGGER_PHRASES.document_generation,
    handler: handleDocumentGeneration,
    responseType: 'file',
  })

  // Register chat_completion tool
  registry.set('chat_completion', {
    name: 'chat_completion',
    description: 'General-purpose chat completion for conversation and assistance',
    triggerPhrases: TOOL_TRIGGER_PHRASES.chat_completion,
    handler: handleChatCompletion,
    responseType: 'text',
  })

  // Make the registry immutable
  return Object.freeze(registry) as ReadonlyMap<string, ToolDefinition>
}

/**
 * Immutable registry wrapped to throw on modification
 */
class ImmutableToolRegistry extends Map<string, ToolDefinition> {
  private readonly _frozen: ReadonlyMap<string, ToolDefinition>

  constructor(registry: ReadonlyMap<string, ToolDefinition>) {
    super()
    this._frozen = registry
    // Copy entries to parent Map for iteration
    for (const [key, value] of registry) {
      super.set(key, value)
    }
  }

  override set(): this {
    throw new Error('Tool registry is immutable and cannot be modified')
  }

  override delete(): boolean {
    throw new Error('Tool registry is immutable and cannot be modified')
  }

  override clear(): void {
    throw new Error('Tool registry is immutable and cannot be modified')
  }

  override get(key: string): ToolDefinition | undefined {
    return this._frozen.get(key)
  }

  override has(key: string): boolean {
    return this._frozen.has(key)
  }

  override get size(): number {
    return this._frozen.size
  }
}

/**
 * Central tool registry singleton
 * REQ_007.1: Exported as singleton module for consistent access
 */
export const toolRegistry = new ImmutableToolRegistry(createToolRegistry())

// =============================================================================
// REQ_007.1: Registry access functions
// =============================================================================

/**
 * Get a tool by name
 * REQ_007.1: getToolByName returns ToolDefinition | undefined
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name)
}

/**
 * Get all registered tools
 * REQ_007.1: getAllTools returns array of all registered ToolDefinitions
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values())
}

/**
 * Check if a tool exists by name
 * REQ_007.1: hasToolByName returns boolean
 */
export function hasToolByName(name: string): boolean {
  return toolRegistry.has(name)
}

// =============================================================================
// REQ_007.5: invokeToolHandler utility
// =============================================================================

/**
 * Invoke a tool handler through registry lookup
 * REQ_007.5: Unified error handling and response normalization
 */
export async function invokeToolHandler(
  toolName: string,
  params: ToolParams,
  context?: ToolExecutionContext
): Promise<ToolResult> {
  const startTime = performance.now()

  // Lookup tool in registry
  const tool = getToolByName(toolName)
  if (!tool) {
    const error = new ToolError(`Tool not found: ${toolName}`, 'NOT_FOUND', false)
    context?.onError?.(error)
    throw error
  }

  // Merge context into params
  const mergedParams: ToolParams = {
    ...params,
    signal: context?.signal ?? params.signal,
    context,
  }

  // Set up timeout if specified
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = context?.timeout
    ? new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new ToolError(`Tool execution timed out after ${context.timeout}ms`, 'TIMEOUT', true))
      }, context.timeout)
    })
    : null

  try {
    context?.onStart?.()

    // Execute handler with optional timeout
    const result = timeoutPromise
      ? await Promise.race([tool.handler(mergedParams), timeoutPromise])
      : await tool.handler(mergedParams)

    const duration = performance.now() - startTime
    console.log(`[ToolRegistry] ${toolName} completed in ${duration.toFixed(2)}ms`)

    return result
  } catch (error) {
    const duration = performance.now() - startTime
    console.log(`[ToolRegistry] ${toolName} failed after ${duration.toFixed(2)}ms`)

    if (error instanceof ToolError) {
      context?.onError?.(error)
      throw error
    }

    const toolError = new ToolError(
      error instanceof Error ? error.message : 'Unknown error',
      'HANDLER_ERROR',
      false
    )
    context?.onError?.(toolError)
    throw toolError
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}
