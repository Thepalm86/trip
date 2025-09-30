'use client'

import { MapPin } from 'lucide-react'
import { useOnboardingStore } from '@/lib/store/onboarding-store'

export function OnboardingDemoMapOverlay() {
  const isDemoActive = useOnboardingStore((state) => state.isDemoActive)
  const currentStepId = useOnboardingStore((state) => state.currentStepId)

  if (!isDemoActive) {
    return null
  }

  const emphasizeMarkers = currentStepId === 'map-marker-types'

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      data-tour="map-demo-markers"
    >
      <div className="relative flex items-center gap-20">
        <MarkerCallout
          variant="filled"
          title="Itinerary marker"
          description="Appears when a destination is added to your plan"
          highlight={emphasizeMarkers}
          dataAttribute="map-demo-marker-itinerary"
        />
        <MarkerCallout
          variant="hollow"
          title="Explore marker"
          description="Shows saved ideas from Explore before you commit"
          highlight={emphasizeMarkers}
          dataAttribute="map-demo-marker-explore"
        />
      </div>
    </div>
  )
}

interface MarkerCalloutProps {
  variant: 'filled' | 'hollow'
  title: string
  description: string
  highlight: boolean
  dataAttribute: string
}

function MarkerCallout({ variant, title, description, highlight, dataAttribute }: MarkerCalloutProps) {
  const isFilled = variant === 'filled'

  return (
    <div className={`flex flex-col items-center gap-3 text-center transition-transform duration-300 ${
      highlight ? 'scale-105' : 'scale-100'
    }`}>
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-4 shadow-2xl shadow-black/30 backdrop-blur-sm ${
          isFilled
            ? 'border-blue-400/80 bg-blue-500/50'
            : 'border-white/60 bg-transparent'
        }`}
        data-tour={dataAttribute}
      >
        <MapPin
          className={`h-8 w-8 stroke-[2.25] ${
            isFilled ? 'text-white fill-white/80' : 'text-white/80'
          }`}
          style={{ fill: isFilled ? 'rgba(191,219,254,0.85)' : 'transparent' }}
        />
        {isFilled ? (
          <div className="absolute inset-0 rounded-full border border-white/40 opacity-50" />
        ) : null}
      </div>
      <div className="w-44 rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white/80 shadow-lg">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <p className="mt-2 text-xs leading-relaxed text-white/60">{description}</p>
      </div>
    </div>
  )
}
