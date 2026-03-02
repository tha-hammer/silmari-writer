'use client';

import { Mic, Square, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVoiceEdit } from '@/hooks/useVoiceEdit';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { useConversationStore } from '@/lib/store';
import VoiceSessionTimer from './VoiceSessionTimer';

export default function VoiceEditPanel() {
  const { startEditing, stopEditing, undo } = useVoiceEdit();
  const { sessionState, timeRemaining } = useRealtimeSession();
  const { editHistory } = useConversationStore();

  const isActive = sessionState === 'connected';
  const isConnecting = sessionState === 'connecting';
  const hasEdits = (editHistory?.edits.length ?? 0) > 0;

  if (!isActive && !isConnecting) {
    return (
      <Button
        onClick={() => {
          void startEditing();
        }}
        aria-label="Voice Edit"
        variant="secondary"
        size="sm"
      >
        <Mic className="h-4 w-4" />
        Voice Edit
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <VoiceSessionTimer timeRemaining={timeRemaining} />

      <Button
        onClick={undo}
        disabled={!hasEdits}
        aria-label="Undo"
        variant="ghost"
        size="sm"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </Button>

      <Button
        onClick={stopEditing}
        aria-label="Stop"
        variant="destructive"
        size="sm"
      >
        <Square className="h-3.5 w-3.5" />
        Stop
      </Button>

      {isConnecting && (
        <Badge variant="outline" className="animate-pulse text-muted-foreground">
          Connecting...
        </Badge>
      )}
    </div>
  );
}
