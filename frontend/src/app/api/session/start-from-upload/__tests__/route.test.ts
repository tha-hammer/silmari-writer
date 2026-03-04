import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionErrors } from '@/server/error_definitions/SessionErrors';

vi.mock('@/server/services/InitializeSessionService', () => ({
  InitializeSessionService: {
    createSession: vi.fn(),
  },
}));

import { InitializeSessionService } from '@/server/services/InitializeSessionService';
import { POST } from '../route';

const mockCreateSession = vi.mocked(InitializeSessionService.createSession);
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeRequest(body: unknown, authToken?: string): Request {
  return new Request('http://localhost/api/session/start-from-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/session/start-from-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          resumeContext: 'Senior backend engineer with distributed systems experience.',
          resumeName: 'MaceoJourdan_Resume.pdf',
          jobTitle: 'Senior Platform Engineer',
          jobDescription: 'Role focuses on API reliability, observability, and platform ownership.',
          questionText: 'Describe a system you stabilized under production pressure.',
        }),
      }),
    });
  });

  it('returns initialized session payload for valid uploaded files', async () => {
    mockCreateSession.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      resume: {
        content: 'Resume context',
        name: 'Resume',
        wordCount: 2,
      },
      job: {
        title: 'Imported role',
        description: 'Job context',
        sourceType: 'text',
        sourceValue: 'uploaded-files',
      },
      question: {
        text: 'Question',
      },
      state: 'initialized',
      createdAt: '2026-03-03T00:00:00.000Z',
    });

    const response = await POST(
      makeRequest(
        {
          files: [
            {
              filename: 'resume.pdf',
              url: 'https://blob.example/resume.pdf',
              mimeType: 'application/pdf',
            },
          ],
        },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      state: 'initialized',
      inputMode: 'file_upload',
    });
    expect(data.questions.length).toBeGreaterThan(0);
    expect(data.questionProgress.total).toBe(data.questions.length);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    );

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);
    const userMessage = body.input[1];
    expect(userMessage.content).toContainEqual(
      expect.objectContaining({
        type: 'input_file',
        filename: 'resume.pdf',
        file_url: 'https://blob.example/resume.pdf',
      }),
    );

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        resume: expect.objectContaining({
          content: 'Senior backend engineer with distributed systems experience.',
          name: 'MaceoJourdan_Resume.pdf',
        }),
        job: expect.objectContaining({
          title: 'Senior Platform Engineer',
        }),
        question: expect.objectContaining({
          text: 'Describe a system you stabilized under production pressure.',
        }),
      }),
    );
  });

  it('returns 401 when authorization header is missing', async () => {
    const response = await POST(
      makeRequest({
        files: [
          {
            filename: 'resume.pdf',
            url: 'https://blob.example/resume.pdf',
            mimeType: 'application/pdf',
          },
        ],
      }) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for unsupported file type', async () => {
    const response = await POST(
      makeRequest(
        {
          files: [
            {
              filename: 'archive.zip',
              url: 'https://blob.example/archive.zip',
              mimeType: 'application/zip',
            },
          ],
        },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 409 for active-session conflict', async () => {
    mockCreateSession.mockRejectedValue(SessionErrors.SessionAlreadyActive());

    const response = await POST(
      makeRequest(
        {
          files: [
            {
              filename: 'resume.pdf',
              url: 'https://blob.example/resume.pdf',
              mimeType: 'application/pdf',
            },
          ],
        },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data.code).toBe('SESSION_ALREADY_ACTIVE');
  });

  it('falls back to metadata context when multimodal extraction fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('OpenAI unavailable'));
    mockCreateSession.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      resume: {
        content: 'Resume context',
        name: 'Resume',
        wordCount: 2,
      },
      job: {
        title: 'Imported role',
        description: 'Job context',
        sourceType: 'text',
        sourceValue: 'uploaded-files',
      },
      question: {
        text: 'Question',
      },
      state: 'initialized',
      createdAt: '2026-03-03T00:00:00.000Z',
    });

    const response = await POST(
      makeRequest(
        {
          files: [
            {
              filename: 'resume.pdf',
              url: 'https://blob.example/resume.pdf',
              mimeType: 'application/pdf',
            },
            {
              filename: 'job-shot.png',
              url: 'https://blob.example/job-shot.png',
              mimeType: 'image/png',
            },
          ],
        },
        'valid-token',
      ) as any,
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.inputMode).toBe('file_upload');

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        resume: expect.objectContaining({
          content: expect.stringContaining('Uploaded resume files: resume.pdf.'),
        }),
        job: expect.objectContaining({
          description: expect.stringContaining('Uploaded screenshot files: https://blob.example/job-shot.png.'),
        }),
      }),
    );

    warnSpy.mockRestore();
  });
});
