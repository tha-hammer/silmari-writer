import { NextRequest, NextResponse } from 'next/server';
import {
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_TEXT_TYPES,
  SUPPORTED_DOCUMENT_TYPES,
  isSupportedMimeType,
} from '@/lib/attachment-types';
import { MAX_ROUTE_ATTACHMENTS, MAX_ROUTE_PAYLOAD_BYTES } from './constants';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;
const RATE_LIMIT_BASE_DELAY_MS = 10000;
const OPENAI_REQUEST_TIMEOUT_MS = 45_000;
const MODEL_NAME = 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a writing partner who writes for real-world outcomes, not academic exercises.

Before you write anything, figure out what the user is actually trying to accomplish:
- Are they trying to persuade someone? (cold email, pitch, proposal)
- Entertain or engage? (social media, blog post, creative writing)
- Get a reader to take action? (landing page, CTA, fundraising)
- Inform clearly? (documentation, explainer, report)
- Express something personal? (letter, journal, reflection)

Then write for THAT outcome. Match your tone, structure, and word choices to the intent:
- Persuasion → punchy, benefit-driven, specific. No filler.
- Entertainment → conversational, vivid, surprising. Have a voice.
- Call to action → clear, direct, urgent without being desperate.
- Information → organized, scannable, precise. No fluff.
- Personal → authentic, warm, human. Not corporate.

Rules:
- Write like a sharp human, not a committee. No "In today's fast-paced world" or "It's important to note that."
- Use concrete details over vague claims. "Increased signups 40%" beats "significantly improved metrics."
- If light research (recent events, Reddit discussions, industry context) would make the writing better, search the web for it. Don't guess at facts you could look up.
- Vary sentence length. Short sentences punch. Longer ones build rhythm and carry the reader through more complex ideas.
- Cut anything that doesn't earn its place. Every sentence should do work.
- Match the formality to the context. A tweet thread and a board memo need different registers.
- When the user explicitly asks you to search the web, ALWAYS use the web_search_preview tool. Do not refuse or skip the search.`;

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface FileAttachment {
  filename: string;
  contentType: string;
  textContent?: string;
  base64Data?: string;
  rawBlob?: string;
  fileUrl?: string;
}

type ResponseInputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename?: string; file_data?: string; file_url?: string };

type ResponseInputMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ResponseInputPart[];
};

function shouldEnableWebSearchTool(message: string): boolean {
  return /\b(search|look up|lookup|latest|news|current events|on the web|online)\b/i.test(message);
}


function parseHistory(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const maybe = entry as Record<string, unknown>;
    const role = maybe.role;
    const content = maybe.content;

    if (
      typeof role !== 'string' ||
      typeof content !== 'string' ||
      (role !== 'user' && role !== 'assistant' && role !== 'system')
    ) {
      return [];
    }

    return [{ role, content }];
  });
}

function toAttachment(value: unknown): FileAttachment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybe = value as Record<string, unknown>;
  if (typeof maybe.filename !== 'string' || typeof maybe.contentType !== 'string') {
    return null;
  }

  const fileUrl =
    typeof maybe.fileUrl === 'string'
      ? maybe.fileUrl
      : typeof maybe.file_url === 'string'
        ? maybe.file_url
        : typeof maybe.url === 'string'
          ? maybe.url
          : undefined;

  return {
    filename: maybe.filename,
    contentType: maybe.contentType,
    textContent: typeof maybe.textContent === 'string' ? maybe.textContent : undefined,
    base64Data: typeof maybe.base64Data === 'string' ? maybe.base64Data : undefined,
    rawBlob: typeof maybe.rawBlob === 'string' ? maybe.rawBlob : undefined,
    fileUrl,
  };
}

function parseAttachments(value: unknown): FileAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(toAttachment)
    .filter((attachment): attachment is FileAttachment => attachment !== null);
}

function isSupportedAttachment(attachment: FileAttachment): boolean {
  return isSupportedMimeType(attachment.contentType);
}

function calculatePayloadSize(attachments: FileAttachment[]): number {
  const encoder = new TextEncoder();
  return attachments.reduce((total, attachment) => {
    const textSize = encoder.encode(attachment.textContent ?? '').length;
    const imageSize = encoder.encode(attachment.base64Data ?? '').length;
    const blobSize = encoder.encode(attachment.rawBlob ?? '').length;
    return total + textSize + imageSize + blobSize;
  }, 0);
}

function toInputFilePart(attachment: FileAttachment): ResponseInputPart | null {
  if (attachment.fileUrl) {
    return {
      type: 'input_file',
      filename: attachment.filename,
      file_url: attachment.fileUrl,
    };
  }

  if (attachment.rawBlob) {
    return {
      type: 'input_file',
      filename: attachment.filename,
      file_data: attachment.rawBlob,
    };
  }

  return null;
}

function buildUserContent(
  message: string,
  attachments: FileAttachment[],
): string | ResponseInputPart[] {
  const supported = attachments.filter(isSupportedAttachment);
  if (supported.length === 0) {
    return message;
  }

  const textAttachments = supported.filter((a) => SUPPORTED_TEXT_TYPES.has(a.contentType));
  const documentAttachments = supported.filter((a) => SUPPORTED_DOCUMENT_TYPES.has(a.contentType));
  const imageAttachments = supported.filter((a) => SUPPORTED_IMAGE_TYPES.has(a.contentType));

  let textContent = message;
  const textLikeAttachments = [...textAttachments, ...documentAttachments];
  if (textLikeAttachments.length > 0) {
    const textContext = textLikeAttachments
      .map((a) => `--- ${a.filename} ---\n${a.textContent ?? ''}`)
      .join('\n\n');
    textContent = `${textContext}\n\n${message}`;
  }

  const documentParts: ResponseInputPart[] = [];
  const documentFallbackLines: string[] = [];

  for (const attachment of documentAttachments) {
    const filePart = toInputFilePart(attachment);
    if (filePart) {
      documentParts.push(filePart);
    } else {
      documentFallbackLines.push(
        `[Attached file metadata only: ${attachment.filename} (${attachment.contentType})]`,
      );
    }
  }

  if (documentFallbackLines.length > 0) {
    textContent = `${textContent}\n\n${documentFallbackLines.join('\n')}`;
  }

  if (imageAttachments.length === 0 && documentParts.length === 0) {
    return textContent;
  }

  const parts: ResponseInputPart[] = [{ type: 'input_text', text: textContent }, ...documentParts];
  for (const attachment of imageAttachments) {
    if (attachment.base64Data) {
      parts.push({ type: 'input_image', image_url: attachment.base64Data });
    }
  }

  return parts;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [], attachments: rawAttachments } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message format', code: 'INVALID_MESSAGE' },
        { status: 400 },
      );
    }

    const attachmentCount = Array.isArray(rawAttachments) ? rawAttachments.length : 0;
    if (attachmentCount > MAX_ROUTE_ATTACHMENTS) {
      return NextResponse.json(
        {
          error: `Too many attachments (max ${MAX_ROUTE_ATTACHMENTS})`,
          code: 'ATTACHMENT_LIMIT',
        },
        { status: 400 },
      );
    }

    const attachments = parseAttachments(rawAttachments);
    if (calculatePayloadSize(attachments) > MAX_ROUTE_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Attachment payload too large', code: 'PAYLOAD_TOO_LARGE' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Chat service not configured', code: 'CONFIG_ERROR' },
        { status: 500 },
      );
    }

    const parsedHistory = parseHistory(history);
    const userContent = buildUserContent(message, attachments);

    const input: ResponseInputMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...parsedHistory.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: 'user', content: userContent },
    ];

    const response = await generateWithRetry(apiKey, input, 0, shouldEnableWebSearchTool(message));

    return NextResponse.json({ content: response });
  } catch (error) {
    console.error('Chat generation error:', error);

    if (error instanceof ChatGenerationError) {
      const statusCodes: Record<string, number> = {
        INVALID_API_KEY: 401,
        RATE_LIMIT: 429,
        API_TIMEOUT: 504,
        NETWORK: 502,
        API_ERROR: 500,
      };

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
        },
        { status: statusCodes[error.code] || 500 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate response', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

class ChatGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'ChatGenerationError';
  }
}

async function generateWithRetry(
  apiKey: string,
  input: ResponseInputMessage[],
  retries: number,
  enableWebSearch: boolean,
): Promise<string> {
  try {
    return await makeOpenAIRequest(apiKey, input, enableWebSearch);
  } catch (error) {
    if (error instanceof ChatGenerationError && error.retryable && retries < MAX_RETRIES) {
      const baseDelay = error.code === 'RATE_LIMIT' ? RATE_LIMIT_BASE_DELAY_MS : BASE_RETRY_DELAY_MS;
      const delay = baseDelay * Math.pow(2, retries);
      console.warn(`Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms (${error.code})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateWithRetry(apiKey, input, retries + 1, enableWebSearch);
    }

    throw error;
  }
}

async function makeOpenAIRequest(
  apiKey: string,
  input: ResponseInputMessage[],
  enableWebSearch: boolean,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const requestBody: Record<string, unknown> = {
      model: MODEL_NAME,
      input,
    };

    if (enableWebSearch) {
      requestBody.tools = [{ type: 'web_search_preview' }];
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      const errorMessage = (() => {
        try {
          return JSON.parse(errorBody)?.error?.message || errorBody;
        } catch {
          return errorBody;
        }
      })();

      switch (res.status) {
        case 401:
          throw new ChatGenerationError(`Invalid API key: ${errorMessage}`, 'INVALID_API_KEY', false);
        case 429:
          throw new ChatGenerationError(`Rate limit exceeded: ${errorMessage}`, 'RATE_LIMIT', true);
        case 500:
        case 502:
        case 503:
        case 504:
          throw new ChatGenerationError(`Server error: ${errorMessage}`, 'API_ERROR', true);
        default:
          throw new ChatGenerationError(`API error (${res.status}): ${errorMessage}`, 'API_ERROR', false);
      }
    }

    const data = await res.json();

    if (data.output_text) {
      return data.output_text;
    }

    const textContent = data.output
      ?.filter((item: { type: string }) => item.type === 'message')
      ?.flatMap((item: { content: Array<{ type: string; text: string }> }) => item.content)
      ?.filter((block: { type: string }) => block.type === 'output_text')
      ?.map((block: { text: string }) => block.text)
      ?.join('');

    if (!textContent) {
      throw new ChatGenerationError('No response generated', 'API_ERROR', false);
    }

    return textContent;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ChatGenerationError(
        `Request timed out after ${OPENAI_REQUEST_TIMEOUT_MS}ms`,
        'API_TIMEOUT',
        false,
      );
    }

    if (error instanceof ChatGenerationError) {
      throw error;
    }

    throw new ChatGenerationError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK',
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
