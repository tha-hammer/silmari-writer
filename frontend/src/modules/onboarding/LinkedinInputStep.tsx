'use client';

import { useState } from 'react';

interface ParseResult {
  ok: boolean;
  message?: string;
  fallbackOptions?: Array<'manual' | 'oauth' | 'skip'>;
}

interface ManualProfileInput {
  headline?: string;
  summary?: string;
}

export interface LinkedinInputStepProps {
  onUrlSubmit?: (url: string) => Promise<ParseResult>;
  onManualSubmit?: (profile: ManualProfileInput) => Promise<void>;
  onOauthStart?: () => Promise<void>;
  onSkip?: () => Promise<void>;
}

async function defaultUrlSubmit(url: string): Promise<ParseResult> {
  const response = await fetch('/api/onboarding/linkedin/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'url', url }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      message: payload.message ?? 'Failed to parse LinkedIn URL',
      fallbackOptions: payload.fallbackOptions,
    };
  }

  return { ok: true };
}

async function defaultManualSubmit(profile: ManualProfileInput): Promise<void> {
  const response = await fetch('/api/onboarding/linkedin/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'manual', manualProfile: profile }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Failed to save manual LinkedIn profile');
  }
}

async function defaultSkip(): Promise<void> {
  const response = await fetch('/api/onboarding/linkedin/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'skip' }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? 'Failed to skip LinkedIn step');
  }
}

export default function LinkedinInputStep({
  onUrlSubmit = defaultUrlSubmit,
  onManualSubmit = defaultManualSubmit,
  onOauthStart = async () => {},
  onSkip = defaultSkip,
}: LinkedinInputStepProps) {
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [url, setUrl] = useState('');
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackOptions, setFallbackOptions] = useState<Array<'manual' | 'oauth' | 'skip'>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleUrlSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await onUrlSubmit(url);
      if (result.ok) {
        setFallbackOptions([]);
        setStatusMessage('LinkedIn URL parsed successfully');
        return;
      }

      setFallbackOptions(result.fallbackOptions ?? ['manual', 'oauth', 'skip']);
      setError(result.message ?? 'Failed to parse LinkedIn URL');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to parse LinkedIn URL';
      setFallbackOptions(['manual', 'oauth', 'skip']);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      await onManualSubmit({ headline, summary });
      setStatusMessage('Manual LinkedIn profile saved');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to save manual profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      await onSkip();
      setStatusMessage('LinkedIn step skipped');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to skip LinkedIn step';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOauthStart = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      await onOauthStart();
      setStatusMessage('OAuth flow started');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to start OAuth flow';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" data-testid="linkedin-input-step">
      <h2 className="text-lg font-semibold">LinkedIn Profile</h2>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('url')}>
          Use URL
        </button>
        <button type="button" onClick={() => setMode('manual')}>
          Enter manually
        </button>
      </div>

      {mode === 'url' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="linkedin-url">LinkedIn URL</label>
          <input
            id="linkedin-url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/your-profile"
          />
          <button type="button" onClick={handleUrlSubmit} disabled={isLoading}>
            Parse LinkedIn URL
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="headline">Headline</label>
          <input
            id="headline"
            value={headline}
            onChange={event => setHeadline(event.target.value)}
            placeholder="Principal Backend Engineer"
          />
          <label htmlFor="summary">Summary</label>
          <textarea
            id="summary"
            value={summary}
            onChange={event => setSummary(event.target.value)}
            placeholder="Short professional summary"
          />
          <button type="button" onClick={handleManualSubmit} disabled={isLoading}>
            Save manual profile
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={handleOauthStart} disabled={isLoading}>
          Connect with LinkedIn
        </button>
        <button type="button" onClick={handleSkip} disabled={isLoading}>
          Skip for now
        </button>
      </div>

      {fallbackOptions.length > 0 && (
        <div role="status" aria-live="polite" className="text-sm">
          <p>URL parsing failed. Try one of these options:</p>
          <ul>
            {fallbackOptions.includes('manual') && <li>Manual profile entry</li>}
            {fallbackOptions.includes('oauth') && <li>LinkedIn OAuth connect</li>}
            {fallbackOptions.includes('skip') && <li>Skip and continue onboarding</li>}
          </ul>
        </div>
      )}

      {statusMessage && (
        <p role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
