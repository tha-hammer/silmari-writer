'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isTourCompleted,
  setTourCompleted,
  resetTourCompleted,
} from '@/lib/walkthrough-persistence'
import type { WalkthroughStep } from '@/lib/walkthrough-steps'

export function useWalkthrough(tourKey: string, steps: WalkthroughStep[]) {
  const [isCompleted, setIsCompleted] = useState(() => isTourCompleted(tourKey))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tourRef = useRef<any>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tourRef.current?.exit(true).catch(() => {})
    }
  }, [])

  const startTour = useCallback(async () => {
    // Dynamic import to avoid "document is not defined" during SSR
    const introJs = (await import('intro.js')).default
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
