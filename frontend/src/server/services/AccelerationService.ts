import {
  VoiceUxMemoryStore,
  type CompanyShortlistRecord,
  type ContactSuggestionRecord,
  type ContributionAreaRecord,
  type LinkedinDraftRecord,
  type OutreachDraftRecord,
  type ShortlistItemRecord,
} from '@/server/data_access_objects/VoiceUxMemoryStore';
import { VoiceUxDao } from '@/server/data_access_objects/VoiceUxDao';
import { VoiceUxErrors, VoiceUxError } from '@/server/error_definitions/VoiceUxErrors';
import { logger } from '@/server/logging/logger';
import { createHash } from 'crypto';

interface TimeoutOrCancelledResult {
  degraded: true;
  reason: 'timeout' | 'cancelled';
}

interface SuccessfulResult<T> {
  degraded: false;
  reason: null;
  data: T;
}

type TimedResult<T> = TimeoutOrCancelledResult | SuccessfulResult<T>;

export interface CompanyDiscoveryClient {
  generateShortlist(input: {
    baselineSummary: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<Array<{ companyId: string; companyName: string }>>;

  generateContributionAreas(input: {
    companyId: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<Array<{ label: string; rationale: string }>>;

  suggestContacts(input: {
    companyId: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<Array<{ contactExternalId: string; name: string; title: string; reason: string }>>;

  generateOutreachDraft(input: {
    companyId: string;
    contactName?: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<{ content: string }>;

  generateLinkedinDraft(input: {
    companyId: string;
    contributionLabel?: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<{ content: string }>;
}

interface ShortlistGenerateRequest {
  userId: string;
  baselineId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  simulateDelayMs?: number;
}

interface ShortlistSaveRequest {
  userId: string;
  shortlistId?: string;
  items: ShortlistItemRecord[];
}

interface ScopedRequest {
  userId: string;
  shortlistId: string;
  companyId: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  simulateDelayMs?: number;
}

interface OutreachRequest extends ScopedRequest {
  contactId?: string;
}

interface LinkedinDraftRequest extends ScopedRequest {
  contributionAreaId?: string;
}

export interface ShortlistResponse {
  shortlistId: string | null;
  items: ShortlistItemRecord[];
  generated: boolean;
  saved: boolean;
  degraded: boolean;
  reason: 'timeout' | 'cancelled' | 'missing_baseline' | null;
  manualEntryRequired: boolean;
}

export interface ContributionResponse {
  companyId: string;
  contributionAreas: ContributionAreaRecord[];
  degraded: boolean;
  reason: 'timeout' | 'cancelled' | null;
}

export interface ContactsResponse {
  companyId: string;
  contacts: ContactSuggestionRecord[];
  degraded: boolean;
  reason: 'timeout' | 'cancelled' | null;
}

export interface OutreachResponse {
  companyId: string;
  draft: {
    id: string;
    content: string;
    status: 'completed';
  } | null;
  degraded: boolean;
  reason: 'timeout' | 'cancelled' | null;
}

export interface LinkedinDraftResponse {
  companyId: string;
  draft: {
    id: string;
    content: string;
    status: 'completed';
    manualPostOnly: true;
  } | null;
  manualPostReminder: string;
  degraded: boolean;
  reason: 'timeout' | 'cancelled' | null;
}

class LocalCompanyDiscoveryClient implements CompanyDiscoveryClient {
  private async maybeDelay(ms: number | undefined, signal: AbortSignal): Promise<void> {
    const delayMs = ms ?? 0;
    if (delayMs <= 0) {
      if (signal.aborted) {
        throw VoiceUxErrors.cancelled();
      }

      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(resolve, delayMs);

      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(VoiceUxErrors.cancelled());
      };

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async generateShortlist(input: {
    baselineSummary: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<Array<{ companyId: string; companyName: string }>> {
    await this.maybeDelay(input.simulateDelayMs, input.signal);

    const seed = input.baselineSummary.trim() || 'candidate';

    return [
      { companyId: `${seed}-1`, companyName: 'Stripe' },
      { companyId: `${seed}-2`, companyName: 'Notion' },
      { companyId: `${seed}-3`, companyName: 'Figma' },
    ];
  }

  async generateContributionAreas(input: {
    companyId: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<Array<{ label: string; rationale: string }>> {
    await this.maybeDelay(input.simulateDelayMs, input.signal);

    return [
      {
        label: 'Developer productivity',
        rationale: `Based on ${input.companyId} engineering platform maturity signals.`,
      },
      {
        label: 'Reliability and incident prevention',
        rationale: `Aligned with ${input.companyId} public uptime and trust posture.`,
      },
    ];
  }

  async suggestContacts(input: {
    companyId: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<Array<{ contactExternalId: string; name: string; title: string; reason: string }>> {
    await this.maybeDelay(input.simulateDelayMs, input.signal);

    return [
      {
        contactExternalId: `${input.companyId}-hm-1`,
        name: 'Taylor Morgan',
        title: 'Engineering Manager',
        reason: 'Likely hiring manager for backend and platform roles.',
      },
      {
        contactExternalId: `${input.companyId}-rec-1`,
        name: 'Jordan Casey',
        title: 'Technical Recruiter',
        reason: 'Owns initial candidate pipeline for software roles.',
      },
    ];
  }

  async generateOutreachDraft(input: {
    companyId: string;
    contactName?: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<{ content: string }> {
    await this.maybeDelay(input.simulateDelayMs, input.signal);

    const contactLine = input.contactName ? `Hi ${input.contactName},` : 'Hi there,';

    return {
      content: `${contactLine}\n\nI am exploring opportunities at ${input.companyId} and would appreciate a quick chat about where reliability work is most needed.\n\nBest,\nCandidate`,
    };
  }

  async generateLinkedinDraft(input: {
    companyId: string;
    contributionLabel?: string;
    signal: AbortSignal;
    simulateDelayMs?: number;
  }): Promise<{ content: string }> {
    await this.maybeDelay(input.simulateDelayMs, input.signal);

    const focus = input.contributionLabel ?? 'engineering outcomes';

    return {
      content: `I have been studying ${input.companyId} and where I can contribute around ${focus}. Sharing a short breakdown of the impact areas I am most excited about.`,
    };
  }
}

let companyDiscoveryClient: CompanyDiscoveryClient = new LocalCompanyDiscoveryClient();

function toShortlistItems(companies: Array<{ companyId: string; companyName: string }>): ShortlistItemRecord[] {
  return companies.map((company, index) => ({
    companyId: company.companyId,
    companyName: company.companyName,
    rank: index + 1,
  }));
}

async function runWithTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<TimedResult<T>> {
  const controller = new AbortController();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutTriggered = false;

  const cleanupListeners: Array<() => void> = [];

  const abortWith = (reason: 'timeout' | 'cancelled') => {
    if (controller.signal.aborted) {
      return;
    }

    controller.abort(reason);
  };

  timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    abortWith('timeout');
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortWith('cancelled');
    }

    const onExternalAbort = () => {
      abortWith('cancelled');
    };

    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    cleanupListeners.push(() => externalSignal.removeEventListener('abort', onExternalAbort));
  }

  try {
    const data = await operation(controller.signal);

    if (controller.signal.aborted) {
      if (timeoutTriggered || controller.signal.reason === 'timeout') {
        return { degraded: true, reason: 'timeout' };
      }

      return { degraded: true, reason: 'cancelled' };
    }

    return { degraded: false, reason: null, data };
  } catch (error) {
    if (error instanceof VoiceUxError && error.code === 'CANCELLED') {
      if (timeoutTriggered || controller.signal.reason === 'timeout') {
        return { degraded: true, reason: 'timeout' };
      }

      return { degraded: true, reason: 'cancelled' };
    }

    if (controller.signal.aborted) {
      if (timeoutTriggered || controller.signal.reason === 'timeout') {
        return { degraded: true, reason: 'timeout' };
      }

      return { degraded: true, reason: 'cancelled' };
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    for (const cleanup of cleanupListeners) {
      cleanup();
    }
  }
}

function buildDraftHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function loadBaselineForUser(userId: string) {
  const persisted = await VoiceUxDao.findCandidateProfileBaselineByUser(userId);
  if (persisted) {
    return persisted;
  }

  return VoiceUxMemoryStore.getBaselineForUser(userId);
}

async function requireUserOwnedShortlist(
  userId: string,
  shortlistId: string,
): Promise<CompanyShortlistRecord> {
  const persisted = await VoiceUxDao.findShortlistById(shortlistId);
  const shortlist = persisted ?? VoiceUxMemoryStore.getShortlistById(shortlistId);
  if (!shortlist) {
    throw VoiceUxErrors.notFound('Shortlist not found');
  }

  if (shortlist.userId !== userId) {
    throw VoiceUxErrors.forbidden('Shortlist is not owned by the authenticated user');
  }

  if (persisted) {
    VoiceUxMemoryStore.saveShortlist(userId, persisted.items, persisted.id);
  }

  return shortlist;
}

function assertCompanyInShortlist(shortlist: CompanyShortlistRecord, companyId: string): void {
  const exists = shortlist.items.some(item => item.companyId === companyId);

  if (!exists) {
    throw VoiceUxErrors.notFound('Company not found in shortlist');
  }
}

function safeTimeout(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export const AccelerationService = {
  setCompanyDiscoveryClientForTests(client: CompanyDiscoveryClient): void {
    companyDiscoveryClient = client;
  },

  resetCompanyDiscoveryClientForTests(): void {
    companyDiscoveryClient = new LocalCompanyDiscoveryClient();
  },

  async generateShortlist(request: ShortlistGenerateRequest): Promise<ShortlistResponse> {
    const baseline = await loadBaselineForUser(request.userId);

    if (!baseline) {
      return {
        shortlistId: null,
        items: [],
        generated: false,
        saved: false,
        degraded: true,
        reason: 'missing_baseline',
        manualEntryRequired: true,
      };
    }

    if (request.baselineId && baseline.id !== request.baselineId) {
      throw VoiceUxErrors.forbidden('Requested baseline does not belong to the authenticated user');
    }

    const timed = await runWithTimeout(
      safeTimeout(request.timeoutMs, 8000),
      signal =>
        companyDiscoveryClient.generateShortlist({
          baselineSummary:
            baseline.profile.summary ?? baseline.profile.headline ?? 'candidate experience',
          signal,
          simulateDelayMs: request.simulateDelayMs,
        }),
      request.signal,
    );

    if (timed.degraded) {
      logger.warn('shortlist generation degraded', {
        reason: timed.reason,
        userId: request.userId,
      });

      const existingShortlist =
        VoiceUxMemoryStore.getLatestShortlistForUser(request.userId);
      return {
        shortlistId: existingShortlist?.id ?? null,
        items: existingShortlist?.items ?? [],
        generated: false,
        saved: false,
        degraded: true,
        reason: timed.reason,
        manualEntryRequired: true,
      };
    }

    const memoryShortlist = VoiceUxMemoryStore.saveShortlist(
      request.userId,
      toShortlistItems(timed.data),
    );
    const persistedShortlist = await VoiceUxDao.upsertShortlist({
      userId: request.userId,
      shortlistId: memoryShortlist.id,
      items: memoryShortlist.items,
    });
    const shortlist = persistedShortlist ?? memoryShortlist;

    return {
      shortlistId: shortlist.id,
      items: shortlist.items,
      generated: true,
      saved: true,
      degraded: false,
      reason: null,
      manualEntryRequired: false,
    };
  },

  async saveShortlist(request: ShortlistSaveRequest): Promise<ShortlistResponse> {
    if (request.items.length === 0) {
      throw VoiceUxErrors.invalidRequest('At least one shortlist item is required');
    }

    if (request.shortlistId) {
      const existing =
        (await VoiceUxDao.findShortlistById(request.shortlistId)) ??
        VoiceUxMemoryStore.getShortlistById(request.shortlistId);
      if (existing && existing.userId !== request.userId) {
        throw VoiceUxErrors.forbidden('Cannot modify another user\'s shortlist');
      }
    }

    const memoryShortlist = VoiceUxMemoryStore.saveShortlist(
      request.userId,
      request.items,
      request.shortlistId,
    );
    const persistedShortlist = await VoiceUxDao.upsertShortlist({
      userId: request.userId,
      shortlistId: memoryShortlist.id,
      items: memoryShortlist.items,
    });
    const shortlist = persistedShortlist ?? memoryShortlist;

    return {
      shortlistId: shortlist.id,
      items: shortlist.items,
      generated: false,
      saved: true,
      degraded: false,
      reason: null,
      manualEntryRequired: false,
    };
  },

  async generateContributionAreas(request: ScopedRequest): Promise<ContributionResponse> {
    const shortlist = await requireUserOwnedShortlist(request.userId, request.shortlistId);
    assertCompanyInShortlist(shortlist, request.companyId);

    const timed = await runWithTimeout(
      safeTimeout(request.timeoutMs, 10000),
      signal =>
        companyDiscoveryClient.generateContributionAreas({
          companyId: request.companyId,
          signal,
          simulateDelayMs: request.simulateDelayMs,
        }),
      request.signal,
    );

    if (timed.degraded) {
      const persistedAreas = await VoiceUxDao.listContributionAreas(
        request.userId,
        request.companyId,
      );
      return {
        companyId: request.companyId,
        contributionAreas:
          persistedAreas ??
          VoiceUxMemoryStore.getContributionAreas(request.userId, request.companyId),
        degraded: true,
        reason: timed.reason,
      };
    }

    const memoryContributionAreas = VoiceUxMemoryStore.saveContributionAreas(
      request.userId,
      request.companyId,
      timed.data,
    );
    const persistedContributionAreas = await VoiceUxDao.saveContributionAreas({
      userId: request.userId,
      companyId: request.companyId,
      areas: timed.data,
    });
    const contributionAreas = persistedContributionAreas ?? memoryContributionAreas;

    return {
      companyId: request.companyId,
      contributionAreas,
      degraded: false,
      reason: null,
    };
  },

  async suggestContacts(request: ScopedRequest): Promise<ContactsResponse> {
    const shortlist = await requireUserOwnedShortlist(request.userId, request.shortlistId);
    assertCompanyInShortlist(shortlist, request.companyId);

    const timed = await runWithTimeout(
      safeTimeout(request.timeoutMs, 10000),
      signal =>
        companyDiscoveryClient.suggestContacts({
          companyId: request.companyId,
          signal,
          simulateDelayMs: request.simulateDelayMs,
        }),
      request.signal,
    );

    if (timed.degraded) {
      const persistedContacts = await VoiceUxDao.listContacts(
        request.userId,
        request.companyId,
      );
      return {
        companyId: request.companyId,
        contacts:
          persistedContacts ??
          VoiceUxMemoryStore.getContactSuggestions(request.userId, request.companyId),
        degraded: true,
        reason: timed.reason,
      };
    }

    const memoryContacts = VoiceUxMemoryStore.saveContactSuggestions(
      request.userId,
      request.companyId,
      timed.data,
    );
    const persistedContacts = await VoiceUxDao.saveContacts({
      userId: request.userId,
      companyId: request.companyId,
      contacts: timed.data,
    });
    const contacts = persistedContacts ?? memoryContacts;

    return {
      companyId: request.companyId,
      contacts,
      degraded: false,
      reason: null,
    };
  },

  async generateOutreachDraft(request: OutreachRequest): Promise<OutreachResponse> {
    const shortlist = await requireUserOwnedShortlist(request.userId, request.shortlistId);
    assertCompanyInShortlist(shortlist, request.companyId);

    const availableContacts =
      (await VoiceUxDao.listContacts(request.userId, request.companyId)) ??
      VoiceUxMemoryStore.getContactSuggestions(request.userId, request.companyId);
    const contact = availableContacts.find(item => item.id === request.contactId);

    const timed = await runWithTimeout(
      safeTimeout(request.timeoutMs, 12000),
      signal =>
        companyDiscoveryClient.generateOutreachDraft({
          companyId: request.companyId,
          contactName: contact?.name,
          signal,
          simulateDelayMs: request.simulateDelayMs,
        }),
      request.signal,
    );

    if (timed.degraded) {
      const existingDraft =
        (
          await VoiceUxDao.listOutreachDrafts(
            request.userId,
            request.companyId,
          )
        )?.at(-1) ??
        VoiceUxMemoryStore.getOutreachDrafts(request.userId, request.companyId).at(-1);
      return {
        companyId: request.companyId,
        draft: existingDraft
          ? { id: existingDraft.id, content: existingDraft.content, status: 'completed' }
          : null,
        degraded: true,
        reason: timed.reason,
      };
    }

    const memoryDraft = VoiceUxMemoryStore.saveOutreachDraft(
      request.userId,
      request.companyId,
      request.contactId ?? null,
      timed.data.content,
    );
    const persistedDraft = await VoiceUxDao.saveOutreachDraft({
      userId: request.userId,
      companyId: request.companyId,
      contactId: request.contactId ?? null,
      draftHash: buildDraftHash(timed.data.content),
      content: timed.data.content,
    });
    const draft = persistedDraft ?? memoryDraft;

    return {
      companyId: request.companyId,
      draft: {
        id: draft.id,
        content: draft.content,
        status: 'completed',
      },
      degraded: false,
      reason: null,
    };
  },

  async generateLinkedinDraft(request: LinkedinDraftRequest): Promise<LinkedinDraftResponse> {
    const shortlist = await requireUserOwnedShortlist(request.userId, request.shortlistId);
    assertCompanyInShortlist(shortlist, request.companyId);

    let contributionLabel: string | undefined;
    if (request.contributionAreaId) {
      const contributionAreas =
        (await VoiceUxDao.listContributionAreas(request.userId, request.companyId)) ??
        VoiceUxMemoryStore.getContributionAreas(request.userId, request.companyId);
      const area = contributionAreas.find(item => item.id === request.contributionAreaId);
      contributionLabel = area?.label;
    }

    const timed = await runWithTimeout(
      safeTimeout(request.timeoutMs, 12000),
      signal =>
        companyDiscoveryClient.generateLinkedinDraft({
          companyId: request.companyId,
          contributionLabel,
          signal,
          simulateDelayMs: request.simulateDelayMs,
        }),
      request.signal,
    );

    if (timed.degraded) {
      const existingDraft =
        (
          await VoiceUxDao.listLinkedinDrafts(
            request.userId,
            request.companyId,
          )
        )?.at(-1) ??
        VoiceUxMemoryStore.getLinkedinDrafts(request.userId, request.companyId).at(-1);
      return {
        companyId: request.companyId,
        draft: existingDraft
          ? {
              id: existingDraft.id,
              content: existingDraft.content,
              status: 'completed',
              manualPostOnly: true,
            }
          : null,
        manualPostReminder: 'Manual post only. Copy and publish from your own LinkedIn account.',
        degraded: true,
        reason: timed.reason,
      };
    }

    const memoryDraft = VoiceUxMemoryStore.saveLinkedinDraft(
      request.userId,
      request.companyId,
      request.contributionAreaId ?? null,
      timed.data.content,
    );
    const persistedDraft = await VoiceUxDao.saveLinkedinDraft({
      userId: request.userId,
      companyId: request.companyId,
      contributionLabel: contributionLabel ?? request.contributionAreaId ?? null,
      draftHash: buildDraftHash(timed.data.content),
      content: timed.data.content,
    });
    const draft = persistedDraft ?? memoryDraft;

    return {
      companyId: request.companyId,
      draft: {
        id: draft.id,
        content: draft.content,
        status: 'completed',
        manualPostOnly: true,
      },
      manualPostReminder: 'Manual post only. Copy and publish from your own LinkedIn account.',
      degraded: false,
      reason: null,
    };
  },
} as const;

export function __resetAccelerationServiceForTests(): void {
  AccelerationService.resetCompanyDiscoveryClientForTests();
}
