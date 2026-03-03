'use client';

import { useState } from 'react';
import ArtifactCopyButton from '@/components/ArtifactCopyButton';

export interface ContributionAreaView {
  id: string;
  label: string;
  rationale: string;
}

export interface ContactSuggestionView {
  id: string;
  name: string;
  title: string;
  reason: string;
}

export interface OutreachDraftView {
  id: string;
  content: string;
  status: 'completed';
}

export interface AccelerationModuleProps {
  companyId: string;
  onLoadContributionAreas: (companyId: string) => Promise<ContributionAreaView[]>;
  onLoadContacts: (companyId: string) => Promise<ContactSuggestionView[]>;
  onGenerateOutreach: (companyId: string, contactId?: string) => Promise<OutreachDraftView>;
}

export default function AccelerationModule({
  companyId,
  onLoadContributionAreas,
  onLoadContacts,
  onGenerateOutreach,
}: AccelerationModuleProps) {
  const [contributions, setContributions] = useState<ContributionAreaView[]>([]);
  const [contacts, setContacts] = useState<ContactSuggestionView[]>([]);
  const [outreachDraft, setOutreachDraft] = useState<OutreachDraftView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContributions = async () => {
    setError(null);
    try {
      const data = await onLoadContributionAreas(companyId);
      setContributions(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load contributions');
    }
  };

  const loadContacts = async () => {
    setError(null);
    try {
      const data = await onLoadContacts(companyId);
      setContacts(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load contacts');
    }
  };

  const generateOutreach = async () => {
    setError(null);
    try {
      const firstContactId = contacts[0]?.id;
      const draft = await onGenerateOutreach(companyId, firstContactId);
      setOutreachDraft(draft);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to generate outreach draft');
    }
  };

  return (
    <section className="flex flex-col gap-3" data-testid="acceleration-module">
      <h2 className="text-lg font-semibold">Company Acceleration</h2>
      <p data-testid="selected-company">Company: {companyId}</p>

      <div className="flex gap-2">
        <button type="button" onClick={loadContributions}>
          Load contribution areas
        </button>
        <button type="button" onClick={loadContacts}>
          Load contacts
        </button>
        <button type="button" onClick={generateOutreach}>
          Generate outreach draft
        </button>
      </div>

      <ul data-testid="contribution-list">
        {contributions.map(item => (
          <li key={item.id}>{item.label}: {item.rationale}</li>
        ))}
      </ul>

      <ul data-testid="contacts-list">
        {contacts.map(item => (
          <li key={item.id}>{item.name} - {item.title}</li>
        ))}
      </ul>

      {outreachDraft && (
        <article data-testid="outreach-draft">
          <p>{outreachDraft.content}</p>
          <ArtifactCopyButton
            artifactType="outreach"
            content={outreachDraft.content}
            status={outreachDraft.status}
          />
        </article>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
