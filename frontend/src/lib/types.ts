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
