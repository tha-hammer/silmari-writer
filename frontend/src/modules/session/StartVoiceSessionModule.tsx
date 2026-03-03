/**
 * StartVoiceSessionModule - Frontend module for initiating a voice-assisted
 * answer session. Wraps in RequireAuth and calls URL-ingestion API contract.
 *
 * Resource: ui-v3n6 (module)
 * Path: 306-initiate-voice-assisted-answer-session
 *
 * Flow:
 *   1. RequireAuth ensures user is authenticated (redirects to /login if not)
 *   2. User submits a job URL
 *   3. Calls startSessionFromUrl() API contract
 *   4. On success → navigates to /session/[id] with initialized state
 *   5. On failure → displays error message
 */

'use client';

import { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, Loader2, Mic, TriangleAlert } from 'lucide-react';
import { RequireAuth, type AuthUser } from '@/access_controls/RequireAuth';
import { startSessionFromUrl } from '@/api_contracts/startSessionFromUrl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { frontendLogger } from '@/logging/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceSessionState = 'idle' | 'loading' | 'success' | 'error';

export interface VoiceSessionContext {
  sessionId: string | null;
  state: 'initialized' | null;
}

export interface StartVoiceSessionModuleProps {
  user: AuthUser | null;
  authToken: string | null;
  // eslint-disable-next-line no-unused-vars
  onNavigate(path: string): void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SessionContext = createContext<VoiceSessionContext>({
  sessionId: null,
  state: null,
});

export function useVoiceSession(): VoiceSessionContext {
  return useContext(SessionContext);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StartVoiceSessionModule({
  user,
  authToken,
  onNavigate,
}: StartVoiceSessionModuleProps) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [uiState, setUIState] = useState<VoiceSessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionContext, setSessionContext] = useState<VoiceSessionContext>({
    sessionId: null,
    state: null,
  });

  const handleUnauthenticated = useCallback(() => {
    onNavigate('/login');
  }, [onNavigate]);

  const handleStartSession = async () => {
    if (!authToken) {
      onNavigate('/login');
      return;
    }

    const trimmedUrl = sourceUrl.trim();
    if (trimmedUrl.length === 0) {
      setError('Paste a job URL to continue.');
      setUIState('error');
      return;
    }

    setUIState('loading');
    setError(null);

    try {
      const result = await startSessionFromUrl(authToken, trimmedUrl);

      const newContext: VoiceSessionContext = {
        sessionId: result.sessionId,
        state: result.state,
      };

      setSessionContext(newContext);
      setUIState('success');
      onNavigate(`/session/${result.sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      frontendLogger.error(
        'VOICE_SESSION_START_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { module: 'StartVoiceSessionModule', action: 'handleStartSession' },
      );
      setError(message);
      setUIState('error');
    }
  };

  return (
    <RequireAuth user={user} onUnauthenticated={handleUnauthenticated}>
      <SessionContext.Provider value={sessionContext}>
        <Card data-testid="start-voice-session-module" className="border-border/70 bg-card/80">
          <CardContent className="space-y-4 p-5">
            <CardDescription className="flex items-center gap-2 text-sm">
              <Mic className="h-4 w-4 text-primary" />
              Paste a job URL to initialize session context before continuing the voice workflow.
            </CardDescription>

            <div className="space-y-2">
              <label htmlFor="source-url" className="text-sm font-medium">
                Job Posting URL
              </label>
              <input
                id="source-url"
                type="url"
                inputMode="url"
                placeholder="https://example.greenhouse.io/job/123"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Same ingestion pipeline used for URL paste and channel ingestion (email/SMS).
              </p>
            </div>

            <Button
              onClick={handleStartSession}
              aria-label="Start Voice-Assisted Session"
              className="w-full sm:w-auto"
              disabled={uiState === 'loading'}
            >
              Start Voice-Assisted Session
            </Button>

            {uiState === 'loading' && (
              <div data-testid="loading-indicator" className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Initializing from URL...</span>
              </div>
            )}

            {uiState === 'success' && (
              <div data-testid="session-init" className="inline-flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <Badge variant="outline" className="border-green-600/30 bg-green-500/10 text-green-700">
                  Session initialized: {sessionContext.state}
                </Badge>
              </div>
            )}

            {uiState === 'error' && (
              <div
                data-testid="session-error"
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error || 'An unexpected error occurred'}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </SessionContext.Provider>
    </RequireAuth>
  );
}
