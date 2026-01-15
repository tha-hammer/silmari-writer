/**
 * Core type definitions for the writing agent UI
 */

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transcription API types
 */

export interface TranscriptionOptions {
  language?: string;        // ISO 639-1 code (e.g., 'en', 'es')
  prompt?: string;          // Context hint for Whisper
  temperature?: number;     // 0-1, sampling temperature
}

export type TranscriptionErrorCode = 'RATE_LIMIT' | 'FILE_TOO_LARGE' | 'NETWORK' | 'INVALID_API_KEY' | 'API_ERROR';

export class TranscriptionError extends Error {
  code: TranscriptionErrorCode;
  retryable: boolean;

  constructor(message: string, code: TranscriptionErrorCode, retryable: boolean = false) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Attachment for messages (files, images, etc.)
 */
export interface Attachment {
  id: string;
  filename: string;
  size: number;
  type: string;
}

/**
 * Message in a conversation
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}
