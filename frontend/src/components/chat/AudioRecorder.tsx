'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Mic, Square, Play, Pause, RotateCcw } from 'lucide-react'

// Constants
const MAX_RECORDING_TIME_MS = 5 * 60 * 1000 // 5 minutes
const MAX_RECORDING_TIME_SECONDS = MAX_RECORDING_TIME_MS / 1000

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

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1
          if (next >= MAX_RECORDING_TIME_SECONDS) {
            // Auto-stop at 5 minutes - use ref to avoid stale closure
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
  }, [audioUrl, onRecordingComplete])

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
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
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

      {/* Timer display */}
      {(state === 'recording' || state === 'stopped') && (
        <span className="font-mono text-sm text-gray-600 min-w-[50px]">
          {formatTime(recordingTime)}
        </span>
      )}

      {/* Main controls */}
      <div className="flex items-center gap-2">
        {/* Idle state - show record button */}
        {state === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            aria-label="Record"
          >
            <Mic className="w-4 h-4" />
            Record
          </button>
        )}

        {/* Recording state - show stop button */}
        {state === 'recording' && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-900 transition-colors"
            aria-label="Stop"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        )}

        {/* Stopped state - show playback controls */}
        {state === 'stopped' && (
          <>
            <button
              type="button"
              onClick={togglePlayback}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={reRecord}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
              aria-label="Re-record"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Error state - show record button with error message */}
        {state === 'error' && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            aria-label="Record"
          >
            <Mic className="w-4 h-4" />
            Record
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <span className="text-red-500 text-sm">
          {error}
        </span>
      )}
    </div>
  )
})

AudioRecorder.displayName = 'AudioRecorder'

export default AudioRecorder
