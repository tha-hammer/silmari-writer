export type ButtonType = 'copy' | 'regenerate' | 'sendToAPI' | 'edit';
export type EventType = 'button_click' | 'button_outcome' | 'button_timing';
export type Outcome = 'success' | 'error';

export interface ButtonClickEvent {
  buttonType: ButtonType;
  messageId: string;
  timestamp: number;
}

export interface ButtonOutcomeEvent {
  buttonType: ButtonType;
  messageId: string;
  outcome: Outcome;
  errorMessage?: string;
  timestamp: number;
}

export interface ButtonTimingEvent {
  buttonType: ButtonType;
  messageId: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface AnalyticsEvent {
  eventType: EventType;
  [key: string]: unknown;
}

// Analytics events are fire-and-forget, no retry on failure
// This is acceptable for MVP as analytics should not block user experience
async function sendAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.warn('Analytics event failed:', response.status);
    }
  } catch (error) {
    console.warn('Failed to send analytics event:', error);
    // Silent fail - don't disrupt user experience
    // Note: No retry logic for MVP. Future: implement exponential backoff if needed
  }
}

export async function trackButtonClick(data: ButtonClickEvent): Promise<void> {
  await sendAnalyticsEvent({
    eventType: 'button_click',
    ...data,
  });
}

export async function trackButtonOutcome(data: ButtonOutcomeEvent): Promise<void> {
  await sendAnalyticsEvent({
    eventType: 'button_outcome',
    ...data,
  });
}

export async function trackButtonTiming(data: ButtonTimingEvent): Promise<void> {
  await sendAnalyticsEvent({
    eventType: 'button_timing',
    ...data,
  });
}
