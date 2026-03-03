import { InitializeSessionService } from '@/server/services/InitializeSessionService';
import { ChannelIngestionErrors } from '@/server/error_definitions/ChannelIngestionErrors';

interface ChannelInitInput {
  userId: string;
  sourceUrl: string;
  channel: 'email' | 'sms' | 'direct';
}

interface ChannelInitResult {
  id: string;
  state: 'initialized';
  contextSummary: string;
}

export const ChannelIngestionPipelineAdapter = {
  async initializeFromUrl(input: ChannelInitInput): Promise<ChannelInitResult> {
    let host = 'unknown-source';
    try {
      host = new URL(input.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      // Keep fallback host text.
    }

    try {
      const initialized = await InitializeSessionService.createSession({
        resume: {
          content: `Channel-ingested profile context for user ${input.userId}.`,
          name: 'Channel Ingestion Baseline',
          wordCount: 6,
        },
        job: {
          title: `Imported role from ${host}`,
          description: `Role details ingested from ${input.sourceUrl}`,
          sourceType: 'link',
          sourceValue: input.sourceUrl,
        },
        question: {
          text: 'Describe a high-impact project relevant to this opportunity.',
        },
      });

      return {
        id: initialized.id,
        state: 'initialized',
        contextSummary:
          input.channel === 'direct'
            ? `Context extracted from ${host} (direct URL).`
            : `Context extracted from ${host} (${input.channel}).`,
      };
    } catch (error) {
      throw ChannelIngestionErrors.PipelineInitFailed(
        `Channel initialization pipeline failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  },
} as const;
