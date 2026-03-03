import { beforeEach, describe, expect, it } from 'vitest';
import { __resetVoiceUxMemoryStoreForTests, VoiceUxMemoryStore } from '@/server/data_access_objects/VoiceUxMemoryStore';
import { AccelerationService, __resetAccelerationServiceForTests } from '../AccelerationService';

describe('AccelerationService timeout and cancellation', () => {
  beforeEach(() => {
    __resetVoiceUxMemoryStoreForTests();
    __resetAccelerationServiceForTests();

    VoiceUxMemoryStore.saveBaseline('user-test-1', 'manual', {
      headline: 'Backend engineer',
      summary: 'Distributed systems',
      positions: ['Engineer'],
    });

    VoiceUxMemoryStore.saveShortlist('user-test-1', [
      { companyId: 'company-1', companyName: 'Acme', rank: 1 },
    ]);
  });

  it('returns degraded shortlist response when generation times out', async () => {
    const result = await AccelerationService.generateShortlist({
      userId: 'user-test-1',
      timeoutMs: 20,
      simulateDelayMs: 120,
    });

    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('timeout');
    expect(result.manualEntryRequired).toBe(true);
  });

  it('returns degraded response when contribution generation is cancelled', async () => {
    const shortlist = VoiceUxMemoryStore.getLatestShortlistForUser('user-test-1');
    expect(shortlist).not.toBeNull();

    const abortController = new AbortController();
    const pending = AccelerationService.generateContributionAreas({
      userId: 'user-test-1',
      shortlistId: shortlist!.id,
      companyId: 'company-1',
      timeoutMs: 1000,
      simulateDelayMs: 120,
      signal: abortController.signal,
    });

    abortController.abort();

    const result = await pending;
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('cancelled');
  });
});
