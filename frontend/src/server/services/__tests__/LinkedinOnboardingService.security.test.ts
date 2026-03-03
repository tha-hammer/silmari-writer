import { beforeEach, describe, expect, it } from 'vitest';
import { __resetVoiceUxMemoryStoreForTests } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { VoiceUxError } from '@/server/error_definitions/VoiceUxErrors';
import { LinkedinOnboardingService } from '../LinkedinOnboardingService';

describe('LinkedinOnboardingService security', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    LinkedinOnboardingService.resetLinkedInAuthClientForTests();
  });

  it('rejects OAuth callback with nonce mismatch', async () => {
    const started = await LinkedinOnboardingService.startOauthConnect(
      'user-test-1',
      'https://app.example.com/callback',
    );

    await expect(
      LinkedinOnboardingService.completeOauthConnect({
        userId: 'user-test-1',
        state: started.state,
        nonce: 'wrong-nonce',
        code: 'good-code',
      }),
    ).rejects.toMatchObject({
      code: 'OAUTH_NONCE_MISMATCH',
      statusCode: 400,
    } satisfies Partial<VoiceUxError>);
  });

  it('stores token envelope server-side and exposes only redacted connection data', async () => {
    const started = await LinkedinOnboardingService.startOauthConnect(
      'user-test-2',
      'https://app.example.com/callback',
    );

    const callback = await LinkedinOnboardingService.completeOauthConnect({
      userId: 'user-test-2',
      state: started.state,
      nonce: started.nonce,
      code: 'valid-code',
    });

    expect(callback.tokenStored).toBe(true);

    const redacted = LinkedinOnboardingService.getRedactedConnection('user-test-2');
    const serialized = JSON.stringify(redacted);

    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('li_access_');
    expect(serialized).not.toContain('li_refresh_');
  });
});
