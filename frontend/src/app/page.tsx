'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import ProjectSidebar from '@/components/layout/ProjectSidebar';
import ConversationView from '@/components/chat/ConversationView';
import MessageInput from '@/components/chat/MessageInput';
import FileAttachment from '@/components/chat/FileAttachment';
import AudioRecorder, { AudioRecorderHandle } from '@/components/chat/AudioRecorder';
import { useConversationStore } from '@/lib/store';
import { transcribeAudio } from '@/lib/transcription';
import { generateResponse } from '@/lib/api';

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

  const [, setFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);

  const activeMessages = activeProjectId ? getMessages(activeProjectId) : [];

  // Auto-create first project on initial load (only after hydration)
  useEffect(() => {
    if (_hasHydrated && projects.length === 0) {
      createProject('My First Project');
    }
  }, [_hasHydrated, projects.length, createProject]);

  const handleSendMessage = async (content: string) => {
    if (!activeProjectId) return;

    setError(null);

    // Add user message
    addMessage(activeProjectId, {
      role: 'user',
      content,
      timestamp: new Date(),
    });

    setIsGenerating(true);

    try {
      // Generate AI response
      const response = await generateResponse(content, activeMessages);

      addMessage(activeProjectId, {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });
    } catch (err) {
      setError('Failed to generate response. Please try again.');
      console.error('Failed to generate response:', err);
    } finally {
      setIsGenerating(false);
      setFiles([]);
    }
  };

  const handleRecordingComplete = async (blob: Blob) => {
    if (!activeProjectId) return;

    setIsTranscribing(true);
    setError(null);

    try {
      const text = await transcribeAudio(blob);
      await handleSendMessage(text);
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
      await handleSendMessage(text);
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
    <AppLayout>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-card hidden lg:block">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Projects</h2>
          </div>
          <ProjectSidebar
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProject}
            onNewProject={handleNewProject}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {activeProjectId ? (
            <>
              <ConversationView messages={activeMessages} />

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
              <div className="border-t p-4">
                <MessageInput
                  onSendMessage={handleSendMessage}
                  disabled={isGenerating || isTranscribing}
                />
                <div className="mt-4 flex gap-4">
                  <div className="flex-1">
                    <FileAttachment
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
