import {
  trackButtonClick,
  trackButtonOutcome,
  trackButtonTiming,
  ButtonType,
} from '@/lib/analytics';

interface ButtonAnalytics {
  trackClick: () => Promise<void>;
  trackSuccess: (startTime: number) => Promise<void>;
  trackError: (error: Error | string) => Promise<void>;
}

export function useButtonAnalytics(
  buttonType: ButtonType,
  messageId: string
): ButtonAnalytics {
  const trackClick = async () => {
    await trackButtonClick({
      buttonType,
      messageId,
      timestamp: Date.now(),
    });
  };

  const trackSuccess = async (startTime: number) => {
    const endTime = Date.now();

    await trackButtonOutcome({
      buttonType,
      messageId,
      outcome: 'success',
      timestamp: endTime,
    });

    await trackButtonTiming({
      buttonType,
      messageId,
      startTime,
      endTime,
      duration: endTime - startTime,
    });
  };

  const trackError = async (error: Error | string) => {
    await trackButtonOutcome({
      buttonType,
      messageId,
      outcome: 'error',
      errorMessage: error instanceof Error ? error.message : error,
      timestamp: Date.now(),
    });
  };

  return { trackClick, trackSuccess, trackError };
}
