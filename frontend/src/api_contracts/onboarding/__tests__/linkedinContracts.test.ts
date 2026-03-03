import { describe, expect, it } from 'vitest';
import {
  LinkedinConnectCallbackRequestSchema,
  LinkedinConnectCallbackResponseSchema,
  LinkedinConnectStartRequestSchema,
  LinkedinParseRequestSchema,
  LinkedinParseResponseSchema,
} from '../linkedinContracts';

describe('linkedinContracts', () => {
  it('validates url parse payload and response schema', () => {
    const req = LinkedinParseRequestSchema.safeParse({
      mode: 'url',
      url: 'https://www.linkedin.com/in/example/',
    });

    expect(req.success).toBe(true);

    const res = LinkedinParseResponseSchema.safeParse({
      baselineId: crypto.randomUUID(),
      mode: 'url',
      profile: {
        headline: 'example profile',
        summary: 'Imported from LinkedIn URL',
        positions: [],
        sourceUrl: 'https://www.linkedin.com/in/example/',
      },
    });

    expect(res.success).toBe(true);
  });

  it('requires redirectUri for connect start', () => {
    const parsed = LinkedinConnectStartRequestSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('validates callback request/response shape', () => {
    const request = LinkedinConnectCallbackRequestSchema.safeParse({
      state: 'abc',
      nonce: 'def',
      code: 'ghi',
    });
    expect(request.success).toBe(true);

    const response = LinkedinConnectCallbackResponseSchema.safeParse({
      connectionStatus: 'connected',
      linkedinUserId: 'linkedin-123',
      tokenStored: true,
    });
    expect(response.success).toBe(true);
  });
});
