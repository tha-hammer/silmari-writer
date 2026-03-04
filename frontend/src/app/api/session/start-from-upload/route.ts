import { NextRequest, NextResponse } from 'next/server';
import {
  StartSessionFromUploadRequestSchema,
  StartSessionFromUploadResponseSchema,
} from '@/api_contracts/startSessionFromUpload';
import { InitializeSessionService } from '@/server/services/InitializeSessionService';
import { AuthAndValidationFilter } from '@/server/filters/AuthAndValidationFilter';
import { QuestionResolutionService } from '@/server/services/QuestionResolutionService';
import { StoryError, StoryErrors } from '@/server/error_definitions/StoryErrors';
import { SessionError } from '@/server/error_definitions/SessionErrors';

const RESUME_EXTENSIONS = new Set(['docx', 'doc', 'pdf', 'txt', 'md']);
const SCREENSHOT_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const OPENAI_REQUEST_TIMEOUT_MS = 45_000;
const MODEL_NAME = 'gpt-4o-mini';
const DEFAULT_QUESTION_TEXT =
  'Tell us about your favourite project you worked on in recent memory and why you loved working on it so much.';
const MAX_CONTEXT_CHARS = 6000;

type ClassifiedFile = {
  filename: string;
  url: string;
  mimeType?: string;
  kind: 'resume' | 'screenshot';
};

type UploadSessionContext = {
  resumeContext: string;
  resumeName: string;
  jobTitle: string;
  jobDescription: string;
  questionText: string;
};

type ResponseInputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_file'; filename?: string; file_url?: string };

type ResponseInputMessage = {
  role: 'system' | 'user';
  content: string | ResponseInputPart[];
};

function extensionFromFilename(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) ?? '' : '';
}

function classifyFile(filename: string): 'resume' | 'screenshot' | null {
  const ext = extensionFromFilename(filename);
  if (RESUME_EXTENSIONS.has(ext)) {
    return 'resume';
  }
  if (SCREENSHOT_EXTENSIONS.has(ext)) {
    return 'screenshot';
  }
  return null;
}

function wordCountFromText(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sanitizeText(value: string, maxChars = MAX_CONTEXT_CHARS): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

function extractOutputText(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const maybe = data as Record<string, unknown>;
  if (typeof maybe.output_text === 'string' && maybe.output_text.trim().length > 0) {
    return maybe.output_text;
  }

  const output = maybe.output;
  if (!Array.isArray(output)) {
    return null;
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const itemRecord = item as Record<string, unknown>;
    if (itemRecord.type !== 'message') continue;

    const content = itemRecord.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const blockRecord = block as Record<string, unknown>;
      if (
        (blockRecord.type === 'output_text' || blockRecord.type === 'text')
        && typeof blockRecord.text === 'string'
      ) {
        chunks.push(blockRecord.text);
      }
    }
  }

  const combined = chunks.join('').trim();
  return combined.length > 0 ? combined : null;
}

function parseContextFromModelText(outputText: string): Partial<UploadSessionContext> {
  const start = outputText.indexOf('{');
  const end = outputText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return {};
  }

  try {
    const parsed = JSON.parse(outputText.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const record = parsed as Record<string, unknown>;

    return {
      resumeContext: pickString(record, ['resumeContext', 'resume_context', 'resumeSummary', 'resume_summary']),
      resumeName: pickString(record, ['resumeName', 'resume_name']),
      jobTitle: pickString(record, ['jobTitle', 'job_title']),
      jobDescription: pickString(record, ['jobDescription', 'job_description']),
      questionText: pickString(record, ['questionText', 'question_text', 'suggestedQuestion', 'suggested_question']),
    };
  } catch {
    return {};
  }
}

function buildFallbackContext(
  resumeFiles: ClassifiedFile[],
  screenshotFiles: ClassifiedFile[],
): UploadSessionContext {
  const resumeContext = resumeFiles.length > 0
    ? `Uploaded resume files: ${resumeFiles.map((file) => file.filename).join(', ')}.`
    : 'No resume file uploaded; using screenshot-only context.';

  const screenshotContext = screenshotFiles.length > 0
    ? `Uploaded screenshot files: ${screenshotFiles.map((file) => file.url).join(', ')}.`
    : 'No screenshot files were uploaded.';

  return {
    resumeContext: sanitizeText(resumeContext),
    resumeName: resumeFiles[0]?.filename ?? 'Uploaded Context',
    jobTitle: screenshotFiles.length > 0
      ? 'Imported role from uploaded screenshot'
      : 'Imported role from uploaded files',
    jobDescription: sanitizeText(`${resumeContext} ${screenshotContext}`),
    questionText: DEFAULT_QUESTION_TEXT,
  };
}

function mergeContexts(
  fallback: UploadSessionContext,
  inferred: Partial<UploadSessionContext>,
): UploadSessionContext {
  return {
    resumeContext: sanitizeText(inferred.resumeContext ?? fallback.resumeContext),
    resumeName: sanitizeText(inferred.resumeName ?? fallback.resumeName, 180),
    jobTitle: sanitizeText(inferred.jobTitle ?? fallback.jobTitle, 180),
    jobDescription: sanitizeText(inferred.jobDescription ?? fallback.jobDescription),
    questionText: sanitizeText(inferred.questionText ?? fallback.questionText, 500),
  };
}

async function inferContextFromFiles(files: ClassifiedFile[]): Promise<Partial<UploadSessionContext>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const userContent: ResponseInputPart[] = [
      {
        type: 'input_text',
        text: [
          'Analyze the attached files for initializing a writer workflow session.',
          'Treat resume documents and screenshots/job materials as primary evidence.',
          'Return JSON only with keys: resumeContext, resumeName, jobTitle, jobDescription, questionText.',
          'Keep outputs concise and factual. Do not include markdown fences.',
        ].join(' '),
      },
      ...files.map((file) => ({
        type: 'input_file' as const,
        filename: file.filename,
        file_url: file.url,
      })),
    ];

    const input: ResponseInputMessage[] = [
      {
        role: 'system',
        content:
          'You extract structured session context for a voice-assisted writer workflow from attached files.',
      },
      { role: 'user', content: userContent },
    ];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        input,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Context extraction failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const outputText = extractOutputText(data);
    if (!outputText) {
      return {};
    }

    return parseContextFromModelText(outputText);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = AuthAndValidationFilter.authenticate(request.headers.get('authorization'));

    const body = await request.json().catch(() => {
      throw StoryErrors.VALIDATION_ERROR('Invalid JSON payload');
    });

    const parsed = StartSessionFromUploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw StoryErrors.VALIDATION_ERROR(
        `Invalid request payload: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
      );
    }

    const classifiedFiles: ClassifiedFile[] = parsed.data.files.map((file) => ({
      ...file,
      kind: classifyFile(file.filename),
    })).filter((file): file is ClassifiedFile => file.kind !== null);

    if (classifiedFiles.length !== parsed.data.files.length) {
      throw StoryErrors.VALIDATION_ERROR('Unsupported file type. Allowed: resume documents or screenshots.');
    }

    const resumeFiles = classifiedFiles.filter((file) => file.kind === 'resume');
    const screenshotFiles = classifiedFiles.filter((file) => file.kind === 'screenshot');
    const fallbackContext = buildFallbackContext(resumeFiles, screenshotFiles);

    let inferredContext: Partial<UploadSessionContext> = {};
    try {
      inferredContext = await inferContextFromFiles(classifiedFiles);
    } catch (error) {
      console.warn(
        '[session/start-from-upload] multimodal context extraction failed, using fallback metadata context',
        error,
      );
    }

    const sessionContext = mergeContexts(fallbackContext, inferredContext);

    const initialized = await InitializeSessionService.createSession({
      resume: {
        content: sessionContext.resumeContext,
        name: sessionContext.resumeName,
        wordCount: wordCountFromText(sessionContext.resumeContext),
      },
      job: {
        title: sessionContext.jobTitle,
        description: sessionContext.jobDescription,
        sourceType: 'text',
        sourceValue: screenshotFiles[0]?.url ?? classifiedFiles[0]?.url ?? 'uploaded-files',
      },
      question: {
        text: sessionContext.questionText,
      },
      userId: auth.userId,
    });

    const questions = QuestionResolutionService.resolveQuestionsForInputMode('file_upload');
    const questionProgress = QuestionResolutionService.initializeQuestionProgress(questions);

    const responsePayload = {
      sessionId: initialized.id,
      state: initialized.state,
      inputMode: 'file_upload' as const,
      resumeId: null,
      questions,
      questionProgress,
    };

    const responseValidation = StartSessionFromUploadResponseSchema.safeParse(responsePayload);
    if (!responseValidation.success) {
      throw new Error('Failed to construct valid file-upload session response');
    }

    return NextResponse.json(responseValidation.data, { status: 200 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    if (error instanceof SessionError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Unexpected internal error' },
      { status: 500 },
    );
  }
}
