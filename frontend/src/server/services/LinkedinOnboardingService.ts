import { createHash, randomBytes } from 'crypto';
import {
  VoiceUxMemoryStore,
  type LinkedInProfileSnapshot,
  type LinkedInTokenEnvelope,
} from '@/server/data_access_objects/VoiceUxMemoryStore';
import { VoiceUxDao } from '@/server/data_access_objects/VoiceUxDao';
import { VoiceUxErrors } from '@/server/error_definitions/VoiceUxErrors';

export type LinkedinInputMode = 'url' | 'manual' | 'oauth' | 'skip';

export interface LinkedinManualProfileInput {
  headline?: string;
  summary?: string;
  positions?: string[];
}

export interface ParseLinkedinInputRequest {
  userId: string;
  mode: Extract<LinkedinInputMode, 'url' | 'manual' | 'skip'>;
  url?: string;
  manualProfile?: LinkedinManualProfileInput;
}

export interface ParseLinkedinInputResponse {
  baselineId: string;
  mode: LinkedinInputMode;
  profile: LinkedInProfileSnapshot;
}

export interface StartLinkedinConnectResponse {
  authorizationUrl: string;
  state: string;
  nonce: string;
}

export interface CompleteLinkedinConnectRequest {
  userId: string;
  state: string;
  nonce: string;
  code: string;
}

export interface CompleteLinkedinConnectResponse {
  connectionStatus: 'connected';
  linkedinUserId: string;
  tokenStored: true;
}

export interface LinkedInAuthClient {
  exchangeCodeForToken(input: {
    code: string;
    state: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    refreshExpiresAt: string;
    linkedinUserId: string;
  }>;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function normalizeProfile(profile: LinkedinManualProfileInput | undefined): LinkedInProfileSnapshot {
  const positions = (profile?.positions ?? []).filter(position => position.trim() !== '');

  return {
    headline: profile?.headline?.trim() || null,
    summary: profile?.summary?.trim() || null,
    positions,
  };
}

function deriveMockProfileFromLinkedinUrl(url: string): LinkedInProfileSnapshot {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw VoiceUxErrors.linkedinUrlParseFailed('LinkedIn URL is malformed');
  }

  if (!parsedUrl.hostname.toLowerCase().includes('linkedin.com')) {
    throw VoiceUxErrors.linkedinUrlParseFailed('LinkedIn URL must be a linkedin.com domain');
  }

  const cleanedPath = parsedUrl.pathname.replace(/\/+$/, '');
  if (!cleanedPath || cleanedPath === '/') {
    throw VoiceUxErrors.linkedinUrlParseFailed('LinkedIn URL must include a profile path');
  }

  const profileSlug = cleanedPath.split('/').filter(Boolean).pop() ?? 'candidate';

  return {
    headline: `${profileSlug} profile`,
    summary: 'Imported from LinkedIn URL',
    positions: [],
    sourceUrl: parsedUrl.toString(),
  };
}

function generateOpaqueToken(): string {
  return randomBytes(24).toString('hex');
}

function encryptToken(rawToken: string): string {
  return `enc:${Buffer.from(rawToken, 'utf8').toString('base64')}`;
}

function buildTokenEnvelope(accessToken: string, refreshToken: string, expiresAt: string, refreshExpiresAt: string): LinkedInTokenEnvelope {
  return {
    ciphertext: encryptToken(accessToken),
    refreshCiphertext: encryptToken(refreshToken),
    keyId: 'voice-ux-local-key-v1',
    expiresAt,
    refreshExpiresAt,
    revokedAt: null,
  };
}

export function redactSensitiveTokens<T>(payload: T): T {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => redactSensitiveTokens(item)) as T;
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('authorization')
    ) {
      result[key] = '[REDACTED]';
      continue;
    }

    result[key] = redactSensitiveTokens(value);
  }

  return result as T;
}

class LocalLinkedInAuthClient implements LinkedInAuthClient {
  async exchangeCodeForToken(input: {
    code: string;
    state: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    refreshExpiresAt: string;
    linkedinUserId: string;
  }> {
    if (input.code.trim().toLowerCase() === 'deny') {
      throw VoiceUxErrors.oauthDenied();
    }

    const accessToken = `li_access_${generateOpaqueToken()}`;
    const refreshToken = `li_refresh_${generateOpaqueToken()}`;
    const hash = createHash('sha256').update(input.state).digest('hex').slice(0, 12);

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      linkedinUserId: `linkedin-${hash}`,
    };
  }
}

let linkedInAuthClient: LinkedInAuthClient = new LocalLinkedInAuthClient();

export const LinkedinOnboardingService = {
  setLinkedInAuthClientForTests(client: LinkedInAuthClient): void {
    linkedInAuthClient = client;
  },

  resetLinkedInAuthClientForTests(): void {
    linkedInAuthClient = new LocalLinkedInAuthClient();
  },

  async parseInput(request: ParseLinkedinInputRequest): Promise<ParseLinkedinInputResponse> {
    let profile: LinkedInProfileSnapshot;

    if (request.mode === 'url') {
      if (!request.url || request.url.trim() === '') {
        throw VoiceUxErrors.invalidRequest('LinkedIn URL is required when mode=url');
      }

      profile = deriveMockProfileFromLinkedinUrl(request.url);
    } else if (request.mode === 'manual') {
      const normalized = normalizeProfile(request.manualProfile);
      const hasAnyManualField =
        normalized.headline !== null ||
        normalized.summary !== null ||
        normalized.positions.length > 0;

      if (!hasAnyManualField) {
        throw VoiceUxErrors.invalidRequest('Manual LinkedIn profile fields cannot all be empty');
      }

      profile = normalized;
    } else {
      profile = {
        headline: null,
        summary: null,
        positions: [],
      };
    }

    const memoryRecord = VoiceUxMemoryStore.saveBaseline(request.userId, request.mode, profile);
    const persistedRecord = await VoiceUxDao.upsertCandidateProfileBaseline({
      userId: request.userId,
      mode: request.mode,
      profile,
    });
    const record = persistedRecord ?? memoryRecord;

    return {
      baselineId: record.id,
      mode: record.mode,
      profile: record.profile,
    };
  },

  async startOauthConnect(userId: string, redirectUri: string): Promise<StartLinkedinConnectResponse> {
    if (!redirectUri || redirectUri.trim() === '') {
      throw VoiceUxErrors.invalidRequest('redirectUri is required');
    }

    const state = generateOpaqueToken();
    const nonce = generateOpaqueToken();

    VoiceUxMemoryStore.storeOauthState(state, userId, nonce, OAUTH_STATE_TTL_MS);

    const authorizationUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', 'mock-linkedin-client');
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('scope', 'r_liteprofile r_emailaddress');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('nonce', nonce);

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      nonce,
    };
  },

  async completeOauthConnect(
    request: CompleteLinkedinConnectRequest,
  ): Promise<CompleteLinkedinConnectResponse> {
    const stateRecord = VoiceUxMemoryStore.consumeOauthState(request.state);

    if (!stateRecord) {
      throw VoiceUxErrors.oauthStateMismatch();
    }

    if (stateRecord.expiresAtMs < Date.now()) {
      throw VoiceUxErrors.oauthStateMismatch();
    }

    if (stateRecord.userId !== request.userId) {
      throw VoiceUxErrors.forbidden('OAuth callback user does not match the initiating user');
    }

    if (stateRecord.nonce !== request.nonce) {
      throw VoiceUxErrors.oauthNonceMismatch();
    }

    const tokenResponse = await linkedInAuthClient.exchangeCodeForToken({
      code: request.code,
      state: request.state,
    });

    const tokenEnvelope = buildTokenEnvelope(
      tokenResponse.accessToken,
      tokenResponse.refreshToken,
      tokenResponse.expiresAt,
      tokenResponse.refreshExpiresAt,
    );

    VoiceUxMemoryStore.saveConnection(request.userId, tokenResponse.linkedinUserId, tokenEnvelope);
    await VoiceUxDao.upsertLinkedinConnection({
      userId: request.userId,
      linkedinUserId: tokenResponse.linkedinUserId,
      tokenEnvelope,
    });

    const existingBaseline = VoiceUxMemoryStore.getBaselineForUser(request.userId);
    const baselineProfile = existingBaseline?.profile ?? {
      headline: null,
      summary: null,
      positions: [],
    };

    VoiceUxMemoryStore.saveBaseline(request.userId, 'oauth', baselineProfile);
    await VoiceUxDao.upsertCandidateProfileBaseline({
      userId: request.userId,
      mode: 'oauth',
      profile: baselineProfile,
    });

    return {
      connectionStatus: 'connected',
      linkedinUserId: tokenResponse.linkedinUserId,
      tokenStored: true,
    };
  },

  getRedactedConnection(userId: string): Record<string, unknown> | null {
    const connection = VoiceUxMemoryStore.getConnectionForUser(userId);
    if (!connection) {
      return null;
    }

    return redactSensitiveTokens(connection) as unknown as Record<string, unknown>;
  },
} as const;
