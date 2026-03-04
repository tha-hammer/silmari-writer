export class VoiceSessionError extends Error {
  code: string;
  retryable: boolean;

  constructor(message: string, code: string, retryable = false) {
    super(message);
    this.name = 'VoiceSessionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export type VoiceEventCallback = (event: { type: string; [key: string]: unknown }) => void;

export interface VoiceSessionOptions {
  mode: string;
  needsMicrophone: boolean;
  instructions?: string;
  tools?: unknown[];
  onEvent?: VoiceEventCallback;
}

export interface VoiceSession {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  audioEl: HTMLAudioElement;
  stream: MediaStream | null;
  model: string;
  sessionLimitMinutes: number;
  sessionTimeout: ReturnType<typeof setTimeout>;
  close: () => void;
}

export async function createVoiceSession(options: VoiceSessionOptions): Promise<VoiceSession> {
  const { mode, needsMicrophone, instructions, tools, onEvent } = options;

  // Use Google's public STUN servers for NAT traversal
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  // Audio output — append to DOM for autoplay to work in some browsers
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.id = 'voice-session-audio';
  document.body.appendChild(audioEl);

  // Debug audio element events
  audioEl.oncanplay = () => {
    // eslint-disable-next-line no-console
    console.log('[Voice] Audio can play');
  };
  audioEl.onplaying = () => {
    // eslint-disable-next-line no-console
    console.log('[Voice] Audio playing');
  };
  audioEl.onerror = (e) => {
    console.error('[Voice] Audio error:', e);
  };

  pc.ontrack = (event) => {
    // eslint-disable-next-line no-console
    console.log('[Voice] ontrack received:', event.streams.length, 'streams');
    if (event.streams[0]) {
      audioEl.srcObject = event.streams[0];
      // eslint-disable-next-line no-console
      const tracks = event.streams[0].getTracks?.() ?? [];
      console.log('[Voice] Audio element srcObject set, tracks:', tracks.map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
    }
  };

  // Debug: log connection state changes
  pc.oniceconnectionstatechange = () => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[Voice] ICE state:', pc.iceConnectionState);
    }
  };
  pc.onconnectionstatechange = () => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[Voice] Connection state:', pc.connectionState);
    }
  };

  // Audio input: microphone for voice_edit, receive-only for read_aloud
  let stream: MediaStream | null = null;
  if (needsMicrophone) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(stream.getAudioTracks()[0], stream);
    } catch (err) {
      pc.close();
      throw new VoiceSessionError(
        `Microphone access denied: ${(err as Error).message}`,
        'MICROPHONE_DENIED',
        false,
      );
    }
  } else {
    // Add receive-only audio transceiver so the SDP offer includes audio
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }

  // Data channel for API events
  const dc = pc.createDataChannel('oai-events');

  // Create SDP offer and wait for ICE gathering to complete
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE gathering to finish so localDescription.sdp is populated
  if (pc.iceGatheringState !== 'complete') {
    await new Promise<void>((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);
    });
  }

  const sdp = pc.localDescription?.sdp;
  if (!sdp) {
    pc.close();
    stream?.getTracks().forEach((t) => t.stop());
    throw new VoiceSessionError('Failed to generate SDP offer', 'SDP_GENERATION_FAILED', true);
  }

  // Send SDP to our server, which proxies to OpenAI with the API key
  const response = await fetch('/api/voice/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdp,
      mode,
      instructions,
      tools,
    }),
  });

  if (!response.ok) {
    pc.close();
    stream?.getTracks().forEach((t) => t.stop());
    const detail = await response.json().catch(() => ({}));
    throw new VoiceSessionError(
      detail.error || 'SDP exchange failed',
      'SDP_EXCHANGE_FAILED',
      true,
    );
  }

  const { sdp: answerSdp, model, sessionLimitMinutes } = await response.json();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  // Set up data channel message handler for debugging and events
  dc.onmessage = (event) => {
    // Handle binary data (audio might come as ArrayBuffer)
    if (event.data instanceof ArrayBuffer) {
      // eslint-disable-next-line no-console
      console.log('[Voice] DC binary message:', event.data.byteLength, 'bytes');
      return;
    }

    const rawData = typeof event.data === 'string' ? event.data : String(event.data);
    try {
      const data = JSON.parse(rawData);
      // Log non-audio events (audio.delta is too verbose)
      if (data.type && !data.type.includes('audio.delta')) {
        // eslint-disable-next-line no-console
        console.log('[Voice] DC event:', data.type, data);
      }

      // Log transcription events explicitly
      if (data.type && data.type.includes('transcription')) {
        // eslint-disable-next-line no-console
        console.log('[Voice] Transcription event:', data.type, 'transcript:', data.transcript, data);
      }

      // Handle errors from OpenAI
      if (data.type === 'error') {
        console.error('[Voice] OpenAI error:', data.error);
      }

      // Notify callback for all events
      if (onEvent && data.type) {
        onEvent(data);
      }
    } catch (e) {
      // Log parse errors with context
      // eslint-disable-next-line no-console
      console.warn('[Voice] DC parse error:', (e as Error).message, 'length:', rawData.length, 'preview:', rawData.slice(0, 100));
    }
  };

  // Wait for data channel to open, then send session.update with config
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new VoiceSessionError('Data channel timeout', 'DC_TIMEOUT', true)), 10000);
    dc.onopen = () => {
      clearTimeout(timeout);
      // eslint-disable-next-line no-console
      console.log('[Voice] Data channel opened');
      // Send session configuration via data channel
      const sessionUpdate: Record<string, unknown> = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          voice: 'alloy',
          turn_detection: needsMicrophone ? { type: 'server_vad' } : null,
          input_audio_transcription: { model: 'gpt-4o-transcribe' },
        },
      };
      if (instructions) {
        sessionUpdate.session = { ...(sessionUpdate.session as object), instructions };
      }
      if (tools && tools.length > 0) {
        sessionUpdate.session = { ...(sessionUpdate.session as object), tools };
      }
      // eslint-disable-next-line no-console
      console.log('[Voice] Sending session.update:', sessionUpdate);
      dc.send(JSON.stringify(sessionUpdate));
      resolve();
    };
    dc.onerror = (err) => {
      clearTimeout(timeout);
      console.error('[Voice] Data channel error:', err);
      reject(new VoiceSessionError('Data channel error', 'DC_ERROR', true));
    };
  });

  // Session timer
  const sessionTimeout = setTimeout(() => {
    close();
  }, sessionLimitMinutes * 60 * 1000);

  function close() {
    clearTimeout(sessionTimeout);
    pc.close();
    stream?.getTracks().forEach((t) => t.stop());
    audioEl.remove();
  }

  return { pc, dc, audioEl, stream, model, sessionLimitMinutes, sessionTimeout, close };
}
