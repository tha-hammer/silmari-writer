'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Paperclip, X, Upload, FileAudio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatBytes } from '@/lib/utils'

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const DEFAULT_MAX_FILES = 10

// Audio file MIME types supported by OpenAI Whisper
const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpga',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/mpeg',
  'video/webm',
]

interface FileAttachmentProps {
  onFilesChange: (files: File[]) => void
  onTranscribeFile?: (file: File) => Promise<void>
  maxFiles?: number
  maxSizeBytes?: number
}

export default function FileAttachment({
  onFilesChange,
  onTranscribeFile,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
}: FileAttachmentProps) {
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcribingFiles, setTranscribingFiles] = useState<Set<number>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndAddFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList)
    const validFiles: File[] = []
    const errors: string[] = []

    // Check if adding these files would exceed maxFiles
    const availableSlots = maxFiles - files.length
    const filesToAdd = newFiles.slice(0, availableSlots)
    const excessFiles = newFiles.length - availableSlots

    if (excessFiles > 0) {
      errors.push(`Maximum ${maxFiles} files allowed`)
    }

    filesToAdd.forEach((file) => {
      if (file.size > maxSizeBytes) {
        errors.push(`${file.name} exceeds ${formatBytes(maxSizeBytes)} limit`)
      } else {
        validFiles.push(file)
      }
    })

    if (errors.length > 0) {
      setError(errors.join('. '))
    } else {
      setError(null)
    }

    const updatedFiles = [...files, ...validFiles]
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files)
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Clear existing files on new upload
      setFiles([])
      validateAndAddFiles(e.target.files)
    }
    // Reset input value so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleAttachClick = () => {
    inputRef.current?.click()
  }

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index)
    setFiles(updatedFiles)
    onFilesChange(updatedFiles)
  }

  const isAudioFile = (file: File): boolean => {
    return AUDIO_MIME_TYPES.includes(file.type)
  }

  const handleTranscribe = async (file: File, index: number) => {
    if (!onTranscribeFile) return

    setTranscribingFiles(prev => new Set(prev).add(index))
    setError(null)

    try {
      await onTranscribeFile(file)
      // Remove file after successful transcription
      removeFile(index)
    } catch (err) {
      setError(`Failed to transcribe ${file.name}`)
      console.error('Transcription error:', err)
    } finally {
      setTranscribingFiles(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <Card
        data-testid="dropzone"
        data-drag-active={dragActive}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed transition-colors
          ${dragActive ? 'border-primary bg-accent/60' : 'border-border hover:border-primary/50'}
        `}
      >
        <CardContent className="flex flex-col items-center gap-2 px-4 py-5 text-center text-muted-foreground">
          <input
            ref={inputRef}
            type="file"
            data-testid="file-input"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />

          <Upload className="h-8 w-8" />
          <p className="text-sm font-medium">Drag and drop files here, or</p>
          <Button
            type="button"
            onClick={handleAttachClick}
            aria-label="Attach files"
            variant="outline"
            size="sm"
          >
            <Paperclip className="h-4 w-4" />
            Attach files
          </Button>
          <p className="text-xs">Max {formatBytes(maxSizeBytes)} per file</p>
        </CardContent>
      </Card>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => {
            const isAudio = isAudioFile(file)
            const isTranscribing = transcribingFiles.has(index)

            return (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isAudio ? (
                    <FileAudio className="h-4 w-4 flex-shrink-0 text-primary" />
                  ) : (
                    <Paperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-sm">{file.name}</span>
                  <Badge variant="outline" className="ml-1 flex-shrink-0">
                    {formatBytes(file.size)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {isAudio && onTranscribeFile && (
                    <Button
                      type="button"
                      onClick={() => handleTranscribe(file, index)}
                      disabled={isTranscribing}
                      aria-label={`Transcribe ${file.name}`}
                      size="sm"
                    >
                      {isTranscribing ? 'Transcribing...' : 'Transcribe'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                    disabled={isTranscribing}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
