import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const RATE_LIMIT_BASE_DELAY_MS = 10000;

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message format', code: 'INVALID_MESSAGE' },
        { status: 400 }
      );
    }

    // Validate API key exists server-side
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Chat service not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Format conversation history for OpenAI API
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: 'You are a helpful writing assistant. Help users with their writing tasks, provide feedback, and assist with transcription-related queries.',
      },
      ...history.map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // Call OpenAI with retry logic
    const response = await generateWithRetry(openai, messages, 0);

    return NextResponse.json({
      content: response,
    });
  } catch (error) {
    console.error('Chat generation error:', error);

    if (error instanceof ChatGenerationError) {
      const statusCodes: Record<string, number> = {
        INVALID_API_KEY: 401,
        RATE_LIMIT: 429,
        NETWORK: 502,
        API_ERROR: 500,
      };

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
        },
        { status: statusCodes[error.code] || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate response', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

class ChatGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = 'ChatGenerationError';
  }
}

async function generateWithRetry(
  openai: OpenAI,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  retries: number
): Promise<string> {
  try {
    return await makeOpenAIRequest(openai, messages);
  } catch (error) {
    if (error instanceof ChatGenerationError && error.retryable && retries < MAX_RETRIES) {
      // Use longer delays for rate limit errors
      const baseDelay = error.code === 'RATE_LIMIT'
        ? RATE_LIMIT_BASE_DELAY_MS
        : BASE_RETRY_DELAY_MS;

      // Exponential backoff: baseDelay * 2^retries
      const delay = baseDelay * Math.pow(2, retries);
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms (${error.code})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateWithRetry(openai, messages, retries + 1);
    }
    throw error;
  }
}

async function makeOpenAIRequest(
  openai: OpenAI,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  try {
    // Call OpenAI Chat Completions API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new ChatGenerationError(
        'No response generated',
        'API_ERROR',
        false
      );
    }

    return content;
  } catch (error: unknown) {
    // Handle OpenAI SDK errors
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status?: number }).status;
      const message = (error as { message?: string }).message || 'Unknown error';

      switch (status) {
        case 401:
          throw new ChatGenerationError(
            `Invalid API key: ${message}`,
            'INVALID_API_KEY',
            false
          );
        case 429:
          throw new ChatGenerationError(
            `Rate limit exceeded: ${message}`,
            'RATE_LIMIT',
            true
          );
        case 500:
        case 502:
        case 503:
        case 504:
          throw new ChatGenerationError(
            `Server error: ${message}`,
            'API_ERROR',
            true
          );
        default:
          throw new ChatGenerationError(
            `API error: ${message}`,
            'API_ERROR',
            false
          );
      }
    }

    // Network or other errors
    throw new ChatGenerationError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK',
      true
    );
  }
}
