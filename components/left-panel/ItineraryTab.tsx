'use client'

import { useState } from 'react'
import { Calendar, Plus, Map, Heart } from 'lucide-react'
import { Destination, TimelineDay, DayLocation } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { DayCard } from './DayCard'
import { AddDestinationModal } from './AddDestinationModal'
import { DayNotesModal } from './DayNotesModal'
import { BaseLocationPicker } from './BaseLocationPicker'
import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
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

const DAY_CONTAINER_PREFIX = 'day-'
const TIMELINE_DAY_PREFIX = 'timeline-day-'

type DestinationDragData = {
  type: 'destination'
  destinationId: string
  dayId: string
}

type BaseLocationDragData = {
  type: 'base-location'
  dayId: string
  locationIndex: number
}

type TimelineDayDropData = {
  type: 'timeline-day'
  dayId: string
}

function DragPreviewCard({ destination }: { destination: Destination }) {
  return (
    <div className="w-72 rounded-2xl bg-slate-900/95 border border-blue-400/50 shadow-2xl shadow-blue-500/40 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-300/40 flex items-center justify-center text-blue-200 font-semibold">
          {destination.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{destination.name}</p>
          {destination.city ? (
            <p className="text-xs text-blue-200/80 truncate">{destination.city}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BaseLocationPreviewCard({ location }: { location: DayLocation }) {
  const isFavorite = Boolean(location.isFavorite)
  return (
    <div className="w-72 rounded-2xl bg-slate-900/95 border border-emerald-400/50 shadow-2xl shadow-emerald-500/40 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/30 border border-emerald-300/40 flex items-center justify-center text-emerald-200 font-semibold">
          <Map className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{location.name}</p>
          {location.city ? (
            <p className="text-xs text-emerald-200/80 truncate">{location.city}</p>
          ) : null}
          {isFavorite ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-amber-200">
              <Heart className="h-3 w-3 fill-current" /> Favourite
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface DroppableDayProps {
  day: TimelineDay
  index: number
  isSelected: boolean
  onSelect: (dayId: string) => void
  isSource: boolean
  isTarget: boolean
}

function DroppableDay({ day, index, isSelected, onSelect, isSource, isTarget }: DroppableDayProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${TIMELINE_DAY_PREFIX}${day.id}`,
    data: {
      type: 'timeline-day',
      dayId: day.id,
      } satisfies TimelineDayDropData,
  })

  const baseClasses = 'w-full p-3 rounded-lg text-left transition-all duration-200'
  const stateClasses = isSelected
    ? 'bg-purple-500/20 border border-purple-400/30'
    : isTarget
    ? 'bg-purple-500/25 border border-purple-300/70 shadow-lg shadow-purple-500/30'
    : isOver
    ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-500/20'
    : 'bg-white/5 hover:bg-white/10 border border-transparent'

  const sourceClass = isSource && !isSelected ? 'ring-1 ring-purple-400/60' : ''

  return (
    <button
      ref={setNodeRef}
      onClick={() => onSelect(day.id)}
      className={`${baseClasses} ${stateClasses} ${sourceClass}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
          isSelected ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/80'
        }`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white text-sm">
            Day {index + 1} • {day.date.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
          <div className="text-xs text-white/60 truncate">
            {day.baseLocations.length > 0 && (
              `${day.baseLocations[0].city || day.baseLocations[0].name}${day.baseLocations[0].name !== day.baseLocations[0].city ? ` • ${day.baseLocations[0].name}` : ''}`
            )}
          </div>
        </div>
        <div className="text-xs text-white/60">
          {day.destinations.length}
        </div>
      </div>
      {isOver && (
        <div className="mt-2 text-xs text-green-400 font-medium text-center">
          Drop here to move destination
        </div>
      )}
    </button>
  )
}

export function ItineraryTab() {
  const { 
    currentTrip, 
    addNewDay, 
    selectedDayId, 
    setSelectedDay,
    moveDestination,
    reorderDestinations,
    reorderBaseLocations,
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
  const [showDayNotes, setShowDayNotes] = useState(false)
  const [showBaseLocationPicker, setShowBaseLocationPicker] = useState(false)
  const [targetDayId, setTargetDayId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<DestinationDragData | null>(null)
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null)
  const [activeBaseLocation, setActiveBaseLocation] = useState<{ location: DayLocation; dayId: string } | null>(null)
  const [activeTargetDayId, setActiveTargetDayId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as DestinationDragData | BaseLocationDragData | undefined
    if (!activeData) {
      return
    }

    if (activeData.type === 'destination') {
      setActiveDrag(activeData)

      const destination = currentTrip?.days
        .flatMap(day => day.destinations)
        .find(dest => dest.id === activeData.destinationId)

      if (destination) {
        setActiveDestination(destination)
      }
      setActiveBaseLocation(null)
    } else if (activeData.type === 'base-location') {
      setActiveDrag(null)
      setActiveDestination(null)

      const location = currentTrip?.days
        .find(day => day.id === activeData.dayId)
        ?.baseLocations?.[activeData.locationIndex]

      if (location) {
        setActiveBaseLocation({ location, dayId: activeData.dayId })
      }
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const activeData = event.active.data.current as DestinationDragData | BaseLocationDragData | undefined
    if (activeData?.type !== 'destination') {
      setActiveTargetDayId(null)
      return
    }

    const { over } = event
    if (!over) {
      setActiveTargetDayId(null)
      return
    }

    const overId = String(over.id)
    const overData = over.data.current as DestinationDragData | TimelineDayDropData | undefined

    if (overData?.type === 'destination') {
      setActiveTargetDayId(overData.dayId)
    } else if (overData?.type === 'timeline-day') {
      setActiveTargetDayId(overData.dayId)
    } else if (overId.startsWith(DAY_CONTAINER_PREFIX)) {
      setActiveTargetDayId(overId.replace(DAY_CONTAINER_PREFIX, ''))
    } else if (overId.startsWith(TIMELINE_DAY_PREFIX)) {
      setActiveTargetDayId(overId.replace(TIMELINE_DAY_PREFIX, ''))
    } else {
      setActiveTargetDayId(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveBaseLocation(null)
      return
    }

    const activeData = active.data.current as DestinationDragData | BaseLocationDragData | undefined
    if (!activeData) {
      return
    }

    if (String(over.id) === String(active.id)) {
      setActiveTargetDayId(null)
      setActiveDestination(null)
      setActiveDrag(null)
      setActiveBaseLocation(null)
      return
    }

    if (activeData.type === 'destination') {
      const sourceDayId = activeData.dayId
      const destinationId = activeData.destinationId
      const activeIndex = active.data.current?.sortable?.index

      const overId = String(over.id)
      const overData = over.data.current as DestinationDragData | TimelineDayDropData | undefined

      if (overData?.type === 'destination') {
        const targetDayId = overData.dayId
        const targetIndex = over.data.current?.sortable?.index

        if (targetDayId === sourceDayId) {
          if (
            typeof activeIndex === 'number' &&
            typeof targetIndex === 'number' &&
            activeIndex !== targetIndex
          ) {
            await reorderDestinations(sourceDayId, activeIndex, targetIndex)
          }
        } else {
          const insertIndex = typeof targetIndex === 'number' ? targetIndex : 0
          await moveDestination(destinationId, sourceDayId, targetDayId, insertIndex)
        }
      } else if (overData?.type === 'timeline-day' || overId.startsWith(TIMELINE_DAY_PREFIX)) {
        const targetDayId = overData?.dayId ?? overId.replace(TIMELINE_DAY_PREFIX, '')
        if (targetDayId && targetDayId !== sourceDayId) {
          const targetDay = currentTrip?.days.find(day => day.id === targetDayId)
          const insertIndex = targetDay ? targetDay.destinations.length : 0
          await moveDestination(destinationId, sourceDayId, targetDayId, insertIndex)
        }
      } else if (overId.startsWith(DAY_CONTAINER_PREFIX)) {
        const targetDayId = overId.replace(DAY_CONTAINER_PREFIX, '')

        if (!targetDayId) {
          setActiveTargetDayId(null)
          setActiveDestination(null)
          setActiveDrag(null)
          return
        }

        if (targetDayId === sourceDayId) {
          const targetIndex = over.data.current?.sortable?.index
          if (
            typeof activeIndex === 'number' &&
            typeof targetIndex === 'number' &&
            activeIndex !== targetIndex
          ) {
            await reorderDestinations(sourceDayId, activeIndex, targetIndex)
          }
        } else {
          const targetDay = currentTrip?.days.find(day => day.id === targetDayId)
          const insertIndex =
            over.data.current?.sortable?.index ?? targetDay?.destinations.length ?? 0
          await moveDestination(destinationId, sourceDayId, targetDayId, insertIndex)
        }
      }
    } else if (activeData.type === 'base-location') {
      const overData = over.data.current as BaseLocationDragData | undefined
      if (overData?.type === 'base-location' && overData.dayId === activeData.dayId) {
        const fromIndex = active.data.current?.sortable?.index ?? activeData.locationIndex
        const toIndex = over.data.current?.sortable?.index ?? overData.locationIndex

        if (
          typeof fromIndex === 'number' &&
          typeof toIndex === 'number' &&
          fromIndex !== toIndex
        ) {
          await reorderBaseLocations(activeData.dayId, fromIndex, toIndex)
        }
      }
    }

    setActiveTargetDayId(null)
    setActiveDestination(null)
    setActiveDrag(null)
    setActiveBaseLocation(null)
  }

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveTargetDayId(null)
    setActiveDestination(null)
    setActiveDrag(null)
    setActiveBaseLocation(null)
  }

  if (!currentTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-lg">Loading itinerary...</div>
      </div>
    )
  }


  const handleAddDestination = (dayId: string) => {
    setTargetDayId(dayId)
    setShowAddDestination(true)
  }

  const handleAddNotes = (dayId: string) => {
    setTargetDayId(dayId)
    setShowDayNotes(true)
  }

  const handleSetBaseLocation = (dayId: string) => {
    setTargetDayId(dayId)
    setShowBaseLocationPicker(true)
  }

  const handleSelectDay = (dayId: string) => {
    setSelectedDay(dayId)
    setActiveTargetDayId(null)
    setActiveDestination(null)
    setActiveDrag(null)
  }


  const selectedDay = currentTrip.days.find(day => day.id === selectedDayId) || currentTrip.days[0]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex" data-tour="day-plan-wrapper">
        {/* Days List */}
        <div className="w-80 border-r border-white/10 bg-white/[0.02] overflow-y-auto scrollbar-hide" data-tour="timeline">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/80">Timeline</h3>
              <button
                onClick={addNewDay}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all duration-200 text-sm font-medium"
              >
                <Plus className="h-3 w-3" />
                Add Day
              </button>
            </div>

            <div className="space-y-2">
              {currentTrip.days.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                  Select your travel dates or add a day to start building the timeline.
                </div>
              ) : (
                currentTrip.days.map((day, index) => (
                  <DroppableDay
                    key={day.id}
                    day={day}
                    index={index}
                    isSelected={selectedDayId === day.id}
                    onSelect={handleSelectDay}
                    isSource={activeDrag?.dayId === day.id}
                    isTarget={activeTargetDayId === day.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Day Details */}
        <div className="flex-1 overflow-y-auto scrollbar-hide" data-tour="day-details">
          {selectedDay ? (
            <DayCard
              day={selectedDay}
              dayIndex={currentTrip.days.findIndex(d => d.id === selectedDay.id)}
              isExpanded={true}
              onAddDestination={() => handleAddDestination(selectedDay.id)}
              onAddNotes={() => handleAddNotes(selectedDay.id)}
              onSetBaseLocation={() => handleSetBaseLocation(selectedDay.id)}
              activeDestinationId={activeDrag?.destinationId ?? null}
              activeTargetDayId={activeTargetDayId}
              draggingFromDayId={activeDrag?.dayId ?? null}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-4 max-w-sm">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                  <Calendar className="h-8 w-8 text-white/40" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">No days in your timeline yet</h3>
                  <p className="text-sm text-white/60">
                    Pick travel dates or use the Add Day button to create your first day. They will appear here with their details.
                  </p>
                </div>
                <button
                  onClick={addNewDay}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4" />
                  Add First Day
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddDestination && targetDayId && (
        <AddDestinationModal
          dayId={targetDayId}
          onClose={() => {
            setShowAddDestination(false)
            setTargetDayId(null)
          }}
        />
      )}

      {showDayNotes && targetDayId && (
        <DayNotesModal
          dayId={targetDayId}
          onClose={() => {
            setShowDayNotes(false)
            setTargetDayId(null)
          }}
        />
      )}

      {showBaseLocationPicker && targetDayId && (
        <BaseLocationPicker
          dayId={targetDayId}
          onClose={() => {
            setShowBaseLocationPicker(false)
            setTargetDayId(null)
          }}
        />
      )}

      <DragOverlay dropAnimation={null}>
        {activeDestination ? <DragPreviewCard destination={activeDestination} /> : null}
        {activeBaseLocation ? <BaseLocationPreviewCard location={activeBaseLocation.location} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
