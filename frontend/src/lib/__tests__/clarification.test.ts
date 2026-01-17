/**
 * Unit tests for Clarification utilities
 * REQ_006.5: Handle low confidence with clarification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  needsClarification,
  createClarificationState,
  isClarificationExpired,
  saveClarificationState,
  loadClarificationState,
  clearClarificationState,
  generateClarificationMessage,
  getClarificationOptions,
  processClarificationChoice,
  trackClarificationEvent,
  didClarificationImproveAccuracy,
} from '../clarification';

import {
  type ClassifiedIntent,
  type ClarificationState,
  CLARIFICATION_TIMEOUT_MS,
} from '../types';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
const mockStorage = {
  getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockSessionStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
};

describe('Clarification Utilities (REQ_006.5)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);

    // Mock window.sessionStorage
    Object.defineProperty(global, 'window', {
      value: { sessionStorage: mockStorage },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('needsClarification (REQ_006.5.1)', () => {
    it('should return true when confidence < 0.5', () => {
      const intent: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.49,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };
      expect(needsClarification(intent)).toBe(true);
    });

    it('should return false when confidence >= 0.5', () => {
      const intent: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.5,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };
      expect(needsClarification(intent)).toBe(false);
    });

    it('should trigger at exactly confidence = 0.49 but not at 0.50 (REQ_006.5.12)', () => {
      const at49: ClassifiedIntent = {
        tool: 'chat_completion',
        confidence: 0.49,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      const at50: ClassifiedIntent = {
        tool: 'chat_completion',
        confidence: 0.50,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };

      expect(needsClarification(at49)).toBe(true);
      expect(needsClarification(at50)).toBe(false);
    });
  });

  describe('createClarificationState (REQ_006.5.9)', () => {
    it('should create state with correct timestamps', () => {
      const intent: ClassifiedIntent = {
        tool: 'image_generation',
        confidence: 0.4,
        extractedParams: { kind: 'image_generation', prompt: 'sunset' },
      };

      const now = Date.now();
      const state = createClarificationState(intent, 'create a picture');

      expect(state.intent).toEqual(intent);
      expect(state.originalMessage).toBe('create a picture');
      expect(state.createdAt).toBeGreaterThanOrEqual(now);
      expect(state.expiresAt).toBe(state.createdAt + CLARIFICATION_TIMEOUT_MS);
    });
  });

  describe('isClarificationExpired (REQ_006.5.11)', () => {
    it('should return false for non-expired state', () => {
      const state: ClarificationState = {
        intent: {
          tool: 'chat_completion',
          confidence: 0.4,
          extractedParams: { kind: 'chat_completion', message: 'test' },
        },
        originalMessage: 'test',
        createdAt: Date.now(),
        expiresAt: Date.now() + CLARIFICATION_TIMEOUT_MS,
      };

      expect(isClarificationExpired(state)).toBe(false);
    });

    it('should return true for expired state (5 minutes)', () => {
      const state: ClarificationState = {
        intent: {
          tool: 'chat_completion',
          confidence: 0.4,
          extractedParams: { kind: 'chat_completion', message: 'test' },
        },
        originalMessage: 'test',
        createdAt: Date.now() - CLARIFICATION_TIMEOUT_MS - 1000,
        expiresAt: Date.now() - 1000,
      };

      expect(isClarificationExpired(state)).toBe(true);
    });
  });

  describe('Session storage (REQ_006.5.9)', () => {
    it('should save state to sessionStorage', () => {
      const state: ClarificationState = {
        intent: {
          tool: 'document_generation',
          confidence: 0.3,
          extractedParams: { kind: 'document_generation', type: 'pdf', contentDescription: 'report' },
        },
        originalMessage: 'create pdf',
        createdAt: Date.now(),
        expiresAt: Date.now() + CLARIFICATION_TIMEOUT_MS,
      };

      saveClarificationState(state);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'pending_clarification',
        JSON.stringify(state)
      );
    });

    it('should load state from sessionStorage', () => {
      const state: ClarificationState = {
        intent: {
          tool: 'deep_research',
          confidence: 0.45,
          extractedParams: { kind: 'deep_research', query: 'test' },
        },
        originalMessage: 'research something',
        createdAt: Date.now(),
        expiresAt: Date.now() + CLARIFICATION_TIMEOUT_MS,
      };

      mockSessionStorage['pending_clarification'] = JSON.stringify(state);

      const loaded = loadClarificationState();

      expect(loaded).toEqual(state);
    });

    it('should return null for expired stored state', () => {
      const state: ClarificationState = {
        intent: {
          tool: 'chat_completion',
          confidence: 0.4,
          extractedParams: { kind: 'chat_completion', message: 'test' },
        },
        originalMessage: 'test',
        createdAt: Date.now() - CLARIFICATION_TIMEOUT_MS - 1000,
        expiresAt: Date.now() - 1000,
      };

      mockSessionStorage['pending_clarification'] = JSON.stringify(state);

      const loaded = loadClarificationState();

      expect(loaded).toBeNull();
      expect(mockStorage.removeItem).toHaveBeenCalledWith('pending_clarification');
    });

    it('should clear state from sessionStorage', () => {
      clearClarificationState();

      expect(mockStorage.removeItem).toHaveBeenCalledWith('pending_clarification');
    });
  });

  describe('generateClarificationMessage (REQ_006.5.8)', () => {
    it('should generate friendly language without technical jargon', () => {
      const intent: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.4,
        extractedParams: { kind: 'deep_research', query: 'AI' },
      };

      const message = generateClarificationMessage(intent);

      expect(message).toContain('I want to make sure I understand');
      expect(message).toContain('Deep Research');
      expect(message).not.toContain('confidence');
      expect(message).not.toContain('threshold');
    });

    it('should mention alternatives when present', () => {
      const intent: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.4,
        extractedParams: { kind: 'deep_research', query: 'AI' },
        alternativeIntents: [
          { tool: 'chat_completion', confidence: 0.35 },
        ],
      };

      const message = generateClarificationMessage(intent);

      expect(message).toContain('Chat');
    });
  });

  describe('getClarificationOptions (REQ_006.5.3)', () => {
    it('should provide confirm option', () => {
      const intent: ClassifiedIntent = {
        tool: 'image_generation',
        confidence: 0.4,
        extractedParams: { kind: 'image_generation', prompt: 'sunset' },
      };

      const options = getClarificationOptions(intent);

      const confirmOption = options.find(o => o.choice === 'confirm');
      expect(confirmOption).toBeDefined();
      expect(confirmOption?.label).toContain('Image Generation');
    });

    it('should provide alternative options when available', () => {
      const intent: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.4,
        extractedParams: { kind: 'deep_research', query: 'test' },
        alternativeIntents: [
          { tool: 'chat_completion', confidence: 0.35 },
        ],
      };

      const options = getClarificationOptions(intent);

      const altOptions = options.filter(o => o.choice === 'alternative');
      expect(altOptions.length).toBe(1);
      expect(altOptions[0].label).toContain('Chat');
    });

    it('should provide clarify option', () => {
      const intent: ClassifiedIntent = {
        tool: 'chat_completion',
        confidence: 0.4,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };

      const options = getClarificationOptions(intent);

      const clarifyOption = options.find(o => o.choice === 'clarify');
      expect(clarifyOption).toBeDefined();
      expect(clarifyOption?.label).toContain('clarify');
    });

    it('should provide cancel option', () => {
      const intent: ClassifiedIntent = {
        tool: 'document_generation',
        confidence: 0.4,
        extractedParams: { kind: 'document_generation', type: 'pdf', contentDescription: 'test' },
      };

      const options = getClarificationOptions(intent);

      const cancelOption = options.find(o => o.choice === 'cancel');
      expect(cancelOption).toBeDefined();
      expect(cancelOption?.label).toContain('chat');
    });
  });

  describe('processClarificationChoice (REQ_006.5.4-7, REQ_006.5.13)', () => {
    const createState = (tool: ClassifiedIntent['tool'] = 'deep_research'): ClarificationState => ({
      intent: {
        tool,
        confidence: 0.4,
        extractedParams: tool === 'deep_research'
          ? { kind: 'deep_research', query: 'test' }
          : { kind: 'chat_completion', message: 'test' },
      },
      originalMessage: 'original message',
      createdAt: Date.now(),
      expiresAt: Date.now() + CLARIFICATION_TIMEOUT_MS,
    });

    it('should proceed with detected intent when user confirms (REQ_006.5.4)', async () => {
      const state = createState();
      const result = await processClarificationChoice('confirm', state);

      expect(result.action).toBe('proceed');
      expect(result.intent).toEqual(state.intent);
    });

    it('should reclassify with hint when user selects alternative (REQ_006.5.5)', async () => {
      const state = createState();
      const result = await processClarificationChoice('alternative', state, 'image_generation');

      expect(result.action).toBe('reclassify');
      expect(result.newMessage).toContain('[Use image_generation tool]');
      expect(result.newMessage).toContain('original message');
    });

    it('should reclassify with enhanced context when user clarifies (REQ_006.5.6)', async () => {
      const state = createState();
      const result = await processClarificationChoice('clarify', state, 'I want to search for information');

      expect(result.action).toBe('reclassify');
      expect(result.newMessage).toContain('original message');
      expect(result.newMessage).toContain('I want to search for information');
    });

    it('should fall back to chat_completion when user cancels (REQ_006.5.7)', async () => {
      const state = createState();
      const result = await processClarificationChoice('cancel', state);

      expect(result.action).toBe('chat');
      expect(result.intent?.tool).toBe('chat_completion');
      expect(result.intent?.confidence).toBe(1.0);
    });

    it('should clear state after processing', async () => {
      const state = createState();
      await processClarificationChoice('confirm', state);

      expect(mockStorage.removeItem).toHaveBeenCalledWith('pending_clarification');
    });
  });

  describe('Analytics (REQ_006.5.10)', () => {
    it('should track clarification events', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      trackClarificationEvent({
        originalIntent: 'deep_research',
        originalConfidence: 0.4,
        userChoice: 'confirm',
        finalIntent: 'deep_research',
        timestamp: Date.now(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ClarificationAnalytics]')
      );
    });

    it('should determine if clarification improved accuracy', () => {
      const original: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.4,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };

      // Higher confidence = improvement
      const higherConfidence: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.8,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };
      expect(didClarificationImproveAccuracy(original, higherConfidence)).toBe(true);

      // Different tool = improvement (user correction)
      const differentTool: ClassifiedIntent = {
        tool: 'chat_completion',
        confidence: 0.4,
        extractedParams: { kind: 'chat_completion', message: 'test' },
      };
      expect(didClarificationImproveAccuracy(original, differentTool)).toBe(true);

      // Same tool, same confidence = no improvement
      const same: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.4,
        extractedParams: { kind: 'deep_research', query: 'test' },
      };
      expect(didClarificationImproveAccuracy(original, same)).toBe(false);
    });
  });

  describe('Accessibility (REQ_006.5.14)', () => {
    it('should provide clear labels for all options', () => {
      const intent: ClassifiedIntent = {
        tool: 'deep_research',
        confidence: 0.4,
        extractedParams: { kind: 'deep_research', query: 'test' },
        alternativeIntents: [{ tool: 'chat_completion', confidence: 0.3 }],
      };

      const options = getClarificationOptions(intent);

      // All options should have non-empty labels and descriptions
      options.forEach(option => {
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.description.length).toBeGreaterThan(0);
      });
    });
  });
});
