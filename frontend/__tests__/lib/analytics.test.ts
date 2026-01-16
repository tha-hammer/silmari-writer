import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  trackButtonClick,
  trackButtonOutcome,
  trackButtonTiming,
} from '@/lib/analytics'

// Mock fetch
global.fetch = vi.fn()

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }))
  })

  describe('trackButtonClick', () => {
    it('sends analytics event for button click', async () => {
      await trackButtonClick({
        buttonType: 'copy',
        messageId: 'msg-123',
        timestamp: Date.now(),
      })

      expect(fetch).toHaveBeenCalledWith('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"eventType":"button_click"'),
      })
    })

    it('includes button type and message ID', async () => {
      await trackButtonClick({
        buttonType: 'regenerate',
        messageId: 'msg-456',
        timestamp: 1234567890,
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.buttonType).toBe('regenerate')
      expect(body.messageId).toBe('msg-456')
      expect(body.timestamp).toBe(1234567890)
    })
  })

  describe('trackButtonOutcome', () => {
    it('sends analytics event for success outcome', async () => {
      await trackButtonOutcome({
        buttonType: 'regenerate',
        messageId: 'msg-123',
        outcome: 'success',
        timestamp: Date.now(),
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.eventType).toBe('button_outcome')
      expect(body.outcome).toBe('success')
    })

    it('sends analytics event for error outcome with message', async () => {
      await trackButtonOutcome({
        buttonType: 'sendToAPI',
        messageId: 'msg-123',
        outcome: 'error',
        errorMessage: 'API call failed',
        timestamp: Date.now(),
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.outcome).toBe('error')
      expect(body.errorMessage).toBe('API call failed')
    })
  })

  describe('trackButtonTiming', () => {
    it('sends analytics event with timing metrics', async () => {
      const startTime = 1000
      const endTime = 3000

      await trackButtonTiming({
        buttonType: 'regenerate',
        messageId: 'msg-123',
        startTime,
        endTime,
        duration: endTime - startTime,
      })

      const call = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(call[1]!.body as string)

      expect(body.eventType).toBe('button_timing')
      expect(body.duration).toBe(2000)
      expect(body.startTime).toBe(1000)
      expect(body.endTime).toBe(3000)
    })
  })

  describe('Error handling', () => {
    it('handles fetch errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(trackButtonClick({
        buttonType: 'copy',
        messageId: 'msg-123',
        timestamp: Date.now(),
      })).resolves.not.toThrow()
    })

    it('handles non-200 responses', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('Error', { status: 500 }))

      // Should not throw
      await expect(trackButtonClick({
        buttonType: 'copy',
        messageId: 'msg-123',
        timestamp: Date.now(),
      })).resolves.not.toThrow()
    })
  })
})
