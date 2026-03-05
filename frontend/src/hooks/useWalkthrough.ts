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
