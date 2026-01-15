import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatBytes, formatRelativeTime } from '@/lib/utils'

describe('formatBytes', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(100)).toBe('100 Bytes')
    expect(formatBytes(1023)).toBe('1023 Bytes')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1500)).toBe('1.46 KB')
    expect(formatBytes(10240)).toBe('10 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(5242880)).toBe('5 MB')
    expect(formatBytes(10485760)).toBe('10 MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1073741824)).toBe('1 GB')
    expect(formatBytes(5368709120)).toBe('5 GB')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-14T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for times less than 60 seconds ago', () => {
    const now = new Date()
    expect(formatRelativeTime(now)).toBe('Just now')
    expect(formatRelativeTime(new Date(now.getTime() - 30 * 1000))).toBe('Just now')
    expect(formatRelativeTime(new Date(now.getTime() - 59 * 1000))).toBe('Just now')
  })

  it('returns singular minute correctly', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 60 * 1000))).toBe('1 minute ago')
  })

  it('returns plural minutes correctly', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 60 * 1000))).toBe('2 minutes ago')
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000))).toBe('5 minutes ago')
    expect(formatRelativeTime(new Date(now.getTime() - 59 * 60 * 1000))).toBe('59 minutes ago')
  })

  it('returns singular hour correctly', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 60 * 60 * 1000))).toBe('1 hour ago')
  })

  it('returns plural hours correctly', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 60 * 60 * 1000))).toBe('2 hours ago')
    expect(formatRelativeTime(new Date(now.getTime() - 23 * 60 * 60 * 1000))).toBe('23 hours ago')
  })

  it('returns singular day correctly', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 24 * 60 * 60 * 1000))).toBe('1 day ago')
  })

  it('returns plural days correctly', () => {
    const now = new Date()
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))).toBe('2 days ago')
    expect(formatRelativeTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))).toBe('7 days ago')
  })
})
