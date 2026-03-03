import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccelerationModule from '../AccelerationModule';

describe('AccelerationModule', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it('returns contribution areas and contact suggestions scoped to selected company', async () => {
    const user = userEvent.setup();
    const onLoadContributionAreas = vi.fn().mockResolvedValue([
      {
        id: crypto.randomUUID(),
        label: 'Reliability',
        rationale: 'Improve system resilience',
      },
    ]);
    const onLoadContacts = vi.fn().mockResolvedValue([
      {
        id: crypto.randomUUID(),
        name: 'Taylor Morgan',
        title: 'Engineering Manager',
        reason: 'Likely hiring manager',
      },
    ]);
    const onGenerateOutreach = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      content: 'Hi Taylor, I would love to connect.',
      status: 'completed' as const,
    });

    render(
      <AccelerationModule
        companyId="company-1"
        onLoadContributionAreas={onLoadContributionAreas}
        onLoadContacts={onLoadContacts}
        onGenerateOutreach={onGenerateOutreach}
      />,
    );

    await user.click(screen.getByRole('button', { name: /load contribution areas/i }));
    await user.click(screen.getByRole('button', { name: /load contacts/i }));
    await user.click(screen.getByRole('button', { name: /generate outreach draft/i }));

    expect(onLoadContributionAreas).toHaveBeenCalledWith('company-1');
    expect(onLoadContacts).toHaveBeenCalledWith('company-1');
    expect(onGenerateOutreach).toHaveBeenCalledWith('company-1', expect.any(String));

    expect(screen.getByTestId('contribution-list')).toHaveTextContent('Reliability');
    expect(screen.getByTestId('contacts-list')).toHaveTextContent('Taylor Morgan');
    expect(screen.getByTestId('outreach-draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });
});
