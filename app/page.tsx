'use client'

import { useEffect, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { InteractiveMap } from '@/components/map/InteractiveMap'
import { AssistantBubbleOverlay } from '@/components/assistant/AssistantBubbleOverlay'
import { ItineraryOverlay } from '@/components/overlays/ItineraryOverlay'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TripLoader } from '@/components/trip/TripLoader'
import { ResearchCommandPalette } from '@/components/research/ResearchCommandPalette'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { TripHeader } from '@/components/left-panel/TripHeader'

export default function HomePage() {
  const router = useRouter()
  const hasLoadedTrips = useSupabaseTripStore((state) => state.hasLoadedTrips)
  const trips = useSupabaseTripStore((state) => state.trips)
  const loading = useSupabaseTripStore((state) => state.loading)
  const isLoadingTrips = loading.trips

  useEffect(() => {
    if (hasLoadedTrips && !isLoadingTrips && trips.length === 0) {
      router.replace('/setup')
    }
  }, [hasLoadedTrips, isLoadingTrips, router, trips.length])

  const isReady = hasLoadedTrips && trips.length > 0 && !loading.trips

  const layoutStyle = { '--navbar-height': '88px' } as CSSProperties

  return (
    <AuthGuard>
      <TripLoader />
      {!isReady ? (
        <div className="flex h-screen items-center justify-center bg-gradient-dark text-white/70">
          Preparing your workspace...
        </div>
      ) : (
        <div
          className="flex h-screen flex-col bg-gradient-dark map-viewport-container page-container overflow-hidden"
          style={layoutStyle}
        >
          <header className="fixed inset-x-0 top-0 z-50 h-[88px]">
            <TripHeader variant="navbar" className="h-full" />
          </header>
          <main className="relative flex-1 pt-[88px]" style={{ paddingTop: 'var(--navbar-height, 88px)' }}>
            <div className="relative h-full w-full">
              <div className="map-container h-full w-full">
                <InteractiveMap />
              </div>
            </div>
            <ItineraryOverlay />
            <AssistantBubbleOverlay />
            <ResearchCommandPalette />
          </main>
        </div>
      )}
    </AuthGuard>
  )
}
