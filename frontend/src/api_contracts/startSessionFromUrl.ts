import { z } from 'zod';
import { frontendLogger } from '@/logging/index';

export const StartSessionFromUrlRequestSchema = z.object({
  sourceUrl: z.string().url(),
});

export type StartSessionFromUrlRequest = z.infer<typeof StartSessionFromUrlRequestSchema>;

export const StartSessionFromUrlResponseSchema = z.object({
  sessionId: z.string().uuid(),
  state: z.literal('initialized'),
  canonicalUrl: z.string().url(),
  contextSummary: z.string().min(1),
});

export type StartSessionFromUrlResponse = z.infer<typeof StartSessionFromUrlResponseSchema>;

export const StartSessionFromUrlErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export async function startSessionFromUrl(
  authToken: string,
  sourceUrl: string,
): Promise<StartSessionFromUrlResponse> {
  const payload = StartSessionFromUrlRequestSchema.parse({ sourceUrl });

  try {
    const response = await fetch('/api/ingestion/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const parsedError = StartSessionFromUrlErrorSchema.safeParse(errorBody);
      throw new Error(
        parsedError.success
          ? parsedError.data.message
          : `URL session initialization failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    const parsed = StartSessionFromUrlResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Invalid response from ingestion/url: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
      );
    }

    return parsed.data;
  } catch (error) {
    frontendLogger.error(
      'URL session initialization request failed',
      error instanceof Error ? error : new Error(String(error)),
      { action: 'startSessionFromUrl', module: 'api_contracts' },
    );
    throw error;
  }
}
