'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { InteractiveMap } from '@/components/map/InteractiveMap'
import { AssistantBubbleOverlay } from '@/components/assistant/AssistantBubbleOverlay'
import { ItineraryOverlay } from '@/components/overlays/ItineraryOverlay'
import { TopNavbarOverlay } from '@/components/overlays/TopNavbarOverlay'
import { AuthGuard } from '@/components/auth/auth-guard'
import { TripLoader } from '@/components/trip/TripLoader'
import { ResearchCommandPalette } from '@/components/research/ResearchCommandPalette'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

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

  return (
    <AuthGuard>
      <TripLoader />
      {!isReady ? (
        <div className="flex h-screen items-center justify-center bg-gradient-dark text-white/70">
          Preparing your workspace...
        </div>
      ) : (
        <div className="h-screen bg-gradient-dark map-viewport-container page-container overflow-hidden">
          <div className="relative h-full w-full">
            <div className="map-container h-full w-full">
              <InteractiveMap />
            </div>
          </div>
          <TopNavbarOverlay />
          <ItineraryOverlay />
          <AssistantBubbleOverlay />
          <ResearchCommandPalette />
        </div>
      )}
    </AuthGuard>
  )
}
