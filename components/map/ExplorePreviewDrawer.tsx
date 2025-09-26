'use client'

import { useState } from 'react'
import { X, MapPin, Globe2, PlusCircle, Building2, Eye, Edit, Trash2, GripVertical } from 'lucide-react'
import { useExploreStore } from '@/lib/store/explore-store'
import { AddExplorePlaceModal } from '../modals/AddExplorePlaceModal'
import { DestinationOverviewModal } from '../modals/DestinationOverviewModal'
import { DestinationEditModal } from '../modals/DestinationEditModal'
import { Destination } from '@/types'

export function ExplorePreviewDrawer() {
  const selectedPlace = useExploreStore((state) => state.selectedPlace)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const removeActivePlace = useExploreStore((state) => state.removeActivePlace)
  const [mode, setMode] = useState<'destination' | 'base' | null>(null)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Helper function to convert explore place to destination format
  const convertToDestination = (place: any): Destination => ({
    id: `explore-${place.id}`,
    name: place.name,
    description: place.fullName,
    coordinates: place.coordinates,
    city: place.fullName.split(',').map((p: string) => p.trim()).filter(Boolean)[place.fullName.split(',').length - 2] || 'Unknown',
    category: place.category || 'attraction',
    notes: undefined,
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

  // Handle drag (placeholder - would need drag context)
  const handleDrag = () => {
    // This would be implemented with drag and drop context
    // For now, we'll show a visual feedback that drag is available
    console.log('Drag functionality would be implemented here')
    
    // Visual feedback - could be extended to show drag preview
    const dragButton = document.querySelector('[title="Drag"]')
    if (dragButton) {
      dragButton.classList.add('animate-pulse')
      setTimeout(() => {
        dragButton.classList.remove('animate-pulse')
      }, 1000)
    }
  }

  if (!selectedPlace) {
    return null
  }

  return (
    <>
      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="group rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Preview</div>
              <h2 className="mt-2 text-2xl font-light text-white">{selectedPlace.name}</h2>
              <p className="mt-1 text-sm text-white/70 line-clamp-2">{selectedPlace.fullName}</p>
            </div>
            
            {/* Action Buttons - styled exactly like destination cards */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMode('destination')
                }}
                className="p-2 rounded-lg transition-all duration-200 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/50 hover:border-blue-300"
                title="Add as Activity"
              >
                <PlusCircle className="h-4 w-4 text-blue-200" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMode('base')
                }}
                className="p-2 rounded-lg transition-all duration-200 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/50 hover:border-emerald-300"
                title="Set as Base Location"
              >
                <Building2 className="h-4 w-4 text-emerald-200" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleViewDetails()
                }}
                className="p-2 rounded-lg transition-all duration-200 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/50 hover:border-blue-300"
                title="View Details"
              >
                <Eye className="h-4 w-4 text-blue-200" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit()
                }}
                className="p-2 rounded-lg transition-all duration-200 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/50 hover:border-blue-300"
                title="Edit"
              >
                <Edit className="h-4 w-4 text-blue-200" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveMarker()
                }}
                className="p-2 rounded-lg transition-all duration-200 bg-red-500/20 hover:bg-red-500/40 border border-red-400/50 hover:border-red-300"
                title="Remove Marker"
              >
                <Trash2 className="h-4 w-4 text-red-200" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDrag()
                }}
                className="p-2 rounded-lg transition-all duration-200 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/50 hover:border-blue-300 cursor-grab active:cursor-grabbing"
                title="Drag"
              >
                <GripVertical className="h-4 w-4 text-blue-200" />
              </button>
            </div>
            
            <button
              onClick={() => setSelectedPlace(null)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-white/50">
            <span>Coordinates: {selectedPlace.coordinates[1].toFixed(4)}, {selectedPlace.coordinates[0].toFixed(4)}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {selectedPlace.category || 'Location'}
            </span>
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
