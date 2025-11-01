'use client'

import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { ItineraryTab } from '@/components/left-panel/ItineraryTab'

export function ItineraryOverlay() {
  const currentTrip = useSupabaseTripStore((state) => state.currentTrip)

  if (!currentTrip) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-y-6 left-4 z-[55] flex max-h-[calc(100vh-3rem)]">
      <div className="pointer-events-auto flex h-full w-[min(980px,calc(100vw-5rem))] flex-col">
        <div className="flex-1 overflow-hidden rounded-[32px] border border-white/12 bg-slate-950/80 shadow-[0_45px_120px_-40px_rgba(8,15,35,0.95)] backdrop-blur-2xl">
          <ItineraryTab />
        </div>
      </div>
    </div>
  )
}
