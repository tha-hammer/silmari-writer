import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LinkedinInputStep from '../LinkedinInputStep';

describe('LinkedinInputStep', () => {
  it('offers manual and oauth fallback after url parse failure', async () => {
    const user = userEvent.setup();
    const onUrlSubmit = vi.fn().mockResolvedValue({
      ok: false,
      message: 'Unable to parse profile',
      fallbackOptions: ['manual', 'oauth', 'skip'],
    });

    render(<LinkedinInputStep onUrlSubmit={onUrlSubmit} />);

    await user.type(screen.getByLabelText(/linkedin url/i), 'https://www.linkedin.com/in/example');
    await user.click(screen.getByRole('button', { name: /parse linkedin url/i }));

    expect(screen.getByText(/url parsing failed/i)).toBeInTheDocument();
    expect(screen.getByText(/manual profile entry/i)).toBeInTheDocument();
    expect(screen.getByText(/linkedin oauth connect/i)).toBeInTheDocument();
    expect(screen.getByText(/skip and continue onboarding/i)).toBeInTheDocument();
  });

  it('allows skipping LinkedIn and reports success', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn().mockResolvedValue(undefined);

    render(<LinkedinInputStep onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/linkedin step skipped/i)).toBeInTheDocument();
  });
});
