import { describe, it, expect } from 'vitest'
import { writerTourSteps, homeTourSteps } from '@/lib/walkthrough-steps'

describe('writerTourSteps', () => {
  it('has exactly 3 steps', () => {
    expect(writerTourSteps).toHaveLength(3)
  })

  it('step 1 targets the URL input mode button', () => {
    expect(writerTourSteps[0].element).toBe('[data-testid="input-mode-url"]')
    expect(writerTourSteps[0].intro).toContain('job application')
  })

  it('step 2 targets the file upload mode button', () => {
    expect(writerTourSteps[1].element).toBe('[data-testid="input-mode-file_upload"]')
    expect(writerTourSteps[1].intro).toContain('screen shot')
  })

  it('step 3 targets the default questions mode button', () => {
    expect(writerTourSteps[2].element).toBe('[data-testid="input-mode-default_questions"]')
    expect(writerTourSteps[2].intro).toContain('interview')
  })

  it('every step has element and intro strings', () => {
    writerTourSteps.forEach((step) => {
      expect(typeof step.element).toBe('string')
      expect(typeof step.intro).toBe('string')
      expect(step.intro.length).toBeGreaterThan(0)
    })
  })
})

describe('homeTourSteps', () => {
  it('has exactly 4 steps', () => {
    expect(homeTourSteps).toHaveLength(4)
  })

  it('step 1 targets the Record button', () => {
    expect(homeTourSteps[0].element).toBe('button[aria-label="Record"]')
    expect(homeTourSteps[0].intro).toContain('record')
  })

  it('step 2 targets the Attach files button', () => {
    expect(homeTourSteps[1].element).toBe('button[aria-label="Attach files"]')
    expect(homeTourSteps[1].intro).toContain('file')
  })

  it('step 3 targets the Message input', () => {
    expect(homeTourSteps[2].element).toBe('textarea[aria-label="Message input"]')
    expect(homeTourSteps[2].intro).toContain('Cosmic Agent')
  })

  it('step 4 targets the Voice Edit button', () => {
    expect(homeTourSteps[3].element).toBe('button[aria-label="Voice Edit"]')
    expect(homeTourSteps[3].intro).toContain('Voice Edit')
  })

  it('every step has element and intro strings', () => {
    homeTourSteps.forEach((step) => {
      expect(typeof step.element).toBe('string')
      expect(typeof step.intro).toBe('string')
      expect(step.intro.length).toBeGreaterThan(0)
    })
  })
})
