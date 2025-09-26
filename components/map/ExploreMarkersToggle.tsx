'use client'

import { MapPin, Eye, EyeOff } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'

interface ExploreMarkersToggleProps {
  map: any
}

export function ExploreMarkersToggle({ map }: ExploreMarkersToggleProps) {
  const showMarkers = useExploreStore((state) => state.showMarkers)
  const toggleMarkers = useExploreStore((state) => state.toggleMarkers)
  const activePlaces = useExploreStore((state) => state.activePlaces)

  if (activePlaces.length === 0) {
    return null // Don't show toggle if there are no explore markers
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 ml-36">
      <div className="bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-lg overflow-hidden">
        {/* Toggle Header */}
        <button
          onClick={toggleMarkers}
          className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-white/5 transition-all duration-200"
        >
          <MapPin className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Explore Markers</span>
          {showMarkers ? (
            <Eye className="h-4 w-4 text-white/60 ml-auto" />
          ) : (
            <EyeOff className="h-4 w-4 text-white/60 ml-auto" />
          )}
        </button>
      </div>
    </div>
  )
}
