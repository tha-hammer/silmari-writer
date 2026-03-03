'use client';

import { useState } from 'react';
import ArtifactCopyButton from '@/components/ArtifactCopyButton';

export interface LinkedinPlanningDraft {
  id: string;
  content: string;
  status: 'completed';
  manualPostOnly: true;
}

export interface LinkedinPlanningModuleProps {
  onGenerateDraft: () => Promise<LinkedinPlanningDraft>;
}

export default function LinkedinPlanningModule({
  onGenerateDraft,
}: LinkedinPlanningModuleProps) {
  const [draft, setDraft] = useState<LinkedinPlanningDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const generated = await onGenerateDraft();
      setDraft(generated);
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate LinkedIn draft';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-3" data-testid="linkedin-planning-module">
      <h2 className="text-lg font-semibold">LinkedIn Content Planning</h2>
      <p className="text-sm" data-testid="manual-post-guard">
        Manual-post-only safeguard: copy this draft and post manually from your own LinkedIn account.
      </p>

      <button type="button" onClick={handleGenerate} disabled={isLoading}>
        Generate LinkedIn draft
      </button>

      {draft && (
        <article className="rounded border p-3" data-testid="linkedin-draft">
          <p>{draft.content}</p>
          <ArtifactCopyButton
            artifactType="linkedin_post"
            content={draft.content}
            status={draft.status}
          />
        </article>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
