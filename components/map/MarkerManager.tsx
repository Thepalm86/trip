'use client'

import { useEffect, useRef } from 'react'
import type { Trip } from '@/types'

interface MarkerManagerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  selectedCardId: string | null
}

const isMapDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_MAP === 'true'

export function MarkerManager({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId,
  selectedCardId
}: MarkerManagerProps) {

  const baseLocationFeaturesRef = useRef<string | null>(null)
  const destinationFeaturesRef = useRef<string | null>(null)

  // Update base location markers with enhanced data
  useEffect(() => {
    if (!map || !hasTrip) return

    // Add a small delay to ensure sources are initialized
    const timeoutId = setTimeout(() => {
      if (!map.getSource('base-locations')) return

      // Determine which base locations to show
      let daysToShow: Trip['days'] = []
      
      if (selectedDayId) {
        // Show the selected day's first base location
        const selectedDay = tripDays.find(day => day.id === selectedDayId)
        if (selectedDay && Array.isArray(selectedDay.baseLocations) && selectedDay.baseLocations.length > 0) {
          daysToShow.push(selectedDay)
        }
        
        // For travel days, also show the previous day's first base location (departure point)
        const selectedDayIndex = tripDays.findIndex(day => day.id === selectedDayId)
        const previousDay = selectedDayIndex > 0 ? tripDays[selectedDayIndex - 1] : undefined
        
        if (
          previousDay &&
          Array.isArray(previousDay.baseLocations) &&
          previousDay.baseLocations.length > 0 &&
          (!selectedDay ||
            !selectedDay.baseLocations ||
            selectedDay.baseLocations.length === 0 ||
            selectedDay.baseLocations[0].coordinates[0] !== previousDay.baseLocations[0].coordinates[0] ||
            selectedDay.baseLocations[0].coordinates[1] !== previousDay.baseLocations[0].coordinates[1])
        ) {
          daysToShow.push(previousDay)
        }
      } else {
        // No day selected - show all first base locations
        daysToShow = tripDays.filter(
          day => Array.isArray(day.baseLocations) && day.baseLocations.length > 0
        )
      }

      const baseLocationFeatures = daysToShow
        .map((day, index) => {
          const firstBaseLocation = day.baseLocations?.[0]
          if (!firstBaseLocation) {
            return null
          }

          const dayIndex = tripDays.findIndex(d => d.id === day.id)
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: firstBaseLocation.coordinates
            },
          properties: {
            name: firstBaseLocation.name,
            dayIndex: dayIndex,
            dayNumber: dayIndex + 1,
            dayId: day.id,
            baseIndex: 0,
            context: firstBaseLocation.context,
            isSelected: selectedDayId === day.id,
            isDeparturePoint: selectedDayId === day.id ? false : true, // Previous day's location is departure point
            destinationCount: day.destinations.length,
            totalBaseLocations: day.baseLocations ? day.baseLocations.length : 0,
            city: firstBaseLocation.city || 'Unknown City',
            cardId: `base-${day.id}-0`,
            isCardSelected: selectedCardId === `base-${day.id}-0`
          }
        }
        })
        .filter((feature): feature is NonNullable<typeof feature> => feature !== null)

      const serializedFeatures = JSON.stringify(baseLocationFeatures)
      if (baseLocationFeaturesRef.current === serializedFeatures) {
        if (isMapDebugEnabled) {
          console.debug('MarkerManager: Skipping base location update – no changes detected')
        }
        return
      }

      baseLocationFeaturesRef.current = serializedFeatures

      map.getSource('base-locations').setData({
        type: 'FeatureCollection',
        features: baseLocationFeatures
      })

      baseLocationFeatures.forEach((feature, index) => {
        const dayId = feature.properties.dayId
        map.setFeatureState(
          { source: 'base-locations', id: index },
          {
            selected: selectedDayId === dayId,
            hover: false
          }
        )
      })
    }, 50)

    return () => clearTimeout(timeoutId)
  }, [map, hasTrip, tripDays, selectedDayId, selectedCardId])

  // Destination markers update - SIMPLIFIED
  useEffect(() => {
    if (!map || !hasTrip) return

    // Simple, direct update
    const updateDestinations = () => {
      if (!map.getSource('destinations') || !map.getLayer('destinations-layer')) {
        return
      }

      // Create features with proper properties for letters and consistent colors
      const features = tripDays.flatMap((day, dayIndex) => {
        // Only show destination markers for the selected day
        if (selectedDayId !== day.id) {
          return []
        }

        // Use consistent blue color for all destination markers (matching legend)
        const markerColor = '#3b82f6'
        return day.destinations.map((destination, destIndex) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: destination.coordinates
          },
          properties: {
            name: destination.name,
            id: destination.id,
            dayIndex,
            dayNumber: dayIndex + 1,
            dayId: day.id,
            destIndex,
            activityLetter: String.fromCharCode(65 + destIndex), // Convert to letters: A, B, C, etc.
            destinationId: destination.id,
            markerColor: markerColor, // Consistent blue color for all destination markers
            city: destination.city || 'Unknown City',
            cardId: `dest-${destination.id}`,
            isCardSelected: selectedCardId === `dest-${destination.id}`
          }
        }))
      })

      const serializedFeatures = JSON.stringify(features)
      if (destinationFeaturesRef.current === serializedFeatures) {
        if (isMapDebugEnabled) {
          console.debug('MarkerManager: Skipping destination update – no changes detected')
        }
        return
      }

      destinationFeaturesRef.current = serializedFeatures

      map.getSource('destinations').setData({
        type: 'FeatureCollection',
        features
      })
    }

    // Wait for map to be ready
    if (map.isStyleLoaded()) {
      updateDestinations()
    } else {
      map.once('styledata', updateDestinations)
    }
  }, [map, hasTrip, tripDays, selectedDayId, selectedCardId])

  return null
}
