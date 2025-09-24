'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Trip } from '@/types'

interface MapCleanupProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  selectedDestination: any
}

export function MapCleanup({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId, 
  selectedDestination 
}: MapCleanupProps) {

  // Enhanced map bounds fitting with day-specific centering
  useEffect(() => {
    if (!map || !hasTrip || !tripDays.length) return

    let coordinatesToFit: [number, number][] = []

    if (selectedDayId) {
      // When a day is selected, center on that day's locations only
      const selectedDay = tripDays.find(day => day.id === selectedDayId)
      const selectedDayIndex = tripDays.findIndex(day => day.id === selectedDayId)
      
      console.log('MapCleanup: Day selection debug', {
        selectedDayId,
        selectedDayIndex,
        selectedDay: selectedDay ? {
          id: selectedDay.id,
          hasLocation: !!selectedDay.location,
          locationName: selectedDay.location?.name,
          destinationCount: selectedDay.destinations.length,
          destinations: selectedDay.destinations.map(d => d.name)
        } : null,
        tripDaysCount: tripDays.length
      })
      
      if (selectedDay) {
        // Add the current day's base location
        if (selectedDay.location) {
          coordinatesToFit.push(selectedDay.location.coordinates)
          console.log('MapCleanup: Added current day base location', selectedDay.location.name, selectedDay.location.coordinates)
        }
        
        // Add destinations for this day
        coordinatesToFit.push(...selectedDay.destinations.map(dest => dest.coordinates))
        console.log('MapCleanup: Added destinations', selectedDay.destinations.map(d => d.name))
        
        // Agnostic travel day detection - collect all relevant base locations
        const nextDay = tripDays[selectedDayIndex + 1]
        const previousDay = tripDays[selectedDayIndex - 1]
        
        // Helper function to check if two locations are different
        const areLocationsDifferent = (loc1: any, loc2: any) => {
          if (!loc1 || !loc2) return true
          return loc1.coordinates[0] !== loc2.coordinates[0] || 
                 loc1.coordinates[1] !== loc2.coordinates[1]
        }
        
        // Collect all base locations that should be included
        const baseLocationsToInclude: Array<{location: any, dayId: string, role: string}> = []
        
        // Always include current day's base location if it exists
        if (selectedDay.location) {
          baseLocationsToInclude.push({
            location: selectedDay.location,
            dayId: selectedDay.id,
            role: 'current'
          })
        }
        
        // Include previous day's base location if it's different (departure point)
        if (previousDay?.location && areLocationsDifferent(selectedDay.location, previousDay.location)) {
          baseLocationsToInclude.push({
            location: previousDay.location,
            dayId: previousDay.id,
            role: 'departure'
          })
        }
        
        // Include next day's base location if it's different (arrival point)
        if (nextDay?.location && areLocationsDifferent(selectedDay.location, nextDay.location)) {
          baseLocationsToInclude.push({
            location: nextDay.location,
            dayId: nextDay.id,
            role: 'arrival'
          })
        }
        
        // Remove duplicates based on coordinates
        const uniqueLocations = baseLocationsToInclude.filter((item, index, self) => 
          index === self.findIndex(t => 
            t.location.coordinates[0] === item.location.coordinates[0] && 
            t.location.coordinates[1] === item.location.coordinates[1]
          )
        )
        
        console.log('MapCleanup: Travel day analysis', {
          selectedDayId,
          selectedDayLocation: selectedDay.location?.name,
          previousDayLocation: previousDay?.location?.name,
          nextDayLocation: nextDay?.location?.name,
          baseLocationsToInclude: uniqueLocations.map(l => ({
            name: l.location.name,
            dayId: l.dayId,
            role: l.role
          }))
        })
        
        // Add all unique base locations to coordinates
        uniqueLocations.forEach(item => {
          coordinatesToFit.push(item.location.coordinates)
          console.log(`MapCleanup: Added ${item.role} base location`, item.location.name, item.location.coordinates)
        })
      }
    } else {
      // When no day is selected, show all locations
      coordinatesToFit = tripDays.flatMap(day => {
        const coords = []
        if (day.location) {
          coords.push(day.location.coordinates)
        }
        coords.push(...day.destinations.map(dest => dest.coordinates))
        return coords
      })
    }

    if (coordinatesToFit.length > 0) {
      const bounds = coordinatesToFit.reduce((bounds, coord) => {
        return bounds.extend(coord)
      }, new mapboxgl.LngLatBounds(coordinatesToFit[0], coordinatesToFit[0]))

      // Only fit bounds if we have new coordinates or if it's the first load
      const currentCenter = map.getCenter()
      const currentZoom = map.getZoom()
      
      // Check if the map is showing the default Rome location (initial state)
      const isDefaultLocation = Math.abs(currentCenter.lng - 12.4964) < 0.1 && Math.abs(currentCenter.lat - 41.9028) < 0.1
      
      // Always fit bounds when a day is selected, or on first load
      if (selectedDayId || isDefaultLocation || coordinatesToFit.length > 0) {
        let fitOptions
        
        if (selectedDayId) {
          // Adaptive zoom based on number of locations for the selected day
          const locationCount = coordinatesToFit.length
          const selectedDay = tripDays.find(day => day.id === selectedDayId)
          const selectedDayIndex = tripDays.findIndex(day => day.id === selectedDayId)
          const nextDay = tripDays[selectedDayIndex + 1]
          
          // Check if this is a travel day (base location change from previous or to next day)
          const previousDay = tripDays[selectedDayIndex - 1]
          
          // Helper function to check if two locations are different
          const areLocationsDifferent = (loc1: any, loc2: any) => {
            if (!loc1 || !loc2) return true
            return loc1.coordinates[0] !== loc2.coordinates[0] || 
                   loc1.coordinates[1] !== loc2.coordinates[1]
          }
          
          const isTravelDay = (previousDay?.location && areLocationsDifferent(selectedDay?.location, previousDay.location)) ||
                             (nextDay?.location && areLocationsDifferent(selectedDay?.location, nextDay.location))
          
          console.log('MapCleanup: Zoom decision', {
            locationCount,
            isTravelDay,
            selectedDayLocation: selectedDay?.location?.name,
            previousDayLocation: previousDay?.location?.name,
            nextDayLocation: nextDay?.location?.name,
            coordinatesToFit: coordinatesToFit.length,
            coordinatesToFitDetails: coordinatesToFit.map((coord, i) => ({ index: i, coord }))
          })
          
          if (isTravelDay) {
            // Travel day - zoom to capture both base locations with good context
            fitOptions = {
              padding: 100,
              maxZoom: 10,   // Wider zoom to show travel route between cities
              duration: 1200
            }
            console.log('MapCleanup: Using travel day zoom (maxZoom: 10)')
          } else if (locationCount === 1) {
            // Single location - use moderate zoom, don't zoom in too much
            fitOptions = {
              padding: 120,
              maxZoom: 11,   // Moderate zoom for single location
              duration: 1200
            }
            console.log('MapCleanup: Using single location zoom (maxZoom: 11)')
          } else if (locationCount === 2) {
            // Two locations - slightly closer zoom
            fitOptions = {
              padding: 100,
              maxZoom: 12,   // Slightly closer for two locations
              duration: 1200
            }
            console.log('MapCleanup: Using two locations zoom (maxZoom: 12)')
          } else {
            // Multiple locations - closer zoom to show all destinations clearly
            fitOptions = {
              padding: 80,
              maxZoom: 13,   // Closer zoom for multiple locations
              duration: 1200
            }
            console.log('MapCleanup: Using multiple locations zoom (maxZoom: 13)')
          }
        } else {
          // No day selected - show all locations
          fitOptions = {
            padding: 80,
            maxZoom: 12,
            duration: 1000
          }
        }

        map.fitBounds(bounds, fitOptions)
      }
    }
  }, [map, hasTrip, tripDays, selectedDayId])

  // Update selection highlight
  useEffect(() => {
    if (!map || !hasTrip || !map.getSource('selection-highlight')) return

    let highlightFeature = null

    if (selectedDestination) {
      highlightFeature = {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: selectedDestination.coordinates
        },
        properties: {
          type: 'destination',
          id: selectedDestination.id
        }
      }
    } else if (selectedDayId) {
      const selectedDay = tripDays.find(day => day.id === selectedDayId)
      if (selectedDay?.location) {
        highlightFeature = {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: selectedDay.location.coordinates
          },
          properties: {
            type: 'base-location',
            id: selectedDay.id
          }
        }
      }
    }

    map.getSource('selection-highlight').setData({
      type: 'FeatureCollection',
      features: highlightFeature ? [highlightFeature] : []
    })
  }, [map, hasTrip, selectedDestination, selectedDayId, tripDays])

  return null
}
