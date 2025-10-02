'use client'

import { useEffect, useMemo } from 'react'
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
    selectionOrigin,
  } = useSupabaseTripStore()

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
  const showDestinationModal = selectionOrigin === 'preview' && Boolean(destinationContext)
  const showBaseModal = selectionOrigin === 'preview' && Boolean(baseContext)

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

  return (
    <>
      {showDestinationModal && destinationContext && (
        <DestinationOverviewModal
          destination={destinationContext.destination}
          onClose={() => {
            setSelectedDestination(null)
          }}
        />
      )}

      {showBaseModal && baseContext && (
        <BaseLocationEditModal
          dayId={baseContext.day.id}
          locationIndex={baseContext.baseIndex}
          location={baseContext.baseLocation}
          onClose={() => {
            setSelectedBaseLocation(null)
          }}
        />
      )}
    </>
  )
}
