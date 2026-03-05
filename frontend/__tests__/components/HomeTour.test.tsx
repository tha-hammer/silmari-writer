import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useWalkthrough } from '@/hooks/useWalkthrough'

const mockStartTour = vi.fn()
const mockResetTour = vi.fn()
vi.mock('@/hooks/useWalkthrough', () => ({
  useWalkthrough: vi.fn(() => ({
    startTour: mockStartTour,
    isCompleted: false,
    resetTour: mockResetTour,
  })),
}))

import { HomeTourProvider } from '@/components/walkthrough/HomeTourProvider'

describe('HomeTourProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-starts tour when ready and not completed', async () => {
    render(<HomeTourProvider ready={true} />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).toHaveBeenCalledTimes(1)
  })

  it('does not auto-start when not ready', async () => {
    render(<HomeTourProvider ready={false} />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).not.toHaveBeenCalled()
  })

  it('auto-starts when ready becomes true', async () => {
    const { rerender } = render(<HomeTourProvider ready={false} />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).not.toHaveBeenCalled()

    rerender(<HomeTourProvider ready={true} />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).toHaveBeenCalledTimes(1)
  })

  it('does not auto-start when already completed', async () => {
    vi.mocked(useWalkthrough).mockReturnValue({
      startTour: mockStartTour,
      isCompleted: true,
      resetTour: mockResetTour,
    })

    render(<HomeTourProvider ready={true} />)
    await vi.advanceTimersByTimeAsync(500)
    expect(mockStartTour).not.toHaveBeenCalled()
  })

  it('renders a "Take the tour" button', () => {
    render(<HomeTourProvider ready={true} />)
    expect(screen.getByRole('button', { name: /take the tour/i })).toBeInTheDocument()
  })

  it('clicking "Take the tour" calls startTour regardless of ready', () => {
    render(<HomeTourProvider ready={false} />)
    fireEvent.click(screen.getByRole('button', { name: /take the tour/i }))
    expect(mockStartTour).toHaveBeenCalled()
  })
})
