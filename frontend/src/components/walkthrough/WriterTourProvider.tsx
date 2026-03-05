'use client'

import { useEffect } from 'react'
import { useWalkthrough } from '@/hooks/useWalkthrough'
import { writerTourSteps } from '@/lib/walkthrough-steps'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

export function WriterTourProvider() {
  const { startTour, isCompleted } = useWalkthrough('writer', writerTourSteps)

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
