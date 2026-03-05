# intro.js v8 Walkthrough Tours — TDD Implementation Plan

## Overview

Add intro.js (v8.x) guided tours to two pages: `/writer` (job application workflow) and `/` (chat workspace). Each tour highlights key UI elements with custom copy. Tours auto-start for first-time visitors and can be replayed via a button. Tour completion is persisted to localStorage.

## Current State Analysis

### Key Discoveries
- **Framework**: Next.js 16 + React 19 + TypeScript + Tailwind v4
- **Testing**: Vitest + jsdom + React Testing Library + user-event (`frontend/vitest.config.ts`)
- **State**: Zustand with localStorage persistence (`frontend/src/lib/store.ts:145`)
- **First-time detection**: `_hasHydrated && projects.length === 0` (`app/page.tsx:67`)
- **localStorage preference pattern**: `image-streaming.ts:90-107` — direct `window.localStorage` get/set
- **No existing tour code**
- **intro.js v8.3.2** is current — v8 uses `introJs.tour()` API (not `introJs()` which is deprecated)
- **intro.js is safe for static import** in `'use client'` — does not access `window`/`document` at import time
- **AGPL-3.0 license** — commercial license required if app is proprietary SaaS

### Selectors for Tour Steps

**`/writer` page** (`modules/session/StartVoiceSessionModule.tsx`):
| Step | Selector | Line |
|---|---|---|
| URL input mode button | `[data-testid="input-mode-url"]` | 181 |
| File upload mode button | `[data-testid="input-mode-file_upload"]` | 195 |
| Default questions mode button | `[data-testid="input-mode-default_questions"]` | 209 |

**Note**: All three buttons are inside `<RequireAuth>` at line 163. Tour targets only exist when user is authenticated.

**`/` page** (various components):
| Step | Selector | Source | Line |
|---|---|---|---|
| Record button | `button[aria-label="Record"]` | `AudioRecorder.tsx` | 323 |
| Attach files button | `button[aria-label="Attach files"]` | `FileAttachment.tsx` | 186 |
| Message textarea | `textarea[aria-label="Message input"]` | `MessageInput.tsx` | 62 |
| Voice Edit button | `button[aria-label="Voice Edit"]` | `VoiceEditPanel.tsx` | 26 |

**Note**: All 4 targets are inside `{activeProjectId ? (...) : fallback}` gate at `page.tsx:222`. Tour must wait for `activeProjectId` to be set.

## Desired End State

- `npm install intro.js` added as dependency
- `useWalkthrough` hook manages tour lifecycle and persistence using intro.js v8 `Tour` API
- Two step configs: one for `/writer`, one for `/`
- Tours auto-start on first visit per page (tracked independently), gated on DOM readiness
- "Take the tour" replay button accessible on each page
- intro.js styles overridden to match app theme
- All behaviors covered by Vitest unit/component tests

### Observable Behaviors
1. Given the hook is called with a tour key, when it mounts, then it returns `{ startTour, isCompleted, resetTour }`
2. Given a tour completes, when localStorage is checked, then `walkthrough_<key>` is `"true"`
3. Given `/writer` loads and tour not completed, when hydrated, then tour auto-starts with 3 steps
4. Given `/` loads, `activeProjectId` is set, and tour not completed, when ready, then tour auto-starts with 4 steps
5. Given tour already completed, when page loads, then tour does not auto-start
6. Given user clicks "Take the tour", when handler fires, then `startTour()` is called
7. Given intro.js is not available (SSR), when hook runs server-side, then it no-ops gracefully

## What We're NOT Doing
- No server-side tour completion tracking (localStorage only)
- No onboarding flow integration (tours are independent)
- No mobile-specific step adaptation (steps target elements visible on all viewports for now)
- No analytics/KPI tracking for tour events
- No custom intro.js themes beyond basic color matching

## Testing Strategy
- **Framework**: Vitest + jsdom + React Testing Library
- **Test Types**: Unit (hook, config, persistence), Component (auto-start, button, ready gate)
- **Mocking**: `vi.mock('intro.js')` at module scope with v8 `tour()` factory; direct `localStorage` manipulation
- **Test location**: `frontend/__tests__/hooks/useWalkthrough.test.ts`, `frontend/__tests__/lib/walkthrough-steps.test.ts`

---

## Behavior 1: Tour Completion Persistence

### Test Specification
**Given**: A tour key `"writer"` and `localStorage` is empty
**When**: `setTourCompleted("writer")` is called
**Then**: `localStorage.getItem("walkthrough_writer")` returns `"true"`

**Edge cases**:
- `isTourCompleted` returns `false` when key not in storage
- `isTourCompleted` returns `true` when key is `"true"`
- `resetTourCompleted` removes the key
- SSR: returns `false` when `window` is undefined

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/walkthrough-persistence.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  isTourCompleted,
  setTourCompleted,
  resetTourCompleted,
  WALKTHROUGH_PREFIX,
} from '@/lib/walkthrough-persistence'

describe('walkthrough persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when tour has not been completed', () => {
    expect(isTourCompleted('writer')).toBe(false)
  })

  it('returns true after setTourCompleted is called', () => {
    setTourCompleted('writer')
    expect(isTourCompleted('writer')).toBe(true)
  })

  it('stores under the correct localStorage key', () => {
    setTourCompleted('writer')
    expect(localStorage.getItem(`${WALKTHROUGH_PREFIX}writer`)).toBe('true')
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
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/walkthrough-persistence.ts`
```typescript
export const WALKTHROUGH_PREFIX = 'walkthrough_'

export function isTourCompleted(tourKey: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(`${WALKTHROUGH_PREFIX}${tourKey}`) === 'true'
}

export function setTourCompleted(tourKey: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${WALKTHROUGH_PREFIX}${tourKey}`, 'true')
}

export function resetTourCompleted(tourKey: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(`${WALKTHROUGH_PREFIX}${tourKey}`)
}
```

#### 🔵 Refactor
No refactor needed — implementation is minimal.

### Success Criteria
**Automated:**
- [ ] Test fails for right reason (Red): `npm test -- walkthrough-persistence`
- [ ] Test passes (Green): `npm test -- walkthrough-persistence`
- [ ] All tests pass after refactor: `npm test`

---

## Behavior 2: Tour Steps Configuration

### Test Specification
**Given**: The writer tour config is imported
**When**: steps are accessed
**Then**: it returns 3 steps with correct selectors and descriptions

**Given**: The home tour config is imported
**When**: steps are accessed
**Then**: it returns 4 steps with correct selectors and descriptions

**Edge cases**:
- Each step has `element` (string selector) and `intro` (string content)
- Steps are ordered correctly (step numbers match array index + 1)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/lib/walkthrough-steps.test.ts`
```typescript
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
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/lib/walkthrough-steps.ts`
```typescript
export interface WalkthroughStep {
  element: string
  intro: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export const writerTourSteps: WalkthroughStep[] = [
  {
    element: '[data-testid="input-mode-url"]',
    intro:
      'Let us help with the job application — enter the URL for the job post here.',
    position: 'bottom',
  },
  {
    element: '[data-testid="input-mode-file_upload"]',
    intro:
      "If the job application has questions, take a screen shot and upload here. We can give you answers that aren't the usual AI slop. You'll stand out from the crowd!",
    position: 'bottom',
  },
  {
    element: '[data-testid="input-mode-default_questions"]',
    intro:
      'Want help for an upcoming interview or just want practice? Use our trained AI job coach. Copy your answers and use them in your applications too!',
    position: 'bottom',
  },
]

export const homeTourSteps: WalkthroughStep[] = [
  {
    element: 'button[aria-label="Record"]',
    intro:
      'Tap record and start talking. We record up to 5 minutes and transcribe for you.',
    position: 'bottom',
  },
  {
    element: 'button[aria-label="Attach files"]',
    intro: 'Attach any file.',
    position: 'top',
  },
  {
    element: 'textarea[aria-label="Message input"]',
    intro:
      'Chat with our Cosmic Agent about your recording, or your uploaded files.',
    position: 'top',
  },
  {
    element: 'button[aria-label="Voice Edit"]',
    intro:
      "Once the Cosmic Agent is done writing, just hit 'Voice Edit' and tell the Agent what you want changed. When you're ready to use what you've written, just hit the 'Copy' button and paste into your app! Use our agent and you'll never post AI slop again.",
    position: 'top',
  },
]
```

#### 🔵 Refactor
No refactor needed.

### Success Criteria
**Automated:**
- [ ] Test fails for right reason (Red): `npm test -- walkthrough-steps`
- [ ] Test passes (Green): `npm test -- walkthrough-steps`

---

## Behavior 3: `useWalkthrough` Hook (intro.js v8 API)

### Test Specification
**Given**: `useWalkthrough('writer', writerTourSteps)` is called
**When**: the hook returns
**Then**: it exposes `{ startTour, isCompleted, resetTour }`

**Given**: `startTour()` is called
**When**: intro.js runs
**Then**: `introJs.tour().setOptions({ steps }).start()` is invoked and `onComplete` callback sets localStorage

**Given**: tour completes (`onComplete` fires)
**When**: hook re-renders
**Then**: `isCompleted` is `true`

**Edge cases**:
- Calling `startTour()` when already completed still starts the tour (manual replay)
- `resetTour()` clears completion and sets `isCompleted` to `false`
- Hook cleans up intro.js `Tour` instance on unmount (async `exit()` with catch)

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/hooks/useWalkthrough.test.ts`
```typescript
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

// Each method returns `this` for chaining
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

const testSteps: WalkthroughStep[] = [
  { element: '#step1', intro: 'Step 1' },
  { element: '#step2', intro: 'Step 2' },
]

describe('useWalkthrough', () => {
  beforeEach(() => {
    localStorage.clear()
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
    localStorage.setItem('walkthrough_test', 'true')
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    expect(result.current.isCompleted).toBe(true)
  })

  it('startTour calls introJs.tour() and sets options with steps', () => {
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    act(() => { result.current.startTour() })

    const introJsMock = vi.mocked((await import('intro.js')).default)
    expect(introJsMock.tour).toHaveBeenCalled()
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
    expect(localStorage.getItem('walkthrough_test')).toBe('true')
  })

  it('resetTour clears completion', () => {
    localStorage.setItem('walkthrough_test', 'true')
    const { result } = renderHook(() => useWalkthrough('test', testSteps))
    expect(result.current.isCompleted).toBe(true)

    act(() => { result.current.resetTour() })
    expect(result.current.isCompleted).toBe(false)
    expect(localStorage.getItem('walkthrough_test')).toBeNull()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/hooks/useWalkthrough.ts`
```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import introJs from 'intro.js'
import {
  isTourCompleted,
  setTourCompleted,
  resetTourCompleted,
} from '@/lib/walkthrough-persistence'
import type { WalkthroughStep } from '@/lib/walkthrough-steps'

type TourInstance = ReturnType<typeof introJs.tour>

export function useWalkthrough(tourKey: string, steps: WalkthroughStep[]) {
  const [isCompleted, setIsCompleted] = useState(() => isTourCompleted(tourKey))
  const tourRef = useRef<TourInstance | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tourRef.current?.exit(true).catch(() => {})
    }
  }, [])

  const startTour = useCallback(() => {
    const tour = introJs.tour()
    tourRef.current = tour

    tour
      .setOptions({
        steps,
        showStepNumbers: false,
        showBullets: true,
        exitOnOverlayClick: true,
        doneLabel: 'Got it!',
      })
      .onComplete(() => {
        setTourCompleted(tourKey)
        setIsCompleted(true)
      })
      .onExit(() => {
        // Also mark as completed if user exits early — they've seen enough
        setTourCompleted(tourKey)
        setIsCompleted(true)
      })
      .start()
  }, [tourKey, steps])

  const resetTour = useCallback(() => {
    resetTourCompleted(tourKey)
    setIsCompleted(false)
  }, [tourKey])

  return { startTour, isCompleted, resetTour }
}
```

#### 🔵 Refactor
No refactor needed.

### Success Criteria
**Automated:**
- [ ] Test fails for right reason (Red): `npm test -- useWalkthrough`
- [ ] Test passes (Green): `npm test -- useWalkthrough`
- [ ] All tests pass: `npm test`

---

## Behavior 4: Auto-Start Tour on First Visit (`/writer`)

### Test Specification
**Given**: `/writer` page renders and tour not completed
**When**: component mounts
**Then**: `startTour()` is called after a short delay

**Given**: `/writer` page renders and tour already completed
**When**: component mounts
**Then**: `startTour()` is NOT called

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/WriterTour.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('clicking "Take the tour" calls startTour', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<WriterTourProvider />)
    await user.click(screen.getByRole('button', { name: /take the tour/i }))
    expect(mockStartTour).toHaveBeenCalled()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/walkthrough/WriterTourProvider.tsx`
```typescript
'use client'

import { useEffect } from 'react'
import { useWalkthrough } from '@/hooks/useWalkthrough'
import { writerTourSteps } from '@/lib/walkthrough-steps'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

export function WriterTourProvider() {
  const { startTour, isCompleted } = useWalkthrough('writer', writerTourSteps)

  // Auto-start on first visit with delay for DOM to settle
  useEffect(() => {
    if (!isCompleted) {
      const timer = setTimeout(startTour, 500)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, startTour])

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={startTour}
      aria-label="Take the tour"
    >
      <HelpCircle className="mr-1 h-4 w-4" />
      Take the tour
    </Button>
  )
}
```

#### Integration: Mount in `/writer` page
**File**: `frontend/src/app/writer/page.tsx`
```tsx
// Add import
import { WriterTourProvider } from '@/components/walkthrough/WriterTourProvider'

// Add inside <main>, after the closing </Card> tag (line ~49), before </main>:
<WriterTourProvider />
```

### Success Criteria
**Automated:**
- [ ] Test fails (Red): `npm test -- WriterTour`
- [ ] Test passes (Green): `npm test -- WriterTour`

---

## Behavior 5: Auto-Start Tour on First Visit (`/`) — Gated on `activeProjectId`

### Test Specification
**Given**: `/` page renders, `activeProjectId` is set (ready=true), and home tour not completed
**When**: component mounts
**Then**: `startTour()` is called after delay

**Given**: `activeProjectId` is null (ready=false)
**When**: component mounts
**Then**: `startTour()` is NOT called even if tour is not completed

**Given**: home tour already completed
**When**: page loads with ready=true
**Then**: `startTour()` is NOT called

### TDD Cycle

#### 🔴 Red: Write Failing Test
**File**: `frontend/__tests__/components/HomeTour.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('clicking "Take the tour" calls startTour regardless of ready', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<HomeTourProvider ready={false} />)
    await user.click(screen.getByRole('button', { name: /take the tour/i }))
    expect(mockStartTour).toHaveBeenCalled()
  })
})
```

#### 🟢 Green: Minimal Implementation
**File**: `frontend/src/components/walkthrough/HomeTourProvider.tsx`
```typescript
'use client'

import { useEffect } from 'react'
import { useWalkthrough } from '@/hooks/useWalkthrough'
import { homeTourSteps } from '@/lib/walkthrough-steps'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface HomeTourProviderProps {
  ready?: boolean
}

export function HomeTourProvider({ ready = true }: HomeTourProviderProps) {
  const { startTour, isCompleted } = useWalkthrough('home', homeTourSteps)

  // Auto-start only when DOM targets are available (activeProjectId is set)
  useEffect(() => {
    if (!isCompleted && ready) {
      const timer = setTimeout(startTour, 500)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, ready, startTour])

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={startTour}
      aria-label="Take the tour"
    >
      <HelpCircle className="mr-1 h-4 w-4" />
      Take the tour
    </Button>
  )
}
```

#### Integration: Mount in `/` page
**File**: `frontend/src/app/page.tsx`
```tsx
// Add import
import { HomeTourProvider } from '@/components/walkthrough/HomeTourProvider'

// Add inside the top bar div (line ~224), next to existing controls:
// Pass activeProjectId as the ready gate
<HomeTourProvider ready={!!activeProjectId} />
```

### Success Criteria
**Automated:**
- [ ] Test fails (Red): `npm test -- HomeTour`
- [ ] Test passes (Green): `npm test -- HomeTour`

---

## Behavior 6: CSS Theme Integration

### Test Specification
No automated test — this is a styling concern verified visually.

### Implementation
**File**: `frontend/src/app/globals.css`
```css
/* intro.js theme overrides */
.introjs-tooltip {
  border-radius: 0.75rem;
  font-family: inherit;
  border: 1px solid hsl(var(--border));
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.introjs-tooltiptext {
  color: hsl(var(--foreground));
  font-size: 0.9rem;
  line-height: 1.5;
}

.introjs-button {
  border-radius: 0.5rem;
  font-size: 0.85rem;
  text-shadow: none;
  border: 1px solid hsl(var(--border));
}

.introjs-button:hover {
  background-color: hsl(var(--accent));
}

.introjs-skipbutton {
  color: hsl(var(--muted-foreground));
}

.introjs-helperLayer {
  border-radius: 0.75rem;
}

.introjs-donebutton {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.introjs-donebutton:hover {
  background-color: hsl(var(--primary) / 0.9);
}
```

**File**: `frontend/src/app/layout.tsx` — add CSS import:
```tsx
import 'intro.js/minified/introjs.min.css'
```

### Success Criteria
**Manual:**
- [ ] Tooltip matches app border radius and colors
- [ ] Buttons use primary color scheme
- [ ] Overlay doesn't clash with existing UI

---

## Implementation Order

| # | Behavior | Files Created/Modified | Depends On |
|---|---|---|---|
| 0 | Install intro.js | `package.json` | — |
| 1 | Persistence | `src/lib/walkthrough-persistence.ts` | — |
| 2 | Steps config | `src/lib/walkthrough-steps.ts` | — |
| 3 | Hook (v8 API) | `src/hooks/useWalkthrough.ts` | 1, 2 |
| 4 | Writer tour provider | `src/components/walkthrough/WriterTourProvider.tsx`, `app/writer/page.tsx` | 3 |
| 5 | Home tour provider (ready gate) | `src/components/walkthrough/HomeTourProvider.tsx`, `app/page.tsx` | 3 |
| 6 | CSS theming | `globals.css`, `layout.tsx` | 0 |

## New Files Summary

```
frontend/
├── src/
│   ├── lib/
│   │   ├── walkthrough-persistence.ts    (localStorage helpers)
│   │   └── walkthrough-steps.ts          (step configs for both tours)
│   ├── hooks/
│   │   └── useWalkthrough.ts             (core hook — intro.js v8 Tour API)
│   └── components/
│       └── walkthrough/
│           ├── WriterTourProvider.tsx     (writer page tour + button)
│           └── HomeTourProvider.tsx       (home page tour + button, ready prop)
└── __tests__/
    ├── lib/
    │   ├── walkthrough-persistence.test.ts
    │   └── walkthrough-steps.test.ts
    ├── hooks/
    │   └── useWalkthrough.test.ts
    └── components/
        ├── WriterTour.test.tsx
        └── HomeTour.test.tsx
```

## Review Amendments Applied

This plan addresses all critical issues from the review (`2026-03-05--tdd-introjs-walkthrough-tours-REVIEW.md`):

1. **intro.js v8 API** — Hook uses `introJs.tour()` (not deprecated `introJs()`), `onComplete`/`onExit` (camelCase), `ReturnType<typeof introJs.tour>` for typing, async `exit().catch()`
2. **Home tour ready gate** — `HomeTourProvider` accepts `ready` prop, gated on `!!activeProjectId` from `page.tsx`. Tour does not auto-start until DOM targets exist.
3. **Test syntax fix** — `WriterTour.test.tsx` uses `vi.mocked(useWalkthrough).mockReturnValue(...)` pattern instead of broken `await import()` in non-async callback
4. **Test mock structure** — All intro.js mocks use v8 shape: `{ default: { tour: vi.fn(() => instance) } }` with chainable methods

## References

- intro.js v8 docs: https://introjs.com/docs/tour/api
- intro.js v8 migration: https://introjs.com/docs/migration/introjs-v8-migration
- Existing localStorage pattern: `frontend/src/lib/image-streaming.ts:90-107`
- Existing hook pattern: `frontend/src/hooks/useAutoReadAloud.ts`
- Existing component test pattern: `frontend/__tests__/components/MessageInput.test.tsx`
- Writer page selectors: `frontend/src/modules/session/StartVoiceSessionModule.tsx:181-210`
- Home page selectors: `AudioRecorder.tsx:323`, `FileAttachment.tsx:186`, `MessageInput.tsx:62`, `VoiceEditPanel.tsx:26`
- Home page activeProjectId gate: `frontend/src/app/page.tsx:222`
- Writer page RequireAuth gate: `frontend/src/modules/session/StartVoiceSessionModule.tsx:163`
