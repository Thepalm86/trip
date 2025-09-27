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
      
      if (selectedDay) {
        // Add the current day's base location
        if (selectedDay.baseLocations && selectedDay.baseLocations.length > 0) {
          coordinatesToFit.push(selectedDay.baseLocations[0].coordinates)
        }
        
        // Add destinations for this day
        coordinatesToFit.push(...selectedDay.destinations.map(dest => dest.coordinates))
        
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
        if (selectedDay.baseLocations && selectedDay.baseLocations.length > 0) {
          baseLocationsToInclude.push({
            location: selectedDay.baseLocations[0],
            dayId: selectedDay.id,
            role: 'current'
          })
        }
        
        // Include previous day's base location if it's different (departure point)
        if (previousDay?.baseLocations && previousDay.baseLocations.length > 0 && 
            selectedDay.baseLocations && selectedDay.baseLocations.length > 0 &&
            areLocationsDifferent(selectedDay.baseLocations[0], previousDay.baseLocations[0])) {
          baseLocationsToInclude.push({
            location: previousDay.baseLocations[0],
            dayId: previousDay.id,
            role: 'departure'
          })
        }
        
        // Include next day's base location if it's different (arrival point)
        if (nextDay?.baseLocations && nextDay.baseLocations.length > 0 && 
            selectedDay.baseLocations && selectedDay.baseLocations.length > 0 &&
            areLocationsDifferent(selectedDay.baseLocations[0], nextDay.baseLocations[0])) {
          baseLocationsToInclude.push({
            location: nextDay.baseLocations[0],
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
        
        // Add all unique base locations to coordinates
        uniqueLocations.forEach(item => {
          coordinatesToFit.push(item.location.coordinates)
        })
      }
    } else {
      // When no day is selected, show all locations
      coordinatesToFit = tripDays.flatMap(day => {
        const coords = []
        if (day.baseLocations && day.baseLocations.length > 0) {
          coords.push(day.baseLocations[0].coordinates)
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
          
          const isTravelDay = (previousDay?.baseLocations?.[0] && areLocationsDifferent(selectedDay?.baseLocations?.[0], previousDay.baseLocations[0])) ||
                             (nextDay?.baseLocations?.[0] && areLocationsDifferent(selectedDay?.baseLocations?.[0], nextDay.baseLocations[0]))
          
          if (isTravelDay) {
            // Travel day - zoom to capture both base locations with good context
            fitOptions = {
              padding: 100,
              maxZoom: 10,   // Wider zoom to show travel route between cities
              duration: 1200
            }
          } else if (locationCount === 1) {
            // Single location - use moderate zoom, don't zoom in too much
            fitOptions = {
              padding: 120,
              maxZoom: 11,   // Moderate zoom for single location
              duration: 1200
            }
          } else if (locationCount === 2) {
            // Two locations - slightly closer zoom
            fitOptions = {
              padding: 100,
              maxZoom: 12,   // Slightly closer for two locations
              duration: 1200
            }
          } else {
            // Multiple locations - closer zoom to show all destinations clearly
            fitOptions = {
              padding: 80,
              maxZoom: 13,   // Closer zoom for multiple locations
              duration: 1200
            }
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

  // Selection highlight disabled - using marker styling for selection feedback instead

  return null
}
