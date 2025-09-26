'use client'

import { useState } from 'react'
import { X, MapPin, Globe2, PlusCircle, Building2 } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import { AddExplorePlaceModal } from '../modals/AddExplorePlaceModal'

export function ExplorePreviewDrawer() {
  const selectedPlace = useExploreStore((state) => state.selectedPlace)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const removeActivePlace = useExploreStore((state) => state.removeActivePlace)
  const [mode, setMode] = useState<'destination' | 'base' | null>(null)

  if (!selectedPlace) {
    return null
  }

  return (
    <>
      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Preview</div>
              <h2 className="mt-2 text-2xl font-light text-white">{selectedPlace.name}</h2>
              <p className="mt-1 text-sm text-white/70 line-clamp-2">{selectedPlace.fullName}</p>
              {selectedPlace.context && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
                  <Globe2 className="h-3 w-3" />
                  {selectedPlace.context}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedPlace(null)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-white/10 p-5 sm:grid-cols-2">
            <button
              onClick={() => setMode('destination')}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-white transition hover:border-blue-400/50 hover:bg-blue-500/10"
            >
              <PlusCircle className="h-5 w-5 text-blue-300" />
              <div>
                <div className="text-sm font-semibold">Add as Activity</div>
                <div className="text-xs text-white/60">Select a day to include this place in your itinerary</div>
              </div>
            </button>
            <button
              onClick={() => setMode('base')}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-white transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
            >
              <Building2 className="h-5 w-5 text-emerald-300" />
              <div>
                <div className="text-sm font-semibold">Set as Base Location</div>
                <div className="text-xs text-white/60">Choose which day should use this as a hub</div>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-white/50">
            <span>Coordinates: {selectedPlace.coordinates[1].toFixed(4)}, {selectedPlace.coordinates[0].toFixed(4)}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {selectedPlace.category || 'Location'}
            </span>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4 text-xs text-white/60">
            <button
              onClick={() => {
                removeActivePlace(selectedPlace.id)
                setSelectedPlace(null)
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 uppercase tracking-wide transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Remove marker
            </button>
          </div>
        </div>
      </div>

      {mode && (
        <AddExplorePlaceModal
          place={selectedPlace}
          mode={mode}
          onClose={() => setMode(null)}
          onComplete={() => {
            setMode(null)
            setSelectedPlace(null)
          }}
        />
      )}
    </>
  )
}
