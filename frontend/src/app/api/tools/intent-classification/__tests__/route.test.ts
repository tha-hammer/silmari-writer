/**
 * Unit tests for Intent Classification API
 * REQ_006: Intent Classification System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import {
  POST,
  classifyIntent,
  INTENT_CLASSIFIER_SYSTEM_PROMPT,
} from '../route';

import {
  type ToolIntent,
  type ClassifiedIntent,
  type ExtractedParams,
  IntentClassificationError,
  validateClassifiedIntent,
  clampConfidence,
  isValidToolIntent,
  isDeepResearchParams,
  isImageGenerationParams,
  isDocumentGenerationParams,
  isChatCompletionParams,
  shouldRequestClarification,
  getConfidenceLevel,
  CONFIDENCE_THRESHOLDS,
  TOOL_INTENT_DISPLAY_NAMES,
  TOOL_INTENT_ICONS,
  INTENT_CLASSIFIER_PROMPT_VERSION,
} from '@/lib/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment
const originalEnv = process.env;

describe('Intent Classification Types (REQ_006.2)', () => {
  describe('ToolIntent type', () => {
    it('should accept valid tool intent strings', () => {
      const validIntents: ToolIntent[] = [
        'deep_research',
        'image_generation',
        'document_generation',
        'chat_completion',
      ];

      validIntents.forEach(intent => {
        expect(isValidToolIntent(intent)).toBe(true);
      });
    });

    it('should reject invalid tool intent strings', () => {
      const invalidIntents = ['invalid', 'DEEP_RESEARCH', 'chat', '', 'research'];

      invalidIntents.forEach(intent => {
        expect(isValidToolIntent(intent)).toBe(false);
      });
    });
  });

  describe('Type guards', () => {
    it('isDeepResearchParams should correctly identify deep_research params', () => {
      const params: ExtractedParams = {
        kind: 'deep_research',
        query: 'test query',
        depth: 'thorough',
        topics: ['topic1'],
      };
      expect(isDeepResearchParams(params)).toBe(true);
      expect(isImageGenerationParams(params)).toBe(false);
    });

    it('isImageGenerationParams should correctly identify image_generation params', () => {
      const params: ExtractedParams = {
        kind: 'image_generation',
        prompt: 'a sunset',
        size: '1024x1024',
        quality: 'high',
      };
      expect(isImageGenerationParams(params)).toBe(true);
      expect(isDeepResearchParams(params)).toBe(false);
    });

    it('isDocumentGenerationParams should correctly identify document_generation params', () => {
      const params: ExtractedParams = {
        kind: 'document_generation',
        type: 'pdf',
        contentDescription: 'A report',
        title: 'My Report',
      };
      expect(isDocumentGenerationParams(params)).toBe(true);
      expect(isChatCompletionParams(params)).toBe(false);
    });

    it('isChatCompletionParams should correctly identify chat_completion params', () => {
      const params: ExtractedParams = {
        kind: 'chat_completion',
        message: 'Hello',
      };
      expect(isChatCompletionParams(params)).toBe(true);
      expect(isDocumentGenerationParams(params)).toBe(false);
    });
  });

  describe('Display names and icons', () => {
    it('should have display names for all intents', () => {
      expect(TOOL_INTENT_DISPLAY_NAMES.deep_research).toBe('Deep Research');
      expect(TOOL_INTENT_DISPLAY_NAMES.image_generation).toBe('Image Generation');
      expect(TOOL_INTENT_DISPLAY_NAMES.document_generation).toBe('Document Generation');
      expect(TOOL_INTENT_DISPLAY_NAMES.chat_completion).toBe('Chat');
    });

    it('should have icons for all intents', () => {
      expect(TOOL_INTENT_ICONS.deep_research).toBe('search');
      expect(TOOL_INTENT_ICONS.image_generation).toBe('image');
      expect(TOOL_INTENT_ICONS.document_generation).toBe('file-text');
      expect(TOOL_INTENT_ICONS.chat_completion).toBe('message-circle');
    });
  });

  describe('JSON roundtrip (REQ_006.2.12)', () => {
    it('should correctly serialize/deserialize deep_research params', () => {
      const params: ExtractedParams = {
        kind: 'deep_research',
        query: 'quantum computing',
        depth: 'thorough',
        topics: ['physics', 'technology'],
      };
      const roundtrip = JSON.parse(JSON.stringify(params));
      expect(roundtrip).toEqual(params);
      expect(isDeepResearchParams(roundtrip as ExtractedParams)).toBe(true);
    });

    it('should correctly serialize/deserialize image_generation params', () => {
      const params: ExtractedParams = {
        kind: 'image_generation',
        prompt: 'sunset over mountains',
        size: '1536x1024',
        quality: 'high',
        style: 'photorealistic',
      };
      const roundtrip = JSON.parse(JSON.stringify(params));
      expect(roundtrip).toEqual(params);
    });

    it('should correctly serialize/deserialize document_generation params', () => {
      const params: ExtractedParams = {
        kind: 'document_generation',
        type: 'xlsx',
        contentDescription: 'expense tracking',
        template: 'financial',
        title: 'Expenses 2026',
      };
      const roundtrip = JSON.parse(JSON.stringify(params));
      expect(roundtrip).toEqual(params);
    });

    it('should correctly serialize/deserialize chat_completion params', () => {
      const params: ExtractedParams = {
        kind: 'chat_completion',
        message: 'Help me write an email',
      };
      const roundtrip = JSON.parse(JSON.stringify(params));
      expect(roundtrip).toEqual(params);
    });
  });
});

describe('ClassifiedIntent Response (REQ_006.3)', () => {
  describe('clampConfidence', () => {
    it('should clamp values within 0-1 range', () => {
      expect(clampConfidence(0.5)).toBe(0.5);
      expect(clampConfidence(0)).toBe(0);
      expect(clampConfidence(1)).toBe(1);
    });

    it('should clamp negative values to 0', () => {
      expect(clampConfidence(-0.5)).toBe(0);
      expect(clampConfidence(-100)).toBe(0);
    });

    it('should clamp values > 1 to 1', () => {
      expect(clampConfidence(1.5)).toBe(1);
      expect(clampConfidence(100)).toBe(1);
    });

    it('should handle NaN by returning 0', () => {
      expect(clampConfidence(NaN)).toBe(0);
    });

    it('should handle undefined/null by returning 0', () => {
      expect(clampConfidence(undefined as unknown as number)).toBe(0);
      expect(clampConfidence(null as unknown as number)).toBe(0);
    });
  });

  describe('CONFIDENCE_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.8);
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(0.5);
      expect(CONFIDENCE_THRESHOLDS.LOW).toBe(0.3);
      expect(CONFIDENCE_THRESHOLDS.MINIMUM).toBe(0.1);
    });
  });

  describe('getConfidenceLevel', () => {
    it('should return high for confidence >= 0.8', () => {
      expect(getConfidenceLevel(0.8)).toBe('high');
      expect(getConfidenceLevel(0.9)).toBe('high');
      expect(getConfidenceLevel(1.0)).toBe('high');
    });

    it('should return medium for 0.5 <= confidence < 0.8', () => {
      expect(getConfidenceLevel(0.5)).toBe('medium');
      expect(getConfidenceLevel(0.6)).toBe('medium');
      expect(getConfidenceLevel(0.79)).toBe('medium');
    });

    it('should return low for confidence < 0.5', () => {
      expect(getConfidenceLevel(0.49)).toBe('low');
      expect(getConfidenceLevel(0.3)).toBe('low');
      expect(getConfidenceLevel(0)).toBe('low');
    });
  });

  describe('shouldRequestClarification', () => {
    it('should return true for confidence < 0.5 (REQ_006.5.12)', () => {
      const intent: ClassifiedIntent = {
        tool: 'chat_completion',
        confidence: 0.49,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      expect(shouldRequestClarification(intent)).toBe(true);
    });

    it('should return false for confidence >= 0.5 (REQ_006.5.12)', () => {
      const intent: ClassifiedIntent = {
        tool: 'chat_completion',
        confidence: 0.5,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      expect(shouldRequestClarification(intent)).toBe(false);
    });

    it('should trigger at exactly 0.49 but not at 0.50', () => {
      const at49: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.49,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };
      const at50: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.50,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };

      expect(shouldRequestClarification(at49)).toBe(true);
      expect(shouldRequestClarification(at50)).toBe(false);
    });
  });

  describe('validateClassifiedIntent', () => {
    it('should validate a complete ClassifiedIntent', () => {
      const response = {
        tool: 'deep_research',
        confidence: 0.9,
        extractedParams: { kind: 'deep_research', query: 'test' },
        alternativeIntents: [{ tool: 'chat_completion', confidence: 0.3 }],
        rawMessage: 'test message',
        classifiedAt: '2026-01-16T00:00:00Z',
      };

      const result = validateClassifiedIntent(response);
      expect(result.tool).toBe('deep_research');
      expect(result.confidence).toBe(0.9);
    });

    it('should throw on null response', () => {
      expect(() => validateClassifiedIntent(null)).toThrow(IntentClassificationError);
    });

    it('should throw on invalid tool type', () => {
      const response = {
        tool: 'invalid_tool',
        confidence: 0.9,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      expect(() => validateClassifiedIntent(response)).toThrow('Invalid tool type');
    });

    it('should throw on missing confidence', () => {
      const response = {
        tool: 'chat_completion',
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      expect(() => validateClassifiedIntent(response)).toThrow('Invalid confidence');
    });

    it('should throw on missing extractedParams', () => {
      const response = {
        tool: 'chat_completion',
        confidence: 0.9,
      };
      expect(() => validateClassifiedIntent(response)).toThrow('Invalid extractedParams');
    });

    it('should throw on invalid alternativeIntents', () => {
      const response = {
        tool: 'chat_completion',
        confidence: 0.9,
        extractedParams: { kind: 'chat_completion', message: 'test' },
        alternativeIntents: 'not an array',
      };
      expect(() => validateClassifiedIntent(response)).toThrow('Invalid alternativeIntents');
    });

    it('should clamp out-of-range confidence values', () => {
      const response = {
        tool: 'chat_completion',
        confidence: 1.5,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      const result = validateClassifiedIntent(response);
      expect(result.confidence).toBe(1.0);
    });
  });
});

describe('System Prompt (REQ_006.4)', () => {
  it('should have version tracking', () => {
    expect(INTENT_CLASSIFIER_PROMPT_VERSION).toBe('v1.0.0');
  });

  it('should define all four tool types', () => {
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### deep_research');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### image_generation');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### document_generation');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### chat_completion');
  });

  it('should include deep_research keywords (REQ_006.4.3)', () => {
    const keywords = ['research', 'investigate', 'analyze', 'deep dive'];
    keywords.forEach(keyword => {
      expect(INTENT_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain(keyword);
    });
  });

  it('should include image_generation keywords (REQ_006.4.4)', () => {
    const keywords = ['create image', 'draw', 'generate picture', 'visualize'];
    keywords.forEach(keyword => {
      expect(INTENT_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain(keyword);
    });
  });

  it('should include document_generation keywords (REQ_006.4.5)', () => {
    const keywords = ['create pdf', 'generate report', 'spreadsheet', 'word document'];
    keywords.forEach(keyword => {
      expect(INTENT_CLASSIFIER_SYSTEM_PROMPT.toLowerCase()).toContain(keyword);
    });
  });

  it('should include few-shot examples (REQ_006.4.7)', () => {
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### Example 1');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### Example 2');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### Example 3');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('### Example 4');
  });

  it('should specify JSON output format (REQ_006.4.8)', () => {
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('"tool"');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('"confidence"');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('"extractedParams"');
  });

  it('should include confidence scoring guidance (REQ_006.4.10)', () => {
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('0.9+');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('0.6-0.8');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('0.3-0.5');
  });

  it('should include negative examples (REQ_006.4.12)', () => {
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('Negative Examples');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('NOT');
  });

  it('should specify chat_completion as default (REQ_006.4.6)', () => {
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('DEFAULT');
    expect(INTENT_CLASSIFIER_SYSTEM_PROMPT).toContain('chat_completion');
  });
});

describe('classifyIntent Function (REQ_006.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockResponse = (content: object) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  });

  it('should accept userMessage string parameter (REQ_006.1.1)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      tool: 'chat_completion',
      confidence: 0.9,
      extractedParams: { kind: 'chat_completion', message: 'hello' },
    }));

    const result = await classifyIntent('hello');
    expect(result.tool).toBe('chat_completion');
  });

  it('should handle empty messages with INVALID_INPUT error (REQ_006.1.5)', async () => {
    await expect(classifyIntent('')).rejects.toThrow(IntentClassificationError);
    await expect(classifyIntent('')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('should handle whitespace-only messages with INVALID_INPUT error (REQ_006.1.5)', async () => {
    await expect(classifyIntent('   ')).rejects.toThrow(IntentClassificationError);
    await expect(classifyIntent('\t\n')).rejects.toThrow(IntentClassificationError);
  });

  it('should make POST request to OpenAI API (REQ_006.1.2)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      tool: 'chat_completion',
      confidence: 0.9,
      extractedParams: { kind: 'chat_completion', message: 'test' },
    }));

    await classifyIntent('test');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key',
        }),
      })
    );
  });

  it('should use gpt-4o-mini model with temperature 0 (REQ_006.1.2)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      tool: 'chat_completion',
      confidence: 0.9,
      extractedParams: { kind: 'chat_completion', message: 'test' },
    }));

    await classifyIntent('test');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('gpt-4o-mini');
    expect(callBody.temperature).toBe(0);
  });

  it('should use json_object response format (REQ_006.1.3)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      tool: 'chat_completion',
      confidence: 0.9,
      extractedParams: { kind: 'chat_completion', message: 'test' },
    }));

    await classifyIntent('test');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.response_format).toEqual({ type: 'json_object' });
  });

  it('should return Promise<ClassifiedIntent> (REQ_006.1.4)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      tool: 'deep_research',
      confidence: 0.95,
      extractedParams: { kind: 'deep_research', query: 'AI research' },
    }));

    const result = await classifyIntent('research AI developments');

    expect(result).toMatchObject({
      tool: 'deep_research',
      confidence: 0.95,
      extractedParams: { kind: 'deep_research', query: 'AI research' },
    });
  });

  it('should include conversation history in prompt (REQ_006.1.14)', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      tool: 'chat_completion',
      confidence: 0.9,
      extractedParams: { kind: 'chat_completion', message: 'yes' },
    }));

    const history = [
      { role: 'user' as const, content: 'Can you help me?' },
      { role: 'assistant' as const, content: 'Of course! What do you need?' },
    ];

    await classifyIntent('yes, create an image', history);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const systemMessage = callBody.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMessage.content).toContain('Conversation History');
    expect(systemMessage.content).toContain('Can you help me?');
  });

  describe('Error Handling (REQ_006.1.10-13)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      // Run all pending timers to completion to avoid unhandled rejections
      await vi.runAllTimersAsync();
      vi.useRealTimers();
    });

    it('should handle rate limit errors (429) with retry (REQ_006.1.10)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve('rate limited') })
        .mockResolvedValueOnce(createMockResponse({
          tool: 'chat_completion',
          confidence: 0.9,
          extractedParams: { kind: 'chat_completion', message: 'test' },
        }));

      const promise = classifyIntent('test');

      // Advance timer to trigger retry
      await vi.advanceTimersByTimeAsync(10000);

      const result = await promise;
      expect(result.tool).toBe('chat_completion');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors with retry for 5xx (REQ_006.1.13)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('server error') })
        .mockResolvedValueOnce(createMockResponse({
          tool: 'chat_completion',
          confidence: 0.9,
          extractedParams: { kind: 'chat_completion', message: 'test' },
        }));

      const promise = classifyIntent('test');

      // Advance timer to trigger retry
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.tool).toBe('chat_completion');
    });

    it('should throw on invalid API key (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('unauthorized'),
      });

      await expect(classifyIntent('test')).rejects.toMatchObject({
        code: 'INVALID_API_KEY',
      });
    });

    it('should handle malformed JSON response (REQ_006.1.13)', async () => {
      // Mock returns malformed JSON on all retries
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'not valid json' } }],
        }),
      });

      const promise = classifyIntent('test');

      // Advance through all retries (2s, 4s, 8s)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(8000);

      await expect(promise).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should handle network abort as timeout (REQ_006.1.11)', async () => {
      // Mock fetch to reject with AbortError
      mockFetch.mockImplementationOnce(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const promise = classifyIntent('test', undefined, 1);

      await expect(promise).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });

    it('should respect MAX_RETRIES=3 (REQ_006.1.9)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('server error'),
      });

      const promise = classifyIntent('test');

      // Advance through all retries (2s, 4s, 8s)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(8000);

      await expect(promise).rejects.toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('Classification responses (REQ_006.1.12)', () => {
    const testCases: Array<{
      name: string;
      tool: ToolIntent;
      confidence: number;
    }> = [
      { name: 'deep_research high confidence', tool: 'deep_research', confidence: 0.95 },
      { name: 'deep_research medium confidence', tool: 'deep_research', confidence: 0.7 },
      { name: 'deep_research low confidence', tool: 'deep_research', confidence: 0.4 },
      { name: 'image_generation high confidence', tool: 'image_generation', confidence: 0.92 },
      { name: 'image_generation low confidence', tool: 'image_generation', confidence: 0.35 },
      { name: 'document_generation high confidence', tool: 'document_generation', confidence: 0.88 },
      { name: 'chat_completion high confidence', tool: 'chat_completion', confidence: 0.9 },
    ];

    testCases.forEach(({ name, tool, confidence }) => {
      it(`should parse ${name}`, async () => {
        const params: ExtractedParams = tool === 'deep_research'
          ? { kind: 'deep_research', query: 'test' }
          : tool === 'image_generation'
          ? { kind: 'image_generation', prompt: 'test' }
          : tool === 'document_generation'
          ? { kind: 'document_generation', type: 'pdf', contentDescription: 'test' }
          : { kind: 'chat_completion', message: 'test' };

        mockFetch.mockResolvedValueOnce(createMockResponse({
          tool,
          confidence,
          extractedParams: params,
        }));

        const result = await classifyIntent('test');
        expect(result.tool).toBe(tool);
        expect(result.confidence).toBeCloseTo(confidence);
      });
    });
  });
});

describe('POST Endpoint (REQ_006.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createRequest = (body: object): NextRequest => {
    return new NextRequest('http://localhost/api/tools/intent-classification', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('should return 400 for missing userMessage', async () => {
    const request = createRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_INPUT');
  });

  it('should return 400 for empty userMessage', async () => {
    const request = createRequest({ userMessage: '' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_INPUT');
  });

  it('should return 400 for whitespace-only userMessage', async () => {
    const request = createRequest({ userMessage: '   ' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_INPUT');
  });

  it('should return 400 for invalid conversationHistory', async () => {
    const request = createRequest({
      userMessage: 'test',
      conversationHistory: 'not an array',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 200 with valid request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: JSON.stringify({
              tool: 'chat_completion',
              confidence: 0.9,
              extractedParams: { kind: 'chat_completion', message: 'hello' },
            }),
          },
        }],
      }),
    });

    const request = createRequest({ userMessage: 'hello' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tool).toBe('chat_completion');
  });

  it('should handle conversationHistory correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: JSON.stringify({
              tool: 'image_generation',
              confidence: 0.85,
              extractedParams: { kind: 'image_generation', prompt: 'sunset' },
            }),
          },
        }],
      }),
    });

    const request = createRequest({
      userMessage: 'create an image of that',
      conversationHistory: [
        { role: 'user', content: 'I love sunsets' },
        { role: 'assistant', content: 'Sunsets are beautiful!' },
      ],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('should return 408 when request times out', async () => {
    // Mock fetch to reject with AbortError to simulate timeout
    mockFetch.mockImplementationOnce(() => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const request = createRequest({
      userMessage: 'test',
      timeout: 1,
    });

    const response = await POST(request);
    expect(response.status).toBe(408);
    const body = await response.json();
    expect(body.code).toBe('TIMEOUT');
  });
});
