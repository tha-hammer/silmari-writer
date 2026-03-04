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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecallScreenProps {
  progress?: RecallProgress;
  selectedStory?: Story | null;
  sessionId?: string;
  initialWorkingAnswer?: string | null;
  initialResponses?: string[];
  questions?: RecallQuestion[];
  initialQuestionProgress?: QuestionProgressState | null;
  onVoiceResponseSaved?: () => Promise<void> | void;
  onAdvanceToReview?: () => void;
}

type VoiceSubmitStatus = 'idle' | 'listening' | 'submitting' | 'saved' | 'error';
type EditorSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

Start with a warm greeting: say hello, provide one sentence of context, and ask one short opening question.
Use conversational interviewing techniques:
- Keep the tone calm and supportive.
- Ask one focused question at a time.
- Help the user cover anchors (context), actions (what they did), and outcomes (impact).
- If the user asks to move on too early, briefly mention what is still missing and offer a quick follow-up question.
- Keep the active question in focus; do not switch to a different question unless user confirms they are moving on.
- When you believe the question has been fully answered (anchors, actions, and outcomes covered), tell the user they did a great job and say: "When you're ready, say 'next question' or 'move on' to continue to the next one."
- Always use the exact phrases "next question", "move on", or "let's continue" when directing the user to advance — these are the trigger phrases the app listens for.`;
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
  initialWorkingAnswer = null,
  initialResponses = [],
  questions,
  initialQuestionProgress = null,
  onVoiceResponseSaved,
  onAdvanceToReview,
}: RecallScreenProps) {
  const { connect, disconnect, sessionState, setOnEvent } = useRealtimeSession();
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
  const [stopControlsVisible, setStopControlsVisible] = useState(false);
  const [coachPrompt, setCoachPrompt] = useState(() => {
    const initialQuestion = getQuestionByProgress(
      questionSet,
      initialQuestionProgress ?? initializeQuestionProgress(questionSet),
    );
    return buildOpeningCoachPrompt(selectedStory, initialQuestion?.text ?? null);
  });

  const submittedKeysRef = useRef<Set<string>>(new Set());
  const isSubmittingRef = useRef(false);
  const workingAnswerRef = useRef(workingAnswer);
  const greetingEmittedRef = useRef(false);

  const isConnecting = sessionState === 'connecting';
  const isConnected = sessionState === 'connected';
  const incompleteSlots = useMemo(() => deriveIncompleteSlots(liveProgress), [liveProgress]);
  const activeQuestion = useMemo(
    () => getQuestionByProgress(questionSet, questionProgress),
    [questionProgress, questionSet],
  );

  useEffect(() => {
    setQuestionProgress(initialQuestionProgress ?? initializeQuestionProgress(questionSet));
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

  const refreshProgress = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const loadedProgress = await loadRecallProgress(sessionId);
      setLiveProgress(loadedProgress);
    } catch {
      setLiveProgress(NEUTRAL_PROGRESS);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const persistedConversation = await getSessionVoiceTurns(sessionId);
        if (cancelled) {
          return;
        }

        if (persistedConversation.workingAnswer.trim().length > 0) {
          setWorkingAnswer(persistedConversation.workingAnswer);
        }

        if (persistedConversation.questionProgress.total > 0) {
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
  }, [refreshProgress, sessionId]);

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

  const handleNextQuestion = useCallback(async () => {
    const locallyAdvanced = advanceQuestionProgress(questionSet, questionProgress);
    let resolvedProgress = locallyAdvanced;
    setQuestionProgress(locallyAdvanced);
    setStopControlsVisible(false);

    if (sessionId) {
      try {
        const advanced = await advanceSessionQuestion(sessionId);
        resolvedProgress = advanced.questionProgress;
        setQuestionProgress(advanced.questionProgress);
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
  }, [onAdvanceToReview, questionProgress, questionSet, selectedStory, sessionId]);

  const presentStopState = useCallback(
    (reason: 'manual_stop' | 'move_on_intent') => {
      setStopControlsVisible(true);

      if (incompleteSlots.length > 0) {
        setCoachPrompt(
          `Before moving on, let\'s quickly fill: ${incompleteSlots.join(', ')}. One short follow-up can make this answer much stronger.`,
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
          incomplete_slots: incompleteSlots,
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
    isSubmittingRef.current = false;
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

    setEditorStatus('saving');

    try {
      await updateSessionWorkingAnswer(sessionId, workingAnswerRef.current);
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
  }, [sessionId]);

  const handleStartOver = useCallback(async () => {
    if (isConnected) {
      disconnect();
    }

    if (sessionId) {
      try {
        await resetSessionVoiceTurns(sessionId);
      } catch {
        // Non-blocking reset fallback still clears local state.
      }
    }

    setWorkingAnswer('');
    setLiveProgress(NEUTRAL_PROGRESS);
    const resetProgress = initializeQuestionProgress(questionSet);
    setQuestionProgress(resetProgress);
    setSubmitStatus('idle');
    setEditorStatus('idle');
    setStopControlsVisible(false);
    setCoachPrompt(
      buildOpeningCoachPrompt(
        selectedStory,
        getQuestionByProgress(questionSet, resetProgress)?.text ?? null,
      ),
    );
  }, [disconnect, isConnected, questionSet, selectedStory, sessionId]);

  useEffect(() => {
    if (sessionState === 'connected' && !isSubmittingRef.current) {
      setSubmitStatus((current) => (current === 'saved' ? current : 'listening'));
      return;
    }

    if (sessionState !== 'connected' && sessionState !== 'connecting') {
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

      if (isSubmittingRef.current) {
        return;
      }

      if (detectMoveOnIntent(finalTranscriptEvent.transcript)) {
        const transcriptExcerpt = finalTranscriptEvent.transcript.slice(0, 120);

        void emitNewPathClientEvent('recall_move_on_intent', {
          session_id: sessionId,
          user_id: 'unknown_user',
          source: 'ui',
          transcript_excerpt: transcriptExcerpt,
          incomplete_slots_count: incompleteSlots.length,
        });

        presentStopState('move_on_intent');
        return;
      }

      isSubmittingRef.current = true;
      submittedKeysRef.current.add(finalTranscriptEvent.dedupeKey);
      setSubmitStatus('submitting');

      // Merge transcript into working answer immediately so the UI
      // updates regardless of whether the backend call succeeds.
      const mergedAnswer = mergeWorkingAnswer(
        workingAnswerRef.current,
        finalTranscriptEvent.transcript,
      );
      setWorkingAnswer(mergedAnswer);

      void (async () => {
        try {
          await submitVoiceResponse({
            sessionId,
            transcript: finalTranscriptEvent.transcript,
          });

          await updateSessionWorkingAnswer(sessionId, mergedAnswer).catch(() => undefined);

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
        } finally {
          isSubmittingRef.current = false;
        }
      })();
    });

    return () => {
      setOnEvent(null);
    };
  }, [incompleteSlots.length, isConnected, onVoiceResponseSaved, presentStopState, refreshProgress, sessionId, setOnEvent]);

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
    <div data-testid="recall-screen" className="flex flex-col items-center gap-6 p-6">
      <h2 className="text-xl font-semibold">Recall</h2>

      <section
        data-testid="recall-active-question"
        className="w-full max-w-2xl rounded-md border border-border bg-card p-4"
      >
        <p data-testid="recall-question-progress" className="text-xs uppercase tracking-wide text-muted-foreground">
          Question {Math.min(questionProgress.currentIndex + 1, questionProgress.total)} of {questionProgress.total}
        </p>
        <p data-testid="recall-question-text" className="mt-1 text-sm text-foreground">
          {activeQuestion?.text ?? 'All questions completed.'}
        </p>
      </section>

      <section
        data-testid="recall-coach-prompt"
        className="w-full max-w-2xl rounded-md border border-border bg-card p-4"
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Coach</p>
        <p className="mt-1 text-sm text-foreground">{coachPrompt}</p>
      </section>

      {selectedStory && (
        <section
          data-testid="selected-story"
          className="w-full max-w-2xl rounded-md border border-border bg-card p-4"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Story</p>
          <h3 className="text-base font-semibold">{selectedStory.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{selectedStory.summary}</p>
        </section>
      )}

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
        className="text-sm text-muted-foreground"
      >
        {isConnected ? 'Voice model connected. Speak now.' : 'Voice model idle.'}
      </p>

      <p
        data-testid="voice-submit-status"
        className="text-sm text-muted-foreground"
      >
        {submitStatusMessage}
      </p>

      {voiceError && (
        <p data-testid="voice-model-error" role="alert" className="text-sm text-red-600">
          {voiceError}
        </p>
      )}

      <section
        data-testid="working-answer-panel"
        className="w-full max-w-2xl rounded-md border border-border bg-card p-4"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Working answer</p>
          <span data-testid="working-answer-status" className="text-xs text-muted-foreground">
            {editorStatusMessage}
          </span>
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
          className="min-h-32"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              void persistWorkingAnswer();
            }}
          >
            Save edits
          </Button>
        </div>
      </section>

      {stopControlsVisible && (
        <section
          data-testid="recall-stop-controls"
          className="w-full max-w-2xl rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950"
        >
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
              onClick={() => {
                void handleNextQuestion();
              }}
            >
              {questionProgress.currentIndex >= questionProgress.total - 1
                ? 'Finish to Review'
                : 'Next question'}
            </Button>
          </div>
        </section>
      )}

      <ProgressIndicator progress={liveProgress} />
    </div>
  );
}
