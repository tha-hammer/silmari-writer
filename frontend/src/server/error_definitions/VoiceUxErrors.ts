export type VoiceUxErrorCode =
  | 'FEATURE_DISABLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'LINKEDIN_URL_PARSE_FAILED'
  | 'OAUTH_STATE_MISMATCH'
  | 'OAUTH_NONCE_MISMATCH'
  | 'OAUTH_DENIED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INTERNAL_ERROR';

export class VoiceUxError extends Error {
  code: VoiceUxErrorCode;
  statusCode: number;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: VoiceUxErrorCode,
    statusCode: number,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'VoiceUxError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.details = details;
  }
}

export const VoiceUxErrors = {
  featureDisabled: (flag: string) =>
    new VoiceUxError(`Feature flag '${flag}' is disabled`, 'FEATURE_DISABLED', 404, false),

  unauthorized: (message = 'Missing or empty authorization header') =>
    new VoiceUxError(message, 'UNAUTHORIZED', 401, false),

  forbidden: (message = 'You do not have access to this resource') =>
    new VoiceUxError(message, 'FORBIDDEN', 403, false),

  invalidRequest: (message = 'Invalid request payload') =>
    new VoiceUxError(message, 'INVALID_REQUEST', 400, false),

  notFound: (message = 'Resource not found') =>
    new VoiceUxError(message, 'NOT_FOUND', 404, false),

  linkedinUrlParseFailed: (message = 'Unable to parse LinkedIn URL') =>
    new VoiceUxError(
      message,
      'LINKEDIN_URL_PARSE_FAILED',
      422,
      false,
      { fallbackOptions: ['manual', 'oauth', 'skip'] },
    ),

  oauthStateMismatch: () =>
    new VoiceUxError('OAuth callback state is invalid', 'OAUTH_STATE_MISMATCH', 400, false),

  oauthNonceMismatch: () =>
    new VoiceUxError('OAuth callback nonce is invalid', 'OAUTH_NONCE_MISMATCH', 400, false),

  oauthDenied: () =>
    new VoiceUxError('OAuth authorization was denied', 'OAUTH_DENIED', 400, false),

  timeout: (message = 'Operation timed out') =>
    new VoiceUxError(message, 'TIMEOUT', 200, true),

  cancelled: (message = 'Operation cancelled') =>
    new VoiceUxError(message, 'CANCELLED', 200, false),

  internal: (message = 'Unexpected internal error') =>
    new VoiceUxError(message, 'INTERNAL_ERROR', 500, true),
} as const;
