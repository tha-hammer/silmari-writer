'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  emitInterstitialAbandonmentEvent,
  emitNewPathClientEvent,
} from '@/lib/newPathTelemetryClient';
import type { NewPathEventPayload } from '@/server/data_structures/NewPathEvents';
import { getInterstitialContent } from './interstitialContent';
import type { InterstitialTransition } from './interstitialMapper';

type InterstitialCtaAction = NewPathEventPayload<'interstitial_dismissed_or_continued'>['cta_action'];

export interface InterstitialControllerProps {
  transition: InterstitialTransition;
  sessionId: string;
  userId?: string;
  autoAdvanceReady?: boolean;
  onAdvance: (action: InterstitialCtaAction) => void;
}

export function InterstitialController({
  transition,
  sessionId,
  userId = 'unknown_user',
  autoAdvanceReady = true,
  onAdvance,
}: InterstitialControllerProps) {
  const content = useMemo(() => getInterstitialContent(transition.type), [transition.type]);
  const shownAtRef = useRef<number>(Date.now());
  const completedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    shownAtRef.current = Date.now();
    completedRef.current = false;

    void emitNewPathClientEvent('interstitial_shown', {
      interstitial_type: transition.type,
      step_before: transition.stepBefore,
      step_after: transition.stepAfter,
      session_id: sessionId,
      user_id: userId,
      source: 'ui',
    });

    const emitAbandonment = () => {
      if (completedRef.current) {
        return;
      }

      const dwellMs = Math.max(0, Date.now() - shownAtRef.current);
      void emitInterstitialAbandonmentEvent({
        interstitial_type: transition.type,
        step_before: transition.stepBefore,
        dwell_ms: dwellMs,
        session_id: sessionId,
        user_id: userId,
        source: 'ui',
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        emitAbandonment();
      }
    };

    window.addEventListener('pagehide', emitAbandonment);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', emitAbandonment);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [sessionId, transition, userId]);

  const completeTransition = (action: InterstitialCtaAction) => {
    if (completedRef.current || timeoutRef.current) {
      return;
    }

    const elapsedMs = Math.max(0, Date.now() - shownAtRef.current);
    const remainingMs = Math.max(0, transition.minDisplayMs - elapsedMs);

    timeoutRef.current = setTimeout(() => {
      if (completedRef.current) {
        return;
      }

      const dwellMs = Math.max(0, Date.now() - shownAtRef.current);
      completedRef.current = true;

      void emitNewPathClientEvent('interstitial_dismissed_or_continued', {
        interstitial_type: transition.type,
        dwell_ms: dwellMs,
        cta_action: action,
        session_id: sessionId,
        user_id: userId,
        source: 'ui',
      });

      onAdvance(action);
    }, remainingMs);
  };

  useEffect(() => {
    if (autoAdvanceReady) {
      completeTransition('auto-advance');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceReady]);

  return (
    <div
      data-testid="interstitial-controller"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
      role="dialog"
      aria-label="Stage transition in progress"
    >
      <div className="w-full max-w-xl rounded-xl border bg-background p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {content.stepLabel}
        </p>
        <h2 className="mt-2 text-xl font-semibold">{content.title}</h2>
        <p className="mt-3 text-sm text-foreground/90">{content.message}</p>
        <p className="mt-2 text-sm text-muted-foreground">{content.why}</p>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{content.progressPercent}%</span>
          </div>
          <div
            data-testid="interstitial-progress-indicator"
            className="h-2 w-full overflow-hidden rounded bg-muted"
          >
            <div
              className="h-full rounded bg-primary transition-[width] duration-300"
              style={{ width: `${content.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => completeTransition('continue')}
          >
            Continue
          </button>
          <span className="text-xs text-muted-foreground">
            You can wait and we will continue automatically.
          </span>
        </div>
      </div>
    </div>
  );
}

export default InterstitialController;
