export type VoiceUxFeatureFlag =
  | 'voiceUx340'
  | 'voiceUx342'
  | 'voiceUx343'
  | 'voiceUx344'
  | 'voiceUx345';

const ENV_KEY_BY_FLAG: Record<VoiceUxFeatureFlag, string[]> = {
  voiceUx340: ['VOICE_UX_340', 'NEXT_PUBLIC_VOICE_UX_340'],
  voiceUx342: ['VOICE_UX_342', 'NEXT_PUBLIC_VOICE_UX_342'],
  voiceUx343: ['VOICE_UX_343', 'NEXT_PUBLIC_VOICE_UX_343'],
  voiceUx344: ['VOICE_UX_344', 'NEXT_PUBLIC_VOICE_UX_344'],
  voiceUx345: ['VOICE_UX_345', 'NEXT_PUBLIC_VOICE_UX_345'],
};

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled']);

export function isVoiceUxFeatureEnabled(
  flag: VoiceUxFeatureFlag,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const keys = ENV_KEY_BY_FLAG[flag];

  for (const key of keys) {
    const rawValue = env[key];
    if (rawValue === undefined) {
      continue;
    }

    return !DISABLED_VALUES.has(rawValue.trim().toLowerCase());
  }

  return true;
}
