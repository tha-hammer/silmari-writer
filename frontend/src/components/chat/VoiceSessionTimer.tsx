import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

interface VoiceSessionTimerProps {
  timeRemaining: number | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTimerColor(seconds: number): string {
  if (seconds <= 60) return 'text-red-500';
  if (seconds <= 300) return 'text-yellow-500';
  return 'text-muted-foreground';
}

export default function VoiceSessionTimer({ timeRemaining }: VoiceSessionTimerProps) {
  if (timeRemaining === null) return null;

  return (
    <div
      data-testid="voice-session-timer"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm font-mono',
        getTimerColor(timeRemaining),
      )}
    >
      <Clock className="h-3.5 w-3.5" />
      {formatTime(timeRemaining)}
    </div>
  );
}
