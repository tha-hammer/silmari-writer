import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionError } from '@/server/error_definitions/SessionErrors';

vi.mock('@/server/data_access_objects/InitializeSessionDAO', () => ({
  InitializeSessionDAO: {
    getActiveSession: vi.fn(),
    persist: vi.fn(),
    supersedeInitializedSession: vi.fn(),
  },
}));

import { InitializeSessionDAO } from '@/server/data_access_objects/InitializeSessionDAO';
import { InitializeSessionService } from '@/server/services/InitializeSessionService';

const mockDAO = vi.mocked(InitializeSessionDAO);

describe('InitializeSessionService stale-session handling', () => {
  const validInput: Parameters<typeof InitializeSessionService.createSession>[0] = {
    resume: {
      content: 'Resume content',
      name: 'Resume',
      wordCount: 2,
    },
    job: {
      title: 'Engineer',
      description: 'Build systems',
      sourceType: 'text' as const,
      sourceValue: 'Build systems',
    },
    question: {
      text: 'Tell me about a project.',
    },
    userId: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supersedes stale initialized session and then persists a new one', async () => {
    mockDAO.getActiveSession.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      resume: validInput.resume,
      job: validInput.job,
      question: validInput.question,
      state: 'initialized',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    mockDAO.supersedeInitializedSession.mockResolvedValue(undefined);
    mockDAO.persist.mockResolvedValue({
      id: '660e8400-e29b-41d4-a716-446655440000',
      resume: validInput.resume,
      job: validInput.job,
      question: validInput.question,
      state: 'initialized',
      createdAt: '2026-03-03T00:00:00.000Z',
    });

    await InitializeSessionService.createSession(validInput);

    expect(mockDAO.supersedeInitializedSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(mockDAO.persist).toHaveBeenCalledTimes(1);
  });

  it('supersedes fresh initialized session instead of blocking', async () => {
    mockDAO.getActiveSession.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      resume: validInput.resume,
      job: validInput.job,
      question: validInput.question,
      state: 'initialized',
      createdAt: new Date().toISOString(),
    });
    mockDAO.supersedeInitializedSession.mockResolvedValue(undefined);
    mockDAO.persist.mockResolvedValue({
      id: '660e8400-e29b-41d4-a716-446655440000',
      resume: validInput.resume,
      job: validInput.job,
      question: validInput.question,
      state: 'initialized',
      createdAt: new Date().toISOString(),
    });

    await InitializeSessionService.createSession(validInput);

    expect(mockDAO.supersedeInitializedSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(mockDAO.persist).toHaveBeenCalledTimes(1);
  });

  it('propagates supersede failure and does not persist a new session', async () => {
    mockDAO.getActiveSession.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      resume: validInput.resume,
      job: validInput.job,
      question: validInput.question,
      state: 'initialized',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    mockDAO.supersedeInitializedSession.mockRejectedValue(
      new SessionError('write failed', 'PERSISTENCE_FAILURE', 500, true),
    );

    await expect(
      InitializeSessionService.createSession(validInput),
    ).rejects.toMatchObject({
      code: 'PERSISTENCE_FAILURE',
    });

    expect(mockDAO.persist).not.toHaveBeenCalled();
  });
});
