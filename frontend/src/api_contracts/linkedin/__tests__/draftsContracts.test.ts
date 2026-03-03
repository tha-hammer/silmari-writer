import { describe, expect, it } from 'vitest';
import {
  LinkedinDraftRequestSchema,
  LinkedinDraftResponseSchema,
} from '../draftsContracts';

describe('linkedin draft contracts', () => {
  it('validates request schema', () => {
    const parsed = LinkedinDraftRequestSchema.safeParse({
      shortlistId: crypto.randomUUID(),
      companyId: 'company-1',
      contributionAreaId: crypto.randomUUID(),
    });

    expect(parsed.success).toBe(true);
  });

  it('validates response schema with manual-post safeguard', () => {
    const parsed = LinkedinDraftResponseSchema.safeParse({
      companyId: 'company-1',
      draft: {
        id: crypto.randomUUID(),
        content: 'LinkedIn draft',
        status: 'completed',
        manualPostOnly: true,
      },
      manualPostReminder: 'Manual post only. Copy and publish from your own LinkedIn account.',
      degraded: false,
      reason: null,
    });

    expect(parsed.success).toBe(true);
  });
});
