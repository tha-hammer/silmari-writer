import {
  type NewPathEventName,
  type NewPathEventPayload,
  validateNewPathEvent,
} from '@/server/data_structures/NewPathEvents';
import {
  type TypedTelemetryGatewayOptions,
  TypedTelemetryGateway,
} from './TypedTelemetryGateway';
import { logger } from './logger';

const PATH = '340-345-observability-contract';
const RESOURCE = 'cfg-r3d7';

export const newPathEventLogger = {
  validate: validateNewPathEvent,

  async emit<T extends NewPathEventName>(
    eventName: T,
    payload: NewPathEventPayload<T>,
    options?: TypedTelemetryGatewayOptions,
  ): Promise<{ ok: boolean }> {
    const result = await TypedTelemetryGateway.emit(eventName, payload, options);

    if (!result.ok) {
      logger.warn('New-path telemetry emission failed_non_blocking', {
        path: PATH,
        resource: RESOURCE,
        eventName,
        sink: result.sink,
      });
    }

    return { ok: result.ok };
  },
} as const;

