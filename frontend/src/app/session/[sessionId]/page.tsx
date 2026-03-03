'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Workflow } from 'lucide-react';
import { getSession } from '@/api_contracts/getSession';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SessionWorkflowShell } from '@/modules/session/SessionWorkflowShell';
import type { SessionView } from '@/server/data_structures/SessionView';

interface SessionRouteParams {
  sessionId: string;
}

export interface SessionPageProps {
  params: Promise<SessionRouteParams>;
}

export default function SessionPage({ params }: SessionPageProps) {
  const paramsInput = params as Promise<SessionRouteParams> | SessionRouteParams;
  const resolvedParams =
    typeof (paramsInput as Promise<SessionRouteParams>)?.then === 'function'
      ? use(paramsInput as Promise<SessionRouteParams>)
      : (paramsInput as SessionRouteParams);
  const sessionId = resolvedParams?.sessionId;

  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    if (!sessionId || sessionId.trim() === '') {
      return;
    }

    try {
      const nextSession = await getSession(sessionId);
      setSession(nextSession);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to refresh session.';
      setError(message);
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    if (!sessionId || sessionId.trim() === '') {
      setSession(null);
      setError('Session ID must be a valid UUID');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getSession(sessionId);
        if (!cancelled) {
          setSession(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load session.';
          setError(message);
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <main data-testid="session-page-loading" className="mx-auto w-full max-w-5xl p-6 md:p-8">
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm">Loading session...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error || !session) {
    return (
      <main data-testid="session-page-error" className="mx-auto w-full max-w-5xl p-6 md:p-8" role="alert">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-2 p-6 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">{error ?? 'Session not found.'}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main data-testid="session-page" className="mx-auto w-full max-w-5xl space-y-4 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Workflow className="h-3.5 w-3.5" />
          Session Flow
        </Badge>
        <Badge variant="outline">{session.id.slice(0, 8)}</Badge>
      </div>
      <SessionWorkflowShell
        session={session}
        onVoiceResponseSaved={refreshSession}
      />
    </main>
  );
}
