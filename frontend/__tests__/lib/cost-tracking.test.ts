/**
 * Cost Tracking Module Tests (REQ_010)
 *
 * Tests for cost estimation, tracking, confirmation, and logging functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // REQ_010.1: Deep Research cost estimates
  estimateDeepResearchCost,
  getDeepResearchCostRange,
  DEEP_RESEARCH_PRICING,
  SEARCH_CONTEXT_TOKEN_ESTIMATES,

  // REQ_010.2: Image generation costs
  estimateImageGenerationCost,
  getImageModelCostComparison,
  IMAGE_GENERATION_PRICING,

  // REQ_010.3: Tool cost tracking
  createToolCostTracker,
  trackWebSearchCall,
  trackCodeInterpreterSession,
  trackModelCost,
  extractToolCostsFromResponse,
  getToolCostBreakdown,
  TOOL_COSTS,

  // REQ_010.4: Cost confirmation
  requiresCostConfirmation,
  getLowerCostAlternatives,
  createCostConfirmationOptions,
  requiresToolSpecificConfirmation,
  DEFAULT_COST_THRESHOLD,
  DEFAULT_TOOL_THRESHOLDS,

  // REQ_010.5: Cost logging
  generateRequestId,
  createCostLogEntry,
  updateCostLogWithActual,
  calculateActualCost,
  hasSignificantCostDiscrepancy,
  formatCost,
  aggregateDailyCosts,
  exportCostData,
  getCostTooltip,
  CostLogger,
  costLogger,

  // Types
  type DeepResearchCostEstimate,
  type ImageGenerationCostEstimate,
  type ToolCostTracking,
  type CostLogEntry,
  type DailyCostAggregation,
  type CostConfirmationOptions,
} from '../../src/lib/cost-tracking';

describe('REQ_010: Cost Tracking and Display', () => {
  describe('REQ_010.1: Deep Research Cost Estimates', () => {
    it('should display cost estimate immediately when depth is selected', () => {
      const quickEstimate = estimateDeepResearchCost('quick');
      const thoroughEstimate = estimateDeepResearchCost('thorough');

      expect(quickEstimate.totalCost).toBeGreaterThan(0);
      expect(thoroughEstimate.totalCost).toBeGreaterThan(0);
    });

    it('should show estimated cost range of $2-$5 with average ~$3 for quick depth', () => {
      const estimate = estimateDeepResearchCost('quick');

      // Quick mode uses o4-mini which is cheaper
      expect(estimate.minCost).toBeGreaterThanOrEqual(1);
      expect(estimate.maxCost).toBeLessThanOrEqual(10);

      const range = getDeepResearchCostRange('quick');
      expect(range).toContain('$2-$5');
      expect(range).toContain('~$3');
    });

    it('should show estimated cost range of $20-$40 with average ~$30 for thorough depth', () => {
      const estimate = estimateDeepResearchCost('thorough');

      // Thorough mode uses o3 which is more expensive
      expect(estimate.minCost).toBeGreaterThanOrEqual(10);
      expect(estimate.maxCost).toBeLessThanOrEqual(100);

      const range = getDeepResearchCostRange('thorough');
      expect(range).toContain('$20-$40');
      expect(range).toContain('~$30');
    });

    it('should show cost breakdown with base model cost plus additional tool costs', () => {
      const estimate = estimateDeepResearchCost('thorough', [
        { type: 'web_search_preview' },
        { type: 'code_interpreter' },
      ]);

      expect(estimate.breakdown.length).toBeGreaterThanOrEqual(3);
      expect(estimate.breakdown.some(b => b.label.includes('Model'))).toBe(true);
      expect(estimate.breakdown.some(b => b.label === 'Web Search')).toBe(true);
      expect(estimate.breakdown.some(b => b.label === 'Code Interpreter')).toBe(true);
    });

    it('should display estimated token usage alongside cost estimate', () => {
      const estimate = estimateDeepResearchCost('thorough');

      expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
      expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
    });

    it('should update cost estimate dynamically as user toggles additional tools', () => {
      const baseEstimate = estimateDeepResearchCost('thorough');
      const withWebSearch = estimateDeepResearchCost('thorough', [{ type: 'web_search_preview' }]);
      const withCodeInterpreter = estimateDeepResearchCost('thorough', [{ type: 'code_interpreter' }]);
      const withBoth = estimateDeepResearchCost('thorough', [
        { type: 'web_search_preview' },
        { type: 'code_interpreter' },
      ]);

      expect(withWebSearch.totalCost).toBeGreaterThan(baseEstimate.totalCost);
      expect(withCodeInterpreter.totalCost).toBeGreaterThan(baseEstimate.totalCost);
      expect(withBoth.totalCost).toBeGreaterThan(withWebSearch.totalCost);
      expect(withBoth.totalCost).toBeGreaterThan(withCodeInterpreter.totalCost);
    });

    it('should include web_search and code_interpreter costs when enabled', () => {
      const estimate = estimateDeepResearchCost('quick', [
        { type: 'web_search_preview' },
        { type: 'code_interpreter' },
      ]);

      expect(estimate.webSearchCost).toBeGreaterThan(0);
      expect(estimate.codeInterpreterCost).toBeGreaterThan(0);
    });

    it('should provide cost estimate tooltip explaining pricing factors', () => {
      const tooltip = getCostTooltip(
        50000,
        20000,
        'o4-mini-deep-research-2025-06-26'
      );

      expect(tooltip).toContain('Input tokens');
      expect(tooltip).toContain('Output tokens');
      expect(tooltip).toContain('Rate:');
      expect(tooltip).toContain('/M');
    });

    it('should have pricing constants for quick model (o4-mini)', () => {
      const pricing = DEEP_RESEARCH_PRICING['o4-mini-deep-research-2025-06-26'];

      expect(pricing.inputPerMillion).toBe(1.10);
      expect(pricing.outputPerMillion).toBe(4.40);
      expect(pricing.label).toBe('Quick');
    });

    it('should have pricing constants for thorough model (o3)', () => {
      const pricing = DEEP_RESEARCH_PRICING['o3-deep-research-2025-06-26'];

      expect(pricing.inputPerMillion).toBe(10.00);
      expect(pricing.outputPerMillion).toBe(40.00);
      expect(pricing.label).toBe('Thorough');
    });

    it('should have token estimates for search context sizes', () => {
      expect(SEARCH_CONTEXT_TOKEN_ESTIMATES.low).toBe(500);
      expect(SEARCH_CONTEXT_TOKEN_ESTIMATES.medium).toBe(2000);
      expect(SEARCH_CONTEXT_TOKEN_ESTIMATES.high).toBe(5000);
    });
  });

  describe('REQ_010.2: Image Generation Cost Estimates', () => {
    it('should update cost display in real-time as user changes parameters', () => {
      const lowQuality = estimateImageGenerationCost('gpt-image-1.5', 'low', 1);
      const highQuality = estimateImageGenerationCost('gpt-image-1.5', 'high', 1);

      expect(lowQuality.totalCost).not.toBe(highQuality.totalCost);
    });

    it('should show low quality at ~$0.01-$0.02 per image', () => {
      const estimate = estimateImageGenerationCost('gpt-image-1.5', 'low', 1);

      expect(estimate.perImageCost).toBeGreaterThanOrEqual(0.01);
      expect(estimate.perImageCost).toBeLessThanOrEqual(0.02);
    });

    it('should show medium quality at ~$0.04-$0.07 per image', () => {
      const estimate = estimateImageGenerationCost('gpt-image-1.5', 'medium', 1);

      expect(estimate.perImageCost).toBeGreaterThanOrEqual(0.04);
      expect(estimate.perImageCost).toBeLessThanOrEqual(0.07);
    });

    it('should show high quality at ~$0.17-$0.19 per image', () => {
      const estimate = estimateImageGenerationCost('gpt-image-1.5', 'high', 1);

      expect(estimate.perImageCost).toBeGreaterThanOrEqual(0.15);
      expect(estimate.perImageCost).toBeLessThanOrEqual(0.20);
    });

    it('should calculate total cost as per-image cost × image count', () => {
      const singleImage = estimateImageGenerationCost('gpt-image-1.5', 'medium', 1);
      const threeImages = estimateImageGenerationCost('gpt-image-1.5', 'medium', 3);
      const fiveImages = estimateImageGenerationCost('gpt-image-1.5', 'medium', 5);

      expect(threeImages.totalCost).toBe(singleImage.perImageCost * 3);
      expect(fiveImages.totalCost).toBe(singleImage.perImageCost * 5);
    });

    it('should show model comparison widget with cost difference between models', () => {
      const comparison = getImageModelCostComparison('high');

      expect(comparison['gpt-image-1.5']).toBeDefined();
      expect(comparison['gpt-image-1']).toBeDefined();
      expect(comparison['gpt-image-1-mini']).toBeDefined();
    });

    it('should show per-image cost AND total cost for batch generation', () => {
      const batch = estimateImageGenerationCost('gpt-image-1.5', 'medium', 4);

      expect(batch.perImageCost).toBeGreaterThan(0);
      expect(batch.totalCost).toBe(batch.perImageCost * batch.imageCount);
      expect(batch.imageCount).toBe(4);
    });

    it('should include model and quality in estimate result', () => {
      const estimate = estimateImageGenerationCost('gpt-image-1', 'high', 2);

      expect(estimate.model).toBe('gpt-image-1');
      expect(estimate.quality).toBe('high');
    });

    it('should have correct pricing for all model and quality combinations', () => {
      const models = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const;
      const qualities = ['low', 'medium', 'high'] as const;

      for (const model of models) {
        for (const quality of qualities) {
          expect(IMAGE_GENERATION_PRICING[model][quality]).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('REQ_010.3: Tool Cost Tracking', () => {
    it('should track each code_interpreter session at $0.03', () => {
      expect(TOOL_COSTS.codeInterpreterSession).toBe(0.03);

      let tracker = createToolCostTracker();
      tracker = trackCodeInterpreterSession(tracker);

      expect(tracker.codeInterpreterSessionCount).toBe(1);
      expect(tracker.codeInterpreterCost).toBe(0.03);
    });

    it('should track each web_search_preview call at $0.01', () => {
      expect(TOOL_COSTS.webSearchCall).toBe(0.01);

      let tracker = createToolCostTracker();
      tracker = trackWebSearchCall(tracker);

      expect(tracker.webSearchCallCount).toBe(1);
      expect(tracker.webSearchCost).toBe(0.01);
    });

    it('should update running cost total in real-time during execution', () => {
      let tracker = createToolCostTracker();

      tracker = trackWebSearchCall(tracker);
      expect(tracker.totalCost).toBe(0.01);

      tracker = trackWebSearchCall(tracker);
      expect(tracker.totalCost).toBe(0.02);

      tracker = trackCodeInterpreterSession(tracker);
      expect(tracker.totalCost).toBe(0.05);
    });

    it('should distinguish between different types of tool calls in the same request', () => {
      let tracker = createToolCostTracker();

      tracker = trackWebSearchCall(tracker);
      tracker = trackWebSearchCall(tracker);
      tracker = trackCodeInterpreterSession(tracker);

      expect(tracker.webSearchCallCount).toBe(2);
      expect(tracker.codeInterpreterSessionCount).toBe(1);
      expect(tracker.webSearchCost).toBe(0.02);
      expect(tracker.codeInterpreterCost).toBe(0.03);
    });

    it('should aggregate session costs correctly when multiple code_interpreter sessions occur', () => {
      let tracker = createToolCostTracker();

      tracker = trackCodeInterpreterSession(tracker);
      tracker = trackCodeInterpreterSession(tracker);
      tracker = trackCodeInterpreterSession(tracker);

      expect(tracker.codeInterpreterSessionCount).toBe(3);
      expect(tracker.codeInterpreterCost).toBe(0.09);
    });

    it('should extract web_search_call count from response.output items', () => {
      const outputItems = [
        { type: 'web_search_call', status: 'completed' },
        { type: 'web_search_call', status: 'completed' },
        { type: 'message', status: 'completed' },
        { type: 'web_search_call', status: 'completed' },
      ];

      const tracker = extractToolCostsFromResponse(outputItems);

      expect(tracker.webSearchCallCount).toBe(3);
      expect(tracker.webSearchCost).toBe(0.03);
    });

    it('should add tool costs to base model costs for complete cost picture', () => {
      let tracker = createToolCostTracker();

      // Add model cost
      tracker = trackModelCost(tracker, 50000, 20000, 'o4-mini-deep-research-2025-06-26');

      // Add tool costs
      tracker = trackWebSearchCall(tracker);
      tracker = trackCodeInterpreterSession(tracker);

      expect(tracker.totalCost).toBe(tracker.modelCost + tracker.webSearchCost + tracker.codeInterpreterCost);
    });

    it('should provide breakdown including modelCost, webSearchCost, codeInterpreterCost, totalCost', () => {
      let tracker = createToolCostTracker();

      tracker = trackModelCost(tracker, 50000, 20000, 'o4-mini-deep-research-2025-06-26');
      tracker = trackWebSearchCall(tracker);
      tracker = trackWebSearchCall(tracker);
      tracker = trackCodeInterpreterSession(tracker);

      const breakdown = getToolCostBreakdown(tracker);

      expect(breakdown.some(b => b.label === 'Model Cost')).toBe(true);
      expect(breakdown.some(b => b.label === 'Web Search')).toBe(true);
      expect(breakdown.some(b => b.label === 'Code Interpreter')).toBe(true);
    });

    it('should extract code_interpreter_call items from response output', () => {
      const outputItems = [
        { type: 'code_interpreter_call', status: 'completed' },
        { type: 'message', status: 'completed' },
        { type: 'code_interpreter_call', status: 'completed' },
      ];

      const tracker = extractToolCostsFromResponse(outputItems);

      expect(tracker.codeInterpreterSessionCount).toBe(2);
      expect(tracker.codeInterpreterCost).toBe(0.06);
    });

    it('should return empty tracker for response with no tool calls', () => {
      const outputItems = [
        { type: 'message', status: 'completed' },
        { type: 'reasoning', status: 'completed' },
      ];

      const tracker = extractToolCostsFromResponse(outputItems);

      expect(tracker.webSearchCallCount).toBe(0);
      expect(tracker.codeInterpreterSessionCount).toBe(0);
      expect(tracker.totalCost).toBe(0);
    });
  });

  describe('REQ_010.4: Cost Confirmation Dialog', () => {
    it('should require confirmation when estimated cost exceeds user-configurable threshold', () => {
      expect(requiresCostConfirmation(6.0, 5.0)).toBe(true);
      expect(requiresCostConfirmation(4.9, 5.0)).toBe(false);
      expect(requiresCostConfirmation(5.0, 5.0)).toBe(false);
    });

    it('should use default threshold of $5 when not specified', () => {
      expect(DEFAULT_COST_THRESHOLD).toBe(5.0);
      expect(requiresCostConfirmation(5.01)).toBe(true);
      expect(requiresCostConfirmation(4.99)).toBe(false);
    });

    it('should suggest alternative lower-cost options in the dialog', () => {
      const alternatives = getLowerCostAlternatives('deep_research', 30);

      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives[0].label).toContain('Quick');
      expect(alternatives[0].estimatedCost).toBeLessThan(30);
    });

    it('should suggest low quality alternative for expensive image generation', () => {
      const alternatives = getLowerCostAlternatives('image_generation', 0.50);

      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives[0].label).toContain('Low Quality');
      expect(alternatives[0].estimatedCost).toBeLessThan(0.50);
    });

    it('should create confirmation options with all required fields', () => {
      const options = createCostConfirmationOptions(
        25.0,
        'deep_research',
        [{ label: 'Model', amount: 25.0 }],
        { remainingBudget: 50.0, threshold: 10.0 }
      );

      expect(options.estimatedCost).toBe(25.0);
      expect(options.operationType).toBe('deep_research');
      expect(options.breakdown.length).toBe(1);
      expect(options.alternatives).toBeDefined();
      expect(options.remainingBudget).toBe(50.0);
      expect(options.threshold).toBe(10.0);
    });

    it('should use default threshold in confirmation options if not provided', () => {
      const options = createCostConfirmationOptions(25.0, 'deep_research', []);

      expect(options.threshold).toBe(DEFAULT_COST_THRESHOLD);
    });

    it('should support per-tool type threshold configuration', () => {
      expect(requiresToolSpecificConfirmation(6.0, 'deep_research')).toBe(true);
      expect(requiresToolSpecificConfirmation(4.0, 'deep_research')).toBe(false);

      expect(requiresToolSpecificConfirmation(0.60, 'image_generation')).toBe(true);
      expect(requiresToolSpecificConfirmation(0.40, 'image_generation')).toBe(false);
    });

    it('should have different default thresholds for different tool types', () => {
      expect(DEFAULT_TOOL_THRESHOLDS.deep_research).toBe(5.0);
      expect(DEFAULT_TOOL_THRESHOLDS.image_generation).toBe(0.50);
      expect(DEFAULT_TOOL_THRESHOLDS.document_generation).toBe(1.0);
      expect(DEFAULT_TOOL_THRESHOLDS.chat_completion).toBe(0.10);
    });

    it('should allow custom threshold overrides', () => {
      const customThresholds = { deep_research: 10.0 };

      expect(requiresToolSpecificConfirmation(6.0, 'deep_research', customThresholds)).toBe(false);
      expect(requiresToolSpecificConfirmation(11.0, 'deep_research', customThresholds)).toBe(true);
    });

    it('should not return alternatives for costs already at minimum', () => {
      const alternatives = getLowerCostAlternatives('deep_research', 1.0);

      // Quick mode is ~$3, so $1 is already cheaper
      expect(alternatives.length).toBe(0);
    });
  });

  describe('REQ_010.5: Cost Logging and Analytics', () => {
    let logger: CostLogger;

    beforeEach(() => {
      logger = new CostLogger();
    });

    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should log actual costs with request ID, timestamp, and user ID', () => {
      const entry = createCostLogEntry({
        requestId: 'req_123',
        userId: 'user_456',
        operationType: 'deep_research',
        estimatedCost: 25.0,
      });

      expect(entry.requestId).toBe('req_123');
      expect(entry.userId).toBe('user_456');
      expect(entry.timestamp).toBeDefined();
      expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should capture token usage from response object', () => {
      const entry = createCostLogEntry({
        operationType: 'deep_research',
        estimatedCost: 25.0,
      });

      const updated = updateCostLogWithActual(entry, 27.5, {
        inputTokens: 50000,
        outputTokens: 25000,
        cachedTokens: 5000,
        reasoningTokens: 10000,
      });

      expect(updated.tokenUsage?.inputTokens).toBe(50000);
      expect(updated.tokenUsage?.outputTokens).toBe(25000);
      expect(updated.tokenUsage?.cachedTokens).toBe(5000);
      expect(updated.tokenUsage?.reasoningTokens).toBe(10000);
    });

    it('should calculate actual cost from token usage using current pricing rates', () => {
      const cost = calculateActualCost(
        100000,
        50000,
        'o3-deep-research-2025-06-26'
      );

      // Expected: (100000/1M * 10) + (50000/1M * 40) = 1.0 + 2.0 = 3.0
      expect(cost).toBe(3.0);
    });

    it('should detect discrepancy when actual cost differs significantly from estimate (>20%)', () => {
      expect(hasSignificantCostDiscrepancy(10.0, 15.0)).toBe(true);  // 50% diff
      expect(hasSignificantCostDiscrepancy(10.0, 11.5)).toBe(false); // 15% diff
      expect(hasSignificantCostDiscrepancy(10.0, 12.1)).toBe(true);  // 21% diff
      expect(hasSignificantCostDiscrepancy(10.0, 12.0)).toBe(false); // 20% diff exactly
    });

    it('should handle edge case where estimated cost is zero', () => {
      expect(hasSignificantCostDiscrepancy(0, 1.0)).toBe(true);
      expect(hasSignificantCostDiscrepancy(0, 0)).toBe(false);
    });

    it('should format cost as currency string', () => {
      expect(formatCost(25.5)).toBe('$25.50');
      expect(formatCost(0.01)).toBe('$0.01');
      expect(formatCost(1234.56)).toBe('$1,234.56');
    });

    it('should support custom fraction digits in formatting', () => {
      expect(formatCost(0.0111, { maximumFractionDigits: 4 })).toBe('$0.0111');
      expect(formatCost(0.0111, { maximumFractionDigits: 2 })).toBe('$0.01');
    });

    it('should aggregate daily costs correctly', () => {
      const entries: CostLogEntry[] = [
        createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 }),
        createCostLogEntry({ operationType: 'deep_research', estimatedCost: 15.0 }),
        createCostLogEntry({ operationType: 'image_generation', estimatedCost: 0.50 }),
      ];

      const aggregations = aggregateDailyCosts(entries);

      expect(aggregations.length).toBe(1);
      expect(aggregations[0].totalCost).toBe(25.50);
      expect(aggregations[0].operationCount).toBe(3);
      expect(aggregations[0].byOperationType.deep_research.count).toBe(2);
      expect(aggregations[0].byOperationType.image_generation.count).toBe(1);
    });

    it('should use actual cost when available in aggregation', () => {
      let entry = createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 });
      entry = updateCostLogWithActual(entry, 12.0);

      const aggregations = aggregateDailyCosts([entry]);

      expect(aggregations[0].totalCost).toBe(12.0);
    });

    it('should export cost reports in CSV format', () => {
      const entries: CostLogEntry[] = [
        {
          requestId: 'req_1',
          operationType: 'deep_research',
          timestamp: '2026-01-16T10:00:00Z',
          estimatedCost: 25.0,
          actualCost: 27.5,
          tokenUsage: { inputTokens: 50000, outputTokens: 25000 },
          metadata: { model: 'o3-deep-research' },
        },
      ];

      const csv = exportCostData(entries, 'csv');

      expect(csv).toContain('requestId');
      expect(csv).toContain('timestamp');
      expect(csv).toContain('estimatedCost');
      expect(csv).toContain('req_1');
      expect(csv).toContain('deep_research');
    });

    it('should export cost reports in JSON format', () => {
      const entries: CostLogEntry[] = [
        createCostLogEntry({ operationType: 'deep_research', estimatedCost: 25.0 }),
      ];

      const json = exportCostData(entries, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.length).toBe(1);
      expect(parsed[0].operationType).toBe('deep_research');
    });

    it('should include operation metadata in log entries', () => {
      const entry = createCostLogEntry({
        operationType: 'deep_research',
        estimatedCost: 25.0,
        metadata: {
          model: 'o3-deep-research',
          depth: 'thorough',
          inputLength: 500,
          outputLength: 10000,
        },
      });

      expect(entry.metadata?.model).toBe('o3-deep-research');
      expect(entry.metadata?.depth).toBe('thorough');
      expect(entry.metadata?.inputLength).toBe(500);
      expect(entry.metadata?.outputLength).toBe(10000);
    });

    it('should query logs by date range', () => {
      logger.log(createCostLogEntry({
        operationType: 'deep_research',
        estimatedCost: 10.0,
      }));

      const results = logger.query({
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date().toISOString(),
      });

      expect(results.length).toBe(1);
    });

    it('should query logs by user ID', () => {
      logger.log(createCostLogEntry({
        userId: 'user_123',
        operationType: 'deep_research',
        estimatedCost: 10.0,
      }));
      logger.log(createCostLogEntry({
        userId: 'user_456',
        operationType: 'image_generation',
        estimatedCost: 0.50,
      }));

      const results = logger.query({ userId: 'user_123' });

      expect(results.length).toBe(1);
      expect(results[0].userId).toBe('user_123');
    });

    it('should query logs by operation type', () => {
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 }));
      logger.log(createCostLogEntry({ operationType: 'image_generation', estimatedCost: 0.50 }));
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 15.0 }));

      const results = logger.query({ operationType: 'deep_research' });

      expect(results.length).toBe(2);
      expect(results.every(r => r.operationType === 'deep_research')).toBe(true);
    });

    it('should get daily aggregations from logger', () => {
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 }));
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 15.0 }));

      const aggregations = logger.getDailyAggregations();

      expect(aggregations.length).toBeGreaterThan(0);
      expect(aggregations[0].totalCost).toBe(25.0);
    });

    it('should export all logs from logger', () => {
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 }));

      const json = logger.export('json');
      const parsed = JSON.parse(json);

      expect(parsed.length).toBe(1);
    });

    it('should clear all logs', () => {
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 }));
      logger.log(createCostLogEntry({ operationType: 'deep_research', estimatedCost: 15.0 }));

      logger.clear();

      expect(logger.getAll().length).toBe(0);
    });

    it('should include correlationId when provided', () => {
      const entry = createCostLogEntry({
        correlationId: 'corr_abc123',
        operationType: 'deep_research',
        estimatedCost: 25.0,
      });

      expect(entry.correlationId).toBe('corr_abc123');
    });

    it('should generate requestId when not provided', () => {
      const entry = createCostLogEntry({
        operationType: 'deep_research',
        estimatedCost: 25.0,
      });

      expect(entry.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should have global costLogger instance available', () => {
      expect(costLogger).toBeDefined();
      expect(costLogger).toBeInstanceOf(CostLogger);
    });

    it('should sort daily aggregations by date', () => {
      // Create entries with different dates by modifying timestamp
      const entry1 = createCostLogEntry({ operationType: 'deep_research', estimatedCost: 10.0 });
      entry1.timestamp = '2026-01-14T10:00:00Z';

      const entry2 = createCostLogEntry({ operationType: 'deep_research', estimatedCost: 15.0 });
      entry2.timestamp = '2026-01-16T10:00:00Z';

      const entry3 = createCostLogEntry({ operationType: 'deep_research', estimatedCost: 20.0 });
      entry3.timestamp = '2026-01-15T10:00:00Z';

      const aggregations = aggregateDailyCosts([entry1, entry2, entry3]);

      expect(aggregations[0].date).toBe('2026-01-14');
      expect(aggregations[1].date).toBe('2026-01-15');
      expect(aggregations[2].date).toBe('2026-01-16');
    });
  });
});
