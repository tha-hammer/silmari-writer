import { NextRequest, NextResponse } from 'next/server';

import {
  type ToolIntent,
  type ExtractedParams,
  type ClassifiedIntent,
  type AlternativeIntent,
  type IntentClassificationErrorCode,
  IntentClassificationError,
  validateClassifiedIntent,
  clampConfidence,
  isValidToolIntent,
  CONFIDENCE_THRESHOLDS,
  INTENT_CLASSIFIER_PROMPT_VERSION,
} from '@/lib/types';

/**
 * Intent Classifier System Prompt
 * REQ_006.4: Classification criteria and few-shot examples
 * // v1.0.0 - 2026-01-16
 */
export const INTENT_CLASSIFIER_SYSTEM_PROMPT = `You are an intent classification system that routes user messages to the appropriate tool. Analyze the user's message and classify it into one of four tool types.

## Tool Types

### deep_research
Use for queries requiring in-depth investigation, analysis, or research.
**Keywords**: research, investigate, find out, analyze, what is the latest, study, explore, look into, deep dive, compare, evaluate, examine
**NOT for**: simple factual questions, quick lookups, general knowledge

### image_generation
Use for requests to create visual content.
**Keywords**: create image, draw, generate picture, visualize, design, illustrate, make artwork, paint, render, sketch, photo of, picture of
**NOT for**: editing existing images, analyzing images, describing images

### document_generation
Use for creating formatted documents, reports, or spreadsheets.
**Keywords**: create PDF, generate report, make spreadsheet, Word document, Excel file, export as, create document, build a report, write a proposal, draft invoice
**NOT for**: editing existing documents, simple text responses, explanations

### chat_completion (DEFAULT)
Use for general conversation, writing assistance, explanations, creative writing, and questions.
This is the DEFAULT when no other tool clearly matches.
**Use for**: answering questions, writing help, explanations, coding help, translations, summaries

## Output Format

Return a JSON object with this exact structure:
{
  "tool": "deep_research" | "image_generation" | "document_generation" | "chat_completion",
  "confidence": 0.0 to 1.0,
  "extractedParams": { ... },
  "alternativeIntents": [ ... ] (optional)
}

### Confidence Scoring
- 0.9+ : Clear, unambiguous match to a tool type
- 0.6-0.8 : Likely match but some ambiguity exists
- 0.3-0.5 : Uncertain, could be multiple tools
- Below 0.3 : Very uncertain, default to chat_completion

### Parameter Extraction by Tool

**deep_research**: { "kind": "deep_research", "query": "extracted query", "depth": "quick"|"thorough" (optional), "topics": ["topic1", "topic2"] (optional) }

**image_generation**: { "kind": "image_generation", "prompt": "image description", "size": "1024x1024"|"1536x1024"|"1024x1536"|"auto" (optional), "quality": "low"|"medium"|"high" (optional), "style": "style description" (optional) }

**document_generation**: { "kind": "document_generation", "type": "pdf"|"docx"|"xlsx", "contentDescription": "what to generate", "template": "template name" (optional), "title": "document title" (optional) }

**chat_completion**: { "kind": "chat_completion", "message": "original message" }

### Alternative Intents
Include alternativeIntents when:
- Primary confidence is below 0.8
- Second-best intent has confidence > 0.4 AND is within 0.3 of primary

## Few-Shot Examples

### Example 1: Deep Research
User: "Research the latest developments in quantum computing and compare different approaches"
Output: {
  "tool": "deep_research",
  "confidence": 0.95,
  "extractedParams": {
    "kind": "deep_research",
    "query": "latest developments in quantum computing comparison of approaches",
    "depth": "thorough",
    "topics": ["quantum computing", "technology comparison"]
  }
}

### Example 2: Image Generation
User: "Create an image of a futuristic city at sunset with flying cars"
Output: {
  "tool": "image_generation",
  "confidence": 0.95,
  "extractedParams": {
    "kind": "image_generation",
    "prompt": "futuristic city at sunset with flying cars",
    "quality": "high"
  }
}

### Example 3: Document Generation
User: "Generate a PDF report about our Q4 sales performance"
Output: {
  "tool": "document_generation",
  "confidence": 0.92,
  "extractedParams": {
    "kind": "document_generation",
    "type": "pdf",
    "contentDescription": "Q4 sales performance report",
    "title": "Q4 Sales Performance Report"
  }
}

### Example 4: Chat Completion
User: "Can you explain how async/await works in JavaScript?"
Output: {
  "tool": "chat_completion",
  "confidence": 0.90,
  "extractedParams": {
    "kind": "chat_completion",
    "message": "Can you explain how async/await works in JavaScript?"
  }
}

### Example 5: Ambiguous (with alternatives)
User: "I need information about climate change"
Output: {
  "tool": "chat_completion",
  "confidence": 0.55,
  "extractedParams": {
    "kind": "chat_completion",
    "message": "I need information about climate change"
  },
  "alternativeIntents": [
    { "tool": "deep_research", "confidence": 0.45 }
  ]
}

### Example 6: Document with spreadsheet
User: "Create an Excel spreadsheet tracking monthly expenses"
Output: {
  "tool": "document_generation",
  "confidence": 0.93,
  "extractedParams": {
    "kind": "document_generation",
    "type": "xlsx",
    "contentDescription": "monthly expense tracking spreadsheet",
    "title": "Monthly Expenses"
  }
}

## Negative Examples (What NOT to classify)

- "Edit this image to make it brighter" -> NOT image_generation (editing, not creating)
- "What's 2+2?" -> NOT deep_research (simple factual, use chat_completion)
- "Read this PDF and summarize it" -> NOT document_generation (reading, not creating)
- "How was quantum computing discovered?" -> NOT deep_research unless explicitly requesting research (use chat_completion for history questions)`;

// API Configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const CLASSIFICATION_MODEL = 'gpt-4o-mini';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const RATE_LIMIT_BASE_DELAY_MS = 10000;
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Custom error class for classification API errors
 */
class ClassificationApiError extends Error {
  constructor(
    message: string,
    public code: IntentClassificationErrorCode,
    public retryable: boolean,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ClassificationApiError';
  }
}

/**
 * Hash a string for logging (privacy-preserving)
 */
function hashMessage(message: string): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Format conversation history for context
 */
function formatConversationHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  if (!history || history.length === 0) return '';

  const formattedHistory = history
    .slice(-5) // Only use last 5 messages for context
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `\n\n## Conversation History (for context)\n${formattedHistory}`;
}

/**
 * Make OpenAI API request for classification
 */
async function makeClassificationRequest(
  userMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<ClassifiedIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ClassificationApiError(
      'OpenAI API key not configured',
      'INVALID_API_KEY',
      false,
      500
    );
  }

  const systemPrompt = conversationHistory?.length
    ? INTENT_CLASSIFIER_SYSTEM_PROMPT + formatConversationHistory(conversationHistory)
    : INTENT_CLASSIFIER_SYSTEM_PROMPT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CLASSIFICATION_MODEL,
        temperature: 0, // Deterministic output
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();

      if (response.status === 401) {
        throw new ClassificationApiError(
          'Invalid API key',
          'INVALID_API_KEY',
          false,
          401
        );
      }

      if (response.status === 429) {
        throw new ClassificationApiError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          true,
          429
        );
      }

      if (response.status >= 500) {
        throw new ClassificationApiError(
          `OpenAI API error: ${errorBody}`,
          'API_ERROR',
          true,
          response.status
        );
      }

      throw new ClassificationApiError(
        `API error: ${errorBody}`,
        'API_ERROR',
        false,
        response.status
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new ClassificationApiError(
        'Empty response from OpenAI',
        'INVALID_RESPONSE',
        true,
        500
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ClassificationApiError(
        'Failed to parse JSON response',
        'INVALID_RESPONSE',
        true,
        500
      );
    }

    // Validate and return
    const validated = validateClassifiedIntent(parsed);
    validated.rawMessage = userMessage;
    validated.classifiedAt = new Date().toISOString();

    return validated;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ClassificationApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ClassificationApiError(
        'Classification request timed out',
        'TIMEOUT',
        false, // Timeouts are not retryable as they indicate the request took too long
        408
      );
    }

    // Network errors
    throw new ClassificationApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK',
      true,
      503
    );
  }
}

/**
 * Classify intent with retry logic
 * REQ_006.1: Reuses retry pattern from generate/route.ts
 */
async function classifyWithRetry(
  userMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  timeout: number = DEFAULT_TIMEOUT_MS,
  retries: number = 0
): Promise<ClassifiedIntent> {
  try {
    return await makeClassificationRequest(userMessage, conversationHistory, timeout);
  } catch (error) {
    if (error instanceof ClassificationApiError && error.retryable && retries < MAX_RETRIES) {
      const baseDelay = error.code === 'RATE_LIMIT' ? RATE_LIMIT_BASE_DELAY_MS : BASE_RETRY_DELAY_MS;
      const delay = baseDelay * Math.pow(2, retries);

      console.log(`[IntentClassification] Retrying after ${delay}ms (attempt ${retries + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return classifyWithRetry(userMessage, conversationHistory, timeout, retries + 1);
    }
    throw error;
  }
}

/**
 * Main classifyIntent function
 * REQ_006.1: Core classification logic
 */
export async function classifyIntent(
  userMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<ClassifiedIntent> {
  const startTime = Date.now();
  const messageHash = hashMessage(userMessage);

  // REQ_006.1.5: Handle empty or whitespace-only messages
  if (!userMessage || !userMessage.trim()) {
    throw new IntentClassificationError(
      'Message cannot be empty or whitespace only',
      'INVALID_INPUT'
    );
  }

  try {
    const result = await classifyWithRetry(userMessage, conversationHistory, timeout);

    const latency = Date.now() - startTime;

    // REQ_006.1.7: Log classification for analytics
    console.log(`[IntentClassification] Classified message=${messageHash} tool=${result.tool} confidence=${result.confidence.toFixed(2)} latency=${latency}ms version=${INTENT_CLASSIFIER_PROMPT_VERSION}`);

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[IntentClassification] Failed message=${messageHash} latency=${latency}ms error=${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}

/**
 * POST /api/tools/intent-classification
 * REQ_006.1: HTTP endpoint for intent classification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userMessage, conversationHistory, timeout } = body as {
      userMessage?: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
      timeout?: number;
    };

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'userMessage is required and must be a string', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    if (!userMessage.trim()) {
      return NextResponse.json(
        { error: 'userMessage cannot be empty or whitespace only', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // Validate conversationHistory if provided
    if (conversationHistory !== undefined) {
      if (!Array.isArray(conversationHistory)) {
        return NextResponse.json(
          { error: 'conversationHistory must be an array', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      for (const msg of conversationHistory) {
        if (
          typeof msg !== 'object' ||
          !msg ||
          !['user', 'assistant'].includes(msg.role) ||
          typeof msg.content !== 'string'
        ) {
          return NextResponse.json(
            { error: 'Invalid conversationHistory entry', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
      }
    }

    const effectiveTimeout = typeof timeout === 'number' && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS;

    const result = await classifyIntent(userMessage, conversationHistory, effectiveTimeout);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof IntentClassificationError) {
      const statusCode = error.code === 'INVALID_INPUT' ? 400 :
                         error.code === 'RATE_LIMIT' ? 429 :
                         error.code === 'TIMEOUT' ? 408 :
                         error.code === 'INVALID_API_KEY' ? 401 : 500;

      return NextResponse.json(
        { error: error.message, code: error.code, retryable: error.retryable },
        { status: statusCode }
      );
    }

    if (error instanceof ClassificationApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code, retryable: error.retryable },
        { status: error.statusCode }
      );
    }

    console.error('[IntentClassification] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'API_ERROR', retryable: true },
      { status: 500 }
    );
  }
}
