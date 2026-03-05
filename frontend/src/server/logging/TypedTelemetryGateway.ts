import {
  type NewPathEventName,
  type NewPathEventPayload,
  validateNewPathEvent,
} from '@/server/data_structures/NewPathEvents';
import { logger } from './logger';

export type TelemetrySink = 'analytics_events' | 'primary_kpi_events' | 'ingestion_messages';

type PersistEventFn = (eventName: string, payload: Record<string, unknown>) => Promise<void>;

export interface TypedTelemetryGatewayOptions {
  sinks?: Partial<Record<TelemetrySink, PersistEventFn>>;
}

const EVENT_SINK_MAP: Record<NewPathEventName, TelemetrySink> = {
  artifact_copied_to_clipboard: 'analytics_events',
  interstitial_shown: 'analytics_events',
  interstitial_dismissed_or_continued: 'analytics_events',
  interstitial_abandonment: 'analytics_events',
  recall_greeting_shown: 'analytics_events',
  recall_stop_state_presented: 'analytics_events',
  recall_move_on_intent: 'analytics_events',
  recall_move_on_blocked: 'analytics_events',
  recall_move_on_advanced: 'analytics_events',
  recall_working_answer_saved: 'analytics_events',
  recall_turn_persisted: 'analytics_events',
  recall_turn_recovered: 'analytics_events',
};

const noopSink: PersistEventFn = async () => {};

function getSink(
  sink: TelemetrySink,
  options?: TypedTelemetryGatewayOptions,
): PersistEventFn {
  return options?.sinks?.[sink] ?? noopSink;
}

export const TypedTelemetryGateway = {
  resolveSink(eventName: NewPathEventName): TelemetrySink {
    return EVENT_SINK_MAP[eventName];
  },

  async emit<T extends NewPathEventName>(
    eventName: T,
    payload: unknown,
    options?: TypedTelemetryGatewayOptions,
  ): Promise<{ ok: boolean; sink: TelemetrySink; payload: NewPathEventPayload<T> }> {
    const validatedPayload = validateNewPathEvent(eventName, payload);
    const enrichedPayload = {
      ...validatedPayload,
      timestamp: validatedPayload.timestamp ?? new Date().toISOString(),
    } as NewPathEventPayload<T>;
    const sink = this.resolveSink(eventName);

    try {
      const sinkWriter = getSink(sink, options);
      await sinkWriter(eventName, enrichedPayload as Record<string, unknown>);
      return { ok: true, sink, payload: enrichedPayload };
    } catch (error) {
      logger.error('Typed telemetry sink write failed', error, {
        path: '340-345-observability-contract',
        resource: 'cfg-r3d7',
        eventName,
        sink,
      });

      return { ok: false, sink, payload: enrichedPayload };
    }
  },
} as const;
