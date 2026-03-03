import { describe, expect, it } from 'vitest';
import { ShortlistRequestSchema, ShortlistResponseSchema } from '../shortlistContracts';
import { ContributionRequestSchema, ContributionResponseSchema } from '../contributionContracts';
import { ContactsRequestSchema, ContactsResponseSchema } from '../contactsContracts';
import { OutreachRequestSchema, OutreachResponseSchema } from '../outreachContracts';

describe('acceleration contracts', () => {
  it('validates shortlist generate/save contracts', () => {
    expect(
      ShortlistRequestSchema.safeParse({ action: 'generate', baselineId: crypto.randomUUID() }).success,
    ).toBe(true);

    expect(
      ShortlistRequestSchema.safeParse({
        action: 'save',
        shortlistId: crypto.randomUUID(),
        items: [{ companyId: 'c1', companyName: 'Acme', rank: 1 }],
      }).success,
    ).toBe(true);

    expect(
      ShortlistResponseSchema.safeParse({
        shortlistId: crypto.randomUUID(),
        items: [{ companyId: 'c1', companyName: 'Acme', rank: 1 }],
        generated: false,
        saved: true,
        degraded: false,
        reason: null,
        manualEntryRequired: false,
      }).success,
    ).toBe(true);
  });

  it('validates contribution and contacts contracts', () => {
    const request = {
      shortlistId: crypto.randomUUID(),
      companyId: 'company-1',
    };

    expect(ContributionRequestSchema.safeParse(request).success).toBe(true);
    expect(ContactsRequestSchema.safeParse(request).success).toBe(true);

    expect(
      ContributionResponseSchema.safeParse({
        companyId: 'company-1',
        contributionAreas: [
          {
            id: crypto.randomUUID(),
            userId: 'user-1',
            companyId: 'company-1',
            label: 'Reliability',
            rationale: 'Customer trust impact',
            createdAt: new Date().toISOString(),
          },
        ],
        degraded: false,
        reason: null,
      }).success,
    ).toBe(true);

    expect(
      ContactsResponseSchema.safeParse({
        companyId: 'company-1',
        contacts: [
          {
            id: crypto.randomUUID(),
            userId: 'user-1',
            companyId: 'company-1',
            contactExternalId: 'contact-1',
            name: 'Taylor',
            title: 'Manager',
            reason: 'Hiring manager',
            createdAt: new Date().toISOString(),
          },
        ],
        degraded: false,
        reason: null,
      }).success,
    ).toBe(true);
  });

  it('validates outreach contract', () => {
    expect(
      OutreachRequestSchema.safeParse({
        shortlistId: crypto.randomUUID(),
        companyId: 'company-1',
        contactId: crypto.randomUUID(),
      }).success,
    ).toBe(true);

    expect(
      OutreachResponseSchema.safeParse({
        companyId: 'company-1',
        draft: {
          id: crypto.randomUUID(),
          content: 'Hello',
          status: 'completed',
        },
        degraded: false,
        reason: null,
      }).success,
    ).toBe(true);
  });
});
