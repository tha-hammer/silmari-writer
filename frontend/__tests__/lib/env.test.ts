import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '@/lib/env'

describe('validateEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv } as NodeJS.ProcessEnv
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should throw error when OPENAI_API_KEY is missing', () => {
    const env = process.env as Record<string, string | undefined>
    delete env.OPENAI_API_KEY

    expect(() => validateEnv()).toThrow('OPENAI_API_KEY')
  })

  it('should throw error when OPENAI_API_KEY is empty', () => {
    process.env.OPENAI_API_KEY = ''

    expect(() => validateEnv()).toThrow('OPENAI_API_KEY')
  })

  it('should return valid env object when OPENAI_API_KEY is provided', () => {
    const env = process.env as Record<string, string | undefined>
    env.OPENAI_API_KEY = 'sk-test-key-123'
    env.NODE_ENV = 'development'

    const result = validateEnv()

    expect(result.OPENAI_API_KEY).toBe('sk-test-key-123')
    expect(result.NODE_ENV).toBe('development')
  })

  it('should accept valid NODE_ENV values', () => {
    const env = process.env as Record<string, string | undefined>
    env.OPENAI_API_KEY = 'sk-test-key-123'
    env.NODE_ENV = 'production'

    const result = validateEnv()

    expect(result.NODE_ENV).toBe('production')
  })

  it('should default NODE_ENV to development when not set', () => {
    const env = process.env as Record<string, string | undefined>
    env.OPENAI_API_KEY = 'sk-test-key-123'
    delete env.NODE_ENV

    const result = validateEnv()

    expect(result.NODE_ENV).toBe('development')
  })
})

describe('getEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return cached env on subsequent calls', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-123'

    // Need to re-import to clear the module cache
    const { getEnv: freshGetEnv } = await import('@/lib/env')

    const first = freshGetEnv()
    const second = freshGetEnv()

    expect(first).toBe(second)
  })
})
