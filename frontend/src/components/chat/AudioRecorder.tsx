'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

// Constants
export const MAX_RECORDING_TIME_MS = 5 * 60 * 1000 // 5 minutes
export const MAX_RECORDING_TIME_SECONDS = MAX_RECORDING_TIME_MS / 1000
const WARNING_THRESHOLD_SECONDS = 60 // 1 minute remaining
const CRITICAL_THRESHOLD_SECONDS = 30 // 30 seconds remaining

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
}

export interface AudioRecorderHandle {
  reset: () => void
}

type RecorderState = 'idle' | 'recording' | 'stopped' | 'error'

const AudioRecorder = forwardRef<AudioRecorderHandle, AudioRecorderProps>(
  ({ onRecordingComplete }, ref) => {
    const [state, setState] = useState<RecorderState>('idle')
    const [recordingTime, setRecordingTime] = useState(0)
    const [, setAudioBlob] = useState<Blob | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const stopRecordingRef = useRef<(() => void) | null>(null)
    const warningPlayedRef = useRef<boolean>(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Get remaining time in seconds
  const getRemainingTime = (elapsedSeconds: number): number => {
    return MAX_RECORDING_TIME_SECONDS - elapsedSeconds
  }

  // Get timer color class based on remaining time
  const getTimerColorClass = (elapsedSeconds: number): string => {
    const remaining = getRemainingTime(elapsedSeconds)
    if (remaining <= CRITICAL_THRESHOLD_SECONDS) {
      return 'text-red-500' // Critical: red at 30 seconds remaining
    }
    if (remaining <= WARNING_THRESHOLD_SECONDS) {
      return 'text-yellow-500' // Warning: yellow/orange at 1 minute remaining
    }
    return 'text-gray-600' // Normal
  }

  // Play audio warning beep
  const playWarningSound = useCallback(() => {
    try {
      // Create a simple beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800 // Frequency in Hz
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch {
      // Audio warning not critical, silently fail
    }
  }, [])

  // Determine supported MIME type
  const getMimeType = (): string => {
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        return 'audio/webm'
      }
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        return 'audio/mp4'
      }
    }
    return 'audio/webm' // Default fallback
  }

  // Stop recording - defined first so it can be called from startRecording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // Keep ref updated for use inside interval callback
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setRecordingTime(0)

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create MediaRecorder
      const mimeType = getMimeType()
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        setAudioBlob(blob)

        // Create URL for playback
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl)
        }
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        // Notify parent
        onRecordingComplete(blob)

        setState('stopped')
      }

      mediaRecorder.onerror = () => {
        setError('Recording error occurred')
        setState('error')
      }

      // Start recording
      mediaRecorder.start()
      setState('recording')
      warningPlayedRef.current = false

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1
          const remaining = MAX_RECORDING_TIME_SECONDS - next

          // Play audio warning at 30 seconds remaining (only once)
          if (remaining === CRITICAL_THRESHOLD_SECONDS && !warningPlayedRef.current) {
            warningPlayedRef.current = true
            playWarningSound()
          }

          if (next >= MAX_RECORDING_TIME_SECONDS) {
            // Auto-stop at 5 minutes - use ref to avoid stale closure
            toast.info('Recording stopped - maximum 5 minute limit reached')
            stopRecordingRef.current?.()
            return prev
          }
          return next
        })
      }, 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone access to record.')
      setState('error')
    }
  }, [audioUrl, onRecordingComplete, playWarningSound])

  // Re-record (clear and start again)
  const reRecord = useCallback(() => {
    setAudioBlob(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setRecordingTime(0)
    setIsPlaying(false)
    startRecording()
  }, [audioUrl, startRecording])

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [audioUrl, isPlaying])

  // Handle audio ended
  const handleAudioEnded = () => {
    setIsPlaying(false)
  }

  // Expose reset method to parent via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      // Clean up audio
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
      }
      setAudioBlob(null)

      // Reset state
      setState('idle')
      setRecordingTime(0)
      setIsPlaying(false)
      setError(null)

      // Stop any active recording
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }))

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}

      {/* Recording indicator */}
      {state === 'recording' && (
        <div
          data-testid="recording-indicator"
          className="w-3 h-3 bg-red-500 rounded-full animate-pulse"
        />
      )}

      {/* Timer display - shows remaining time during recording, elapsed time when stopped */}
      {state === 'recording' && (
        <span
          data-testid="countdown-timer"
          className={`font-mono text-sm min-w-[50px] ${getTimerColorClass(recordingTime)}`}
        >
          {formatTime(getRemainingTime(recordingTime))}
        </span>
      )}
      {state === 'stopped' && (
        <span className="font-mono text-sm text-gray-600 min-w-[50px]">
          {formatTime(recordingTime)}
        </span>
      )}

      {/* Main controls */}
      <div className="flex items-center gap-2">
        {/* Idle state - show record button */}
        {state === 'idle' && (
          <Button
            type="button"
            onClick={startRecording}
            variant="destructive"
            size="sm"
            className="rounded-full"
            aria-label="Record"
          >
            <Mic className="w-4 h-4" />
            Record
          </Button>
        )}

        {/* Recording state - show stop button */}
        {state === 'recording' && (
          <Button
            type="button"
            onClick={stopRecording}
            variant="secondary"
            size="sm"
            className="rounded-full"
            aria-label="Stop"
          >
            <Square className="w-4 h-4" />
            Stop
          </Button>
        )}

        {/* Stopped state - show playback controls */}
        {state === 'stopped' && (
          <>
            <Button
              type="button"
              onClick={togglePlayback}
              size="icon"
              className="rounded-full"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            <Button
              type="button"
              onClick={reRecord}
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Re-record"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </>
        )}

        {/* Error state - show record button with error message */}
        {state === 'error' && (
          <Button
            type="button"
            onClick={startRecording}
            variant="destructive"
            size="sm"
            className="rounded-full"
            aria-label="Record"
          >
            <Mic className="w-4 h-4" />
            Record
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Badge variant="destructive" className={cn('h-6 px-2 text-xs')}>
          {error}
        </Badge>
      )}
    </div>
  )
})

AudioRecorder.displayName = 'AudioRecorder'

export default AudioRecorder
