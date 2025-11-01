'use client'

import { TripHeader } from '@/components/left-panel/TripHeader'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

export function TopNavbarOverlay() {
  const currentTrip = useSupabaseTripStore((state) => state.currentTrip)

  if (!currentTrip) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-4">
      <TripHeader className="pointer-events-auto w-full max-w-[min(1200px,calc(100vw-2rem))]" variant="navbar" />
    </div>
  )
}
