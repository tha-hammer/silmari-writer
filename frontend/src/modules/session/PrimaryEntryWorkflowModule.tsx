'use client';

import { useMemo, useState } from 'react';
import AccelerationModule, {
  type ContactSuggestionView,
  type ContributionAreaView,
  type OutreachDraftView,
} from '@/modules/acceleration/AccelerationModule';
import LinkedinPlanningModule, {
  type LinkedinPlanningDraft,
} from '@/modules/linkedin/LinkedinPlanningModule';
import LinkedinInputStep from '@/modules/onboarding/LinkedinInputStep';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type EntryStage = 'resume' | 'linkedin' | 'acceleration' | 'planning';

interface ShortlistItem {
  companyId: string;
  companyName: string;
}

interface LinkedinParseResponse {
  baselineId: string;
}

interface ShortlistResponse {
  shortlistId: string | null;
  items: ShortlistItem[];
}

interface ContributionResponse {
  contributionAreas: Array<{
    id: string;
    label: string;
    rationale: string;
  }>;
}

interface ContactsResponse {
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    reason: string;
  }>;
}

interface OutreachResponse {
  draft: OutreachDraftView | null;
}

interface LinkedinDraftResponse {
  draft: LinkedinPlanningDraft | null;
}

function resolveAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storageCandidate = window.localStorage as unknown as {
    getItem?: (_key: string) => string | null;
  };
  const stored =
    typeof storageCandidate.getItem === 'function'
      ? storageCandidate.getItem('authToken')?.trim()
      : null;
  if (stored) {
    return stored;
  }

  return 'dev-session-token';
}

export interface PrimaryEntryWorkflowModuleProps {
  sessionId: string;
  onCompleted: () => void;
}

export function PrimaryEntryWorkflowModule({
  sessionId,
  onCompleted,
}: PrimaryEntryWorkflowModuleProps) {
  const [stage, setStage] = useState<EntryStage>('resume');
  const [resumeText, setResumeText] = useState('');
  const [resumeReady, setResumeReady] = useState(false);
  const [linkedinReady, setLinkedinReady] = useState(false);
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [shortlistId, setShortlistId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contributionAreaId, setContributionAreaId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authToken = useMemo(() => resolveAuthToken(), []);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const postJson = async <T,>(url: string, body: Record<string, unknown>): Promise<T> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const message =
        typeof payload.message === 'string'
          ? payload.message
          : `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload as T;
  };

  const handleUploadResume = () => {
    const normalized = resumeText.trim();
    if (!normalized) {
      setErrorMessage('Resume content is required before continuing.');
      return;
    }

    setResumeReady(true);
    setErrorMessage(null);
    setStatusMessage('Resume uploaded. Continue to LinkedIn onboarding.');
    setStage('linkedin');
  };

  const handleLinkedinUrlSubmit = async (url: string) => {
    try {
      const result = await postJson<LinkedinParseResponse>(
        '/api/onboarding/linkedin/parse',
        { mode: 'url', url },
      );
      setBaselineId(result.baselineId);
      setLinkedinReady(true);
      setErrorMessage(null);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse LinkedIn URL';
      const fallbackOptions: Array<'manual' | 'oauth' | 'skip'> = ['manual', 'oauth', 'skip'];
      return {
        ok: false,
        message,
        fallbackOptions,
      };
    }
  };

  const handleLinkedinManualSubmit = async (manualProfile: {
    headline?: string;
    summary?: string;
  }) => {
    const result = await postJson<LinkedinParseResponse>(
      '/api/onboarding/linkedin/parse',
      { mode: 'manual', manualProfile },
    );
    setBaselineId(result.baselineId);
    setLinkedinReady(true);
    setErrorMessage(null);
  };

  const handleLinkedinOauthStart = async () => {
    const redirectUri =
      typeof window !== 'undefined'
        ? `${window.location.origin}/session/${sessionId}`
        : 'http://localhost/session/callback';

    await postJson<{ authorizationUrl: string }>(
      '/api/onboarding/linkedin/connect/start',
      { redirectUri },
    );

    setLinkedinReady(true);
    setStatusMessage('LinkedIn OAuth flow initiated.');
    setErrorMessage(null);
  };

  const handleLinkedinSkip = async () => {
    const result = await postJson<LinkedinParseResponse>(
      '/api/onboarding/linkedin/parse',
      { mode: 'skip' },
    );
    setBaselineId(result.baselineId);
    setLinkedinReady(true);
    setErrorMessage(null);
  };

  const handleGenerateShortlist = async () => {
    const response = await postJson<ShortlistResponse>(
      '/api/acceleration/shortlist',
      { action: 'generate', baselineId: baselineId ?? undefined },
    );

    const primary = response.items[0];
    setShortlistId(response.shortlistId);
    setCompanyId(primary?.companyId ?? null);
    setStatusMessage(primary ? `Selected company: ${primary.companyName}` : 'Shortlist generated.');
    setErrorMessage(null);
  };

  const requireAccelerationContext = () => {
    if (!shortlistId || !companyId) {
      throw new Error('Generate shortlist before using acceleration tools.');
    }
    return { shortlistId, companyId };
  };

  const loadContributionAreas = async (): Promise<ContributionAreaView[]> => {
    const context = requireAccelerationContext();
    const response = await postJson<ContributionResponse>(
      '/api/acceleration/contribution',
      {
        shortlistId: context.shortlistId,
        companyId: context.companyId,
      },
    );

    setContributionAreaId(response.contributionAreas[0]?.id ?? null);
    return response.contributionAreas.map((area) => ({
      id: area.id,
      label: area.label,
      rationale: area.rationale,
    }));
  };

  const loadContacts = async (): Promise<ContactSuggestionView[]> => {
    const context = requireAccelerationContext();
    const response = await postJson<ContactsResponse>(
      '/api/acceleration/contacts',
      {
        shortlistId: context.shortlistId,
        companyId: context.companyId,
      },
    );

    return response.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      reason: contact.reason,
    }));
  };

  const generateOutreach = async (_companyId: string, contactId?: string): Promise<OutreachDraftView> => {
    const context = requireAccelerationContext();
    const response = await postJson<OutreachResponse>(
      '/api/acceleration/outreach',
      {
        shortlistId: context.shortlistId,
        companyId: context.companyId,
        contactId,
      },
    );

    if (!response.draft) {
      throw new Error('Outreach draft was not generated.');
    }

    return response.draft;
  };

  const generateLinkedinDraft = async (): Promise<LinkedinPlanningDraft> => {
    const context = requireAccelerationContext();
    const response = await postJson<LinkedinDraftResponse>(
      '/api/linkedin/drafts',
      {
        shortlistId: context.shortlistId,
        companyId: context.companyId,
        contributionAreaId: contributionAreaId ?? undefined,
      },
    );

    if (!response.draft) {
      throw new Error('LinkedIn draft was not generated.');
    }

    return response.draft;
  };

  return (
    <Card data-testid="primary-entry-workflow" className="border-border/70 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Primary Entry Workflow</CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete onboarding, acceleration, and LinkedIn planning before interview recall.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {stage === 'resume' && (
          <section className="space-y-2" data-testid="resume-gate">
            <h3 className="font-medium">Resume Check</h3>
            <p className="text-sm text-muted-foreground">
              Upload resume context to unlock the rest of the session entry flow.
            </p>
            <label htmlFor="resume-content" className="text-sm">Resume content</label>
            <textarea
              id="resume-content"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste your resume text"
            />
            <Button type="button" onClick={handleUploadResume}>
              Upload resume
            </Button>
            <p data-testid="resume-status" className="text-sm">
              Resume present: {resumeReady ? 'yes' : 'no'}
            </p>
          </section>
        )}

        {stage === 'linkedin' && (
          <section className="space-y-3" data-testid="linkedin-stage">
            <LinkedinInputStep
              onUrlSubmit={handleLinkedinUrlSubmit}
              onManualSubmit={handleLinkedinManualSubmit}
              onOauthStart={handleLinkedinOauthStart}
              onSkip={handleLinkedinSkip}
            />
            <Button
              type="button"
              onClick={() => setStage('acceleration')}
              disabled={!linkedinReady}
            >
              Continue to acceleration
            </Button>
          </section>
        )}

        {stage === 'acceleration' && (
          <section className="space-y-3" data-testid="acceleration-stage">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void handleGenerateShortlist()}>
                Generate shortlist
              </Button>
              {companyId && (
                <p data-testid="shortlist-selected-company" className="text-sm">
                  Active company: {companyId}
                </p>
              )}
            </div>

            <AccelerationModule
              companyId={companyId ?? 'pending-company'}
              onLoadContributionAreas={async () => loadContributionAreas()}
              onLoadContacts={async () => loadContacts()}
              onGenerateOutreach={generateOutreach}
            />

            <Button
              type="button"
              onClick={() => setStage('planning')}
              disabled={!shortlistId || !companyId}
            >
              Continue to LinkedIn planning
            </Button>
          </section>
        )}

        {stage === 'planning' && (
          <section className="space-y-3" data-testid="linkedin-planning-stage">
            <LinkedinPlanningModule onGenerateDraft={generateLinkedinDraft} />
            <Button type="button" onClick={onCompleted}>
              Continue to interview
            </Button>
          </section>
        )}

        {statusMessage && <p role="status">{statusMessage}</p>}
        {errorMessage && <p role="alert">{errorMessage}</p>}
      </CardContent>
    </Card>
  );
}

export default PrimaryEntryWorkflowModule;
