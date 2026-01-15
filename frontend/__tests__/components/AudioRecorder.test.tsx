import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import AudioRecorder from '@/components/chat/AudioRecorder'

// Store instances to manipulate in tests
let mockMediaRecorderInstance: MockMediaRecorder | null = null

// Mock MediaRecorder
class MockMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true)

  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((e: Event) => void) | null = null

  constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {
    mockMediaRecorderInstance = this
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    // Simulate data being available
    const blob = new Blob(['mock audio data'], { type: this.options?.mimeType || 'audio/webm' })
    if (this.ondataavailable) {
      this.ondataavailable({ data: blob })
    }
    if (this.onstop) {
      this.onstop()
    }
  }
}

// Mock MediaStream
class MockMediaStream {
  getTracks() {
    return [{ stop: vi.fn() }]
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn()

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks()
  mockMediaRecorderInstance = null

  // Setup MediaRecorder mock
  vi.stubGlobal('MediaRecorder', MockMediaRecorder)

  // Setup navigator.mediaDevices mock
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  })

  // Setup URL mock
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  })

  // Default: permission granted
  mockGetUserMedia.mockResolvedValue(new MockMediaStream())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AudioRecorder', () => {
  describe('initial state', () => {
    it('should render record button', () => {
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument()
    })

    it('should not show timer initially', () => {
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument()
    })

    it('should not show playback controls initially', () => {
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /re-record/i })).not.toBeInTheDocument()
    })
  })

  describe('microphone permission', () => {
    it('should request microphone permission when record is clicked', async () => {
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: /record/i }))

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
      })
    })

    it('should show error when permission is denied', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'))

      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: /record/i }))

      await waitFor(() => {
        expect(screen.getByText(/microphone access/i)).toBeInTheDocument()
      })
    })
  })

  describe('recording state', () => {
    it('should show stop button when recording', async () => {
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: /record/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
      })
    })

    it('should show timer when recording', async () => {
      vi.useFakeTimers()
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0) // Flush promises
      })

      expect(screen.getByText('00:00')).toBeInTheDocument()

      // Advance timer by 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })

      expect(screen.getByText('00:05')).toBeInTheDocument()
    })

    it('should show recording indicator', async () => {
      vi.useFakeTimers()
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0) // Flush promises
      })

      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument()
    })
  })

  describe('stop recording', () => {
    it('should call onRecordingComplete with audio blob when stop is clicked', async () => {
      vi.useFakeTimers()
      const onRecordingComplete = vi.fn()
      render(<AudioRecorder onRecordingComplete={onRecordingComplete} />)

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()

      // Stop recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stop/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(onRecordingComplete).toHaveBeenCalledWith(expect.any(Blob))
    })

    it('should show playback controls after stopping', async () => {
      vi.useFakeTimers()
      const onRecordingComplete = vi.fn()
      render(<AudioRecorder onRecordingComplete={onRecordingComplete} />)

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      // Stop recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stop/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /re-record/i })).toBeInTheDocument()
    })
  })

  describe('5-minute limit', () => {
    it('should auto-stop recording at 5 minutes', async () => {
      vi.useFakeTimers()
      const onRecordingComplete = vi.fn()
      render(<AudioRecorder onRecordingComplete={onRecordingComplete} />)

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()

      // Advance timer to 5 minutes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      })

      expect(onRecordingComplete).toHaveBeenCalled()
    })

    it('should show 04:59 just before auto-stop', async () => {
      vi.useFakeTimers()
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      // Start recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('00:00')).toBeInTheDocument()

      // Advance to 4:59
      await act(async () => {
        await vi.advanceTimersByTimeAsync(299 * 1000)
      })

      expect(screen.getByText('04:59')).toBeInTheDocument()
    })
  })

  describe('playback', () => {
    it('should allow playback preview after recording', async () => {
      vi.useFakeTimers()
      const onRecordingComplete = vi.fn()
      render(<AudioRecorder onRecordingComplete={onRecordingComplete} />)

      // Record
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      // Stop
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stop/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      // Play button should be present
      const playButton = screen.getByRole('button', { name: /play/i })
      expect(playButton).toBeInTheDocument()
    })
  })

  describe('re-record', () => {
    it('should clear previous recording and restart when re-record is clicked', async () => {
      vi.useFakeTimers()
      const onRecordingComplete = vi.fn()
      render(<AudioRecorder onRecordingComplete={onRecordingComplete} />)

      // First recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stop/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByRole('button', { name: /re-record/i })).toBeInTheDocument()

      // Re-record
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /re-record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      // Should have reset to recording state
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument()
    })

    it('should reset timer when re-recording', async () => {
      vi.useFakeTimers()
      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      // First recording
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('00:00')).toBeInTheDocument()

      // Advance timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000)
      })
      expect(screen.getByText('00:10')).toBeInTheDocument()

      // Stop
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stop/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      // Re-record
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /re-record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('00:00')).toBeInTheDocument()
    })
  })

  describe('MediaRecorder type support', () => {
    it('should use webm format when supported', async () => {
      vi.useFakeTimers()
      MockMediaRecorder.isTypeSupported.mockImplementation((type: string) => type === 'audio/webm')

      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(MockMediaRecorder.isTypeSupported).toHaveBeenCalledWith('audio/webm')
    })

    it('should fallback to mp4 when webm is not supported', async () => {
      vi.useFakeTimers()
      MockMediaRecorder.isTypeSupported.mockImplementation((type: string) => type === 'audio/mp4')

      render(<AudioRecorder onRecordingComplete={vi.fn()} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /record/i }))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(MockMediaRecorder.isTypeSupported).toHaveBeenCalled()
    })
  })
})
