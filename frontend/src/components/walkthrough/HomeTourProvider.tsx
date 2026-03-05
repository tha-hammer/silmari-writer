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
