import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortlistModule from '../ShortlistModule';

describe('ShortlistModule', () => {
  it('generates shortlist and persists user edits', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockResolvedValue([
      { companyId: 'c1', companyName: 'Stripe', rank: 1 },
      { companyId: 'c2', companyName: 'Figma', rank: 2 },
      { companyId: 'c3', companyName: 'Notion', rank: 3 },
    ]);
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<ShortlistModule onGenerate={onGenerate} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /generate shortlist/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);

    const secondItem = screen.getByTestId('shortlist-item-2');
    await user.click(within(secondItem).getByRole('button', { name: /move figma up/i }));

    await user.click(screen.getByRole('button', { name: /save shortlist/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ companyId: 'c2', companyName: 'Figma', rank: 1 }),
      expect.objectContaining({ companyId: 'c1', companyName: 'Stripe', rank: 2 }),
      expect.objectContaining({ companyId: 'c3', companyName: 'Notion', rank: 3 }),
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Shortlist saved');
  });

  it('allows manual company add before save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<ShortlistModule onSave={onSave} />);

    await user.type(screen.getByLabelText(/manual company/i), 'Datadog');
    await user.click(screen.getByRole('button', { name: /add company/i }));
    await user.click(screen.getByRole('button', { name: /save shortlist/i }));

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ companyName: 'Datadog', rank: 1 }),
    ]);
  });
});
