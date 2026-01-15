import { z } from 'zod'

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  const result = envSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!result.success) {
    // Zod v4 uses issues array
    const issues = result.error.issues || []
    const errors = issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(`Environment validation failed:\n${errors}`)
  }

  return result.data
}

// Export validated env for use throughout the app
// This will throw on import if env is invalid
let _env: Env | undefined

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv()
  }
  return _env
}

// For server-side usage, validate on first access
export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env]
  },
})
