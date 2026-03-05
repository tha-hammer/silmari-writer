/**
 * RecallModule Integration Test - Terminal Condition
 *
 * Path: 303-display-recall-state-with-record-button-and-progress-indicator
 *
 * Exercises the full path: Trigger → Step1→2→3→4→5
 *
 * Proves:
 * - Reachability: Full path from module init → rendered RECALL UI
 * - TypeInvariant: All TS contracts satisfied end-to-end
 * - ErrorConsistency: Each failure branch produces defined UI error state and logs via cfg-r3d7
 */

import { render, screen, waitFor } from '@testing-library/react';
import { useRecallModule, RecallModuleProvider } from '../RecallModule';
import { validateRecallAccess } from '@/access_controls/RecallAccessControl';
import { RecallLayout } from '@/components/RecallLayout';
import { loadRecallProgress, NEUTRAL_PROGRESS } from '@/data_loaders/RecallProgressLoader';
import { frontendLogger } from '@/logging/index';
import type { RecallProgress } from '@/data_loaders/RecallProgressLoader';

vi.mock('@/logging/index', () => ({
  frontendLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockLogger = vi.mocked(frontendLogger);
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Integration component exercising the full path
// ---------------------------------------------------------------------------

function RecallIntegration({
  initialState,
  user,
}: {
  initialState: string;
  user: { id: string; role: string; permissions: string[] };
}) {
  return (
    <RecallModuleProvider initialState={initialState}>
      <RecallIntegrationInner user={user} />
    </RecallModuleProvider>
  );
}

function RecallIntegrationInner({
  user,
}: {
  user: { id: string; role: string; permissions: string[] };
}) {
  // Step 1: State is provided by RecallModuleProvider
  // Step 2: Validate access
  const { state } = useRecallState();
  const accessResult = validateRecallAccess({ state, user });

  if (!accessResult.authorized) {
    return (
      <div data-testid="access-denied">
        Access denied. Redirecting to {accessResult.redirect}
      </div>
    );
  }

  // Step 3-5: Render layout (progress is passed directly in this test)
  return <RecallLayoutWithLoader />;
}

function RecallLayoutWithLoader() {
  const [progress, setProgress] = React.useState<RecallProgress>(NEUTRAL_PROGRESS);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    loadRecallProgress('integration-session', 'session').then((data) => {
      setProgress(data);
      setLoaded(true);
    });
  }, []);

  return (
    <div data-testid="recall-interface">
      <RecallLayout progress={progress} />
      {loaded && <span data-testid="progress-loaded" />}
    </div>
  );
}

// Need to import React and the context hook
import React from 'react';
import { useRecallState } from '../RecallModule';

// ---------------------------------------------------------------------------
// Full Path Integration Tests
// ---------------------------------------------------------------------------

const authorizedUser = {
  id: 'user-int-001',
  role: 'participant',
  permissions: ['view:recall'],
};

const unauthorizedUser = {
  id: 'user-int-002',
  role: 'viewer',
  permissions: [],
};

describe('RecallModule Integration - Terminal Condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Happy Path: RECALL state → authorized → UI rendered with progress', () => {
    it('should render complete RECALL interface with progress data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ anchors: 7, actions: 12, outcomes: 4 }),
      });

      render(
        <RecallIntegration
          initialState="RECALL"
          user={authorizedUser}
        />,
      );

      // Step 1: State resolved to RECALL (no error logged)
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'UI_STATE_NOT_FOUND',
        expect.anything(),
        expect.anything(),
      );

      // Step 2: Access authorized (no deny rendered)
      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();

      // Step 3: Record button visible
      expect(screen.getByTestId('record-button')).toBeInTheDocument();

      // Step 3: Progress indicator visible
      expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();

      // Step 5: Record button is enabled
      expect(screen.getByTestId('record-button')).not.toBeDisabled();

      // Step 4: Wait for progress to load and display
      await waitFor(() => {
        expect(screen.getByTestId('progress-loaded')).toBeInTheDocument();
      });

      // Anchors/Actions/Outcomes displayed
      expect(screen.getByTestId('progress-anchors')).toHaveTextContent('7');
      expect(screen.getByTestId('progress-actions')).toHaveTextContent('12');
      expect(screen.getByTestId('progress-outcomes')).toHaveTextContent('4');
    });
  });

  describe('Error Path: State not found → SAFE_DEFAULT → access denied', () => {
    it('should fallback to SAFE_DEFAULT and deny access when state is undefined', () => {
      render(
        <RecallIntegration
          initialState={undefined as unknown as string}
          user={authorizedUser}
        />,
      );

      // Step 1: Fallback triggered
      expect(mockLogger.error).toHaveBeenCalledWith(
        'UI_STATE_NOT_FOUND',
        expect.anything(),
        expect.objectContaining({ module: 'RecallModule' }),
      );

      // Step 2: Access denied because state is SAFE_DEFAULT, not RECALL
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    });
  });

  describe('Error Path: User unauthorized → access denied', () => {
    it('should deny access for unauthorized user even with RECALL state', () => {
      render(
        <RecallIntegration
          initialState="RECALL"
          user={unauthorizedUser}
        />,
      );

      // Step 2: Access denied
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'UI_RECALL_ACCESS_DENIED',
        expect.anything(),
        expect.objectContaining({ module: 'RecallAccessControl' }),
      );
    });
  });

  describe('Error Path: Progress load failure → neutral state displayed', () => {
    it('should display neutral progress when data load fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API down'));

      render(
        <RecallIntegration
          initialState="RECALL"
          user={authorizedUser}
        />,
      );

      // Wait for progress load to complete (with error)
      await waitFor(() => {
        expect(screen.getByTestId('progress-loaded')).toBeInTheDocument();
      });

      // Neutral progress displayed
      expect(screen.getByTestId('progress-anchors')).toHaveTextContent('0');
      expect(screen.getByTestId('progress-actions')).toHaveTextContent('0');
      expect(screen.getByTestId('progress-outcomes')).toHaveTextContent('0');

      // Error logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'UI_PROGRESS_LOAD_FAILED',
        expect.anything(),
        expect.objectContaining({ module: 'RecallProgressLoader' }),
      );
    });
  });
});
