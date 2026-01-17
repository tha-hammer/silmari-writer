/**
 * Core type definitions for the writing agent UI
 */

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transcription API types
 */

export interface TranscriptionOptions {
  language?: string;        // ISO 639-1 code (e.g., 'en', 'es')
  prompt?: string;          // Context hint for Whisper
  temperature?: number;     // 0-1, sampling temperature
}

export type TranscriptionErrorCode = 'RATE_LIMIT' | 'FILE_TOO_LARGE' | 'NETWORK' | 'INVALID_API_KEY' | 'API_ERROR' | 'UPLOAD_ERROR';

export class TranscriptionError extends Error {
  code: TranscriptionErrorCode;
  retryable: boolean;

  constructor(message: string, code: TranscriptionErrorCode, retryable: boolean = false) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Attachment for messages (files, images, etc.)
 */
export interface Attachment {
  id: string;
  filename: string;
  size: number;
  type: string;
}

/**
 * Message in a conversation
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  isVoiceTranscription?: boolean; // Indicates message originated from voice transcription
}

/**
 * Non-blocking operation types (can run alongside blocking operations)
 */
export type NonBlockingOperationType = 'copy';

/**
 * Button operation types (mutually exclusive per message)
 */
export type BlockingOperationType = 'regenerate' | 'sendToAPI' | 'edit';

/**
 * State for non-blocking copy operation
 */
export interface CopyState {
  isActive: boolean;
  timestamp: number;
}

/**
 * State for blocking operations (mutually exclusive)
 */
export interface BlockingOperationState {
  type: BlockingOperationType;
  isLoading: boolean;
  error?: string;
}

/**
 * Per-message button state tracking
 */
export interface MessageButtonState {
  copy?: CopyState;
  blockingOperation?: BlockingOperationState;
}

/**
 * Deep Research API types (REQ_000)
 */

export type DeepResearchModel = 'o3-deep-research-2025-06-26' | 'o4-mini-deep-research-2025-06-26';

export type DeepResearchDepth = 'quick' | 'thorough';

export type ReasoningSummary = 'auto' | 'detailed';

export type DeepResearchErrorCode =
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'INVALID_API_KEY'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'JOB_NOT_FOUND'
  | 'JOB_FORBIDDEN';

export type DeepResearchJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Developer or user role message input for Deep Research API
 * REQ_000.2: Support developer and user role message inputs
 */
export interface DeepResearchMessage {
  role: 'developer' | 'user';
  content: Array<{ type: 'input_text'; text: string }>;
}

/**
 * Reasoning configuration for Deep Research API
 * REQ_000.3: Configure reasoning summary options
 */
export interface DeepResearchReasoning {
  summary: ReasoningSummary;
}

/**
 * Request body for Deep Research API
 * REQ_000.1-000.4: Full request structure
 * REQ_001.1-001.4: Tool configuration support
 */
export interface DeepResearchRequest {
  model: DeepResearchModel;
  input: DeepResearchMessage[];
  reasoning?: DeepResearchReasoning;
  background?: boolean;
  tools?: DeepResearchTool[];
}

/**
 * Citation in Deep Research response
 */
export interface DeepResearchCitation {
  type: 'url_citation';
  url: string;
  title?: string;
  start_index: number;
  end_index: number;
}

/**
 * Reasoning step from Deep Research
 */
export interface DeepResearchReasoningStep {
  id: string;
  type: 'reasoning';
  summary: Array<{ type: 'summary_text'; text: string }>;
}

/**
 * Content block in Deep Research response
 */
export interface DeepResearchContentBlock {
  type: 'output_text';
  text: string;
  annotations?: DeepResearchCitation[];
}

/**
 * Output item from Deep Research response
 */
export interface DeepResearchOutputItem {
  id: string;
  type: 'message';
  role: 'assistant';
  content: DeepResearchContentBlock[];
}

/**
 * Progress information for background jobs
 * REQ_000.5: Progress tracking
 */
export interface DeepResearchProgress {
  step: string;
  percentage?: number;
}

/**
 * Job metadata from background mode response
 * REQ_000.4: Background mode response
 */
export interface DeepResearchJobMetadata {
  id: string;
  status: DeepResearchJobStatus;
  statusUrl: string;
  createdAt: string;
  model: DeepResearchModel;
  estimatedCompletion?: {
    min: number; // minutes
    max: number; // minutes
  };
}

/**
 * Full Deep Research API response
 */
export interface DeepResearchApiResponse {
  id: string;
  object: 'response';
  status: DeepResearchJobStatus;
  output?: DeepResearchOutputItem[];
  reasoning?: DeepResearchReasoningStep[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Processed Deep Research result for UI consumption
 * REQ_001.5: Extended with search queries and code executions
 */
export interface DeepResearchResult {
  text: string;
  citations: DeepResearchCitation[];
  reasoningSteps: Array<{ id: string; text: string }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
  };
  searchQueries?: Array<{ id: string; query: string; status: string }>;
  codeExecutions?: Array<{ id: string; code: string; output?: string; status: string }>;
  costBreakdown?: DeepResearchCostBreakdown;
}

/**
 * Status response for polling background jobs
 * REQ_000.5: Polling mechanism
 */
export interface DeepResearchStatusResponse {
  status: DeepResearchJobStatus;
  progress?: DeepResearchProgress;
  result?: DeepResearchResult;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Deep Research error class
 */
export class DeepResearchError extends Error {
  code: DeepResearchErrorCode;
  retryable: boolean;

  constructor(message: string, code: DeepResearchErrorCode, retryable: boolean = false) {
    super(message);
    this.name = 'DeepResearchError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Options for initiating a Deep Research request
 */
export interface DeepResearchOptions {
  query: string;
  depth?: DeepResearchDepth;
  developerInstructions?: string;
  reasoningSummary?: ReasoningSummary;
  background?: boolean;
  tools?: DeepResearchTool[];
}

/**
 * Deep Research Tool Types (REQ_001)
 */

/**
 * User location for web search targeting
 * REQ_001.1: Geolocation configuration
 */
export interface UserLocation {
  country: string; // ISO 3166-1 alpha-2 code
  city?: string;
  region?: string;
}

/**
 * Domain configuration for web search filtering
 * REQ_001.1: Domain whitelist/blacklist
 */
export interface DomainConfig {
  include?: string[]; // Whitelist domains
  exclude?: string[]; // Blacklist domains
}

/**
 * Search context size for web search
 * REQ_001.1: Controls amount of context retrieved
 */
export type SearchContextSize = 'low' | 'medium' | 'high';

/**
 * Web Search Preview Tool configuration
 * REQ_001.1: web_search_preview tool
 */
export interface WebSearchPreviewTool {
  type: 'web_search_preview';
  domains?: DomainConfig;
  search_context_size?: SearchContextSize;
  user_location?: UserLocation;
}

/**
 * Code Interpreter Tool configuration
 * REQ_001.2: code_interpreter tool
 */
export interface CodeInterpreterTool {
  type: 'code_interpreter';
}

/**
 * File Search Tool configuration
 * REQ_001.3: file_search tool with vector store IDs
 */
export interface FileSearchTool {
  type: 'file_search';
  vector_store_ids: string[]; // Max 2 IDs, format: vs_xxxxx
}

/**
 * MCP Tool configuration
 * REQ_001.4: MCP tool support
 */
export interface McpTool {
  type: 'mcp';
  server_url: string; // Must be HTTPS
  require_approval?: boolean; // Default: true
}

/**
 * Union type for all Deep Research tools
 * REQ_001.1-001.4: Combined tool types
 */
export type DeepResearchTool =
  | WebSearchPreviewTool
  | CodeInterpreterTool
  | FileSearchTool
  | McpTool;

/**
 * Web search call item from response output
 * REQ_001.5: Intermediate reasoning transparency
 */
export interface WebSearchCallItem {
  id: string;
  type: 'web_search_call';
  status: string;
  query?: string;
}

/**
 * Code interpreter call item from response output
 * REQ_001.5: Code execution tracking
 */
export interface CodeInterpreterCallItem {
  id: string;
  type: 'code_interpreter_call';
  status: string;
  code?: string;
  output?: string;
}

/**
 * Cost breakdown for Deep Research result
 * REQ_001.2: Track code interpreter session costs
 */
export interface DeepResearchCostBreakdown {
  codeInterpreterSessions?: number;
  codeInterpreterCost?: number; // $0.03 per session
}

/**
 * Image Generation API types (REQ_002)
 */

export type ImageGenerationModel = 'gpt-image-1.5' | 'gpt-image-1' | 'gpt-image-1-mini';

export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';

export type ImageQuality = 'low' | 'medium' | 'high';

export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

export type ImageBackground = 'auto' | 'transparent' | 'opaque';

export type ImageGenerationErrorCode =
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'INVALID_API_KEY'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'CONFIG_ERROR'
  | 'INVALID_RESPONSE'
  | 'UPLOAD_FAILED'
  | 'TIMEOUT';

/**
 * Request body for Image Generation API
 * REQ_002.1, REQ_002.5: Full request structure
 */
export interface ImageGenerationRequest {
  prompt: string;
  model?: ImageGenerationModel;
  n?: number; // 1-10 images
  size?: ImageSize;
  quality?: ImageQuality;
  output_format?: ImageOutputFormat;
  background?: ImageBackground;
}

/**
 * Single image data from OpenAI API response
 * REQ_002.3: Base64 response structure
 */
export interface ImageData {
  b64_json: string;
  revised_prompt?: string;
}

/**
 * OpenAI Image Generation API response
 * REQ_002.3: Response structure
 */
export interface OpenAIImageResponse {
  created: number;
  data: ImageData[];
}

/**
 * Generated image result with storage URL
 * REQ_002.4: Persisted image structure
 */
export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
  format: ImageOutputFormat;
  size: ImageSize;
  model: ImageGenerationModel;
  generatedAt: string;
}

/**
 * Image Generation API response
 * REQ_002.1: Full response structure
 */
export interface ImageGenerationResponse {
  images: GeneratedImage[];
  model: ImageGenerationModel;
  quality: ImageQuality;
  estimatedCost?: number;
}

/**
 * Image Generation error class
 * REQ_002.1: Error handling
 */
export class ImageGenerationError extends Error {
  code: ImageGenerationErrorCode;
  retryable: boolean;

  constructor(message: string, code: ImageGenerationErrorCode, retryable: boolean = false) {
    super(message);
    this.name = 'ImageGenerationError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Document Generation API types (REQ_003)
 */

export type DocumentGenerationModel = 'gpt-4-turbo' | 'gpt-4o' | 'gpt-4o-mini';

export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';

export type DocumentType = 'report' | 'spreadsheet' | 'letter' | 'proposal' | 'invoice';

export type DocumentGenerationErrorCode =
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'INVALID_API_KEY'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'CONFIG_ERROR'
  | 'INVALID_RESPONSE'
  | 'UPLOAD_FAILED'
  | 'TIMEOUT'
  | 'GENERATION_FAILED'
  | 'SCHEMA_VALIDATION_FAILED';

/**
 * Column type for spreadsheet documents
 * REQ_003.2: Column definition schema
 */
export type ColumnType = 'string' | 'number' | 'date' | 'currency';

/**
 * Column definition for spreadsheet documents
 * REQ_003.2: Column schema
 */
export interface ColumnDefinition {
  header: string;
  type: ColumnType;
  width?: number;
}

/**
 * List item structure for documents
 * REQ_003.2: List schema
 */
export interface DocumentList {
  items: string[];
  ordered: boolean;
  nested?: DocumentList[];
}

/**
 * Table structure for documents
 * REQ_003.2: Table schema
 */
export interface DocumentTable {
  headers: string[];
  rows: string[][];
  caption?: string;
}

/**
 * Section structure for documents
 * REQ_003.2: Section schema with nested subsections
 */
export interface DocumentSection {
  heading: string;
  content: string;
  subsections?: DocumentSection[];
  tables?: DocumentTable[];
  lists?: DocumentList[];
}

/**
 * Base document content structure
 * REQ_003.2: Base document schema
 */
export interface DocumentContent {
  title: string;
  author?: string;
  createdAt: string; // ISO date string
  sections: DocumentSection[];
}

/**
 * Spreadsheet content structure
 * REQ_003.2: Spreadsheet schema
 */
export interface SpreadsheetContent {
  title: string;
  author?: string;
  createdAt: string;
  sheets: SpreadsheetSheet[];
}

/**
 * Single sheet within a spreadsheet
 * REQ_003.2: Sheet schema
 */
export interface SpreadsheetSheet {
  sheetName: string;
  columns: ColumnDefinition[];
  rows: (string | number | null)[][];
}

/**
 * Request body for Document Generation API
 * REQ_003.1: Request structure
 */
export interface DocumentGenerationRequest {
  prompt: string;
  documentType: DocumentType;
  format: DocumentFormat;
  model?: DocumentGenerationModel;
  context?: string;
}

/**
 * Generated document result with storage URL
 * REQ_003.1: Generated document structure
 */
export interface GeneratedDocument {
  url: string;
  filename: string;
  format: DocumentFormat;
  documentType: DocumentType;
  title: string;
  generatedAt: string;
  sizeBytes: number;
}

/**
 * Document Generation API response
 * REQ_003.1: Response structure
 */
export interface DocumentGenerationResponse {
  document: GeneratedDocument;
  model: DocumentGenerationModel;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  generationTime: number; // milliseconds
}

/**
 * Document Generation error class
 * REQ_003.1: Error handling
 */
export class DocumentGenerationError extends Error {
  code: DocumentGenerationErrorCode;
  retryable: boolean;
  suggestedAction?: string;

  constructor(
    message: string,
    code: DocumentGenerationErrorCode,
    retryable: boolean = false,
    suggestedAction?: string
  ) {
    super(message);
    this.name = 'DocumentGenerationError';
    this.code = code;
    this.retryable = retryable;
    this.suggestedAction = suggestedAction;
  }
}

/**
 * Schema version information
 * REQ_003.2: Schema versioning
 */
export interface SchemaVersion {
  version: string;
  type: DocumentType;
  schema: object;
}

/**
 * JSON Schema for OpenAI Structured Outputs
 * REQ_003.1: Response format configuration
 */
export interface StructuredOutputSchema {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: boolean;
    schema: object;
  };
}

/**
 * Intent Classification API types (REQ_006)
 */

/**
 * Four core intent types for tool routing
 * REQ_006.2: Union literal type for intent classification
 *
 * @example
 * // deep_research - Use for research queries, investigations, analysis
 * "Research the latest AI developments" -> deep_research
 *
 * @example
 * // image_generation - Use for visual content creation
 * "Create an image of a sunset" -> image_generation
 *
 * @example
 * // document_generation - Use for creating documents, reports, spreadsheets
 * "Generate a PDF report" -> document_generation
 *
 * @example
 * // chat_completion - Default for general conversation and assistance
 * "Help me write an email" -> chat_completion
 */
export type ToolIntent = 'deep_research' | 'image_generation' | 'document_generation' | 'chat_completion';

/**
 * Parameters for deep research intent
 * REQ_006.2: DeepResearchParams interface
 */
export interface DeepResearchParams {
  kind: 'deep_research';
  query: string;
  depth?: 'quick' | 'thorough';
  topics?: string[];
}

/**
 * Parameters for image generation intent
 * REQ_006.2: ImageGenerationParams interface
 */
export interface ImageGenerationParams {
  kind: 'image_generation';
  prompt: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high';
  style?: string;
}

/**
 * Parameters for document generation intent
 * REQ_006.2: DocumentGenerationParams interface
 */
export interface DocumentGenerationParams {
  kind: 'document_generation';
  type: 'pdf' | 'docx' | 'xlsx';
  contentDescription: string;
  template?: string;
  title?: string;
}

/**
 * Parameters for chat completion intent (default fallback)
 * REQ_006.2: ChatCompletionParams interface
 */
export interface ChatCompletionParams {
  kind: 'chat_completion';
  message: string;
}

/**
 * Discriminated union for extracted parameters
 * REQ_006.2: Allows narrowing based on 'kind' discriminant field
 */
export type ExtractedParams =
  | DeepResearchParams
  | ImageGenerationParams
  | DocumentGenerationParams
  | ChatCompletionParams;

/**
 * Type guard for DeepResearchParams
 * REQ_006.2: Type-safe parameter validation
 */
export function isDeepResearchParams(params: ExtractedParams): params is DeepResearchParams {
  return params.kind === 'deep_research';
}

/**
 * Type guard for ImageGenerationParams
 * REQ_006.2: Type-safe parameter validation
 */
export function isImageGenerationParams(params: ExtractedParams): params is ImageGenerationParams {
  return params.kind === 'image_generation';
}

/**
 * Type guard for DocumentGenerationParams
 * REQ_006.2: Type-safe parameter validation
 */
export function isDocumentGenerationParams(params: ExtractedParams): params is DocumentGenerationParams {
  return params.kind === 'document_generation';
}

/**
 * Type guard for ChatCompletionParams
 * REQ_006.2: Type-safe parameter validation
 */
export function isChatCompletionParams(params: ExtractedParams): params is ChatCompletionParams {
  return params.kind === 'chat_completion';
}

/**
 * Type guard for validating unknown strings as ToolIntent
 * REQ_006.2: Runtime validation for intent strings
 */
export function isValidToolIntent(value: string): value is ToolIntent {
  return ['deep_research', 'image_generation', 'document_generation', 'chat_completion'].includes(value);
}

/**
 * Human-readable display names for intents
 * REQ_006.2: UI display labels
 */
export const TOOL_INTENT_DISPLAY_NAMES: Record<ToolIntent, string> = {
  deep_research: 'Deep Research',
  image_generation: 'Image Generation',
  document_generation: 'Document Generation',
  chat_completion: 'Chat',
};

/**
 * Icon names for intent types
 * REQ_006.2: UI icon mapping
 */
export const TOOL_INTENT_ICONS: Record<ToolIntent, string> = {
  deep_research: 'search',
  image_generation: 'image',
  document_generation: 'file-text',
  chat_completion: 'message-circle',
};

/**
 * Alternative intent suggestion
 * REQ_006.3: For ambiguous classifications
 */
export interface AlternativeIntent {
  tool: ToolIntent;
  confidence: number;
}

/**
 * Confidence thresholds for classification decisions
 * REQ_006.3: Semantic confidence levels
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3,
  MINIMUM: 0.1,
} as const;

/**
 * Classified intent response structure
 * REQ_006.3: Core response interface
 */
export interface ClassifiedIntent {
  /** Detected tool type */
  tool: ToolIntent;
  /** Confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Extracted parameters for the detected tool */
  extractedParams: ExtractedParams;
  /** Alternative intents when classification is ambiguous */
  alternativeIntents?: AlternativeIntent[];
  /** Original user message preserved for reference */
  rawMessage?: string;
  /** Timestamp of classification for debugging */
  classifiedAt?: string;
}

/**
 * Clamp confidence to valid 0.0-1.0 range
 * REQ_006.3: Handle edge cases like negative, >1, NaN
 */
export function clampConfidence(n: number): number {
  if (Number.isNaN(n) || n === undefined || n === null) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}

/**
 * Determine if clarification should be requested
 * REQ_006.3: Returns true if confidence < MEDIUM threshold
 */
export function shouldRequestClarification(intent: ClassifiedIntent): boolean {
  return intent.confidence < CONFIDENCE_THRESHOLDS.MEDIUM;
}

/**
 * Get semantic confidence level from numeric score
 * REQ_006.3: Convert numeric confidence to category
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'high';
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'low';
}

/**
 * Intent classification error codes
 * REQ_006.1: Error handling codes
 */
export type IntentClassificationErrorCode =
  | 'INVALID_INPUT'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'INVALID_API_KEY'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE';

/**
 * Intent Classification error class
 * REQ_006.1: Error handling
 */
export class IntentClassificationError extends Error {
  code: IntentClassificationErrorCode;
  retryable: boolean;

  constructor(message: string, code: IntentClassificationErrorCode, retryable: boolean = false) {
    super(message);
    this.name = 'IntentClassificationError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Validate that a response matches ClassifiedIntent structure
 * REQ_006.3: Runtime validation for API responses
 * @throws IntentClassificationError on invalid structure
 */
export function validateClassifiedIntent(response: unknown): ClassifiedIntent {
  if (!response || typeof response !== 'object') {
    throw new IntentClassificationError(
      'Invalid response: expected object',
      'VALIDATION_ERROR'
    );
  }

  const obj = response as Record<string, unknown>;

  // Validate tool field
  if (typeof obj.tool !== 'string' || !isValidToolIntent(obj.tool)) {
    throw new IntentClassificationError(
      `Invalid tool type: ${obj.tool}`,
      'VALIDATION_ERROR'
    );
  }

  // Validate confidence field
  if (typeof obj.confidence !== 'number') {
    throw new IntentClassificationError(
      'Invalid confidence: expected number',
      'VALIDATION_ERROR'
    );
  }

  // Validate extractedParams field
  if (!obj.extractedParams || typeof obj.extractedParams !== 'object') {
    throw new IntentClassificationError(
      'Invalid extractedParams: expected object',
      'VALIDATION_ERROR'
    );
  }

  const params = obj.extractedParams as Record<string, unknown>;
  if (typeof params.kind !== 'string') {
    throw new IntentClassificationError(
      'Invalid extractedParams: missing kind discriminant',
      'VALIDATION_ERROR'
    );
  }

  // Validate alternativeIntents if present
  if (obj.alternativeIntents !== undefined) {
    if (!Array.isArray(obj.alternativeIntents)) {
      throw new IntentClassificationError(
        'Invalid alternativeIntents: expected array',
        'VALIDATION_ERROR'
      );
    }
    for (const alt of obj.alternativeIntents) {
      if (
        typeof alt !== 'object' ||
        !alt ||
        typeof (alt as AlternativeIntent).tool !== 'string' ||
        typeof (alt as AlternativeIntent).confidence !== 'number'
      ) {
        throw new IntentClassificationError(
          'Invalid alternativeIntent structure',
          'VALIDATION_ERROR'
        );
      }
    }
  }

  return {
    tool: obj.tool as ToolIntent,
    confidence: clampConfidence(obj.confidence as number),
    extractedParams: obj.extractedParams as ExtractedParams,
    alternativeIntents: obj.alternativeIntents as AlternativeIntent[] | undefined,
    rawMessage: typeof obj.rawMessage === 'string' ? obj.rawMessage : undefined,
    classifiedAt: typeof obj.classifiedAt === 'string' ? obj.classifiedAt : undefined,
  };
}

/**
 * Clarification dialog timeout in milliseconds
 * REQ_006.5: 5 minutes timeout for pending clarification
 */
export const CLARIFICATION_TIMEOUT_MS = 300000;

/**
 * User choices for clarification dialog
 * REQ_006.5: Clarification flow options
 */
export type ClarificationChoice = 'confirm' | 'alternative' | 'clarify' | 'cancel';

/**
 * Clarification state for managing pending clarifications
 * REQ_006.5: Session persistence
 */
export interface ClarificationState {
  intent: ClassifiedIntent;
  originalMessage: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Intent classifier prompt version for A/B testing
 * REQ_006.4: Version tracking
 */
export const INTENT_CLASSIFIER_PROMPT_VERSION = 'v1.0.0';
