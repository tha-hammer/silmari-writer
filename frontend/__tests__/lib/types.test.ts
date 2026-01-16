import { describe, it, expect } from 'vitest'
import type { MessageButtonState } from '@/lib/types'

describe('MessageButtonState Types', () => {
  it('should have MessageButtonState type with copy property', () => {
    const state: MessageButtonState = {
      copy: {
        isActive: true,
        timestamp: Date.now(),
      },
    }

    expect(state.copy).toBeDefined()
    expect(state.copy?.isActive).toBe(true)
    expect(typeof state.copy?.timestamp).toBe('number')
  })

  it('should have MessageButtonState type with blockingOperation property', () => {
    const state: MessageButtonState = {
      blockingOperation: {
        type: 'regenerate',
        isLoading: true,
      },
    }

    expect(state.blockingOperation).toBeDefined()
    expect(state.blockingOperation?.type).toBe('regenerate')
    expect(state.blockingOperation?.isLoading).toBe(true)
  })

  it('should allow blockingOperation with error', () => {
    const state: MessageButtonState = {
      blockingOperation: {
        type: 'sendToAPI',
        isLoading: false,
        error: 'API call failed',
      },
    }

    expect(state.blockingOperation?.error).toBe('API call failed')
  })

  it('should allow empty MessageButtonState', () => {
    const state: MessageButtonState = {}
    expect(Object.keys(state)).toHaveLength(0)
  })
})
