import { createHash } from 'crypto';

export type LinkedinInputMode = 'url' | 'manual' | 'oauth' | 'skip';

export interface LinkedInProfileSnapshot {
  headline: string | null;
  summary: string | null;
  positions: string[];
  sourceUrl?: string;
}

export interface CandidateProfileBaselineRecord {
  id: string;
  userId: string;
  mode: LinkedinInputMode;
  profile: LinkedInProfileSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedInTokenEnvelope {
  ciphertext: string;
  refreshCiphertext: string;
  keyId: string;
  expiresAt: string;
  refreshExpiresAt: string;
  revokedAt: string | null;
}

export interface LinkedInConnectionRecord {
  id: string;
  userId: string;
  linkedinUserId: string;
  tokenEnvelope: LinkedInTokenEnvelope;
  createdAt: string;
  updatedAt: string;
}

export interface ShortlistItemRecord {
  companyId: string;
  companyName: string;
  rank: number;
}

export interface CompanyShortlistRecord {
  id: string;
  userId: string;
  items: ShortlistItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ContributionAreaRecord {
  id: string;
  userId: string;
  companyId: string;
  label: string;
  rationale: string;
  createdAt: string;
}

export interface ContactSuggestionRecord {
  id: string;
  userId: string;
  companyId: string;
  contactExternalId: string;
  name: string;
  title: string;
  reason: string;
  createdAt: string;
}

export interface OutreachDraftRecord {
  id: string;
  userId: string;
  companyId: string;
  contactId: string | null;
  draftHash: string;
  content: string;
  createdAt: string;
}

export interface LinkedinDraftRecord {
  id: string;
  userId: string;
  companyId: string;
  contributionAreaId: string | null;
  draftHash: string;
  content: string;
  createdAt: string;
}

interface OAuthStateRecord {
  userId: string;
  nonce: string;
  expiresAtMs: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function hashDraft(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function cloneShortlistItems(items: ShortlistItemRecord[]): ShortlistItemRecord[] {
  return items
    .map(item => ({ ...item }))
    .sort((a, b) => a.rank - b.rank)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

const baselineByUser = new Map<string, CandidateProfileBaselineRecord>();
const connectionByUser = new Map<string, LinkedInConnectionRecord>();
const oauthStateByState = new Map<string, OAuthStateRecord>();
const shortlistById = new Map<string, CompanyShortlistRecord>();
const shortlistIdByUser = new Map<string, string>();
const contributionsByCompany = new Map<string, ContributionAreaRecord[]>();
const contactsByCompany = new Map<string, ContactSuggestionRecord[]>();
const outreachDraftsByCompany = new Map<string, OutreachDraftRecord[]>();
const linkedinDraftsByCompany = new Map<string, LinkedinDraftRecord[]>();

function companyKey(userId: string, companyId: string): string {
  return `${userId}:${companyId}`;
}

export const VoiceUxMemoryStore = {
  reset(): void {
    baselineByUser.clear();
    connectionByUser.clear();
    oauthStateByState.clear();
    shortlistById.clear();
    shortlistIdByUser.clear();
    contributionsByCompany.clear();
    contactsByCompany.clear();
    outreachDraftsByCompany.clear();
    linkedinDraftsByCompany.clear();
  },

  saveBaseline(
    userId: string,
    mode: LinkedinInputMode,
    profile: LinkedInProfileSnapshot,
  ): CandidateProfileBaselineRecord {
    const existing = baselineByUser.get(userId);
    const timestamp = nowIso();

    const record: CandidateProfileBaselineRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      userId,
      mode,
      profile,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    baselineByUser.set(userId, record);
    return record;
  },

  getBaselineForUser(userId: string): CandidateProfileBaselineRecord | null {
    return baselineByUser.get(userId) ?? null;
  },

  storeOauthState(state: string, userId: string, nonce: string, ttlMs: number): void {
    oauthStateByState.set(state, {
      userId,
      nonce,
      expiresAtMs: Date.now() + ttlMs,
    });
  },

  consumeOauthState(state: string): OAuthStateRecord | null {
    const record = oauthStateByState.get(state) ?? null;
    oauthStateByState.delete(state);
    return record;
  },

  saveConnection(
    userId: string,
    linkedinUserId: string,
    tokenEnvelope: LinkedInTokenEnvelope,
  ): LinkedInConnectionRecord {
    const existing = connectionByUser.get(userId);
    const timestamp = nowIso();

    const record: LinkedInConnectionRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      userId,
      linkedinUserId,
      tokenEnvelope,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    connectionByUser.set(userId, record);
    return record;
  },

  getConnectionForUser(userId: string): LinkedInConnectionRecord | null {
    return connectionByUser.get(userId) ?? null;
  },

  saveShortlist(
    userId: string,
    items: ShortlistItemRecord[],
    shortlistId?: string,
  ): CompanyShortlistRecord {
    const resolvedShortlistId = shortlistId ?? shortlistIdByUser.get(userId) ?? crypto.randomUUID();
    const existing = shortlistById.get(resolvedShortlistId);
    const timestamp = nowIso();

    const record: CompanyShortlistRecord = {
      id: resolvedShortlistId,
      userId,
      items: cloneShortlistItems(items),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    shortlistById.set(resolvedShortlistId, record);
    shortlistIdByUser.set(userId, resolvedShortlistId);
    return record;
  },

  getShortlistById(shortlistId: string): CompanyShortlistRecord | null {
    return shortlistById.get(shortlistId) ?? null;
  },

  getLatestShortlistForUser(userId: string): CompanyShortlistRecord | null {
    const shortlistId = shortlistIdByUser.get(userId);
    if (!shortlistId) {
      return null;
    }

    return shortlistById.get(shortlistId) ?? null;
  },

  saveContributionAreas(
    userId: string,
    companyId: string,
    areas: Array<{ label: string; rationale: string }>,
  ): ContributionAreaRecord[] {
    const key = companyKey(userId, companyId);
    const createdAt = nowIso();
    const records = areas.map(area => ({
      id: crypto.randomUUID(),
      userId,
      companyId,
      label: area.label,
      rationale: area.rationale,
      createdAt,
    }));

    contributionsByCompany.set(key, records);
    return records;
  },

  getContributionAreas(userId: string, companyId: string): ContributionAreaRecord[] {
    return contributionsByCompany.get(companyKey(userId, companyId)) ?? [];
  },

  saveContactSuggestions(
    userId: string,
    companyId: string,
    contacts: Array<{ contactExternalId: string; name: string; title: string; reason: string }>,
  ): ContactSuggestionRecord[] {
    const key = companyKey(userId, companyId);
    const createdAt = nowIso();
    const records = contacts.map(contact => ({
      id: crypto.randomUUID(),
      userId,
      companyId,
      contactExternalId: contact.contactExternalId,
      name: contact.name,
      title: contact.title,
      reason: contact.reason,
      createdAt,
    }));

    contactsByCompany.set(key, records);
    return records;
  },

  getContactSuggestions(userId: string, companyId: string): ContactSuggestionRecord[] {
    return contactsByCompany.get(companyKey(userId, companyId)) ?? [];
  },

  saveOutreachDraft(
    userId: string,
    companyId: string,
    contactId: string | null,
    content: string,
  ): OutreachDraftRecord {
    const key = companyKey(userId, companyId);
    const record: OutreachDraftRecord = {
      id: crypto.randomUUID(),
      userId,
      companyId,
      contactId,
      draftHash: hashDraft(content),
      content,
      createdAt: nowIso(),
    };

    const existing = outreachDraftsByCompany.get(key) ?? [];
    outreachDraftsByCompany.set(key, [...existing, record]);
    return record;
  },

  getOutreachDrafts(userId: string, companyId: string): OutreachDraftRecord[] {
    return outreachDraftsByCompany.get(companyKey(userId, companyId)) ?? [];
  },

  saveLinkedinDraft(
    userId: string,
    companyId: string,
    contributionAreaId: string | null,
    content: string,
  ): LinkedinDraftRecord {
    const key = companyKey(userId, companyId);
    const record: LinkedinDraftRecord = {
      id: crypto.randomUUID(),
      userId,
      companyId,
      contributionAreaId,
      draftHash: hashDraft(content),
      content,
      createdAt: nowIso(),
    };

    const existing = linkedinDraftsByCompany.get(key) ?? [];
    linkedinDraftsByCompany.set(key, [...existing, record]);
    return record;
  },

  getLinkedinDrafts(userId: string, companyId: string): LinkedinDraftRecord[] {
    return linkedinDraftsByCompany.get(companyKey(userId, companyId)) ?? [];
  },
};

export function __resetVoiceUxMemoryStoreForTests(): void {
  VoiceUxMemoryStore.reset();
}
