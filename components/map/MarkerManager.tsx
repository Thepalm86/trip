'use client'

import { useEffect } from 'react'
import type { Trip } from '@/types'

interface MarkerManagerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
}

const DAY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange-red
]


export function MarkerManager({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId 
}: MarkerManagerProps) {

  // Update base location markers with enhanced data
  useEffect(() => {
    if (!map || !hasTrip) return

    console.log('MarkerManager: Updating base location markers', { 
      tripDaysCount: tripDays.length,
      daysWithLocations: tripDays.filter(day => day.location).length,
      tripDays: tripDays.map(day => ({ 
        id: day.id, 
        hasLocation: !!day.location,
        locationName: day.location?.name
      }))
    })

    // Add a small delay to ensure sources are initialized
    const timeoutId = setTimeout(() => {
      if (!map.getSource('base-locations')) return

      // Determine which base locations to show
      let daysToShow: typeof tripDays = []
      
      if (selectedDayId) {
        // Show the selected day's base location
        const selectedDay = tripDays.find(day => day.id === selectedDayId)
        if (selectedDay?.location) {
          daysToShow.push(selectedDay)
        }
        
        // For travel days, also show the previous day's base location (departure point)
        const selectedDayIndex = tripDays.findIndex(day => day.id === selectedDayId)
        const previousDay = tripDays[selectedDayIndex - 1]
        
        if (previousDay?.location && 
            (!selectedDay?.location || 
             selectedDay.location.coordinates[0] !== previousDay.location.coordinates[0] || 
             selectedDay.location.coordinates[1] !== previousDay.location.coordinates[1])) {
          daysToShow.push(previousDay)
        }
      } else {
        // No day selected - show all base locations
        daysToShow = tripDays.filter(day => day.location)
      }

      const baseLocationFeatures = daysToShow.map((day, index) => {
        const dayIndex = tripDays.findIndex(d => d.id === day.id)
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: day.location!.coordinates
          },
          properties: {
            name: day.location!.name,
            dayIndex: dayIndex,
            dayNumber: dayIndex + 1,
            dayId: day.id,
            context: day.location!.context,
            isSelected: selectedDayId === day.id,
            isDeparturePoint: selectedDayId === day.id ? false : true, // Previous day's location is departure point
            destinationCount: day.destinations.length
          }
        }
      })

      console.log('MarkerManager: Setting base location features on map', { 
        selectedDayId,
        daysToShowCount: daysToShow.length,
        daysToShow: daysToShow.map(d => ({ 
          dayId: d.id, 
          locationName: d.location?.name,
          isSelectedDay: d.id === selectedDayId
        })),
        featureCount: baseLocationFeatures.length,
        features: baseLocationFeatures.map(f => ({ 
          name: f.properties.name, 
          dayId: f.properties.dayId,
          isSelected: f.properties.isSelected,
          isDeparturePoint: f.properties.isDeparturePoint
        }))
      })

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
  }, [map, hasTrip, tripDays, selectedDayId])

  // Destination markers update - SIMPLIFIED
  useEffect(() => {
    console.log('🚀 MarkerManager: SIMPLE destination update triggered', { map: !!map, hasTrip, tripDaysCount: tripDays.length })
    if (!map || !hasTrip) return

    // Simple, direct update
    const updateDestinations = () => {
      if (!map.getSource('destinations') || !map.getLayer('destinations-layer')) {
        console.warn('⚠️ Source or layer not ready')
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
            markerColor: markerColor // Consistent blue color for all destination markers
          }
        }))
      })

      console.log('🎯 MarkerManager: Setting SIMPLE destination features', { count: features.length })

      // Update source directly
      map.getSource('destinations').setData({
        type: 'FeatureCollection',
        features
      })

      console.log('✅ MarkerManager: SIMPLE destination markers updated')
    }

    // Wait for map to be ready
    if (map.isStyleLoaded()) {
      updateDestinations()
    } else {
      map.once('styledata', updateDestinations)
    }
  }, [map, hasTrip, tripDays, selectedDayId])

  return null
}
