import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LinkedinPlanningModule from '../LinkedinPlanningModule';

describe('LinkedinPlanningModule', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it('renders manual-post-only safeguard and no publish controls', async () => {
    const user = userEvent.setup();
    const onGenerateDraft = vi.fn().mockResolvedValue({
      id: crypto.randomUUID(),
      content: 'Draft content for LinkedIn',
      status: 'completed' as const,
      manualPostOnly: true as const,
    });

    render(<LinkedinPlanningModule onGenerateDraft={onGenerateDraft} />);

    expect(screen.getByTestId('manual-post-guard')).toHaveTextContent(/manual-post-only/i);
    expect(screen.queryByRole('button', { name: /publish|post now/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /generate linkedin draft/i }));

    expect(screen.getByTestId('linkedin-draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish|post/i })).not.toBeInTheDocument();
  });
});
