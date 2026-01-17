/**
 * Cost Tracking Module (REQ_010)
 *
 * This module provides cost estimation, tracking, and logging for expensive operations
 * including Deep Research, Image Generation, and tool usage.
 */

import type {
  DeepResearchDepth,
  DeepResearchModel,
  DeepResearchTool,
  ImageGenerationModel,
  ImageQuality,
  ToolIntent,
} from './types';

/**
 * REQ_010.1: Deep Research pricing constants
 * Based on OpenAI's per-million-token pricing
 *
 * Deep Research queries typically use significantly more tokens due to:
 * - Multiple web searches and content retrieval
 * - Reasoning steps and chain-of-thought processing
 * - Comprehensive report generation
 *
 * Quick mode (~$3): o4-mini with ~1.5M input tokens, ~300K output tokens
 * Thorough mode (~$30): o3 with ~2M input tokens, ~500K output tokens
 */
export const DEEP_RESEARCH_PRICING = {
  'o4-mini-deep-research-2025-06-26': {
    inputPerMillion: 1.10,
    outputPerMillion: 4.40,
    estimatedInputTokens: 1500000,
    estimatedOutputTokens: 300000,
    label: 'Quick',
  },
  'o3-deep-research-2025-06-26': {
    inputPerMillion: 10.00,
    outputPerMillion: 40.00,
    estimatedInputTokens: 2000000,
    estimatedOutputTokens: 500000,
    label: 'Thorough',
  },
} as const;

/**
 * REQ_010.2: Image generation pricing constants
 * Based on OpenAI's per-image pricing
 */
export const IMAGE_GENERATION_PRICING: Record<ImageGenerationModel, Record<ImageQuality, number>> = {
  'gpt-image-1.5': {
    low: 0.011,
    medium: 0.042,
    high: 0.167,
  },
  'gpt-image-1': {
    low: 0.011,
    medium: 0.042,
    high: 0.167,
  },
  'gpt-image-1-mini': {
    low: 0.011,
    medium: 0.042,
    high: 0.167,
  },
} as const;

/**
 * REQ_010.3: Tool cost constants
 */
export const TOOL_COSTS = {
  codeInterpreterSession: 0.03,
  webSearchCall: 0.01,
} as const;

/**
 * REQ_010.1: Token cost estimates for search context sizes
 */
export const SEARCH_CONTEXT_TOKEN_ESTIMATES = {
  low: 500,
  medium: 2000,
  high: 5000,
} as const;

/**
 * REQ_010.4: Default cost confirmation threshold
 */
export const DEFAULT_COST_THRESHOLD = 5.0;

/**
 * REQ_010.1: Deep Research cost estimate result
 */
export interface DeepResearchCostEstimate {
  /** Base model cost (input + output tokens) */
  modelCost: number;
  /** Additional cost from web search calls (estimated) */
  webSearchCost: number;
  /** Additional cost from code interpreter sessions (estimated) */
  codeInterpreterCost: number;
  /** Total estimated cost */
  totalCost: number;
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** Cost range minimum */
  minCost: number;
  /** Cost range maximum */
  maxCost: number;
  /** Breakdown by component */
  breakdown: CostBreakdownItem[];
}

/**
 * REQ_010.1: Cost breakdown item for detailed display
 */
export interface CostBreakdownItem {
  label: string;
  amount: number;
  description?: string;
}

/**
 * REQ_010.2: Image generation cost estimate result
 */
export interface ImageGenerationCostEstimate {
  /** Cost per image */
  perImageCost: number;
  /** Total cost for all images */
  totalCost: number;
  /** Number of images */
  imageCount: number;
  /** Model used */
  model: ImageGenerationModel;
  /** Quality level */
  quality: ImageQuality;
}

/**
 * REQ_010.3: Tool cost tracking result
 */
export interface ToolCostTracking {
  /** Base model cost */
  modelCost: number;
  /** Web search calls cost */
  webSearchCost: number;
  /** Code interpreter sessions cost */
  codeInterpreterCost: number;
  /** Total tracked cost */
  totalCost: number;
  /** Number of web search calls */
  webSearchCallCount: number;
  /** Number of code interpreter sessions */
  codeInterpreterSessionCount: number;
}

/**
 * REQ_010.5: Cost log entry for billing and analytics
 */
export interface CostLogEntry {
  /** Unique request identifier */
  requestId: string;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** User identifier */
  userId?: string;
  /** Operation type */
  operationType: ToolIntent;
  /** Timestamp of operation */
  timestamp: string;
  /** Estimated cost before execution */
  estimatedCost: number;
  /** Actual cost after execution */
  actualCost?: number;
  /** Token usage from API response */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  };
  /** Tools used during operation */
  toolsUsed?: string[];
  /** Operation metadata */
  metadata?: {
    model?: string;
    depth?: string;
    quality?: string;
    imageCount?: number;
    inputLength?: number;
    outputLength?: number;
  };
}

/**
 * REQ_010.5: Daily cost aggregation
 */
export interface DailyCostAggregation {
  date: string;
  totalCost: number;
  operationCount: number;
  byOperationType: Record<ToolIntent, { cost: number; count: number }>;
}

/**
 * REQ_010.4: Cost confirmation dialog options
 */
export interface CostConfirmationOptions {
  /** Estimated cost of operation */
  estimatedCost: number;
  /** Operation type */
  operationType: ToolIntent;
  /** Cost breakdown */
  breakdown: CostBreakdownItem[];
  /** Alternative lower-cost options */
  alternatives?: Array<{
    label: string;
    estimatedCost: number;
    description: string;
  }>;
  /** User's remaining budget (if configured) */
  remainingBudget?: number;
  /** User's cost threshold */
  threshold: number;
}

/**
 * REQ_010.4: Cost confirmation result
 */
export interface CostConfirmationResult {
  confirmed: boolean;
  rememberChoice: boolean;
  selectedAlternative?: string;
  timestamp: string;
}

/**
 * REQ_010.1: Calculate estimated cost for Deep Research query
 *
 * @param depth - Research depth (quick or thorough)
 * @param tools - Optional tools configuration
 * @returns Cost estimate with breakdown
 */
export function estimateDeepResearchCost(
  depth: DeepResearchDepth,
  tools?: DeepResearchTool[]
): DeepResearchCostEstimate {
  const model: DeepResearchModel = depth === 'quick'
    ? 'o4-mini-deep-research-2025-06-26'
    : 'o3-deep-research-2025-06-26';

  const pricing = DEEP_RESEARCH_PRICING[model];
  const breakdown: CostBreakdownItem[] = [];

  // Calculate base model cost
  const inputCost = (pricing.estimatedInputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (pricing.estimatedOutputTokens / 1_000_000) * pricing.outputPerMillion;
  const modelCost = inputCost + outputCost;

  breakdown.push({
    label: `${pricing.label} Model`,
    amount: modelCost,
    description: `~${pricing.estimatedInputTokens.toLocaleString()} input + ~${pricing.estimatedOutputTokens.toLocaleString()} output tokens`,
  });

  // Calculate tool costs
  let webSearchCost = 0;
  let codeInterpreterCost = 0;

  if (tools) {
    const hasWebSearch = tools.some(t => t.type === 'web_search_preview');
    const hasCodeInterpreter = tools.some(t => t.type === 'code_interpreter');

    if (hasWebSearch) {
      // Estimate 10-30 search calls for a typical research query
      const estimatedSearchCalls = depth === 'quick' ? 10 : 30;
      webSearchCost = estimatedSearchCalls * TOOL_COSTS.webSearchCall;
      breakdown.push({
        label: 'Web Search',
        amount: webSearchCost,
        description: `~${estimatedSearchCalls} estimated search calls`,
      });
    }

    if (hasCodeInterpreter) {
      // Estimate 1-3 code interpreter sessions
      const estimatedSessions = depth === 'quick' ? 1 : 3;
      codeInterpreterCost = estimatedSessions * TOOL_COSTS.codeInterpreterSession;
      breakdown.push({
        label: 'Code Interpreter',
        amount: codeInterpreterCost,
        description: `~${estimatedSessions} estimated sessions @ $0.03/session`,
      });
    }
  }

  const totalCost = modelCost + webSearchCost + codeInterpreterCost;

  // Calculate cost range (±50% for estimation uncertainty)
  const minCost = totalCost * 0.5;
  const maxCost = totalCost * 1.5;

  return {
    modelCost,
    webSearchCost,
    codeInterpreterCost,
    totalCost,
    estimatedInputTokens: pricing.estimatedInputTokens,
    estimatedOutputTokens: pricing.estimatedOutputTokens,
    minCost,
    maxCost,
    breakdown,
  };
}

/**
 * REQ_010.1: Get Deep Research cost range as formatted string
 *
 * @param depth - Research depth
 * @returns Formatted cost range string
 */
export function getDeepResearchCostRange(depth: DeepResearchDepth): string {
  if (depth === 'quick') {
    return '$2-$5 (avg ~$3)';
  }
  return '$20-$40 (avg ~$30)';
}

/**
 * REQ_010.2: Calculate estimated cost for image generation
 *
 * @param model - Image generation model
 * @param quality - Image quality level
 * @param count - Number of images to generate
 * @returns Cost estimate
 */
export function estimateImageGenerationCost(
  model: ImageGenerationModel,
  quality: ImageQuality,
  count: number = 1
): ImageGenerationCostEstimate {
  const perImageCost = IMAGE_GENERATION_PRICING[model][quality];
  const totalCost = perImageCost * count;

  return {
    perImageCost,
    totalCost,
    imageCount: count,
    model,
    quality,
  };
}

/**
 * REQ_010.2: Get all model cost comparison for image generation
 *
 * @param quality - Quality level to compare
 * @returns Cost comparison for all models
 */
export function getImageModelCostComparison(quality: ImageQuality): Record<ImageGenerationModel, number> {
  return {
    'gpt-image-1.5': IMAGE_GENERATION_PRICING['gpt-image-1.5'][quality],
    'gpt-image-1': IMAGE_GENERATION_PRICING['gpt-image-1'][quality],
    'gpt-image-1-mini': IMAGE_GENERATION_PRICING['gpt-image-1-mini'][quality],
  };
}

/**
 * REQ_010.3: Create a new tool cost tracker
 *
 * @returns Tool cost tracking object
 */
export function createToolCostTracker(): ToolCostTracking {
  return {
    modelCost: 0,
    webSearchCost: 0,
    codeInterpreterCost: 0,
    totalCost: 0,
    webSearchCallCount: 0,
    codeInterpreterSessionCount: 0,
  };
}

/**
 * REQ_010.3: Track a web search call
 *
 * @param tracker - Current tracker state
 * @returns Updated tracker
 */
export function trackWebSearchCall(tracker: ToolCostTracking): ToolCostTracking {
  const newCount = tracker.webSearchCallCount + 1;
  const newWebSearchCost = newCount * TOOL_COSTS.webSearchCall;
  const newTotalCost = tracker.modelCost + newWebSearchCost + tracker.codeInterpreterCost;

  return {
    ...tracker,
    webSearchCallCount: newCount,
    webSearchCost: newWebSearchCost,
    totalCost: newTotalCost,
  };
}

/**
 * REQ_010.3: Track a code interpreter session
 *
 * @param tracker - Current tracker state
 * @returns Updated tracker
 */
export function trackCodeInterpreterSession(tracker: ToolCostTracking): ToolCostTracking {
  const newCount = tracker.codeInterpreterSessionCount + 1;
  const newCodeInterpreterCost = newCount * TOOL_COSTS.codeInterpreterSession;
  const newTotalCost = tracker.modelCost + tracker.webSearchCost + newCodeInterpreterCost;

  return {
    ...tracker,
    codeInterpreterSessionCount: newCount,
    codeInterpreterCost: newCodeInterpreterCost,
    totalCost: newTotalCost,
  };
}

/**
 * REQ_010.3: Track model cost from token usage
 *
 * @param tracker - Current tracker state
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - Model used
 * @returns Updated tracker
 */
export function trackModelCost(
  tracker: ToolCostTracking,
  inputTokens: number,
  outputTokens: number,
  model: DeepResearchModel
): ToolCostTracking {
  const pricing = DEEP_RESEARCH_PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const newModelCost = inputCost + outputCost;
  const newTotalCost = newModelCost + tracker.webSearchCost + tracker.codeInterpreterCost;

  return {
    ...tracker,
    modelCost: newModelCost,
    totalCost: newTotalCost,
  };
}

/**
 * REQ_010.3: Extract tool costs from Deep Research response
 *
 * @param outputItems - Response output items
 * @returns Updated tracker with extracted costs
 */
export function extractToolCostsFromResponse(
  outputItems: Array<{ type: string; status?: string }>
): ToolCostTracking {
  let tracker = createToolCostTracker();

  for (const item of outputItems) {
    if (item.type === 'web_search_call') {
      tracker = trackWebSearchCall(tracker);
    } else if (item.type === 'code_interpreter_call') {
      tracker = trackCodeInterpreterSession(tracker);
    }
  }

  return tracker;
}

/**
 * REQ_010.3: Get cost breakdown from tracker
 *
 * @param tracker - Tool cost tracker
 * @returns Cost breakdown for display
 */
export function getToolCostBreakdown(tracker: ToolCostTracking): CostBreakdownItem[] {
  const breakdown: CostBreakdownItem[] = [];

  if (tracker.modelCost > 0) {
    breakdown.push({
      label: 'Model Cost',
      amount: tracker.modelCost,
    });
  }

  if (tracker.webSearchCallCount > 0) {
    breakdown.push({
      label: 'Web Search',
      amount: tracker.webSearchCost,
      description: `${tracker.webSearchCallCount} calls @ $0.01/call`,
    });
  }

  if (tracker.codeInterpreterSessionCount > 0) {
    breakdown.push({
      label: 'Code Interpreter',
      amount: tracker.codeInterpreterCost,
      description: `${tracker.codeInterpreterSessionCount} sessions @ $0.03/session`,
    });
  }

  return breakdown;
}

/**
 * REQ_010.4: Check if cost exceeds threshold
 *
 * @param estimatedCost - Estimated cost
 * @param threshold - Cost threshold (default: $5)
 * @returns True if confirmation needed
 */
export function requiresCostConfirmation(
  estimatedCost: number,
  threshold: number = DEFAULT_COST_THRESHOLD
): boolean {
  return estimatedCost > threshold;
}

/**
 * REQ_010.4: Get alternative lower-cost options
 *
 * @param operationType - Current operation type
 * @param currentCost - Current estimated cost
 * @returns Alternative options with lower costs
 */
export function getLowerCostAlternatives(
  operationType: ToolIntent,
  currentCost: number
): Array<{ label: string; estimatedCost: number; description: string }> {
  const alternatives: Array<{ label: string; estimatedCost: number; description: string }> = [];

  if (operationType === 'deep_research' && currentCost > 5) {
    const quickEstimate = estimateDeepResearchCost('quick');
    alternatives.push({
      label: 'Use Quick Mode',
      estimatedCost: quickEstimate.totalCost,
      description: 'Faster results with o4-mini model (~$3)',
    });
  }

  if (operationType === 'image_generation' && currentCost > 0.10) {
    alternatives.push({
      label: 'Use Low Quality',
      estimatedCost: 0.011,
      description: 'Lower quality image at ~$0.01',
    });
  }

  return alternatives.filter(alt => alt.estimatedCost < currentCost);
}

/**
 * REQ_010.4: Create cost confirmation options
 *
 * @param estimatedCost - Estimated cost
 * @param operationType - Operation type
 * @param breakdown - Cost breakdown items
 * @param options - Additional options
 * @returns Cost confirmation dialog options
 */
export function createCostConfirmationOptions(
  estimatedCost: number,
  operationType: ToolIntent,
  breakdown: CostBreakdownItem[],
  options?: {
    remainingBudget?: number;
    threshold?: number;
  }
): CostConfirmationOptions {
  return {
    estimatedCost,
    operationType,
    breakdown,
    alternatives: getLowerCostAlternatives(operationType, estimatedCost),
    remainingBudget: options?.remainingBudget,
    threshold: options?.threshold ?? DEFAULT_COST_THRESHOLD,
  };
}

/**
 * REQ_010.5: Generate unique request ID
 *
 * @returns Unique request identifier
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * REQ_010.5: Create cost log entry
 *
 * @param options - Log entry options
 * @returns Cost log entry
 */
export function createCostLogEntry(options: {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  operationType: ToolIntent;
  estimatedCost: number;
  metadata?: CostLogEntry['metadata'];
}): CostLogEntry {
  return {
    requestId: options.requestId ?? generateRequestId(),
    correlationId: options.correlationId,
    userId: options.userId,
    operationType: options.operationType,
    timestamp: new Date().toISOString(),
    estimatedCost: options.estimatedCost,
    metadata: options.metadata,
  };
}

/**
 * REQ_010.5: Update cost log entry with actual cost
 *
 * @param entry - Existing log entry
 * @param actualCost - Actual cost from API response
 * @param tokenUsage - Token usage from API response
 * @returns Updated log entry
 */
export function updateCostLogWithActual(
  entry: CostLogEntry,
  actualCost: number,
  tokenUsage?: CostLogEntry['tokenUsage']
): CostLogEntry {
  return {
    ...entry,
    actualCost,
    tokenUsage,
  };
}

/**
 * REQ_010.5: Calculate cost from token usage
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - Model used
 * @returns Calculated cost
 */
export function calculateActualCost(
  inputTokens: number,
  outputTokens: number,
  model: DeepResearchModel
): number {
  const pricing = DEEP_RESEARCH_PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

/**
 * REQ_010.5: Check for significant cost discrepancy
 *
 * @param estimatedCost - Estimated cost before execution
 * @param actualCost - Actual cost after execution
 * @param threshold - Discrepancy threshold (default: 20%)
 * @returns True if discrepancy exceeds threshold
 */
export function hasSignificantCostDiscrepancy(
  estimatedCost: number,
  actualCost: number,
  threshold: number = 0.20
): boolean {
  if (estimatedCost === 0) return actualCost > 0;
  const discrepancy = Math.abs(actualCost - estimatedCost) / estimatedCost;
  return discrepancy > threshold;
}

/**
 * REQ_010.5: Format cost for display
 *
 * @param cost - Cost value
 * @param options - Formatting options
 * @returns Formatted cost string
 */
export function formatCost(
  cost: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 4,
  });
  return formatter.format(cost);
}

/**
 * REQ_010.5: Aggregate daily costs
 *
 * @param entries - Cost log entries
 * @returns Daily aggregations
 */
export function aggregateDailyCosts(entries: CostLogEntry[]): DailyCostAggregation[] {
  const aggregations = new Map<string, DailyCostAggregation>();

  for (const entry of entries) {
    const date = entry.timestamp.split('T')[0];
    const cost = entry.actualCost ?? entry.estimatedCost;

    let agg = aggregations.get(date);
    if (!agg) {
      agg = {
        date,
        totalCost: 0,
        operationCount: 0,
        byOperationType: {
          deep_research: { cost: 0, count: 0 },
          image_generation: { cost: 0, count: 0 },
          document_generation: { cost: 0, count: 0 },
          chat_completion: { cost: 0, count: 0 },
        },
      };
      aggregations.set(date, agg);
    }

    agg.totalCost += cost;
    agg.operationCount += 1;
    agg.byOperationType[entry.operationType].cost += cost;
    agg.byOperationType[entry.operationType].count += 1;
  }

  return Array.from(aggregations.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * REQ_010.5: Export cost data to specified format
 *
 * @param entries - Cost log entries
 * @param format - Export format
 * @returns Exported data string
 */
export function exportCostData(entries: CostLogEntry[], format: 'csv' | 'json'): string {
  if (format === 'json') {
    return JSON.stringify(entries, null, 2);
  }

  // CSV format
  const headers = [
    'requestId',
    'timestamp',
    'operationType',
    'estimatedCost',
    'actualCost',
    'inputTokens',
    'outputTokens',
    'model',
  ];

  const rows = entries.map(entry => [
    entry.requestId,
    entry.timestamp,
    entry.operationType,
    entry.estimatedCost.toFixed(4),
    entry.actualCost?.toFixed(4) ?? '',
    entry.tokenUsage?.inputTokens?.toString() ?? '',
    entry.tokenUsage?.outputTokens?.toString() ?? '',
    entry.metadata?.model ?? '',
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * REQ_010.1: Token usage tooltip text
 *
 * @param inputTokens - Input token count
 * @param outputTokens - Output token count
 * @param model - Model used
 * @returns Tooltip text explaining cost factors
 */
export function getCostTooltip(
  inputTokens: number,
  outputTokens: number,
  model: DeepResearchModel
): string {
  const pricing = DEEP_RESEARCH_PRICING[model];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return [
    `Input tokens: ${inputTokens.toLocaleString()} (${formatCost(inputCost)})`,
    `Output tokens: ${outputTokens.toLocaleString()} (${formatCost(outputCost)})`,
    `Rate: $${pricing.inputPerMillion}/M input, $${pricing.outputPerMillion}/M output`,
  ].join('\n');
}

/**
 * REQ_010.4: Per-tool threshold configuration
 */
export interface ToolThresholdConfig {
  deep_research: number;
  image_generation: number;
  document_generation: number;
  chat_completion: number;
}

/**
 * REQ_010.4: Default per-tool thresholds
 */
export const DEFAULT_TOOL_THRESHOLDS: ToolThresholdConfig = {
  deep_research: 5.0,
  image_generation: 0.50,
  document_generation: 1.0,
  chat_completion: 0.10,
};

/**
 * REQ_010.4: Check threshold for specific tool type
 *
 * @param estimatedCost - Estimated cost
 * @param toolType - Tool type
 * @param customThresholds - Custom threshold configuration
 * @returns True if confirmation required
 */
export function requiresToolSpecificConfirmation(
  estimatedCost: number,
  toolType: ToolIntent,
  customThresholds?: Partial<ToolThresholdConfig>
): boolean {
  const thresholds = { ...DEFAULT_TOOL_THRESHOLDS, ...customThresholds };
  return estimatedCost > thresholds[toolType];
}

/**
 * Cost Logger class for managing cost logs
 * REQ_010.5: Structured logging for billing and analytics
 */
export class CostLogger {
  private logs: CostLogEntry[] = [];
  private retentionDays: number;

  constructor(retentionDays: number = 90) {
    this.retentionDays = retentionDays;
  }

  /**
   * Add a new cost log entry
   */
  log(entry: CostLogEntry): void {
    this.logs.push(entry);
    this.cleanupOldLogs();
  }

  /**
   * Get logs filtered by criteria
   */
  query(options?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    operationType?: ToolIntent;
  }): CostLogEntry[] {
    let filtered = [...this.logs];

    if (options?.startDate) {
      filtered = filtered.filter(e => e.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter(e => e.timestamp <= options.endDate!);
    }
    if (options?.userId) {
      filtered = filtered.filter(e => e.userId === options.userId);
    }
    if (options?.operationType) {
      filtered = filtered.filter(e => e.operationType === options.operationType);
    }

    return filtered;
  }

  /**
   * Get daily aggregations
   */
  getDailyAggregations(options?: { startDate?: string; endDate?: string }): DailyCostAggregation[] {
    const filtered = this.query(options);
    return aggregateDailyCosts(filtered);
  }

  /**
   * Export logs to format
   */
  export(format: 'csv' | 'json'): string {
    return exportCostData(this.logs, format);
  }

  /**
   * Get all logs
   */
  getAll(): CostLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Remove logs older than retention period
   */
  private cleanupOldLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffStr = cutoffDate.toISOString();

    this.logs = this.logs.filter(e => e.timestamp >= cutoffStr);
  }
}

/**
 * Global cost logger instance
 * REQ_010.5: Singleton for application-wide cost tracking
 */
export const costLogger = new CostLogger();
