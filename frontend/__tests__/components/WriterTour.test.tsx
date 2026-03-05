import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useWalkthrough } from '@/hooks/useWalkthrough'

// Mock the hook
const mockStartTour = vi.fn()
const mockResetTour = vi.fn()
vi.mock('@/hooks/useWalkthrough', () => ({
  useWalkthrough: vi.fn(() => ({
    startTour: mockStartTour,
    isCompleted: false,
    resetTour: mockResetTour,
  })),
}))

import { WriterTourProvider } from '@/components/walkthrough/WriterTourProvider'

describe('WriterTourProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-starts tour when not completed', async () => {
    render(<WriterTourProvider />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).toHaveBeenCalledTimes(1)
  })

  it('does not auto-start when already completed', async () => {
    vi.mocked(useWalkthrough).mockReturnValue({
      startTour: mockStartTour,
      isCompleted: true,
      resetTour: mockResetTour,
    })

    render(<WriterTourProvider />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).not.toHaveBeenCalled()
  })

  it('renders a "Take the tour" button', () => {
    render(<WriterTourProvider />)
    expect(screen.getByRole('button', { name: /take the tour/i })).toBeInTheDocument()
  })

  it('clicking "Take the tour" calls startTour', () => {
    render(<WriterTourProvider />)
    fireEvent.click(screen.getByRole('button', { name: /take the tour/i }))
    expect(mockStartTour).toHaveBeenCalled()
  })
})
