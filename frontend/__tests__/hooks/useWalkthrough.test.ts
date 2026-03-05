import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWalkthrough } from '@/hooks/useWalkthrough'
import type { WalkthroughStep } from '@/lib/walkthrough-steps'

// Mock intro.js v8 API — default export is an object with a .tour() factory
const mockStart = vi.fn().mockResolvedValue(undefined)
const mockExit = vi.fn().mockResolvedValue(undefined)
const mockSetOptions = vi.fn()
const mockOnComplete = vi.fn()
const mockOnExit = vi.fn()

const mockTourInstance = {
  setOptions: mockSetOptions,
  start: mockStart,
  onComplete: mockOnComplete,
  onExit: mockOnExit,
  exit: mockExit,
}

// Wire up chaining: each method returns the tour instance
mockSetOptions.mockReturnValue(mockTourInstance)
mockOnComplete.mockReturnValue(mockTourInstance)
mockOnExit.mockReturnValue(mockTourInstance)

vi.mock('intro.js', () => ({
  default: {
    tour: vi.fn(() => ({ ...mockTourInstance })),
  },
}))

// Provide a real Storage-like mock since Node 22 native localStorage
// conflicts with jsdom in this test environment.
const store = new Map<string, string>()
const storageMock: Storage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
  removeItem: vi.fn((key: string) => { store.delete(key) }),
  clear: vi.fn(() => { store.clear() }),
  key: vi.fn((index: number) => [...store.keys()][index] ?? null),
  get length() { return store.size },
}

const testSteps: WalkthroughStep[] = [
  { element: '#step1', intro: 'Step 1' },
  { element: '#step2', intro: 'Step 2' },
]

describe('useWalkthrough', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', storageMock)
    vi.clearAllMocks()
    // Re-wire chaining after clearAllMocks
    mockSetOptions.mockReturnValue(mockTourInstance)
    mockOnComplete.mockReturnValue(mockTourInstance)
    mockOnExit.mockReturnValue(mockTourInstance)
    mockStart.mockResolvedValue(undefined)
    mockExit.mockResolvedValue(undefined)
  })

  it('returns startTour, isCompleted, and resetTour', () => {
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    expect(result.current.startTour).toBeInstanceOf(Function)
    expect(result.current.resetTour).toBeInstanceOf(Function)
    expect(typeof result.current.isCompleted).toBe('boolean')
  })

  it('isCompleted is false initially', () => {
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    expect(result.current.isCompleted).toBe(false)
  })

  it('isCompleted is true when localStorage has completion', () => {
    store.set('walkthrough_test', 'true')
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    expect(result.current.isCompleted).toBe(true)
  })

  it('startTour calls introJs.tour() and sets options with steps', () => {
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    act(() => { result.current.startTour() })

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: testSteps,
      })
    )
    expect(mockStart).toHaveBeenCalled()
  })

  it('registers onComplete and onExit callbacks', () => {
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    act(() => { result.current.startTour() })
    expect(mockOnComplete).toHaveBeenCalledWith(expect.any(Function))
    expect(mockOnExit).toHaveBeenCalledWith(expect.any(Function))
  })

  it('onComplete callback persists completion', () => {
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    act(() => { result.current.startTour() })

    // Extract and call the onComplete callback
    const completeCallback = mockOnComplete.mock.calls[0][0]
    act(() => { completeCallback() })

    expect(result.current.isCompleted).toBe(true)
    expect(store.get('walkthrough_test')).toBe('true')
  })

  it('resetTour clears completion', () => {
    store.set('walkthrough_test', 'true')
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    expect(result.current.isCompleted).toBe(true)

    act(() => { result.current.resetTour() })
    expect(result.current.isCompleted).toBe(false)
    expect(store.has('walkthrough_test')).toBe(false)
  })
})
