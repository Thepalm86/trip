'use client'

import { useState, useEffect, useRef } from 'react'
import { X, MapPin, PlusCircle, Building2, Eye, Edit, Trash2, MoreVertical } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import { AddExplorePlaceModal } from '../modals/AddExplorePlaceModal'
import { DestinationOverviewModal } from '../modals/DestinationOverviewModal'
import { DestinationEditModal } from '../modals/DestinationEditModal'
import { Destination } from '@/types'
import { fallbackCityFromFullName } from '@/lib/location/city'
import { getExploreCategoryMetadata } from '@/lib/explore/categories'

export function ExplorePreviewDrawer() {
  const selectedPlace = useExploreStore((state) => state.selectedPlace)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const removeActivePlace = useExploreStore((state) => state.removeActivePlace)
  const [mode, setMode] = useState<'destination' | 'base' | null>(null)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

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


  if (!selectedPlace) {
    return null
  }

  const categoryMetadata = getExploreCategoryMetadata(selectedPlace.category)
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
      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="group rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="flex-1 min-w-0">
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
            
            {/* Fixed Action Buttons Container */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Action Dropdown Menu */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDropdown(!showDropdown)
                  }}
                  className="p-2 rounded-lg transition-all duration-200 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30"
                  title="More Actions"
                >
                  <MoreVertical className="h-4 w-4 text-white/70" />
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl z-50">
                    <div className="p-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMode('destination')
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-blue-500/20 text-left"
                      >
                        <PlusCircle className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-white">Add as Activity</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMode('base')
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-emerald-500/20 text-left"
                      >
                        <Building2 className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-white">Set as Accommodation</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetails()
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-blue-500/20 text-left"
                      >
                        <Eye className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-white">View Details</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit()
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-blue-500/20 text-left"
                      >
                        <Edit className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-white">Edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveMarker()
                          setShowDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-red-500/20 text-left"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span className="text-sm text-white">Remove Marker</span>
                      </button>
                    </div>
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
