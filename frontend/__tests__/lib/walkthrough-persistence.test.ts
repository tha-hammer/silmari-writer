import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isTourCompleted,
  setTourCompleted,
  resetTourCompleted,
  WALKTHROUGH_PREFIX,
} from '@/lib/walkthrough-persistence'

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

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', storageMock)
})

describe('walkthrough persistence', () => {
  it('returns false when tour has not been completed', () => {
    expect(isTourCompleted('writer')).toBe(false)
  })

  it('returns true after setTourCompleted is called', () => {
    setTourCompleted('writer')
    expect(isTourCompleted('writer')).toBe(true)
  })

  it('stores under the correct localStorage key', () => {
    setTourCompleted('writer')
    expect(storageMock.setItem).toHaveBeenCalledWith(`${WALKTHROUGH_PREFIX}writer`, 'true')
  })

  it('tracks tours independently', () => {
    setTourCompleted('writer')
    expect(isTourCompleted('home')).toBe(false)
  })

  it('resetTourCompleted removes the key', () => {
    setTourCompleted('writer')
    resetTourCompleted('writer')
    expect(isTourCompleted('writer')).toBe(false)
  })
})
