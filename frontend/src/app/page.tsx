'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import ProjectSidebar from '@/components/layout/ProjectSidebar';
import ConversationView from '@/components/chat/ConversationView';
import MessageInput from '@/components/chat/MessageInput';
import FileAttachment from '@/components/chat/FileAttachment';
import AudioRecorder, { AudioRecorderHandle } from '@/components/chat/AudioRecorder';
import ReadAloudToggle from '@/components/chat/ReadAloudToggle';
import VoiceEditPanel from '@/components/chat/VoiceEditPanel';
import { useConversationStore } from '@/lib/store';
import { transcribeAudio } from '@/lib/transcription';
import { generateResponse } from '@/lib/api';
import {
  prepareFilesContent,
  UnsupportedFileError,
  validateAttachments,
} from '@/lib/file-content';
import type { FileContentPayload } from '@/lib/file-content';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { useAutoReadAloud } from '@/hooks/useAutoReadAloud';
import { HomeTourProvider } from '@/components/walkthrough/HomeTourProvider';

export default function HomePage() {
  const {
    projects,
    activeProjectId,
    createProject,
    setActiveProject,
    addMessage,
    getMessages,
    _hasHydrated,
  } = useConversationStore();

  const [files, setFiles] = useState<File[]>([]);
  const [fileResetKey, setFileResetKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);

  // Read Aloud integration
  const { readAloudEnabled } = useConversationStore();
  const { sessionState, sendEvent, setOnEvent } = useRealtimeSession();
  const { onNewAssistantMessage, handleResponseDone } = useAutoReadAloud({
    readAloudEnabled,
    isConnected: sessionState === 'connected',
    sendEvent,
  });

  // Wire up response.done event to process TTS queue
  useEffect(() => {
    setOnEvent((event) => {
      if (event.type === 'response.done') {
        handleResponseDone();
      }
    });
    return () => setOnEvent(null);
  }, [setOnEvent, handleResponseDone]);

  const activeMessages = activeProjectId ? getMessages(activeProjectId) : [];

  // Auto-create first project on initial load (only after hydration)
  useEffect(() => {
    if (_hasHydrated && projects.length === 0) {
      createProject('My First Project');
    }
  }, [_hasHydrated, projects.length, createProject]);

  const mapAttachmentError = (err: unknown): string => {
    if (err instanceof UnsupportedFileError) {
      return `Unsupported file type: ${err.filename}. Please attach PNG/JPEG/GIF/WebP images or TXT/JSON files.`;
    }

    if (err instanceof Error && err.message) {
      return err.message;
    }

    return 'Failed to process file attachments. Please try again.';
  };

  const handleSendMessage = async (content: string, isVoiceTranscription = false) => {
    if (!activeProjectId) return;

    setError(null);

    const currentFiles = [...files];
    const validation = validateAttachments(currentFiles);
    if (!validation.valid) {
      setError(validation.error || 'Invalid attachments. Please review selected files.');
      return;
    }

    let preparedAttachments: FileContentPayload[] = [];
    try {
      preparedAttachments = await prepareFilesContent(currentFiles);
    } catch (err) {
      setError(mapAttachmentError(err));
      return;
    }

    const attachmentMetadata = currentFiles.length > 0
      ? currentFiles.map((file) => ({
          id: crypto.randomUUID(),
          filename: file.name,
          size: file.size,
          type: file.type,
        }))
      : undefined;

    // Add user message
    addMessage(activeProjectId, {
      role: 'user',
      content,
      timestamp: new Date(),
      isVoiceTranscription,
      ...(attachmentMetadata ? { attachments: attachmentMetadata } : {}),
    });

    setIsGenerating(true);

    try {
      // Generate AI response
      const response = await generateResponse(
        content,
        activeMessages,
        preparedAttachments.length > 0 ? preparedAttachments : undefined,
      );

      addMessage(activeProjectId, {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      // Send to Read Aloud if enabled
      onNewAssistantMessage(response);
    } catch (err) {
      setError('Failed to generate response. Please try again.');
      console.error('Failed to generate response:', err);
    } finally {
      setIsGenerating(false);
      setFiles([]);
      setFileResetKey((current) => current + 1);
    }
  };

  const handleRecordingComplete = async (blob: Blob) => {
    if (!activeProjectId) return;

    setIsTranscribing(true);
    setError(null);

    try {
      const text = await transcribeAudio(blob);

      if (!text || text.trim().length === 0) {
        setError('No speech detected in recording. Please try again.');
        return;
      }

      await handleSendMessage(text, true); // Mark as voice transcription
    } catch (err) {
      setError('Failed to transcribe audio. Please try again.');
      console.error('Failed to transcribe audio:', err);
    } finally {
      setIsTranscribing(false);
      // Reset recorder to idle state so user can record again
      audioRecorderRef.current?.reset();
    }
  };

  const handleTranscribeFile = async (file: File) => {
    if (!activeProjectId) return;

    setIsTranscribing(true);
    setError(null);

    try {
      const text = await transcribeAudio(file);

      if (!text || text.trim().length === 0) {
        setError(`No speech detected in ${file.name}. Please try again.`);
        return;
      }

      await handleSendMessage(text, true); // Mark as voice transcription
    } catch (err) {
      setError(`Failed to transcribe ${file.name}. Please try again.`);
      console.error('Failed to transcribe file:', err);
      throw err; // Re-throw so FileAttachment can handle it
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleNewProject = () => {
    const projectNumber = projects.length + 1;
    createProject(`New Project ${projectNumber}`);
  };

  return (
    <AppLayout
      sidebar={(
        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={setActiveProject}
          onNewProject={handleNewProject}
        />
      )}
    >
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background">
        {/* Main content area */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          {activeProjectId ? (
            <>
              <div className="flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
                <p className="text-xs text-muted-foreground">Chat Workspace</p>
                <div className="flex items-center gap-2">
                  <HomeTourProvider ready={!!activeProjectId} />
                  <Link
                    href="/writer"
                    data-testid="workflow-entry-link"
                    className="text-xs font-medium underline underline-offset-4 hover:text-foreground"
                  >
                    Open Writer Workflow
                  </Link>
                </div>
              </div>

              <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-muted/20">
                <ConversationView messages={activeMessages} />
              </div>

              {/* Voice controls */}
              <div className="flex items-center gap-2 border-t bg-card/70 px-4 py-2">
                <ReadAloudToggle />
                <VoiceEditPanel />
              </div>

              {/* Loading indicator */}
              {isGenerating && (
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating response...
                </div>
              )}

              {/* Transcribing indicator */}
              {isTranscribing && (
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing...
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="px-4 py-2 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}

              {/* Input area */}
              <div className="border-t bg-background p-4">
                <MessageInput
                  onSendMessage={handleSendMessage}
                  disabled={isGenerating || isTranscribing}
                />
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <FileAttachment
                      key={fileResetKey}
                      onFilesChange={setFiles}
                      onTranscribeFile={handleTranscribeFile}
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <AudioRecorder
                      ref={audioRecorderRef}
                      onRecordingComplete={handleRecordingComplete}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Select a project or create a new one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
