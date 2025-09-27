'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

interface OnboardingStep {
  id: string
  selector: string
  title: string
  description: string
}

const STORAGE_KEY = 'trip3:onboardingSeen:v1'
const HIGHLIGHT_CLASS = 'trip3-onboarding-highlight'
const MAX_SELECTOR_ATTEMPTS = 12

export function AppOnboarding() {
  const [mounted, setMounted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null)

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: 'timeline',
        selector: '[data-tour="timeline"]',
        title: 'Organize each day',
        description: 'Use the day list to add new days, jump between them, and keep your itinerary structured.'
      },
      {
        id: 'day-details',
        selector: '[data-tour="day-details"]',
        title: 'Plan activities & stays',
        description: 'Add accommodations, drag destinations, and capture notes for the day you have selected.'
      },
      {
        id: 'map',
        selector: '[data-tour="map"]',
        title: 'Visualize the trip',
        description: 'The map updates with your selections so you can review routes, markers, and travel context instantly.'
      },
      {
        id: 'explore',
        selector: '[data-tour="explore"]',
        title: 'Discover places anywhere',
        description: 'Search cities or points of interest and drop them into the itinerary or keep them for later discovery.'
      },
      {
        id: 'profile',
        selector: '[data-tour="profile"]',
        title: 'Account & collaboration',
        description: 'Access sharing options, profile actions, and future workspace tools from your account menu.'
      }
    ], []
  )

  const finishTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    }
    setIsRunning(false)
    setStepIndex(0)
    setTargetRect(null)
    setHighlightedElement(null)
  }, [])

  const startTour = useCallback(() => {
    setStepIndex(0)
    setTargetRect(null)
    setHighlightedElement(null)
    setIsRunning(true)
  }, [])

  const goToNextStep = useCallback(() => {
    setStepIndex((current) => {
      if (current >= steps.length - 1) {
        finishTour()
        return current
      }
      return current + 1
    })
  }, [finishTour, steps.length])

  const goToPreviousStep = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1))
  }, [])

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    const seen = window.localStorage.getItem(STORAGE_KEY)
    const timer = !seen
      ? window.setTimeout(() => {
          startTour()
        }, 1500)
      : undefined

    const handleManualStart = () => {
      window.localStorage.removeItem(STORAGE_KEY)
      startTour()
    }

    window.addEventListener('trip3:start-onboarding', handleManualStart)

    return () => {
      if (timer) {
        window.clearTimeout(timer)
      }
      window.removeEventListener('trip3:start-onboarding', handleManualStart)
    }
  }, [startTour])

  useEffect(() => {
    if (!isRunning) {
      if (highlightedElement) {
        highlightedElement.classList.remove(HIGHLIGHT_CLASS)
      }
      return
    }

    const step = steps[stepIndex]
    if (!step) {
      finishTour()
      return
    }

    let isCancelled = false
    let attempts = 0

    const locateTarget = () => {
      if (isCancelled) return
      const element = document.querySelector(step.selector) as HTMLElement | null

      if (element) {
        setHighlightedElement((previous) => {
          if (previous && previous !== element) {
            previous.classList.remove(HIGHLIGHT_CLASS)
          }
          element.classList.add(HIGHLIGHT_CLASS)
          return element
        })
        setTargetRect(element.getBoundingClientRect())
      } else if (attempts < MAX_SELECTOR_ATTEMPTS) {
        attempts += 1
        window.setTimeout(locateTarget, 300)
      } else {
        goToNextStep()
      }
    }

    locateTarget()

    const handleViewportChange = () => {
      if (!isRunning) return
      const element = document.querySelector(step.selector) as HTMLElement | null
      if (element) {
        setTargetRect(element.getBoundingClientRect())
      }
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [finishTour, goToNextStep, highlightedElement, isRunning, stepIndex, steps])

  useEffect(() => {
    return () => {
      highlightedElement?.classList.remove(HIGHLIGHT_CLASS)
    }
  }, [highlightedElement])

  if (!mounted || !isRunning) {
    return null
  }

  const activeStep = steps[stepIndex]
  if (!activeStep) {
    return null
  }

  const tooltipWidth = 320
  const tooltipHeight = 176
  const tooltipOffset = 28
  const rect = targetRect

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  const padding = 12

  const highlightBounds = rect
    ? {
        top: Math.max(rect.top - padding, 8),
        left: Math.max(rect.left - padding, 8),
        right: Math.min(rect.right + padding, viewportWidth - 8),
        bottom: Math.min(rect.bottom + padding, viewportHeight - 8)
      }
    : null

  const highlightStyles = highlightBounds
    ? {
        top: highlightBounds.top,
        left: highlightBounds.left,
        width: Math.max(highlightBounds.right - highlightBounds.left, 0),
        height: Math.max(highlightBounds.bottom - highlightBounds.top, 0)
      }
    : undefined

  const spaceTop = highlightBounds ? highlightBounds.top - 24 : 0
  const spaceBottom = highlightBounds ? viewportHeight - highlightBounds.bottom - 24 : 0
  const spaceLeft = highlightBounds ? highlightBounds.left - 24 : 0
  const spaceRight = highlightBounds ? viewportWidth - highlightBounds.right - 24 : 0

  const placementPriority: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left']

  const placement = highlightBounds
    ? placementPriority.find((candidate) => {
        switch (candidate) {
          case 'top':
            return spaceTop >= tooltipHeight + 16
          case 'bottom':
            return spaceBottom >= tooltipHeight + 16
          case 'left':
            return spaceLeft >= tooltipWidth + 16
          case 'right':
            return spaceRight >= tooltipWidth + 16
          default:
            return false
        }
      }) ?? 'bottom'
    : 'bottom'

  let tooltipTop = viewportHeight / 2 - tooltipHeight / 2
  let tooltipLeft = viewportWidth / 2 - tooltipWidth / 2

  if (highlightBounds) {
    switch (placement) {
      case 'top':
        tooltipTop = highlightBounds.top - tooltipHeight - tooltipOffset
        tooltipLeft = highlightBounds.left + (highlightBounds.right - highlightBounds.left) / 2 - tooltipWidth / 2
        break
      case 'bottom':
        tooltipTop = highlightBounds.bottom + tooltipOffset
        tooltipLeft = highlightBounds.left + (highlightBounds.right - highlightBounds.left) / 2 - tooltipWidth / 2
        break
      case 'left':
        tooltipLeft = highlightBounds.left - tooltipWidth - tooltipOffset
        tooltipTop = highlightBounds.top + (highlightBounds.bottom - highlightBounds.top) / 2 - tooltipHeight / 2
        break
      case 'right':
        tooltipLeft = highlightBounds.right + tooltipOffset
        tooltipTop = highlightBounds.top + (highlightBounds.bottom - highlightBounds.top) / 2 - tooltipHeight / 2
        break
    }

    tooltipTop = Math.min(Math.max(tooltipTop, 24), viewportHeight - tooltipHeight - 24)
    tooltipLeft = Math.min(Math.max(tooltipLeft, 24), viewportWidth - tooltipWidth - 24)
  }

  const arrowLeft = highlightBounds
    ? placement === 'left' || placement === 'right'
      ? (placement === 'right' ? -8 : tooltipWidth - 8)
      : Math.min(
          Math.max((highlightBounds.left + (highlightBounds.right - highlightBounds.left) / 2) - tooltipLeft - 8, 24),
          tooltipWidth - 24
        )
    : tooltipWidth / 2 - 8

  const arrowTop = highlightBounds
    ? placement === 'top' || placement === 'bottom'
      ? (placement === 'bottom' ? -8 : tooltipHeight - 8)
      : Math.min(
          Math.max((highlightBounds.top + (highlightBounds.bottom - highlightBounds.top) / 2) - tooltipTop - 8, 24),
          tooltipHeight - 24
        )
    : tooltipHeight / 2 - 8

  const overlays = highlightBounds
    ? [
        {
          top: 0,
          left: 0,
          width: '100%',
          height: highlightBounds.top
        },
        {
          top: highlightBounds.bottom,
          left: 0,
          width: '100%',
          height: Math.max(viewportHeight - highlightBounds.bottom, 0)
        },
        {
          top: highlightBounds.top,
          left: 0,
          width: highlightBounds.left,
          height: Math.max(highlightBounds.bottom - highlightBounds.top, 0)
        },
        {
          top: highlightBounds.top,
          left: highlightBounds.right,
          width: Math.max(viewportWidth - highlightBounds.right, 0),
          height: Math.max(highlightBounds.bottom - highlightBounds.top, 0)
        }
      ]
    : [
        { top: 0, left: 0, width: '100%', height: '100%' as const }
      ]

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto">
        {overlays.map((overlay, index) => (
          <div
            key={index}
            className="absolute bg-slate-950/80 backdrop-blur-sm"
            style={overlay}
          />
        ))}
      </div>

      {highlightStyles && (
        <div
          className="pointer-events-none fixed rounded-2xl border border-cyan-300/80 shadow-[0_0_30px_rgba(56,189,248,0.45)] transition-all duration-200"
          style={highlightStyles}
        />
      )}

      <div
        className="pointer-events-auto fixed w-[320px] rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-white shadow-2xl"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
          Step {stepIndex + 1} of {steps.length}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{activeStep.title}</h3>
        <p className="text-sm text-white/70 leading-relaxed mb-5">
          {activeStep.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={finishTour}
            className="text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-white transition"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousStep}
              disabled={stepIndex === 0}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 transition hover:border-white/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={goToNextStep}
              className="rounded-lg bg-blue-500/80 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              {stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <div
          className={`absolute h-4 w-4 rotate-45 border border-white/10 bg-slate-900/95 ${
            placement === 'bottom'
              ? 'border-b-0 border-r-0'
              : placement === 'top'
              ? 'border-t-0 border-l-0'
              : placement === 'right'
              ? 'border-r-0 border-t-0'
              : 'border-l-0 border-b-0'
          }`}
          style={{
            top:
              placement === 'bottom'
                ? -8
                : placement === 'top'
                ? tooltipHeight - 8
                : arrowTop,
            left:
              placement === 'right'
                ? -8
                : placement === 'left'
                ? tooltipWidth - 8
                : arrowLeft
          }}
        />
      </div>
    </div>,
    document.body
  )
}
