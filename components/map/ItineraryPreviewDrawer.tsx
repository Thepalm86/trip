'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Edit, Eye, MapPin, X } from 'lucide-react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { DestinationOverviewModal } from '@/components/modals/DestinationOverviewModal'
import { BaseLocationEditModal } from '@/components/modals/BaseLocationEditModal'

export function ItineraryPreviewDrawer() {
  const {
    currentTrip,
    selectedDestination,
    setSelectedDestination,
    selectedBaseLocation,
    setSelectedBaseLocation,
    setSelectedDay,
    setSelectedCard,
    selectionOrigin,
  } = useSupabaseTripStore()

  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [isBaseEditOpen, setIsBaseEditOpen] = useState(false)

  const destinationContext = useMemo(() => {
    if (!currentTrip || !selectedDestination) {
      return null
    }

    for (let dayIndex = 0; dayIndex < currentTrip.days.length; dayIndex++) {
      const day = currentTrip.days[dayIndex]
      const destinationIndex = day.destinations.findIndex(dest => dest.id === selectedDestination.id)
      if (destinationIndex !== -1) {
        const destination = day.destinations[destinationIndex]
        return {
          day,
          dayIndex,
          destination,
          destinationIndex,
          activityLetter: String.fromCharCode(65 + destinationIndex),
        }
      }
    }

    return null
  }, [currentTrip, selectedDestination])

  const baseContext = useMemo(() => {
    if (!currentTrip || !selectedBaseLocation) {
      return null
    }

    const dayIndex = currentTrip.days.findIndex(day => day.id === selectedBaseLocation.dayId)
    if (dayIndex === -1) {
      return null
    }

    const day = currentTrip.days[dayIndex]
    const baseLocation = day.baseLocations?.[selectedBaseLocation.index]
    if (!baseLocation) {
      return null
    }

    return {
      day,
      dayIndex,
      baseLocation,
      baseIndex: selectedBaseLocation.index,
    }
  }, [currentTrip, selectedBaseLocation])

  useEffect(() => {
    if (selectedDestination && !destinationContext) {
      setSelectedDestination(null)
    }
  }, [selectedDestination, destinationContext, setSelectedDestination])

  useEffect(() => {
    if (selectedBaseLocation && !baseContext) {
      setSelectedBaseLocation(null)
    }
  }, [selectedBaseLocation, baseContext, setSelectedBaseLocation])

  const closeDrawer = () => {
    setSelectedDestination(null)
    setSelectedBaseLocation(null)
  }

  const handleFocusTimeline = () => {
    if (destinationContext) {
      setSelectedDay(destinationContext.day.id)
      setSelectedCard(`dest-${destinationContext.destination.id}`)
    } else if (baseContext) {
      setSelectedDay(baseContext.day.id)
      setSelectedCard(`base-${baseContext.day.id}-${baseContext.baseIndex}`)
    }
  }

  const activeDestination = Boolean(destinationContext)
  const activeBase = Boolean(baseContext)
  const allowDrawer = selectionOrigin === 'map'

  if (!allowDrawer || (!activeDestination && !activeBase)) {
    return null
  }

  const title = activeDestination
    ? destinationContext!.destination.name
    : baseContext!.baseLocation.name

  const subtitle = activeDestination
    ? destinationContext!.destination.city || destinationContext!.day.destinations[0]?.city || 'Unknown location'
    : baseContext!.baseLocation.city || 'Unknown location'

  const dayLabel = activeDestination
    ? `Day ${destinationContext!.dayIndex + 1} • Activity ${destinationContext!.activityLetter}`
    : `Day ${baseContext!.dayIndex + 1} • Accommodation`

  return (
    <>
      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-20 w-full max-w-lg -translate-x-1/2">
        <div className="group rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-start justify-between gap-5 p-5">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Preview</div>
              <div className="space-y-2">
                <h2 className="text-2xl font-light text-white leading-tight">{title}</h2>
                <p className="text-sm text-white/70 leading-relaxed line-clamp-2">{subtitle}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50 pt-1">
                <Calendar className="h-3.5 w-3.5" />
                {dayLabel}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {activeDestination && (
                <button
                  onClick={() => setIsOverviewOpen(true)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              {activeBase && (
                <button
                  onClick={() => setIsBaseEditOpen(true)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  title="Edit accommodation"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={closeDrawer}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-xs text-white/60">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {activeDestination
                ? (destinationContext!.destination.category || 'Destination')
                : 'Accommodation'}
            </span>
            <button
              onClick={handleFocusTimeline}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              Focus in itinerary
            </button>
          </div>
        </div>
      </div>

      {activeDestination && isOverviewOpen && (
        <DestinationOverviewModal
          destination={destinationContext!.destination}
          onClose={() => setIsOverviewOpen(false)}
        />
      )}

      {activeBase && isBaseEditOpen && (
        <BaseLocationEditModal
          dayId={baseContext!.day.id}
          locationIndex={baseContext!.baseIndex}
          location={baseContext!.baseLocation}
          onClose={() => setIsBaseEditOpen(false)}
        />
      )}
    </>
  )
}
