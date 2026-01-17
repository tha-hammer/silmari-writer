/**
 * Clarification utilities for low confidence classifications
 * REQ_006.5: Handle low confidence with user clarification
 */

import {
  type ClassifiedIntent,
  type ClarificationChoice,
  type ClarificationState,
  type ToolIntent,
  CLARIFICATION_TIMEOUT_MS,
  CONFIDENCE_THRESHOLDS,
  TOOL_INTENT_DISPLAY_NAMES,
  shouldRequestClarification,
  getConfidenceLevel,
} from './types';

/**
 * Storage key for clarification state persistence
 * REQ_006.5.9: Session persistence
 */
const CLARIFICATION_STATE_KEY = 'pending_clarification';

/**
 * Check if a classification needs user clarification
 * REQ_006.5.1: When confidence < 0.5, pause execution
 */
export function needsClarification(intent: ClassifiedIntent): boolean {
  return shouldRequestClarification(intent);
}

/**
 * Create a clarification state for session storage
 * REQ_006.5.9: Persist clarification state
 */
export function createClarificationState(
  intent: ClassifiedIntent,
  originalMessage: string
): ClarificationState {
  const now = Date.now();
  return {
    intent,
    originalMessage,
    createdAt: now,
    expiresAt: now + CLARIFICATION_TIMEOUT_MS,
  };
}

/**
 * Check if clarification state has expired
 * REQ_006.5.11: 5 minute timeout
 */
export function isClarificationExpired(state: ClarificationState): boolean {
  return Date.now() > state.expiresAt;
}

/**
 * Get sessionStorage safely (for SSR compatibility)
 */
function getSessionStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

/**
 * Save clarification state to session storage
 * REQ_006.5.9: Session persistence
 */
export function saveClarificationState(state: ClarificationState): void {
  const storage = getSessionStorage();
  if (storage) {
    storage.setItem(CLARIFICATION_STATE_KEY, JSON.stringify(state));
  }
}

/**
 * Load clarification state from session storage
 * REQ_006.5.9: Session persistence
 */
export function loadClarificationState(): ClarificationState | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  const stored = storage.getItem(CLARIFICATION_STATE_KEY);
  if (!stored) return null;

  try {
    const state = JSON.parse(stored) as ClarificationState;

    // Check if expired
    if (isClarificationExpired(state)) {
      clearClarificationState();
      return null;
    }

    return state;
  } catch {
    clearClarificationState();
    return null;
  }
}

/**
 * Clear clarification state from session storage
 */
export function clearClarificationState(): void {
  const storage = getSessionStorage();
  if (storage) {
    storage.removeItem(CLARIFICATION_STATE_KEY);
  }
}

/**
 * Generate friendly clarification message
 * REQ_006.5.8: Friendly language, not technical jargon
 */
export function generateClarificationMessage(intent: ClassifiedIntent): string {
  const toolName = TOOL_INTENT_DISPLAY_NAMES[intent.tool];
  const confidenceLevel = getConfidenceLevel(intent.confidence);

  let message = "I want to make sure I understand what you're looking for. ";

  if (confidenceLevel === 'low') {
    message += `I think you might want to use **${toolName}**, but I'm not very confident about that. `;
  } else {
    message += `It looks like you might want to use **${toolName}**. `;
  }

  if (intent.alternativeIntents && intent.alternativeIntents.length > 0) {
    const alternatives = intent.alternativeIntents
      .map(alt => TOOL_INTENT_DISPLAY_NAMES[alt.tool])
      .join(' or ');
    message += `You might also want ${alternatives}. `;
  }

  message += 'What would you like to do?';

  return message;
}

/**
 * Get available options for clarification dialog
 * REQ_006.5.3: User options
 */
export function getClarificationOptions(intent: ClassifiedIntent): Array<{
  choice: ClarificationChoice;
  label: string;
  description: string;
}> {
  const options: Array<{ choice: ClarificationChoice; label: string; description: string }> = [];

  // Option 1: Confirm detected intent
  options.push({
    choice: 'confirm',
    label: `Yes, use ${TOOL_INTENT_DISPLAY_NAMES[intent.tool]}`,
    description: `Proceed with ${TOOL_INTENT_DISPLAY_NAMES[intent.tool]} as detected`,
  });

  // Option 2: Select from alternatives (if any)
  if (intent.alternativeIntents && intent.alternativeIntents.length > 0) {
    for (const alt of intent.alternativeIntents) {
      options.push({
        choice: 'alternative',
        label: `Use ${TOOL_INTENT_DISPLAY_NAMES[alt.tool]} instead`,
        description: `Switch to ${TOOL_INTENT_DISPLAY_NAMES[alt.tool]}`,
      });
    }
  }

  // Option 3: Type clarification
  options.push({
    choice: 'clarify',
    label: 'Let me clarify',
    description: 'Add more details to help me understand',
  });

  // Option 4: Cancel (fall back to chat)
  options.push({
    choice: 'cancel',
    label: 'Just chat instead',
    description: 'Skip tool selection and have a conversation',
  });

  return options;
}

/**
 * Process user's clarification choice
 * REQ_006.5.4-7: Handle each choice path
 */
export async function processClarificationChoice(
  choice: ClarificationChoice,
  state: ClarificationState,
  additionalInput?: string | ToolIntent
): Promise<{
  action: 'proceed' | 'reclassify' | 'chat';
  intent?: ClassifiedIntent;
  newMessage?: string;
}> {
  clearClarificationState();

  switch (choice) {
    case 'confirm':
      // REQ_006.5.4: User confirms, proceed regardless of low confidence
      return {
        action: 'proceed',
        intent: state.intent,
      };

    case 'alternative':
      // REQ_006.5.5: User selected alternative tool
      if (typeof additionalInput === 'string' && additionalInput) {
        // Re-classify with the selected tool as a hint
        return {
          action: 'reclassify',
          newMessage: `[Use ${additionalInput} tool] ${state.originalMessage}`,
        };
      }
      // Fallback to original intent if no alternative specified
      return {
        action: 'proceed',
        intent: state.intent,
      };

    case 'clarify':
      // REQ_006.5.6: User wants to add clarification
      if (typeof additionalInput === 'string' && additionalInput.trim()) {
        return {
          action: 'reclassify',
          newMessage: `${state.originalMessage}. ${additionalInput}`,
        };
      }
      // If no clarification provided, re-run with original
      return {
        action: 'reclassify',
        newMessage: state.originalMessage,
      };

    case 'cancel':
      // REQ_006.5.7: Fall back to chat_completion
      return {
        action: 'chat',
        intent: {
          tool: 'chat_completion',
          confidence: 1.0, // User explicitly chose chat
          extractedParams: {
            kind: 'chat_completion',
            message: state.originalMessage,
          },
          rawMessage: state.originalMessage,
          classifiedAt: new Date().toISOString(),
        },
      };

    default:
      // Unknown choice, fall back to chat
      return { action: 'chat' };
  }
}

/**
 * Analytics tracking for clarification events
 * REQ_006.5.10: Track clarification metrics
 */
export interface ClarificationAnalytics {
  originalIntent: ToolIntent;
  originalConfidence: number;
  userChoice: ClarificationChoice;
  finalIntent?: ToolIntent;
  timestamp: number;
}

/**
 * Track clarification analytics event
 * REQ_006.5.10: Log clarification frequency, choices, accuracy improvement
 */
export function trackClarificationEvent(analytics: ClarificationAnalytics): void {
  console.log(
    `[ClarificationAnalytics] ` +
    `original=${analytics.originalIntent} ` +
    `confidence=${analytics.originalConfidence.toFixed(2)} ` +
    `choice=${analytics.userChoice} ` +
    `final=${analytics.finalIntent || 'pending'}`
  );

  // In a real implementation, this would send to an analytics service
}

/**
 * Determine if clarification improved classification accuracy
 * REQ_006.5.10: Accuracy tracking
 */
export function didClarificationImproveAccuracy(
  originalIntent: ClassifiedIntent,
  finalIntent: ClassifiedIntent
): boolean {
  // Accuracy improved if:
  // 1. Final confidence is higher
  // 2. Or user explicitly chose a different tool (assumed correct)
  if (finalIntent.confidence > originalIntent.confidence) {
    return true;
  }
  if (finalIntent.tool !== originalIntent.tool) {
    return true; // User correction assumed to be accurate
  }
  return false;
}
