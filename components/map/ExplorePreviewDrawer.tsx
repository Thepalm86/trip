'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, MapPin, PlusCircle, Building2, Eye, Edit, Trash2 } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import { AddExplorePlaceModal } from '../modals/AddExplorePlaceModal'
import { DestinationOverviewModal } from '../modals/DestinationOverviewModal'
import { DestinationEditModal } from '../modals/DestinationEditModal'
import { Destination } from '@/types'
import { fallbackCityFromFullName } from '@/lib/location/city'
import { getExploreCategoryMetadata } from '@/lib/explore/categories'

const applyAlpha = (hex: string, alpha: string) => {
  if (hex.startsWith('#') && hex.length === 7) {
    return `${hex}${alpha}`
  }
  return hex
}

export function ExplorePreviewDrawer() {
  const selectedPlace = useExploreStore((state) => state.selectedPlace)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const removeActivePlace = useExploreStore((state) => state.removeActivePlace)
  const [mode, setMode] = useState<'destination' | 'base' | null>(null)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    return () => {
      setMode(null)
    }
  }, [])

  useEffect(() => {
    if (!selectedPlace) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setSelectedPlace(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedPlace, setSelectedPlace])

  // Helper function to convert explore place to destination format
  const convertToDestination = (place: any): Destination => ({
    id: `explore-${place.id}`,
    name: place.name,
    description: place.fullName,
    coordinates: place.coordinates,
    city: (() => {
      if (place.city && place.city.length > 0) {
        return place.city
      }
      const city = fallbackCityFromFullName(place.fullName)
      return city === 'Unknown' ? undefined : city
    })(),
    category: place.category || 'attraction',
    notes: place.notes,
    estimatedDuration: undefined,
    cost: undefined,
    links: []
  })

  // Handle view details
  const handleViewDetails = () => {
    setShowOverviewModal(true)
  }

  // Handle edit
  const handleEdit = () => {
    setShowEditModal(true)
  }

  // Handle remove marker
  const handleRemoveMarker = () => {
    if (selectedPlace) {
      removeActivePlace(selectedPlace.id)
      setSelectedPlace(null)
    }
  }

  const categoryMetadata = useMemo(
    () => getExploreCategoryMetadata(selectedPlace?.category),
    [selectedPlace?.category],
  )

  const accentColor = categoryMetadata.colors.border

  const quickActionStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${applyAlpha(accentColor, '22')} 0%, rgba(15, 23, 42, 0.85) 100%)`,
      borderColor: applyAlpha(accentColor, '88'),
      color: '#e2e8f0',
    }),
    [accentColor],
  )

  const containerStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${applyAlpha(accentColor, '24')} 0%, rgba(15, 23, 42, 0.78) 100%)`,
      borderColor: applyAlpha(accentColor, '88'),
      boxShadow: `0 24px 60px ${applyAlpha(accentColor, '24')}`,
    }),
    [accentColor],
  )

  if (!selectedPlace) {
    return null
  }
  
  const fallbackCity = fallbackCityFromFullName(selectedPlace.fullName)
  const displayCity = (() => {
    if (selectedPlace.city && selectedPlace.city.length > 0) {
      return selectedPlace.city
    }
    return fallbackCity !== 'Unknown' ? fallbackCity : null
  })()
  const isCityCategory = categoryMetadata.key === 'city'

  return (
    <>
      <div ref={containerRef} className="pointer-events-auto absolute bottom-6 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="group rounded-3xl border bg-slate-900/80 backdrop-blur-2xl" style={containerStyle}>
          <div className="relative flex items-start justify-between gap-4 p-5">
            <div className="flex-1 min-w-0 pr-28">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Preview</div>
              <div className="mt-2 space-y-1">
                <h2 className="text-2xl font-light text-white leading-tight">
                  {isCityCategory && displayCity ? displayCity : selectedPlace.name}
                </h2>
                {!isCityCategory && (
                  <p className="text-sm text-white/70 leading-snug">
                    {displayCity ?? selectedPlace.fullName}
                  </p>
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute top-5 right-5 hidden flex-wrap items-center justify-end gap-2 group-hover:flex">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMode('destination')
                }}
                className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                style={quickActionStyle}
                title="Add as activity"
                aria-label="Add as activity"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMode('base')
                }}
                className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                style={quickActionStyle}
                title="Set as accommodation"
                aria-label="Set as accommodation"
              >
                <Building2 className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewDetails()
                }}
                className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                style={quickActionStyle}
                title="View details"
                aria-label="View details"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit()
                }}
                className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                style={quickActionStyle}
                title="Edit"
                aria-label="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveMarker()
                }}
                className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                style={quickActionStyle}
                title="Remove"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelectedPlace(null)}
                className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Close preview"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-t border-white/10">
            <div className="flex items-center justify-end px-5 py-4 text-xs text-white/50">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {categoryMetadata.label}
              </span>
            </div>

            {selectedPlace.notes && (
              <div className="border-t border-white/10 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Note</div>
                <p className="mt-2 text-sm text-white/80 whitespace-pre-line">{selectedPlace.notes}</p>
              </div>
            )}
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

      {/* Overview Modal */}
      {showOverviewModal && (
        <DestinationOverviewModal
          destination={convertToDestination(selectedPlace)}
          onClose={() => setShowOverviewModal(false)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <DestinationEditModal
          dayId="explore"
          destination={convertToDestination(selectedPlace)}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </>
  )
}
