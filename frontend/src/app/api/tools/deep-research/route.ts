import { NextRequest, NextResponse } from 'next/server';
import type {
  DeepResearchModel,
  DeepResearchDepth,
  ReasoningSummary,
  DeepResearchErrorCode,
  DeepResearchJobStatus,
  DeepResearchMessage,
  DeepResearchRequest,
  DeepResearchApiResponse,
  DeepResearchResult,
  DeepResearchCitation,
  DeepResearchOptions,
  DeepResearchTool,
  WebSearchPreviewTool,
  CodeInterpreterTool,
  FileSearchTool,
  McpTool,
  SearchContextSize,
  DeepResearchCostBreakdown,
} from '@/lib/types';

// Constants
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const MAX_TEXT_LENGTH = 32000;
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes for non-background mode

// Model selection based on depth
const MODEL_MAP: Record<DeepResearchDepth, DeepResearchModel> = {
  quick: 'o4-mini-deep-research-2025-06-26',
  thorough: 'o3-deep-research-2025-06-26',
};

// Default reasoning summary based on depth
const DEFAULT_REASONING_MAP: Record<DeepResearchDepth, ReasoningSummary> = {
  quick: 'auto',
  thorough: 'detailed',
};

// Error response helper
class DeepResearchApiError extends Error {
  constructor(
    message: string,
    public code: DeepResearchErrorCode,
    public retryable: boolean,
    public statusCode: number
  ) {
    super(message);
    this.name = 'DeepResearchApiError';
  }
}

// Validation functions
function validateQuery(query: unknown): string {
  if (!query || typeof query !== 'string') {
    throw new DeepResearchApiError(
      'Query is required and must be a string',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new DeepResearchApiError(
      'Query cannot be empty or whitespace only',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new DeepResearchApiError(
      `Query exceeds maximum length of 32,000 characters`,
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  return trimmed;
}

function validateDepth(depth: unknown): DeepResearchDepth {
  if (depth === undefined || depth === null) {
    return 'quick'; // Default
  }

  if (depth !== 'quick' && depth !== 'thorough') {
    throw new DeepResearchApiError(
      'Depth must be "quick" or "thorough"',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  return depth as DeepResearchDepth;
}

function validateReasoningSummary(
  summary: unknown,
  defaultValue: ReasoningSummary
): ReasoningSummary {
  if (summary === undefined || summary === null) {
    return defaultValue;
  }

  if (summary !== 'auto' && summary !== 'detailed') {
    throw new DeepResearchApiError(
      'Reasoning summary must be "auto" or "detailed"',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  return summary as ReasoningSummary;
}

function validateDeveloperInstructions(instructions: unknown): string | undefined {
  if (instructions === undefined || instructions === null) {
    return undefined;
  }

  if (typeof instructions !== 'string') {
    throw new DeepResearchApiError(
      'Developer instructions must be a string',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  const trimmed = instructions.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new DeepResearchApiError(
      `Developer instructions exceed maximum length of 32,000 characters`,
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  return trimmed;
}

// Domain pattern validation (e.g., example.com, sub.example.com)
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// ISO 3166-1 alpha-2 country codes (common subset)
const VALID_COUNTRY_CODES = new Set([
  'US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
  'AU', 'NZ', 'JP', 'KR', 'CN', 'IN', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'ZA', 'EG', 'NG',
  'RU', 'UA', 'PL', 'CZ', 'RO', 'HU', 'GR', 'PT', 'IE', 'IL', 'AE', 'SA', 'SG', 'MY', 'TH',
  'ID', 'PH', 'VN', 'TW', 'HK', 'TR', 'PK', 'BD'
]);

// Vector store ID pattern (vs_xxxxx)
const VECTOR_STORE_ID_PATTERN = /^vs_[a-zA-Z0-9]+$/;

// Valid search context sizes
const VALID_SEARCH_CONTEXT_SIZES: SearchContextSize[] = ['low', 'medium', 'high'];

function validateDomain(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain);
}

function validateCountryCode(code: string): boolean {
  return VALID_COUNTRY_CODES.has(code.toUpperCase());
}

function validateVectorStoreId(id: string): boolean {
  return VECTOR_STORE_ID_PATTERN.test(id);
}

function validateHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateWebSearchPreviewTool(tool: WebSearchPreviewTool): void {
  // Validate domains if provided
  if (tool.domains) {
    if (tool.domains.include) {
      if (!Array.isArray(tool.domains.include)) {
        throw new DeepResearchApiError(
          'web_search_preview domains.include must be an array',
          'VALIDATION_ERROR',
          false,
          400
        );
      }
      for (const domain of tool.domains.include) {
        if (typeof domain !== 'string' || !validateDomain(domain)) {
          throw new DeepResearchApiError(
            `Invalid domain format in include list: "${domain}". Expected format: example.com`,
            'VALIDATION_ERROR',
            false,
            400
          );
        }
      }
    }

    if (tool.domains.exclude) {
      if (!Array.isArray(tool.domains.exclude)) {
        throw new DeepResearchApiError(
          'web_search_preview domains.exclude must be an array',
          'VALIDATION_ERROR',
          false,
          400
        );
      }
      for (const domain of tool.domains.exclude) {
        if (typeof domain !== 'string' || !validateDomain(domain)) {
          throw new DeepResearchApiError(
            `Invalid domain format in exclude list: "${domain}". Expected format: example.com`,
            'VALIDATION_ERROR',
            false,
            400
          );
        }
      }
    }
  }

  // Validate search_context_size if provided
  if (tool.search_context_size !== undefined) {
    if (!VALID_SEARCH_CONTEXT_SIZES.includes(tool.search_context_size)) {
      throw new DeepResearchApiError(
        `Invalid search_context_size: "${tool.search_context_size}". Must be one of: low, medium, high`,
        'VALIDATION_ERROR',
        false,
        400
      );
    }
  }

  // Validate user_location if provided
  if (tool.user_location) {
    if (!tool.user_location.country || typeof tool.user_location.country !== 'string') {
      throw new DeepResearchApiError(
        'user_location.country is required and must be a string',
        'VALIDATION_ERROR',
        false,
        400
      );
    }

    if (!validateCountryCode(tool.user_location.country)) {
      throw new DeepResearchApiError(
        `Invalid country code: "${tool.user_location.country}". Must be a valid ISO 3166-1 alpha-2 code`,
        'VALIDATION_ERROR',
        false,
        400
      );
    }

    if (tool.user_location.city !== undefined && typeof tool.user_location.city !== 'string') {
      throw new DeepResearchApiError(
        'user_location.city must be a string',
        'VALIDATION_ERROR',
        false,
        400
      );
    }

    if (tool.user_location.region !== undefined && typeof tool.user_location.region !== 'string') {
      throw new DeepResearchApiError(
        'user_location.region must be a string',
        'VALIDATION_ERROR',
        false,
        400
      );
    }
  }
}

function validateCodeInterpreterTool(tool: CodeInterpreterTool): void {
  // code_interpreter tool only requires type field, which is already validated
  if (tool.type !== 'code_interpreter') {
    throw new DeepResearchApiError(
      'Invalid code_interpreter tool type',
      'VALIDATION_ERROR',
      false,
      400
    );
  }
}

function validateFileSearchTool(tool: FileSearchTool): void {
  // Validate vector_store_ids is required and is an array
  if (!tool.vector_store_ids || !Array.isArray(tool.vector_store_ids)) {
    throw new DeepResearchApiError(
      'file_search tool requires vector_store_ids array',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  // Validate max 2 vector store IDs
  if (tool.vector_store_ids.length > 2) {
    throw new DeepResearchApiError(
      'file_search tool allows maximum of 2 vector_store_ids',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  // Validate at least 1 vector store ID
  if (tool.vector_store_ids.length === 0) {
    throw new DeepResearchApiError(
      'file_search tool requires at least one vector_store_id',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  // Validate each vector store ID format
  for (const id of tool.vector_store_ids) {
    if (typeof id !== 'string' || !validateVectorStoreId(id)) {
      throw new DeepResearchApiError(
        `Invalid vector_store_id format: "${id}". Expected format: vs_xxxxx`,
        'VALIDATION_ERROR',
        false,
        400
      );
    }
  }
}

function validateMcpTool(tool: McpTool): void {
  // Validate server_url is required
  if (!tool.server_url || typeof tool.server_url !== 'string') {
    throw new DeepResearchApiError(
      'mcp tool requires server_url',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  // Validate URL format
  try {
    new URL(tool.server_url);
  } catch {
    throw new DeepResearchApiError(
      `Invalid server_url format: "${tool.server_url}". Must be a valid URL`,
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  // Validate HTTPS requirement
  if (!validateHttpsUrl(tool.server_url)) {
    throw new DeepResearchApiError(
      'mcp server_url must use HTTPS protocol',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  // Validate require_approval if provided
  if (tool.require_approval !== undefined && typeof tool.require_approval !== 'boolean') {
    throw new DeepResearchApiError(
      'mcp require_approval must be a boolean',
      'VALIDATION_ERROR',
      false,
      400
    );
  }
}

function validateTools(tools: unknown): DeepResearchTool[] | undefined {
  if (tools === undefined || tools === null) {
    return undefined;
  }

  if (!Array.isArray(tools)) {
    throw new DeepResearchApiError(
      'tools must be an array',
      'VALIDATION_ERROR',
      false,
      400
    );
  }

  const validatedTools: DeepResearchTool[] = [];

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object' || !('type' in tool)) {
      throw new DeepResearchApiError(
        'Each tool must have a type field',
        'VALIDATION_ERROR',
        false,
        400
      );
    }

    switch (tool.type) {
      case 'web_search_preview':
        validateWebSearchPreviewTool(tool as WebSearchPreviewTool);
        validatedTools.push(tool as WebSearchPreviewTool);
        break;
      case 'code_interpreter':
        validateCodeInterpreterTool(tool as CodeInterpreterTool);
        validatedTools.push(tool as CodeInterpreterTool);
        break;
      case 'file_search':
        validateFileSearchTool(tool as FileSearchTool);
        validatedTools.push(tool as FileSearchTool);
        break;
      case 'mcp':
        validateMcpTool(tool as McpTool);
        validatedTools.push(tool as McpTool);
        break;
      default:
        throw new DeepResearchApiError(
          `Unknown tool type: "${tool.type}". Supported types: web_search_preview, code_interpreter, file_search, mcp`,
          'VALIDATION_ERROR',
          false,
          400
        );
    }
  }

  return validatedTools.length > 0 ? validatedTools : undefined;
}

// Build input messages array
function buildInputMessages(
  query: string,
  developerInstructions?: string
): DeepResearchMessage[] {
  const messages: DeepResearchMessage[] = [];

  // Developer messages come first
  if (developerInstructions) {
    messages.push({
      role: 'developer',
      content: [{ type: 'input_text', text: developerInstructions }],
    });
  }

  // User query
  messages.push({
    role: 'user',
    content: [{ type: 'input_text', text: query }],
  });

  return messages;
}

// Build the request payload
function buildRequestPayload(
  model: DeepResearchModel,
  input: DeepResearchMessage[],
  reasoningSummary: ReasoningSummary,
  background: boolean,
  tools?: DeepResearchTool[]
): DeepResearchRequest {
  const payload: DeepResearchRequest = {
    model,
    input,
    reasoning: { summary: reasoningSummary },
    background,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  return payload;
}

// Code interpreter session cost constant
const CODE_INTERPRETER_SESSION_COST = 0.03;

// Process API response into result format
function processApiResponse(response: DeepResearchApiResponse): DeepResearchResult {
  // Extract text from output
  let text = '';
  const citations: DeepResearchCitation[] = [];
  const searchQueries: Array<{ id: string; query: string; status: string }> = [];
  const codeExecutions: Array<{ id: string; code: string; output?: string; status: string }> = [];
  let codeInterpreterSessions = 0;

  if (response.output) {
    for (const outputItem of response.output) {
      // Handle message type items
      if (outputItem.type === 'message' && outputItem.content) {
        for (const contentBlock of outputItem.content) {
          if (contentBlock.type === 'output_text') {
            text += contentBlock.text;
            if (contentBlock.annotations) {
              citations.push(...contentBlock.annotations);
            }
          }
        }
      }

      // Handle web_search_call items (REQ_001.5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyItem = outputItem as any;
      if (anyItem.type === 'web_search_call') {
        searchQueries.push({
          id: anyItem.id || '',
          query: anyItem.query || '',
          status: anyItem.status || 'unknown',
        });
      }

      // Handle code_interpreter_call items (REQ_001.2, REQ_001.5)
      if (anyItem.type === 'code_interpreter_call') {
        codeExecutions.push({
          id: anyItem.id || '',
          code: anyItem.code || '',
          output: anyItem.output,
          status: anyItem.status || 'unknown',
        });
        // Each code_interpreter_call represents a session
        codeInterpreterSessions++;
      }
    }
  }

  // Extract reasoning steps from response.output with type === 'reasoning' (REQ_001.5)
  const reasoningSteps: Array<{ id: string; text: string }> = [];

  // Check for reasoning items in output array
  if (response.output) {
    for (const outputItem of response.output) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyItem = outputItem as any;
      if (anyItem.type === 'reasoning' && anyItem.summary) {
        const summaryText = anyItem.summary
          .filter((s: { type: string }) => s.type === 'summary_text')
          .map((s: { text: string }) => s.text)
          .join(' ');
        reasoningSteps.push({ id: anyItem.id, text: summaryText });
      }
    }
  }

  // Also check legacy reasoning field
  if (response.reasoning) {
    for (const step of response.reasoning) {
      if (step.type === 'reasoning' && step.summary) {
        const summaryText = step.summary
          .filter((s) => s.type === 'summary_text')
          .map((s) => s.text)
          .join(' ');
        // Avoid duplicates
        if (!reasoningSteps.find(r => r.id === step.id)) {
          reasoningSteps.push({ id: step.id, text: summaryText });
        }
      }
    }
  }

  // Process usage
  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        reasoningTokens: response.usage.reasoning_tokens,
      }
    : undefined;

  // Build cost breakdown (REQ_001.2)
  const costBreakdown: DeepResearchCostBreakdown | undefined =
    codeInterpreterSessions > 0
      ? {
          codeInterpreterSessions,
          codeInterpreterCost: codeInterpreterSessions * CODE_INTERPRETER_SESSION_COST,
        }
      : undefined;

  // Build result
  const result: DeepResearchResult = { text, citations, reasoningSteps, usage };

  if (searchQueries.length > 0) {
    result.searchQueries = searchQueries;
  }

  if (codeExecutions.length > 0) {
    result.codeExecutions = codeExecutions;
  }

  if (costBreakdown) {
    result.costBreakdown = costBreakdown;
  }

  return result;
}

// Handle API errors
function handleApiError(status: number, errorData: { error?: { message?: string; code?: string } }): never {
  const message = errorData?.error?.message || 'Unknown API error';

  switch (status) {
    case 401:
      throw new DeepResearchApiError(
        `Invalid API key: ${message}`,
        'INVALID_API_KEY',
        false,
        401
      );
    case 429:
      throw new DeepResearchApiError(
        `Rate limit exceeded: ${message}`,
        'RATE_LIMIT',
        true,
        429
      );
    case 500:
    case 502:
    case 503:
    case 504:
      throw new DeepResearchApiError(
        `Server error: ${message}`,
        'API_ERROR',
        true,
        status
      );
    default:
      throw new DeepResearchApiError(
        `API error: ${message}`,
        'API_ERROR',
        false,
        status
      );
  }
}

// Main POST handler
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Deep Research service not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json() as DeepResearchOptions & { background?: boolean };

    // Validate inputs
    const query = validateQuery(body.query);
    const depth = validateDepth(body.depth);
    const defaultReasoning = DEFAULT_REASONING_MAP[depth];
    const reasoningSummary = validateReasoningSummary(body.reasoningSummary, defaultReasoning);
    const developerInstructions = validateDeveloperInstructions(body.developerInstructions);
    const tools = validateTools(body.tools);

    // Determine if background mode (default true)
    const background = body.background !== false;

    // Select model based on depth
    const model = MODEL_MAP[depth];

    // Build request
    const input = buildInputMessages(query, developerInstructions);
    const payload = buildRequestPayload(model, input, reasoningSummary, background, tools);

    // Log request (timing and model)
    const startTime = Date.now();
    console.log(`[Deep Research] Starting request - model: ${model}, background: ${background}`);

    // Make API request
    let apiResponse: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      apiResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DeepResearchApiError(
          'Request timed out',
          'TIMEOUT',
          true,
          504
        );
      }
      throw new DeepResearchApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK',
        true,
        502
      );
    }

    // Handle non-OK responses
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      handleApiError(apiResponse.status, errorData);
    }

    // Parse response
    const data = await apiResponse.json() as DeepResearchApiResponse;

    // Log completion
    const duration = Date.now() - startTime;
    console.log(`[Deep Research] Request completed - duration: ${duration}ms, status: ${data.status}`);

    // Handle background mode response
    if (background && data.status === 'pending') {
      return NextResponse.json(
        {
          jobId: data.id,
          status: data.status as DeepResearchJobStatus,
          statusUrl: `/api/tools/deep-research/${data.id}/status`,
          createdAt: new Date().toISOString(),
          model,
        },
        { status: 202 }
      );
    }

    // Handle completed response (non-background mode or already completed)
    if (data.status === 'completed') {
      const result = processApiResponse(data);
      return NextResponse.json(result, { status: 200 });
    }

    // Handle processing state (shouldn't happen in non-background mode)
    return NextResponse.json(
      {
        jobId: data.id,
        status: data.status,
        statusUrl: `/api/tools/deep-research/${data.id}/status`,
        createdAt: new Date().toISOString(),
        model,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Deep Research] Error:', error);

    if (error instanceof DeepResearchApiError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'API_ERROR', retryable: false },
      { status: 500 }
    );
  }
}
