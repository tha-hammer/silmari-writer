import { supabase } from '@/lib/supabase';
import type {
  CandidateProfileBaselineRecord,
  CompanyShortlistRecord,
  ContactSuggestionRecord,
  ContributionAreaRecord,
  LinkedInConnectionRecord,
  LinkedInProfileSnapshot,
  LinkedInTokenEnvelope,
  LinkedinDraftRecord,
  OutreachDraftRecord,
  ShortlistItemRecord,
} from '@/server/data_access_objects/VoiceUxMemoryStore';

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function isSupabaseNotConfiguredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Supabase client not initialized')
  );
}

function toBaselineRecord(row: Record<string, any>): CandidateProfileBaselineRecord {
  const manualProfile = (row.manual_profile ?? {}) as Record<string, unknown>;

  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    profile: {
      headline: (manualProfile.headline as string | undefined) ?? null,
      summary: (manualProfile.summary as string | undefined) ?? null,
      positions: Array.isArray(manualProfile.positions)
        ? manualProfile.positions.map(value => String(value))
        : [],
      sourceUrl: row.linkedin_profile_url ?? undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toShortlistItems(rows: Array<Record<string, any>>): ShortlistItemRecord[] {
  return rows
    .map(row => ({
      companyId: row.company_id,
      companyName: row.company_name,
      rank: row.rank,
    }))
    .sort((a, b) => a.rank - b.rank);
}

function toShortlistRecord(
  shortlist: Record<string, any>,
  items: Array<Record<string, any>>,
): CompanyShortlistRecord {
  return {
    id: shortlist.id,
    userId: shortlist.user_id,
    items: toShortlistItems(items),
    createdAt: shortlist.created_at,
    updatedAt: shortlist.updated_at,
  };
}

function toContributionRecords(rows: Array<Record<string, any>>): ContributionAreaRecord[] {
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    label: row.label,
    rationale: row.rationale ?? '',
    createdAt: row.created_at,
  }));
}

function toContactRecords(rows: Array<Record<string, any>>): ContactSuggestionRecord[] {
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    contactExternalId: row.contact_external_id,
    name: row.full_name ?? 'Unknown',
    title: row.title ?? 'Unknown',
    reason:
      typeof row.metadata?.reason === 'string'
        ? row.metadata.reason
        : 'Relevant to hiring conversation',
    createdAt: row.created_at,
  }));
}

function toOutreachDraftRecords(rows: Array<Record<string, any>>): OutreachDraftRecord[] {
  return rows
    .map(row => ({
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      contactId: row.contact_external_id,
      draftHash: row.draft_hash,
      content: row.content,
      createdAt: row.created_at,
    }))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

function toLinkedinDraftRecords(rows: Array<Record<string, any>>): LinkedinDraftRecord[] {
  return rows
    .map(row => ({
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      contributionAreaId: row.contribution_label,
      draftHash: row.draft_hash,
      content: row.content,
      createdAt: row.created_at,
    }))
    .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

export const VoiceUxDao = {
  async upsertCandidateProfileBaseline(input: {
    userId: string;
    mode: CandidateProfileBaselineRecord['mode'];
    profile: LinkedInProfileSnapshot;
  }): Promise<CandidateProfileBaselineRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('candidate_profile_baselines')
        .upsert(
          {
            user_id: input.userId,
            mode: input.mode,
            linkedin_profile_url: input.profile.sourceUrl ?? null,
            manual_profile: {
              headline: input.profile.headline,
              summary: input.profile.summary,
              positions: input.profile.positions,
            },
            updated_at: nowIso(),
          },
          { onConflict: 'user_id' },
        )
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return toBaselineRecord(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async findCandidateProfileBaselineByUser(userId: string): Promise<CandidateProfileBaselineRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('candidate_profile_baselines')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return toBaselineRecord(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async upsertLinkedinConnection(input: {
    userId: string;
    linkedinUserId: string;
    tokenEnvelope: LinkedInTokenEnvelope;
  }): Promise<LinkedInConnectionRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('linkedin_connections')
        .upsert(
          {
            user_id: input.userId,
            access_token_ciphertext: input.tokenEnvelope.ciphertext,
            refresh_token_ciphertext: input.tokenEnvelope.refreshCiphertext,
            key_id: input.tokenEnvelope.keyId,
            expires_at: input.tokenEnvelope.expiresAt,
            refresh_expires_at: input.tokenEnvelope.refreshExpiresAt,
            revoked_at: input.tokenEnvelope.revokedAt,
            updated_at: nowIso(),
          },
          { onConflict: 'user_id' },
        )
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        linkedinUserId: input.linkedinUserId,
        tokenEnvelope: {
          ciphertext: data.access_token_ciphertext,
          refreshCiphertext: data.refresh_token_ciphertext,
          keyId: data.key_id,
          expiresAt: data.expires_at,
          refreshExpiresAt: data.refresh_expires_at,
          revokedAt: data.revoked_at,
        },
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async upsertShortlist(input: {
    userId: string;
    items: ShortlistItemRecord[];
    shortlistId?: string;
  }): Promise<CompanyShortlistRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const shortlistPayload: Record<string, unknown> = {
        user_id: input.userId,
        name: 'default',
        source: 'mixed',
        updated_at: nowIso(),
      };

      if (input.shortlistId) {
        shortlistPayload.id = input.shortlistId;
      }

      const { data: shortlistData, error: shortlistError } = await supabase
        .from('company_shortlists')
        .upsert(shortlistPayload, {
          onConflict: input.shortlistId ? 'id' : 'user_id,name',
        })
        .select()
        .single();

      if (shortlistError || !shortlistData) {
        return null;
      }

      await supabase
        .from('shortlist_items')
        .delete()
        .eq('shortlist_id', shortlistData.id);

      const itemRows = input.items.map(item => ({
        shortlist_id: shortlistData.id,
        company_id: item.companyId,
        company_name: item.companyName,
        rank: item.rank,
        status: 'saved',
        updated_at: nowIso(),
      }));

      const { data: savedItems, error: itemError } = await supabase
        .from('shortlist_items')
        .insert(itemRows)
        .select('*');

      if (itemError || !savedItems) {
        return null;
      }

      return toShortlistRecord(shortlistData, savedItems);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async findShortlistById(shortlistId: string): Promise<CompanyShortlistRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data: shortlistData, error: shortlistError } = await supabase
        .from('company_shortlists')
        .select('*')
        .eq('id', shortlistId)
        .maybeSingle();

      if (shortlistError || !shortlistData) {
        return null;
      }

      const { data: itemRows, error: itemError } = await supabase
        .from('shortlist_items')
        .select('*')
        .eq('shortlist_id', shortlistId)
        .order('rank', { ascending: true });

      if (itemError || !itemRows) {
        return null;
      }

      return toShortlistRecord(shortlistData, itemRows);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async saveContributionAreas(input: {
    userId: string;
    companyId: string;
    areas: Array<{ label: string; rationale: string }>;
  }): Promise<ContributionAreaRecord[] | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const rows = input.areas.map(area => ({
        user_id: input.userId,
        company_id: input.companyId,
        label: area.label,
        rationale: area.rationale,
        updated_at: nowIso(),
      }));

      const { data, error } = await supabase
        .from('company_contribution_areas')
        .upsert(rows, { onConflict: 'user_id,company_id,label' })
        .select('*');

      if (error || !data) {
        return null;
      }

      return toContributionRecords(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async listContributionAreas(userId: string, companyId: string): Promise<ContributionAreaRecord[] | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('company_contribution_areas')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return null;
      }

      return toContributionRecords(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async saveContacts(input: {
    userId: string;
    companyId: string;
    contacts: Array<{ contactExternalId: string; name: string; title: string; reason: string }>;
  }): Promise<ContactSuggestionRecord[] | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const rows = input.contacts.map(contact => ({
        user_id: input.userId,
        company_id: input.companyId,
        contact_external_id: contact.contactExternalId,
        full_name: contact.name,
        title: contact.title,
        metadata: { reason: contact.reason },
        updated_at: nowIso(),
      }));

      const { data, error } = await supabase
        .from('company_contact_suggestions')
        .upsert(rows, { onConflict: 'user_id,company_id,contact_external_id' })
        .select('*');

      if (error || !data) {
        return null;
      }

      return toContactRecords(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async listContacts(userId: string, companyId: string): Promise<ContactSuggestionRecord[] | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('company_contact_suggestions')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return null;
      }

      return toContactRecords(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async saveOutreachDraft(input: {
    userId: string;
    companyId: string;
    contactId: string | null;
    draftHash: string;
    content: string;
  }): Promise<OutreachDraftRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('outreach_drafts')
        .insert({
          user_id: input.userId,
          company_id: input.companyId,
          contact_external_id: input.contactId,
          draft_hash: input.draftHash,
          content: input.content,
          metadata: {},
          updated_at: nowIso(),
        })
        .select('*')
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        companyId: data.company_id,
        contactId: data.contact_external_id,
        draftHash: data.draft_hash,
        content: data.content,
        createdAt: data.created_at,
      };
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async listOutreachDrafts(userId: string, companyId: string): Promise<OutreachDraftRecord[] | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('outreach_drafts')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return null;
      }

      return toOutreachDraftRecords(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async saveLinkedinDraft(input: {
    userId: string;
    companyId: string;
    contributionLabel: string | null;
    draftHash: string;
    content: string;
  }): Promise<LinkedinDraftRecord | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('linkedin_post_drafts')
        .insert({
          user_id: input.userId,
          company_id: input.companyId,
          contribution_label: input.contributionLabel,
          draft_hash: input.draftHash,
          content: input.content,
          metadata: { manualPostOnly: true },
          updated_at: nowIso(),
        })
        .select('*')
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        companyId: data.company_id,
        contributionAreaId: data.contribution_label,
        draftHash: data.draft_hash,
        content: data.content,
        createdAt: data.created_at,
      };
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },

  async listLinkedinDrafts(userId: string, companyId: string): Promise<LinkedinDraftRecord[] | null> {
    if (!hasSupabaseConfig()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('linkedin_post_drafts')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return null;
      }

      return toLinkedinDraftRecords(data);
    } catch (error) {
      if (isSupabaseNotConfiguredError(error)) {
        return null;
      }

      return null;
    }
  },
};
