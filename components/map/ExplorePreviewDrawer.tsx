'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { PlusCircle, Eye, Edit, Trash2, ExternalLink, Heart } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { AddExplorePlaceModal } from '../modals/AddExplorePlaceModal'
import { AddExploreAccommodationModal } from '../modals/AddExploreAccommodationModal'
import { DestinationOverviewModal } from '../modals/DestinationOverviewModal'
import { DestinationEditModal } from '../modals/DestinationEditModal'
import { Destination } from '@/types'
import { fallbackCityFromFullName } from '@/lib/location/city'
import { getExploreCategoryMetadata } from '@/lib/explore/categories'
import { CornerBadge } from '@/components/shared/CornerBadge'

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
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [showAddAccommodationModal, setShowAddAccommodationModal] = useState(false)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const isModalBlocking =
    showAddActivityModal ||
    showAddAccommodationModal ||
    showEditModal ||
    showOverviewModal

  useEffect(() => {
    if (!selectedPlace || isModalBlocking) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setSelectedPlace(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedPlace, setSelectedPlace, isModalBlocking])

  useEffect(() => {
    if (!selectedPlace) {
      setShowAddActivityModal(false)
      setShowAddAccommodationModal(false)
      setShowEditModal(false)
      setShowOverviewModal(false)
    }
  }, [selectedPlace])

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
    links: Array.isArray(place.links) && place.links.length > 0 ? place.links : undefined,
    isFavorite: place.isFavorite ?? false,
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
  const normalizedCategory = categoryMetadata.key
  const isAccommodationCategory = normalizedCategory === 'accommodation' || normalizedCategory === 'hotel'

  const quickActionStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${applyAlpha(accentColor, '22')} 0%, rgba(15, 23, 42, 0.85) 100%)`,
      borderColor: applyAlpha(accentColor, '88'),
      color: '#e2e8f0',
    }),
    [accentColor],
  )

  const primaryLink = useMemo(() => selectedPlace?.links?.find(link => link.url), [selectedPlace?.links])
  const toggleFavorite = useExploreStore((state) => state.toggleFavorite)
  const isFavorite = selectedPlace?.isFavorite ?? false
  const maybeLocations = useSupabaseTripStore((state) => state.maybeLocations)
  const setMaybeFavorite = useSupabaseTripStore((state) => state.setMaybeFavorite)

  const containerStyle = useMemo(() => {
    const base = {
      background: `linear-gradient(135deg, ${applyAlpha(accentColor, '24')} 0%, rgba(15, 23, 42, 0.78) 100%)`,
      borderColor: applyAlpha(accentColor, '88'),
      boxShadow: `0 24px 60px ${applyAlpha(accentColor, '24')}`,
    }

    if (isFavorite) {
      base.borderColor = applyAlpha('#facc15', 'cc')
      base.boxShadow = `0 36px 90px rgba(250, 204, 21, 0.38), 0 24px 60px ${applyAlpha(accentColor, '24')}`
      base.background = `linear-gradient(135deg, rgba(250, 204, 21, 0.16) 0%, rgba(15, 23, 42, 0.85) 100%)`
    }

    return base
  }, [accentColor, isFavorite])

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
        <div
          className="group rounded-3xl border bg-slate-900/80 backdrop-blur-2xl"
          style={containerStyle}
        >
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
            <CornerBadge label={categoryMetadata.label} accent={accentColor} className="top-0 right-0" />
            <div className="pointer-events-none absolute bottom-5 right-5 hidden flex-wrap items-center justify-end gap-2 group-hover:flex">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (isAccommodationCategory) {
                    setShowAddAccommodationModal(true)
                  } else {
                    setShowAddActivityModal(true)
                  }
                }}
                className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                style={quickActionStyle}
                title={isAccommodationCategory ? 'Add as accommodation' : 'Add as activity'}
                aria-label={isAccommodationCategory ? 'Add as accommodation' : 'Add as activity'}
              >
                <PlusCircle className="h-4 w-4" />
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
                  if (selectedPlace) {
                    const nextFavorite = !isFavorite
                    toggleFavorite(selectedPlace.id)
                    const maybeMatch = maybeLocations.find((destination) => destination.id === `explore-${selectedPlace.id}`)
                    if (maybeMatch) {
                      setMaybeFavorite(maybeMatch.id, nextFavorite)
                    }
                  }
                }}
                className={`pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105 ${
                  isFavorite ? 'bg-amber-500/25 border-amber-300/70 text-amber-100' : ''
                }`}
                style={isFavorite ? undefined : quickActionStyle}
                title={isFavorite ? 'Remove from favourites' : 'Mark as favourite'}
                aria-label="Toggle favourite"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              {primaryLink?.url ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(primaryLink.url, '_blank', 'noopener,noreferrer')
                  }}
                  className="pointer-events-auto p-2 rounded-lg border transition-all duration-200 hover:scale-105"
                  style={quickActionStyle}
                  title={primaryLink.label ? `Open ${primaryLink.label}` : 'Open link'}
                  aria-label="Open primary link"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              ) : null}
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
            </div>
          </div>

          {selectedPlace.notes && (
            <div className="border-t border-white/10 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Note</div>
              <p className="mt-2 text-sm text-white/80 whitespace-pre-line">{selectedPlace.notes}</p>
            </div>
          )}
        </div>
      </div>

      {showAddActivityModal && (
        <AddExplorePlaceModal
          place={selectedPlace}
          onClose={() => setShowAddActivityModal(false)}
          onComplete={() => {
            setShowAddActivityModal(false)
            setSelectedPlace(null)
          }}
        />
      )}

      {showAddAccommodationModal && (
        <AddExploreAccommodationModal
          place={selectedPlace}
          onClose={() => setShowAddAccommodationModal(false)}
          onComplete={() => {
            setShowAddAccommodationModal(false)
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
