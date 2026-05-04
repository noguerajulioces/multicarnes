import { useCallback, useEffect, useRef } from 'react'
import { useTour, type StepType } from '@reactour/tour'
import { hasTourBeenSeen, useTourStore } from '../store/tour.store'

interface UsePageTourOptions {
  key: string
  steps: StepType[]
  ready?: boolean
  delayMs?: number
}

interface UsePageTourResult {
  startTour: () => void
}

export function usePageTour({
  key,
  steps,
  ready = true,
  delayMs = 600
}: UsePageTourOptions): UsePageTourResult {
  const { setIsOpen, setCurrentStep, setSteps } = useTour()
  const markSeen = useTourStore((s) => s.markSeen)
  const openedRef = useRef(false)

  useEffect(() => {
    if (!ready || openedRef.current) return
    if (hasTourBeenSeen(key)) return
    const id = setTimeout(() => {
      openedRef.current = true
      setSteps?.(steps)
      setCurrentStep(0)
      setIsOpen(true)
      markSeen(key)
    }, delayMs)
    return () => clearTimeout(id)
  }, [ready, key, steps, delayMs, setSteps, setCurrentStep, setIsOpen, markSeen])

  const startTour = useCallback(() => {
    setSteps?.(steps)
    setCurrentStep(0)
    setIsOpen(true)
  }, [steps, setSteps, setCurrentStep, setIsOpen])

  return { startTour }
}
