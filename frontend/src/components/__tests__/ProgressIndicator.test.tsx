import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressIndicator from '../ProgressIndicator';

describe('ProgressIndicator', () => {
  it('renders helper copy and counts for anchors/actions/outcomes', () => {
    render(
      <ProgressIndicator
        progress={{
          anchors: 2,
          actions: 3,
          outcomes: 1,
          incompleteSlots: [],
        }}
      />,
    );

    expect(screen.getByTestId('progress-anchors')).toHaveTextContent('2');
    expect(screen.getByTestId('progress-actions')).toHaveTextContent('3');
    expect(screen.getByTestId('progress-outcomes')).toHaveTextContent('1');

    expect(screen.getByTestId('progress-anchors-help')).toHaveTextContent('Context, scope');
    expect(screen.getByTestId('progress-actions-help')).toHaveTextContent('What you did');
    expect(screen.getByTestId('progress-outcomes-help')).toHaveTextContent('Impact, results');
  });

  it('shows incomplete hint when slots are missing', () => {
    render(
      <ProgressIndicator
        progress={{
          anchors: 1,
          actions: 0,
          outcomes: 0,
          incompleteSlots: ['actions', 'outcomes'],
        }}
      />,
    );

    expect(screen.getByTestId('progress-incomplete-hint')).toHaveTextContent('actions, outcomes');
  });
});
