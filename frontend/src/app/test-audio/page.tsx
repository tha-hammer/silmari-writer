'use client'

import { useState, useRef } from 'react'
import AudioRecorder, { AudioRecorderHandle } from '@/components/chat/AudioRecorder'

export default function TestAudioPage() {
  const [transcription, setTranscription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const audioRecorderRef = useRef<AudioRecorderHandle>(null)

  const handleRecordingComplete = async (blob: Blob) => {
    setLastBlob(blob)
    setError(null)
    setLoading(true)

    try {
      // Send to API route for transcription
      const formData = new FormData()
      formData.append('file', blob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Transcription failed')
      }

      const data = await response.json()
      setTranscription(data.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setLoading(false)
      // Reset recorder to idle state so user can record again
      audioRecorderRef.current?.reset()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Audio Recording & Transcription Test</h1>
        <p className="text-gray-600 mb-8">
          Phase 4 manual testing page. Record audio and test transcription via Whisper API.
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Record Audio</h2>
          <AudioRecorder
            ref={audioRecorderRef}
            onRecordingComplete={handleRecordingComplete}
          />

          {lastBlob && (
            <p className="mt-4 text-sm text-gray-500">
              Recording size: {(lastBlob.size / 1024).toFixed(2)} KB
            </p>
          )}
        </div>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-700">Transcribing...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-800 mb-1">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {transcription && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-green-800 mb-2">Transcription</h3>
            <p className="text-green-900 whitespace-pre-wrap">{transcription}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">Test Checklist</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Click Record button - browser prompts for microphone permission</span>
            </li>
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Recording indicator shows (red dot + timer)</span>
            </li>
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Click Stop - playback button appears</span>
            </li>
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Click Play - audio plays back correctly</span>
            </li>
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Click Re-record - previous recording cleared</span>
            </li>
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Transcription appears after recording stops</span>
            </li>
            <li className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" />
              <span>Transcription matches spoken words</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
