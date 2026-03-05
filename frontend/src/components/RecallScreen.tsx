/**
 * RecallScreen - Recall step UI for the writing flow.
 *
 * Resource: ui-w8p2 (component)
 * Path: 331-return-to-recall-from-review
 *
 * Renders the Recall interface with RecordButton and ProgressIndicator.
 * Wraps content in an error boundary for resilient rendering.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RecordButton from './RecordButton';
import ProgressIndicator from './ProgressIndicator';
import { NEUTRAL_PROGRESS, loadRecallProgress } from '@/data_loaders/RecallProgressLoader';
import type { RecallProgress } from '@/data_loaders/RecallProgressLoader';
import type { Story } from '@/server/data_structures/ConfirmStory';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { VOICE_MODES } from '@/lib/voice-types';
import { submitVoiceResponse } from '@/api_contracts/submitVoiceResponse';
import {
  advanceSessionQuestion,
  getSessionVoiceTurns,
  resetSessionVoiceTurns,
  type SessionVoiceTurnsSource,
  updateSessionWorkingAnswer,
} from '@/api_contracts/sessionVoiceTurns';
import { emitNewPathClientEvent } from '@/lib/newPathTelemetryClient';
import { extractFinalTranscriptEvent } from '@/lib/realtime-transcript';
import {
  DEFAULT_RECALL_QUESTIONS,
  advanceQuestionProgress,
  getQuestionByProgress,
  initializeQuestionProgress,
  type QuestionProgressState,
  type RecallQuestion,
} from '@/lib/recallQuestions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecallScreenProps {
  progress?: RecallProgress;
  selectedStory?: Story | null;
  sessionId?: string;
  sessionSource?: SessionVoiceTurnsSource;
  initialWorkingAnswer?: string | null;
  initialResponses?: string[];
  questions?: RecallQuestion[];
  initialQuestionProgress?: QuestionProgressState | null;
  onVoiceResponseSaved?: () => Promise<void> | void;
  onAdvanceToReview?: () => void;
}

type VoiceSubmitStatus = 'idle' | 'listening' | 'submitting' | 'saved' | 'error';
type EditorSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type CopyStatus = 'idle' | 'copied' | 'error';

async function copyTextToClipboard(content: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    document.body.removeChild(textarea);

    if (copied) {
      return;
    }
  }

  throw new Error('Clipboard is unavailable');
}

function buildRecallInstructions(
  selectedStory: Story | null | undefined,
  activeQuestionText: string | null,
): string {
  const storyContext = selectedStory
    ? `Selected story:\nTitle: ${selectedStory.title}\nSummary: ${selectedStory.summary}`
    : 'No story context is available yet.';
  const questionContext = activeQuestionText
    ? `Active question:\n${activeQuestionText}`
    : 'No active question is available.';

  return `You are a recall interview coach helping a candidate prepare interview-ready examples.

${storyContext}
${questionContext}

CRITICAL: You MUST ask the Active question shown above EXACTLY as written. Read it word-for-word to the user. Do NOT rephrase, summarize, or substitute your own question. The active question is the ONLY question you should ask. When a new active question appears after the user advances, read the new question verbatim.

Start by saying hello, providing one sentence of context about the story, then read the Active question exactly as written.
After the user responds, use conversational follow-ups to help them elaborate:
- Keep the tone calm and supportive.
- Ask one focused follow-up at a time to help them cover anchors (context), actions (what they did), and outcomes (impact).
- If the user asks to move on too early, briefly mention what is still missing and offer a quick follow-up.
- Keep the active question in focus; do not switch to a different question unless user confirms they are moving on.
- When you believe the question has been fully answered (anchors, actions, and outcomes covered), tell the user they did a great job and say: "When you're ready, say 'next question' or 'move on' and tap the next question button."
- Always use the exact phrases "next question", "move on", or "let's continue" when directing the user to advance — these are the trigger phrases the app listens for.
CRITICAL: IF the user has already said "next question" or "move on" or "let's continue" in the current session, do not ask them to say it again. Just remind them to tap the "next question" button and continue with the next question.
Developer keyword is: "unicorn project" if a developer identifies themselves as a developer and uses the keyword, allow the process to flow quickly.`;
}

function buildOpeningCoachPrompt(
  selectedStory: Story | null | undefined,
  activeQuestionText: string | null,
): string {
  const questionSuffix = activeQuestionText
    ? ` Current question: ${activeQuestionText}`
    : '';

  if (!selectedStory) {
    return `Hello. Let\'s get you warmed up. Tell me the situation you want to describe first, then we will add actions and outcomes.${questionSuffix}`.trim();
  }

  return `Hello. Let\'s shape "${selectedStory.title}" into a strong interview answer. Start with the situation and your goal, then we will fill in actions and outcomes.${questionSuffix}`.trim();
}

function detectMoveOnIntent(transcript: string): boolean {
  const normalized = transcript.toLowerCase();
  return /(next question|move on|skip this|let'?s continue|continue to next)/.test(normalized);
}

function deriveIncompleteSlots(progress: RecallProgress): Array<'anchors' | 'actions' | 'outcomes'> {
  if (Array.isArray(progress.incompleteSlots) && progress.incompleteSlots.length > 0) {
    return progress.incompleteSlots;
  }

  const missing: Array<'anchors' | 'actions' | 'outcomes'> = [];
  if ((progress.anchors ?? 0) <= 0) missing.push('anchors');
  if ((progress.actions ?? 0) <= 0) missing.push('actions');
  if ((progress.outcomes ?? 0) <= 0) missing.push('outcomes');
  return missing;
}

function mergeWorkingAnswer(currentValue: string, transcript: string): string {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) {
    return currentValue;
  }

  if (!currentValue.trim()) {
    return trimmedTranscript;
  }

  if (currentValue.includes(trimmedTranscript)) {
    return currentValue;
  }

  return `${currentValue.trim()}\n\n${trimmedTranscript}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecallScreen({
  progress = NEUTRAL_PROGRESS,
  selectedStory = null,
  sessionId,
  sessionSource,
  initialWorkingAnswer = null,
  initialResponses = [],
  questions,
  initialQuestionProgress = null,
  onVoiceResponseSaved,
  onAdvanceToReview,
}: RecallScreenProps) {
  const { connect, disconnect, sendEvent, sessionState, setOnEvent } = useRealtimeSession();
  const questionSet = useMemo(
    () => (Array.isArray(questions) && questions.length > 0 ? questions : DEFAULT_RECALL_QUESTIONS),
    [questions],
  );
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<VoiceSubmitStatus>('idle');
  const [liveProgress, setLiveProgress] = useState<RecallProgress>(progress);
  const [questionProgress, setQuestionProgress] = useState<QuestionProgressState>(
    () => initialQuestionProgress ?? initializeQuestionProgress(questionSet),
  );
  const [workingAnswer, setWorkingAnswer] = useState<string>(() => {
    if (initialWorkingAnswer && initialWorkingAnswer.trim().length > 0) {
      return initialWorkingAnswer;
    }
    return initialResponses.join('\n\n');
  });
  const [editorStatus, setEditorStatus] = useState<EditorSaveStatus>('idle');
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [stopControlsVisible, setStopControlsVisible] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState(() => {
    const initialQuestion = getQuestionByProgress(
      questionSet,
      initialQuestionProgress ?? initializeQuestionProgress(questionSet),
    );
    return buildOpeningCoachPrompt(selectedStory, initialQuestion?.text ?? null);
  });

  const submittedKeysRef = useRef<Set<string>>(new Set());
  const workingAnswerRef = useRef(workingAnswer);
  const greetingEmittedRef = useRef(false);
  const copyStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionProgressRef = useRef(questionProgress);
  const latestProgressRef = useRef(liveProgress);
  const pendingProgressRefreshRef = useRef<Promise<RecallProgress> | null>(null);

  const isConnecting = sessionState === 'connecting';
  const isConnected = sessionState === 'connected';
  const incompleteSlots = useMemo(() => deriveIncompleteSlots(liveProgress), [liveProgress]);
  const activeQuestion = useMemo(
    () => getQuestionByProgress(questionSet, questionProgress),
    [questionProgress, questionSet],
  );

  useEffect(() => {
    const resolvedProgress = initialQuestionProgress ?? initializeQuestionProgress(questionSet);
    questionProgressRef.current = resolvedProgress;
    setQuestionProgress(resolvedProgress);
  }, [initialQuestionProgress, questionSet]);

  useEffect(() => {
    if (stopControlsVisible) {
      return;
    }

    setCoachPrompt(buildOpeningCoachPrompt(selectedStory, activeQuestion?.text ?? null));
  }, [activeQuestion?.id, activeQuestion?.text, selectedStory, stopControlsVisible]);

  useEffect(() => {
    workingAnswerRef.current = workingAnswer;
  }, [workingAnswer]);

  useEffect(() => {
    questionProgressRef.current = questionProgress;
  }, [questionProgress]);

  useEffect(() => {
    latestProgressRef.current = liveProgress;
  }, [liveProgress]);

  useEffect(() => () => {
    if (copyStatusTimerRef.current) {
      clearTimeout(copyStatusTimerRef.current);
    }
  }, []);

  const scheduleCopyStatusReset = useCallback(() => {
    if (copyStatusTimerRef.current) {
      clearTimeout(copyStatusTimerRef.current);
    }

    copyStatusTimerRef.current = setTimeout(() => {
      setCopyStatus('idle');
    }, 2000);
  }, []);

  const refreshProgress = useCallback(async (): Promise<RecallProgress> => {
    if (!sessionId || !sessionSource) {
      return latestProgressRef.current;
    }

    if (pendingProgressRefreshRef.current) {
      return pendingProgressRefreshRef.current;
    }

    const refreshPromise = (async () => {
      try {
        const loadedProgress = await loadRecallProgress(sessionId, sessionSource);
        latestProgressRef.current = loadedProgress;
        setLiveProgress(loadedProgress);
        return loadedProgress;
      } catch {
        latestProgressRef.current = NEUTRAL_PROGRESS;
        setLiveProgress(NEUTRAL_PROGRESS);
        return NEUTRAL_PROGRESS;
      }
    })();

    pendingProgressRefreshRef.current = refreshPromise;
    void refreshPromise.finally(() => {
      if (pendingProgressRefreshRef.current === refreshPromise) {
        pendingProgressRefreshRef.current = null;
      }
    });
    return refreshPromise;
  }, [sessionId, sessionSource]);

  useEffect(() => {
    if (!sessionId || !sessionSource) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const persistedConversation = await getSessionVoiceTurns(sessionId, sessionSource);
        if (cancelled) {
          return;
        }

        if (persistedConversation.workingAnswer.trim().length > 0) {
          setWorkingAnswer(persistedConversation.workingAnswer);
        }

        if (persistedConversation.questionProgress.total > 0) {
          questionProgressRef.current = persistedConversation.questionProgress;
          setQuestionProgress(persistedConversation.questionProgress);
        }

        if (persistedConversation.turns.length > 0) {
          void emitNewPathClientEvent('recall_turn_recovered', {
            session_id: sessionId,
            user_id: 'unknown_user',
            source: 'ui',
            turn_count: persistedConversation.turns.length,
          });
        }
      } catch {
        // Non-blocking: recall UI can still run without persisted turns.
      }

      await refreshProgress();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshProgress, sessionId, sessionSource]);

  useEffect(() => {
    if (!sessionId || greetingEmittedRef.current) {
      return;
    }

    greetingEmittedRef.current = true;
    void emitNewPathClientEvent('recall_greeting_shown', {
      session_id: sessionId,
      user_id: 'unknown_user',
      source: 'ui',
      greeting_variant: 'proactive_hello',
    });
  }, [sessionId]);

  const recordLabel = useMemo(() => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Stop';
    return 'Record';
  }, [isConnected, isConnecting]);

  const syncActiveQuestionInstructions = useCallback(
    (questionText: string) => {
      if (!isConnected) return;
      const instructions = buildRecallInstructions(selectedStory, questionText);
      sendEvent({
        type: 'session.update',
        session: { instructions },
      });
      sendEvent({
        type: 'response.create',
        response: { instructions },
      });
    },
    [isConnected, sendEvent, selectedStory],
  );

  const advanceQuestionFlow = useCallback(async () => {
    const startingProgress = questionProgressRef.current;
    const locallyAdvanced = advanceQuestionProgress(questionSet, startingProgress);
    let resolvedProgress = locallyAdvanced;
    setQuestionProgress(locallyAdvanced);
    setStopControlsVisible(false);

    if (sessionId && sessionSource) {
      try {
        const advanced = await advanceSessionQuestion(sessionId, sessionSource);
        if (advanced.questionProgress.currentIndex >= locallyAdvanced.currentIndex) {
          resolvedProgress = advanced.questionProgress;
          setQuestionProgress(advanced.questionProgress);
        }
        if (advanced.workingAnswer.trim().length > 0) {
          setWorkingAnswer(advanced.workingAnswer);
        }
      } catch {
        // Non-blocking; local progression still advances.
      }
    }

    const nextQuestion = getQuestionByProgress(questionSet, resolvedProgress);
    if (!nextQuestion) {
      setCoachPrompt('You completed all recall questions. Moving to review.');
      onAdvanceToReview?.();
      return;
    }

    setCoachPrompt(buildOpeningCoachPrompt(selectedStory, nextQuestion.text));
    syncActiveQuestionInstructions(nextQuestion.text);
  }, [onAdvanceToReview, questionSet, selectedStory, sessionId, sessionSource, syncActiveQuestionInstructions]);

  const handleNextQuestion = useCallback(async () => {
    await advanceQuestionFlow();
  }, [advanceQuestionFlow]);

  const presentStopState = useCallback(
    (
      reason: 'manual_stop' | 'move_on_intent',
      incompleteSlotsSnapshot?: Array<'anchors' | 'actions' | 'outcomes'>,
    ) => {
      const slots = incompleteSlotsSnapshot ?? incompleteSlots;
      setStopControlsVisible(true);

      if (slots.length > 0) {
        setCoachPrompt(
          `Before moving on, let\'s quickly fill: ${slots.join(', ')}. One short follow-up can make this answer much stronger.`,
        );
      } else {
        setCoachPrompt('You have enough detail to continue. Choose next question when ready.');
      }

      if (sessionId) {
        void emitNewPathClientEvent('recall_stop_state_presented', {
          session_id: sessionId,
          user_id: 'unknown_user',
          source: 'ui',
          stop_reason: reason,
          incomplete_slots: slots,
        });
      }
    },
    [incompleteSlots, sessionId],
  );

  const handleRecord = useCallback(async () => {
    if (!activeQuestion) {
      onAdvanceToReview?.();
      return;
    }

    setVoiceError(null);

    if (isConnected) {
      disconnect();
      setSubmitStatus('idle');
      presentStopState('manual_stop');
      return;
    }

    submittedKeysRef.current.clear();
    setSubmitStatus('idle');
    setStopControlsVisible(false);

    const connected = await connect(VOICE_MODES.VOICE_EDIT, {
      instructions: buildRecallInstructions(selectedStory, activeQuestion.text),
    });

    if (!connected) {
      setVoiceError('Unable to start voice model session. Please try again.');
      setSubmitStatus('error');
    }
  }, [activeQuestion, connect, disconnect, isConnected, onAdvanceToReview, presentStopState, selectedStory]);

  const persistWorkingAnswer = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    if (!sessionSource) {
      setEditorStatus('error');
      return;
    }

    setEditorStatus('saving');

    try {
      await updateSessionWorkingAnswer(sessionId, workingAnswerRef.current, sessionSource);
      setEditorStatus('saved');

      void emitNewPathClientEvent('recall_working_answer_saved', {
        session_id: sessionId,
        user_id: 'unknown_user',
        source: 'ui',
        char_count: workingAnswerRef.current.length,
      });
    } catch {
      setEditorStatus('error');
    }
  }, [sessionId, sessionSource]);

  const handleStartOver = useCallback(async () => {
    if (isConnected) {
      disconnect();
    }

    if (sessionId && sessionSource) {
      try {
        await resetSessionVoiceTurns(sessionId, sessionSource);
      } catch {
        // Non-blocking reset fallback still clears local state.
      }
    }

    setWorkingAnswer('');
    setLiveProgress(NEUTRAL_PROGRESS);
    latestProgressRef.current = NEUTRAL_PROGRESS;
    const resetProgress = initializeQuestionProgress(questionSet);
    setQuestionProgress(resetProgress);
    questionProgressRef.current = resetProgress;
    setSubmitStatus('idle');
    setEditorStatus('idle');
    setCopyStatus('idle');
    setStopControlsVisible(false);
    setCoachPrompt(
      buildOpeningCoachPrompt(
        selectedStory,
        getQuestionByProgress(questionSet, resetProgress)?.text ?? null,
      ),
    );
  }, [disconnect, isConnected, questionSet, selectedStory, sessionId, sessionSource]);

  const handleCopyWorkingAnswer = useCallback(async () => {
    const content = workingAnswerRef.current;
    if (!content.trim()) {
      setCopyStatus('error');
      scheduleCopyStatusReset();
      return;
    }

    try {
      await copyTextToClipboard(content);
      setCopyStatus('copied');

      void emitNewPathClientEvent('artifact_copied_to_clipboard', {
        artifact_type: 'answer',
        copy_success: true,
        session_id: sessionId ?? 'unknown_session',
        user_id: 'unknown_user',
        source: 'ui',
      });
    } catch {
      setCopyStatus('error');

      void emitNewPathClientEvent('artifact_copied_to_clipboard', {
        artifact_type: 'answer',
        copy_success: false,
        session_id: sessionId ?? 'unknown_session',
        user_id: 'unknown_user',
        source: 'ui',
        error_code: 'CLIPBOARD_WRITE_FAILED',
      });
    }

    scheduleCopyStatusReset();
  }, [scheduleCopyStatusReset, sessionId]);

  const persistTranscriptBySource = useCallback(async (
    currentSessionId: string,
    source: SessionVoiceTurnsSource | undefined,
    transcript: string,
    mergedAnswer: string,
  ) => {
    if (source === 'session') {
      await updateSessionWorkingAnswer(currentSessionId, mergedAnswer, 'session');
      return;
    }

    if (source === 'answer_session') {
      await submitVoiceResponse({
        sessionId: currentSessionId,
        transcript,
      });

      await updateSessionWorkingAnswer(currentSessionId, mergedAnswer, 'answer_session').catch(() => undefined);
      return;
    }

    throw new Error('Missing sessionSource for transcript persistence');
  }, []);

  useEffect(() => {
    if (sessionState === 'connected') {
      setSubmitStatus((current) => (current === 'saved' ? current : 'listening'));
      return;
    }

    if (sessionState !== 'connecting') {
      setSubmitStatus('idle');
    }
  }, [sessionState]);

  useEffect(() => {
    if (!isConnected || !sessionId) {
      setOnEvent(null);
      return;
    }

    setOnEvent((event) => {
      const finalTranscriptEvent = extractFinalTranscriptEvent(event);
      if (!finalTranscriptEvent) {
        return;
      }

      if (submittedKeysRef.current.has(finalTranscriptEvent.dedupeKey)) {
        return;
      }

      if (detectMoveOnIntent(finalTranscriptEvent.transcript)) {
        submittedKeysRef.current.add(finalTranscriptEvent.dedupeKey);
        const transcriptExcerpt = finalTranscriptEvent.transcript.slice(0, 120);
        const currentIncompleteSlots = deriveIncompleteSlots(latestProgressRef.current);

        void emitNewPathClientEvent('recall_move_on_intent', {
          session_id: sessionId,
          user_id: 'unknown_user',
          source: 'ui',
          transcript_excerpt: transcriptExcerpt,
          incomplete_slots_count: currentIncompleteSlots.length,
        });

        presentStopState('move_on_intent', currentIncompleteSlots);
        return;
      }

      submittedKeysRef.current.add(finalTranscriptEvent.dedupeKey);

      // Merge transcript into working answer immediately so the UI
      // updates regardless of whether the backend call succeeds.
      const mergedAnswer = mergeWorkingAnswer(
        workingAnswerRef.current,
        finalTranscriptEvent.transcript,
      );
      setWorkingAnswer(mergedAnswer);
      setSubmitStatus('submitting');

      void (async () => {
        try {
          await persistTranscriptBySource(
            sessionId,
            sessionSource,
            finalTranscriptEvent.transcript,
            mergedAnswer,
          );

          void emitNewPathClientEvent('recall_turn_persisted', {
            session_id: sessionId,
            user_id: 'unknown_user',
            source: 'ui',
            transcript_length: finalTranscriptEvent.transcript.length,
          });

          setSubmitStatus('saved');
          setEditorStatus('saved');
          await refreshProgress();
          await onVoiceResponseSaved?.();
        } catch {
          submittedKeysRef.current.delete(finalTranscriptEvent.dedupeKey);
          setSubmitStatus('error');
        }
      })();
    });

    return () => {
      setOnEvent(null);
    };
  }, [
    isConnected,
    onVoiceResponseSaved,
    persistTranscriptBySource,
    presentStopState,
    refreshProgress,
    sessionId,
    sessionSource,
    setOnEvent,
  ]);

  const submitStatusMessage = useMemo(() => {
    if (submitStatus === 'submitting') return 'Saving your response...';
    if (submitStatus === 'saved') return 'Response saved.';
    if (submitStatus === 'error') return 'Could not save response. Please try speaking again.';
    if (isConnected) return 'Listening for your response...';
    return 'Voice response auto-save is idle.';
  }, [isConnected, submitStatus]);

  const editorStatusMessage = useMemo(() => {
    if (editorStatus === 'saving') return 'Saving edits...';
    if (editorStatus === 'saved') return 'Edits saved.';
    if (editorStatus === 'error') return 'Could not save edits.';
    return 'Editable by you and the coach.';
  }, [editorStatus]);

  return (
    <div
      data-testid="recall-screen"
      className="mx-auto flex h-[100svh] w-full max-w-3xl flex-col gap-3 overflow-y-auto px-3 py-3 sm:gap-4 sm:px-6 sm:py-6"
    >
      <h2 className="text-center text-lg font-semibold sm:text-xl">Recall</h2>

      <Card
        data-testid="recall-active-question"
        className="w-full"
      >
        <CardContent className="p-3">
          <p
            data-testid="recall-question-progress"
            className="hidden text-xs uppercase tracking-wide text-muted-foreground"
          >
          Question {Math.min(questionProgress.currentIndex + 1, questionProgress.total)} of {questionProgress.total}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Question</p>
          <p data-testid="recall-question-text" className="mt-1 text-sm text-foreground sm:text-base">
            {activeQuestion?.text ?? 'All questions completed.'}
          </p>
        </CardContent>
      </Card>

      <Card
        data-testid="recall-coach-prompt"
        className="w-full"
      >
        <CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Coach</p>
          <p className="mt-1 text-sm text-foreground sm:text-base">{coachPrompt}</p>
        </CardContent>
      </Card>

      {selectedStory && (
        <Card
          data-testid="selected-story"
          className="w-full"
        >
          <CardContent className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected Story</p>
            <h3 className="text-sm font-semibold sm:text-base">{selectedStory.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{selectedStory.summary}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col items-center gap-2">
        <RecordButton
          prominent
          onClick={() => {
            void handleRecord();
          }}
          disabled={isConnecting}
          label={recordLabel}
          ariaLabel={isConnected ? 'Stop recording' : 'Record'}
        />

        <p
          data-testid="voice-model-status"
          className="text-center text-xs text-muted-foreground sm:text-sm"
        >
          {isConnected ? 'Voice model connected. Speak now.' : 'Voice model idle.'}
        </p>

        <p
          data-testid="voice-submit-status"
          className="text-center text-xs text-muted-foreground sm:text-sm"
        >
          {submitStatusMessage}
        </p>
      </div>

      {voiceError && (
        <p data-testid="voice-model-error" role="alert" className="text-sm text-red-600">
          {voiceError}
        </p>
      )}

      <Card
        data-testid="working-answer-panel"
        className="w-full"
      >
        <CardContent className="p-3">
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-sm font-semibold">Working answer</p>
            <div className="flex items-center gap-3">
              <span data-testid="working-answer-status" className="text-xs text-muted-foreground">
                {editorStatusMessage}
              </span>
              <span data-testid="working-answer-copy-status" className="text-xs text-muted-foreground">
                {copyStatus === 'copied'
                  ? 'Copied to clipboard.'
                  : copyStatus === 'error'
                    ? 'Copy failed.'
                    : ''}
              </span>
            </div>
          </div>

          <Textarea
            data-testid="working-answer-editor"
            value={workingAnswer}
            onChange={(event) => {
              setWorkingAnswer(event.target.value);
              setEditorStatus('idle');
            }}
            onBlur={() => {
              void persistWorkingAnswer();
            }}
            placeholder="Your evolving answer appears here. You can edit it anytime."
            className="min-h-24 max-h-40 text-sm sm:min-h-32"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                void persistWorkingAnswer();
              }}
            >
              Save edits
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="copy-working-answer-button"
              className="w-full sm:w-auto"
              onClick={() => {
                void handleCopyWorkingAnswer();
              }}
              disabled={!workingAnswer.trim()}
            >
              {copyStatus === 'copied' ? 'Copied!' : 'Copy answer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {stopControlsVisible && (
        <Card
          data-testid="recall-stop-controls"
          className="w-full border-amber-200 bg-amber-50 text-amber-950"
        >
          <CardContent className="p-3">
            <p className="text-sm font-semibold">Recording stopped</p>
            <p className="mt-1 text-sm">
              You can re-record, start over, or move to the next question.
            </p>

            {incompleteSlots.length > 0 && (
              <p data-testid="incomplete-slot-guidance" className="mt-2 text-sm">
                Still missing: {incompleteSlots.join(', ')}.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setStopControlsVisible(false);
                  void handleRecord();
                }}
              >
                Re-record
              </Button>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  void handleStartOver();
                }}
              >
                Start over
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  void handleNextQuestion();
                }}
              >
                {questionProgress.currentIndex >= questionProgress.total - 1
                  ? 'Finish to Review'
                  : 'Next question'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="w-full">
        <CardContent className="p-3">
          <ProgressIndicator progress={liveProgress} />
        </CardContent>
      </Card>
    </div>
  );
}
