import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionErrors } from '@/server/error_definitions/SessionErrors';

vi.mock('@/server/request_handlers/GetSessionHandler', () => ({
  GetSessionHandler: {
    handle: vi.fn(),
  },
}));

import { GetSessionHandler } from '@/server/request_handlers/GetSessionHandler';
import { GET } from '../route';

const mockHandle = vi.mocked(GetSessionHandler.handle);

describe('GET /api/sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized session payload for valid id', async () => {
    mockHandle.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'INIT',
      source: 'answer_session',
      createdAt: '2026-03-02T10:00:00.000Z',
      updatedAt: '2026-03-02T10:00:00.000Z',
    });

    const response = await GET(
      new Request('http://localhost/api/sessions/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(data.state).toBe('INIT');
  });

  it('returns 200 when handler returns legacy null updatedAt', async () => {
    mockHandle.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'ACTIVE',
      source: 'session',
      createdAt: '2026-03-02T10:00:00.000Z',
      updatedAt: null,
    });

    const response = await GET(
      new Request('http://localhost/api/sessions/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updatedAt).toBeNull();
  });

  it('returns 400 when id is not a UUID', async () => {
    const response = await GET(
      new Request('http://localhost/api/sessions/not-a-uuid'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('INVALID_REQUEST');
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('returns mapped SessionError status and code', async () => {
    mockHandle.mockRejectedValue(SessionErrors.NotFound('Session does not exist'));

    const response = await GET(
      new Request('http://localhost/api/sessions/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('SESSION_NOT_FOUND');
  });

  it('returns 500 on unexpected errors', async () => {
    mockHandle.mockRejectedValue(new Error('database offline'));

    const response = await GET(
      new Request('http://localhost/api/sessions/550e8400-e29b-41d4-a716-446655440000'),
      { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('INTERNAL_ERROR');
  });
});
