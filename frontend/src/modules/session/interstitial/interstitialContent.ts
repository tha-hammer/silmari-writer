export type InterstitialType =
  | 'after_ingestion'
  | 'before_voice_recall'
  | 'before_verification_draft';

export interface InterstitialContent {
  title: string;
  message: string;
  why: string;
  stepLabel: string;
  progressPercent: number;
}

export const INTERSTITIAL_CONTENT: Record<InterstitialType, InterstitialContent> = {
  after_ingestion: {
    title: 'Preparing your session',
    message: 'We are reading the application context so you do not need to rewrite your story from scratch.',
    why: 'This reduces rewrite anxiety and keeps momentum.',
    stepLabel: 'Context ingestion',
    progressPercent: 25,
  },
  before_voice_recall: {
    title: 'Setting up voice recall',
    message: 'Strong interview answers combine clear actions, measurable impact, and context.',
    why: 'We will guide you to all three so your answer stays specific and credible.',
    stepLabel: 'Voice recall',
    progressPercent: 55,
  },
  before_verification_draft: {
    title: 'Preparing verification and draft',
    message: 'We only draft from confirmed details to avoid generic AI language and protect credibility.',
    why: 'This keeps your answer truthful and interview-ready.',
    stepLabel: 'Verification to draft',
    progressPercent: 80,
  },
};

export const FALLBACK_INTERSTITIAL_CONTENT: InterstitialContent = {
  title: 'Moving to the next step',
  message: 'Please hold on while we prepare the next stage.',
  why: 'This keeps your workflow moving forward.',
  stepLabel: 'In progress',
  progressPercent: 50,
};

export function getInterstitialContent(type: InterstitialType): InterstitialContent {
  return INTERSTITIAL_CONTENT[type] ?? FALLBACK_INTERSTITIAL_CONTENT;
}

