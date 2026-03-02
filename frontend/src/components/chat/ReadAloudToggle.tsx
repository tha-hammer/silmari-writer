'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useConversationStore } from '@/lib/store';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { VOICE_MODES } from '@/lib/voice-types';

export default function ReadAloudToggle() {
  const { readAloudEnabled, setReadAloud } = useConversationStore();
  const { connect, disconnect, sessionState } = useRealtimeSession();

  const isConnecting = sessionState === 'connecting';

  const handleToggle = () => {
    if (readAloudEnabled) {
      setReadAloud(false);
      disconnect();
    } else {
      setReadAloud(true);
      connect(VOICE_MODES.READ_ALOUD);
    }
  };

  return (
    <Button
      onClick={handleToggle}
      disabled={isConnecting}
      aria-pressed={readAloudEnabled}
      aria-label="Read Aloud"
      variant={readAloudEnabled ? 'default' : 'secondary'}
      size="sm"
      className={cn(isConnecting && 'cursor-not-allowed')}
    >
      {readAloudEnabled ? (
        <Volume2 className="h-4 w-4" />
      ) : (
        <VolumeX className="h-4 w-4" />
      )}
      Read Aloud
    </Button>
  );
}
