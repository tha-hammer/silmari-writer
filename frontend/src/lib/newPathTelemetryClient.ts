import { frontendLogger } from '@/logging';
import {
  type NewPathEventName,
  type NewPathEventPayload,
  type NewPathEventPayloadMap,
  validateNewPathEvent,
} from '@/server/data_structures/NewPathEvents';

const DEFAULT_ENDPOINT = '/api/telemetry/new-path-events';

type FetchFn = typeof fetch;
type SendBeaconFn = (url: string, data?: BodyInit | null) => boolean;

interface TelemetryClientOptions {
  endpoint?: string;
  fetchImpl?: FetchFn;
}

interface AbandonmentClientOptions extends TelemetryClientOptions {
  sendBeaconImpl?: SendBeaconFn;
}

function buildSerializedEvent<T extends NewPathEventName>(
  eventName: T,
  payload: NewPathEventPayload<T>,
): string {
  const validated = validateNewPathEvent(eventName, payload);
  const enrichedPayload = {
    ...validated,
    timestamp: validated.timestamp ?? new Date().toISOString(),
  };

  return JSON.stringify({
    event_name: eventName,
    payload: enrichedPayload,
  });
}

export async function emitNewPathClientEvent<T extends NewPathEventName>(
  eventName: T,
  payload: NewPathEventPayloadMap[T],
  options?: TelemetryClientOptions,
): Promise<boolean> {
  const endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

  if (!fetchImpl) {
    frontendLogger.warn('No fetch implementation available for telemetry emit', {
      module: 'newPathTelemetryClient',
      eventName,
    });
    return false;
  }

  try {
    const body = buildSerializedEvent(eventName, payload);
    await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
    return true;
  } catch (error) {
    frontendLogger.warn('New-path telemetry emit failed_non_blocking', {
      module: 'newPathTelemetryClient',
      eventName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function emitInterstitialAbandonmentEvent(
  payload: NewPathEventPayload<'interstitial_abandonment'>,
  options?: AbandonmentClientOptions,
): Promise<'beacon' | 'fetch' | 'dropped'> {
  const endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;
  const body = buildSerializedEvent('interstitial_abandonment', payload);

  const sendBeaconImpl = options?.sendBeaconImpl
    ?? (
      typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
        ? navigator.sendBeacon.bind(navigator)
        : undefined
    );

  if (sendBeaconImpl) {
    try {
      const beaconPayload = new Blob([body], { type: 'application/json' });
      const beaconAccepted = sendBeaconImpl(endpoint, beaconPayload);
      if (beaconAccepted) {
        return 'beacon';
      }
    } catch (error) {
      frontendLogger.warn('sendBeacon failed for interstitial abandonment telemetry', {
        module: 'newPathTelemetryClient',
        eventName: 'interstitial_abandonment',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fetchSent = await emitNewPathClientEvent(
    'interstitial_abandonment',
    payload,
    options,
  );
  return fetchSent ? 'fetch' : 'dropped';
}

