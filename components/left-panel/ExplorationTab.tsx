'use client'

import { useState } from 'react'
import { Plus, MapPin, Trash2, Eye, Edit, ExternalLink, Heart } from 'lucide-react'
import { Destination, TimelineDay } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { AddDestinationModal } from './AddDestinationModal'
import { DestinationOverviewModal } from '../modals/DestinationOverviewModal'
import { DestinationEditModal } from '../modals/DestinationEditModal'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

const TIMELINE_DAY_PREFIX = 'timeline-day-'

type MaybeLocationDragData = {
  type: 'maybe-location'
  destinationId: string
}

type TimelineDayDropData = {
  type: 'timeline-day'
  dayId: string
}

function DragPreviewCard({ destination }: { destination: Destination }) {
  return (
    <div className="w-72 rounded-2xl bg-slate-900/95 border border-cyan-400/50 shadow-2xl shadow-cyan-500/40 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/30 border border-cyan-300/40 flex items-center justify-center text-cyan-200 font-semibold">
          {destination.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{destination.name}</p>
          {destination.city ? (
            <p className="text-xs text-cyan-200/80 truncate">{destination.city}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DroppableDay({ day, index, isOver }: { day: TimelineDay; index: number; isOver: boolean }) {
  const { setSelectedDay, selectedDayId } = useSupabaseTripStore()
  const isSelected = selectedDayId === day.id

  const { setNodeRef } = useDroppable({
    id: `${TIMELINE_DAY_PREFIX}${day.id}`,
    data: {
      type: 'timeline-day',
      dayId: day.id,
    } as TimelineDayDropData,
  })

  return (
    <button
      ref={setNodeRef}
      onClick={() => setSelectedDay(day.id)}
      className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
        isSelected 
          ? 'bg-blue-500/20 border border-blue-400/50' 
          : isOver
          ? 'bg-cyan-500/20 border border-cyan-400/50'
          : 'bg-white/5 border border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
            isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/80'
          }`}>
            {index + 1}
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              Day {index + 1} • {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="text-xs text-white/60 truncate">
              {day.baseLocations.length > 0 && (
                `${day.baseLocations[0].city || day.baseLocations[0].name}${day.baseLocations[0].name !== day.baseLocations[0].city ? ` • ${day.baseLocations[0].name}` : ''}`
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-white/60">
          {day.destinations.length}
        </div>
      </div>
      {isOver && (
        <div className="mt-2 text-xs text-cyan-400 font-medium text-center">
          Drop here to add to this day
        </div>
      )}
    </button>
  )
}

function MaybeLocationCard({ destination, index }: { destination: Destination; index: number }) {
  const { removeMaybeLocation, setSelectedDestination, selectedCardId, setSelectedCard, setMaybeFavorite } = useSupabaseTripStore()
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null)
  const primaryLink = destination.links?.find(link => link.url)

  const isSelected = selectedCardId === destination.id
  const isFavorite = Boolean(destination.isFavorite)

  const handleDestinationClick = () => {
    const cardId = `maybe-${destination.id}`
    if (selectedCardId === cardId) {
      setSelectedCard(null)
      setSelectedDestination(null)
    } else {
      setSelectedCard(cardId)
      setSelectedDestination(destination, 'timeline')
    }
  }

  const handleEditDestination = (dest: Destination) => {
    setEditingDestination(dest)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingDestination(null)
  }

  const handleOpenOverview = () => {
    setShowOverviewModal(true)
  }

  const handleCloseOverview = () => {
    setShowOverviewModal(false)
  }

  return (
    <>
      <div
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer hover:shadow-xl hover:shadow-cyan-500/10 ${
          isFavorite
            ? 'border-amber-300/70 shadow-amber-500/30 bg-gradient-to-br from-amber-500/10 via-blue-500/5 to-indigo-500/5'
            : 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-indigo-500/5'
        } ${
          isSelected
            ? 'border-cyan-400 border-2 shadow-xl shadow-cyan-500/20'
            : isFavorite
            ? 'border-amber-300/70'
            : 'border-cyan-400/20 hover:border-cyan-400/40'
        }`}
        onClick={handleDestinationClick}
      >
        {/* Action Buttons */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMaybeFavorite(destination.id, !isFavorite)
            }}
            className={`p-2 rounded-lg transition-all duration-200 border ${
              isFavorite
                ? 'bg-amber-500/25 border-amber-300/70 text-amber-100'
                : 'bg-cyan-500/20 hover:bg-cyan-500/40 border-cyan-400/50 hover:border-cyan-300'
            }`}
            title={isFavorite ? 'Remove favourite' : 'Mark as favourite'}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : 'text-cyan-200'}`} />
          </button>
          {primaryLink && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!primaryLink.url) {
                  return
                }
                window.open(primaryLink.url, '_blank', 'noopener,noreferrer')
              }}
              className="p-2 rounded-lg transition-all duration-200 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300"
              title={primaryLink.label ? `Open ${primaryLink.label}` : 'Open link'}
            >
              <ExternalLink className="h-4 w-4 text-cyan-200" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleOpenOverview()
            }}
            className="p-2 rounded-lg transition-all duration-200 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300"
            title="View Details"
          >
            <Eye className="h-4 w-4 text-cyan-200" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEditDestination(destination)
            }}
            className="p-2 rounded-lg transition-all duration-200 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300"
            title="Edit Destination"
          >
            <Edit className="h-4 w-4 text-cyan-200" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeMaybeLocation(destination.id)
            }}
            className="p-2 rounded-lg transition-all duration-200 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300"
            title="Remove from Maybe List"
          >
            <Trash2 className="h-4 w-4 text-cyan-200" />
          </button>
        </div>

        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-50"></div>
        
        {/* Content */}
        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center shadow-lg border border-cyan-400/30">
                  <span className="text-lg font-bold text-cyan-400">
                    {String.fromCharCode(65 + index)}
                  </span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{destination.name}</h3>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <MapPin className="h-3 w-3" />
                  <span>{destination.city || 'Location'}</span>
                  <span className="h-1 w-1 rounded-full bg-white/20"></span>
                  <span className="text-xs text-white/60">Maybe</span>
                  {isFavorite ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-200">
                      <Heart className="h-3 w-3 fill-current" /> Favourite
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          
          {/* Notes */}
          {destination.notes && (
            <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-white/60 italic">
                "{destination.notes}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showOverviewModal && (
        <DestinationOverviewModal
          destination={destination}
          onClose={handleCloseOverview}
        />
      )}
      
      {showEditModal && editingDestination && (
        <DestinationEditModal
          dayId="maybe"
          destination={editingDestination}
          onClose={handleCloseEditModal}
        />
      )}
    </>
  )
}

export function ExplorationTab() {
  const { 
    currentTrip, 
    maybeLocations,
    addMaybeLocation,
    moveMaybeToDay
  } = useSupabaseTripStore()
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [showAddDestination, setShowAddDestination] = useState(false)
  const [activeDrag, setActiveDrag] = useState<MaybeLocationDragData | null>(null)
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null)

  if (!currentTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-lg">Loading trip...</div>
      </div>
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current as MaybeLocationDragData
    
    if (data?.type === 'maybe-location') {
      setActiveDrag(data)
      const destination = maybeLocations.find(dest => dest.id === data.destinationId)
      setActiveDestination(destination || null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over) {
      setActiveDrag(null)
      setActiveDestination(null)
      return
    }

    const activeData = active.data.current as MaybeLocationDragData
    const overData = over.data.current as TimelineDayDropData

    if (activeData?.type === 'maybe-location' && overData?.type === 'timeline-day') {
      await moveMaybeToDay(activeData.destinationId, overData.dayId)
    }

    setActiveDrag(null)
    setActiveDestination(null)
  }

  const handleDragCancel = () => {
    setActiveDrag(null)
    setActiveDestination(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full flex">
        {/* Left Column - Timeline */}
        <div className="w-48 border-r border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Timeline</h3>
          </div>
          
          <div className="space-y-2">
            {currentTrip.days.map((day, index) => (
              <DroppableDay
                key={day.id}
                day={day}
                index={index}
                isOver={false}
              />
            ))}
          </div>
        </div>

        {/* Middle Column - Maybe Locations */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Maybe Locations</h3>
              <p className="text-sm text-white/60">Explore destinations you're considering</p>
            </div>
            <button
              onClick={() => setShowAddDestination(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          </div>

          {maybeLocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MapPin className="h-12 w-12 text-white/20 mb-4" />
              <h4 className="text-lg font-medium text-white/60 mb-2">No maybe locations yet</h4>
              <p className="text-sm text-white/40 mb-4">Add locations you're considering for your trip</p>
              <button
                onClick={() => setShowAddDestination(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
              >
                <Plus className="h-4 w-4" />
                Add Your First Location
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {maybeLocations.map((destination, index) => (
                <MaybeLocationCard
                  key={destination.id}
                  destination={destination}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDrag && activeDestination ? (
          <DragPreviewCard destination={activeDestination} />
        ) : null}
      </DragOverlay>

      {/* Add Destination Modal */}
      {showAddDestination && (
        <AddDestinationModal
          dayId="maybe"
          onClose={() => setShowAddDestination(false)}
          onAddToMaybe={(destination) => {
            addMaybeLocation(destination)
            setShowAddDestination(false)
          }}
          allowAccommodationCategory
        />
      )}
    </DndContext>
  )
}
