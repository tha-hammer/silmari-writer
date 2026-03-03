import { describe, expect, it } from 'vitest';
import { SessionViewSchema } from '@/server/data_structures/SessionView';

describe('SessionViewSchema', () => {
  it('accepts legacy null updatedAt values', () => {
    const parsed = SessionViewSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      state: 'ACTIVE',
      source: 'session',
      createdAt: '2026-03-02T10:00:00.000Z',
      updatedAt: null,
    });

    expect(parsed.success).toBe(true);
  });
});
