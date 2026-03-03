import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrimaryEntryWorkflowModule from '../PrimaryEntryWorkflowModule';

describe('PrimaryEntryWorkflowModule integration flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => (key === 'authToken' ? 'token-123' : null),
      },
    });
  });

  it('walks through resume -> linkedin -> acceleration -> planning -> continue', async () => {
    const onCompleted = vi.fn();
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/onboarding/linkedin/parse') {
        return new Response(
          JSON.stringify({
            baselineId: '550e8400-e29b-41d4-a716-446655440100',
            mode: 'url',
            profile: { headline: null, summary: null, positions: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === '/api/acceleration/shortlist') {
        return new Response(
          JSON.stringify({
            shortlistId: '550e8400-e29b-41d4-a716-446655440101',
            items: [{ companyId: 'company-1', companyName: 'Acme', rank: 1 }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === '/api/acceleration/contribution') {
        return new Response(
          JSON.stringify({
            contributionAreas: [
              {
                id: '550e8400-e29b-41d4-a716-446655440102',
                label: 'Platform reliability',
                rationale: 'Strong incident response experience',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === '/api/acceleration/contacts') {
        return new Response(
          JSON.stringify({
            contacts: [
              {
                id: '550e8400-e29b-41d4-a716-446655440103',
                name: 'Pat Hiring Manager',
                title: 'Director of Engineering',
                reason: 'Likely decision maker',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === '/api/acceleration/outreach') {
        return new Response(
          JSON.stringify({
            draft: {
              id: '550e8400-e29b-41d4-a716-446655440104',
              content: 'Outreach draft content',
              status: 'completed',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === '/api/linkedin/drafts') {
        return new Response(
          JSON.stringify({
            draft: {
              id: '550e8400-e29b-41d4-a716-446655440105',
              content: 'LinkedIn draft content',
              status: 'completed',
              manualPostOnly: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ message: 'Unexpected request' }), { status: 500 });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <PrimaryEntryWorkflowModule
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        onCompleted={onCompleted}
      />,
    );

    await user.type(screen.getByLabelText(/resume content/i), 'Resume body text');
    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    await user.type(screen.getByLabelText(/linkedin url/i), 'https://www.linkedin.com/in/test-user');
    await user.click(screen.getByRole('button', { name: /parse linkedin url/i }));
    await user.click(screen.getByRole('button', { name: /continue to acceleration/i }));

    await user.click(screen.getByRole('button', { name: /generate shortlist/i }));
    await waitFor(() => {
      expect(screen.getByTestId('shortlist-selected-company')).toHaveTextContent('company-1');
    });

    await user.click(screen.getByRole('button', { name: /load contribution areas/i }));
    await user.click(screen.getByRole('button', { name: /load contacts/i }));
    await user.click(screen.getByRole('button', { name: /generate outreach draft/i }));
    await user.click(screen.getByRole('button', { name: /continue to linkedin planning/i }));

    await user.click(screen.getByRole('button', { name: /generate linkedin draft/i }));
    await user.click(screen.getByRole('button', { name: /continue to interview/i }));

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalled();

    const firstCallHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(firstCallHeaders?.Authorization).toBe('Bearer token-123');
  });
});
