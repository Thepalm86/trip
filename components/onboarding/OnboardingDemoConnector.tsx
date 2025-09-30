'use client'

import { useEffect, useState } from 'react'
import { useOnboardingStore } from '@/lib/store/onboarding-store'

interface ConnectorPoints {
  startX: number
  startY: number
  endX: number
  endY: number
}

export function OnboardingDemoConnector() {
  const isDemoActive = useOnboardingStore((state) => state.isDemoActive)
  const currentStepId = useOnboardingStore((state) => state.currentStepId)
  const [points, setPoints] = useState<ConnectorPoints | null>(null)

  useEffect(() => {
    if (!isDemoActive || currentStepId !== 'map-marker-types') {
      setPoints(null)
      return
    }

    let animationFrame = 0

    const updatePoints = () => {
      const card = document.querySelector('[data-tour="itinerary-card-demo"]') as HTMLElement | null
      const marker = document.querySelector('[data-tour="map-demo-marker-itinerary"]') as HTMLElement | null

      if (!card || !marker) {
        setPoints(null)
        return
      }

      const cardRect = card.getBoundingClientRect()
      const markerRect = marker.getBoundingClientRect()

      const startX = cardRect.right
      const startY = cardRect.top + cardRect.height / 2
      const endX = markerRect.left + markerRect.width / 2
      const endY = markerRect.top + markerRect.height / 2

      setPoints({ startX, startY, endX, endY })
    }

    const handleResize = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(updatePoints)
    }

    updatePoints()
    animationFrame = requestAnimationFrame(updatePoints)

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [currentStepId, isDemoActive])

  if (!points) {
    return null
  }

  const { startX, startY, endX, endY } = points
  const controlX = (startX + endX) / 2
  const controlY = Math.min(startY, endY) - 120
  const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`

  return (
    <svg className="pointer-events-none absolute inset-0 z-[10000]" data-tour="map-demo-connector">
      <defs>
        <marker
          id="onboarding-arrow"
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 12 6 L 0 12 z" fill="rgba(125, 211, 252, 0.9)" />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="rgba(125, 211, 252, 0.75)"
        strokeWidth="3"
        strokeDasharray="8 8"
        markerEnd="url(#onboarding-arrow)"
      />
    </svg>
  )
}
