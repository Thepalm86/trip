'use client'

import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Trip } from '@/types'

interface RouteData {
  coordinates: [number, number][]
  duration: number
  distance: number
  routeType: 'segment'
  fromDayId: string
  toDayId: string
  fromLocation: string
  toLocation: string
  waypoints: Array<{
    coordinates: [number, number]
    type: 'base' | 'destination'
    name: string
    dayId: string
  }>
  segmentType?: 'base-to-destination' | 'destination-to-destination' | 'destination-to-base' | 'base-to-base'
}

interface RouteManagerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  token: string
  onLoadingChange: (loading: boolean) => void
}

export function RouteManager({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId, 
  token, 
  onLoadingChange 
}: RouteManagerProps) {
  const routeCalculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const routeCache = useRef<Map<string, RouteData>>(new Map())

  // Calculate bearing between two points
  const calculateBearing = useCallback((start: [number, number], end: [number, number]) => {
    const startLat = start[1] * Math.PI / 180
    const startLng = start[0] * Math.PI / 180
    const endLat = end[1] * Math.PI / 180
    const endLng = end[0] * Math.PI / 180

    const dLng = endLng - startLng
    const y = Math.sin(dLng) * Math.cos(endLat)
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng)

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  }, [])

  // Check if two base locations are different (agnostic comparison)
  const areBaseLocationsDifferent = useCallback((loc1: any, loc2: any) => {
    if (!loc1 || !loc2) return true
    return loc1.coordinates[0] !== loc2.coordinates[0] || 
           loc1.coordinates[1] !== loc2.coordinates[1]
  }, [])

  // Build waypoints for inter-day route: fromDay base → toDay destinations → toDay base
  const buildInterDayWaypoints = useCallback((fromDay: Trip['days'][0], toDay: Trip['days'][0]) => {
    const waypoints: RouteData['waypoints'] = []

    // Start from fromDay's base location
    if (fromDay.baseLocations && fromDay.baseLocations.length > 0) {
      waypoints.push({
        coordinates: fromDay.baseLocations[0].coordinates,
        type: 'base',
        name: fromDay.baseLocations[0].name,
        dayId: fromDay.id
      })
    }

    // Add all destinations from toDay (these are visited on the way to toDay's base location)
    toDay.destinations.forEach(destination => {
      waypoints.push({
        coordinates: destination.coordinates,
        type: 'destination',
        name: destination.name,
        dayId: toDay.id
      })
    })

    // End at toDay's base location
    if (toDay.baseLocations && toDay.baseLocations.length > 0) {
      waypoints.push({
        coordinates: toDay.baseLocations[0].coordinates,
        type: 'base',
        name: toDay.baseLocations[0].name,
        dayId: toDay.id
      })
    }

    return waypoints
  }, [])

  // Calculate individual segment route between two points
  const calculateSegmentRoute = useCallback(async (fromWaypoint: RouteData['waypoints'][0], toWaypoint: RouteData['waypoints'][0]) => {
    const coordinates = [fromWaypoint.coordinates, toWaypoint.coordinates]
    const cacheKey = `${coordinates.map(coord => `${coord[0]},${coord[1]}`).join('-')}-segment`
    
    // Check cache first
    if (routeCache.current.has(cacheKey)) {
      return routeCache.current.get(cacheKey)!
    }

    try {
      // Always use driving profile for all routes
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';')}?access_token=${token}&geometries=geojson&overview=full`
      )

      if (response.ok) {
        const data = await response.json()
        const route = data.routes[0]

        const routeData: RouteData = {
          coordinates: route.geometry.coordinates,
          duration: route.duration,
          distance: route.distance,
          routeType: 'segment',
          fromDayId: fromWaypoint.dayId,
          toDayId: toWaypoint.dayId,
          fromLocation: fromWaypoint.name,
          toLocation: toWaypoint.name,
          waypoints: [fromWaypoint, toWaypoint]
        }

        // Cache the result
        routeCache.current.set(cacheKey, routeData)
        return routeData
      }
    } catch (error) {
      console.error('Error calculating segment route:', error)
    }

    return null
  }, [token])

  // Determine which routes to show based on selected day
  const getRoutesToShow = useCallback(() => {
    const routesToShow: Array<{
      fromDay: Trip['days'][0]
      toDay: Trip['days'][0]
      type: 'inter-day' | 'intra-day'
    }> = []

    if (!selectedDayId) {
      // No day selected - show all inter-day routes where base locations change and destination day has destinations
      for (let i = 0; i < tripDays.length - 1; i++) {
        const fromDay = tripDays[i]
        const toDay = tripDays[i + 1]
        
        if (fromDay.baseLocations && fromDay.baseLocations.length > 0 && 
            toDay.baseLocations && toDay.baseLocations.length > 0 &&
            areBaseLocationsDifferent(fromDay.baseLocations[0], toDay.baseLocations[0]) &&
            toDay.destinations.length > 0) {
          routesToShow.push({
            fromDay,
            toDay,
            type: 'inter-day'
          })
                  }
                }
              } else {
      // Day selected - show routes to/from that day
      const selectedDayIndex = tripDays.findIndex(day => day.id === selectedDayId)
      
      if (selectedDayIndex >= 0) {
        // Route FROM previous day TO selected day (if base locations are different)
        // Show route if: base locations are different AND (selected day has destinations OR it's a direct base change)
        if (selectedDayIndex > 0) {
          const fromDay = tripDays[selectedDayIndex - 1]
          const toDay = tripDays[selectedDayIndex]
          
          if (fromDay.baseLocations && fromDay.baseLocations.length > 0 && 
              toDay.baseLocations && toDay.baseLocations.length > 0 &&
              areBaseLocationsDifferent(fromDay.baseLocations[0], toDay.baseLocations[0])) {
            routesToShow.push({
              fromDay,
              toDay,
              type: 'inter-day'
            })
          }
        }

        // Route FROM selected day TO next day (only if base locations are different AND next day has destinations)
        // BUT: Don't show routes FROM a day that has no destinations
        if (selectedDayIndex < tripDays.length - 1) {
          const fromDay = tripDays[selectedDayIndex]
          const toDay = tripDays[selectedDayIndex + 1]
          
          if (fromDay.baseLocations && fromDay.baseLocations.length > 0 && 
              toDay.baseLocations && toDay.baseLocations.length > 0 &&
              areBaseLocationsDifferent(fromDay.baseLocations[0], toDay.baseLocations[0]) &&
              toDay.destinations.length > 0 &&
              fromDay.destinations.length > 0) { // Only show routes FROM days that have destinations
            routesToShow.push({
              fromDay,
              toDay,
              type: 'inter-day'
            })
          }
        }

        // Intra-day routes within selected day (base to each destination)
        // BUT: Only show intra-day routes if this is NOT a travel day (base location doesn't change)
        const selectedDay = tripDays[selectedDayIndex]
        const previousDay = tripDays[selectedDayIndex - 1]
        const nextDay = tripDays[selectedDayIndex + 1]
        
        // Check if this is a travel day (base location changes from previous or to next day)
        const isTravelDay = (previousDay?.baseLocations?.[0] && areBaseLocationsDifferent(selectedDay.baseLocations?.[0], previousDay.baseLocations[0])) ||
                           (nextDay?.baseLocations?.[0] && areBaseLocationsDifferent(selectedDay.baseLocations?.[0], nextDay.baseLocations[0]))
        
        // Only show intra-day routes if this is NOT a travel day
        if (selectedDay.baseLocations && selectedDay.baseLocations.length > 0 && 
            selectedDay.destinations.length > 0 && !isTravelDay) {
          routesToShow.push({
            fromDay: selectedDay,
            toDay: selectedDay,
            type: 'intra-day'
          })
        }
      }
    }

    return routesToShow
  }, [selectedDayId, tripDays, areBaseLocationsDifferent])

  // Main route calculation function
  const calculateRoutes = useCallback(async () => {
    if (!map || !token || !hasTrip || tripDays.length === 0) return

    onLoadingChange(true)
    const newRoutes = new Map<string, RouteData>()

    try {
      const routesToShow = getRoutesToShow()
      
      console.log('RouteManager: Calculating routes', {
        selectedDayId,
        routesToShow: routesToShow.length,
        routes: routesToShow.map(r => ({
          from: r.fromDay.id,
          to: r.toDay.id,
          type: r.type,
          fromDayDestinations: r.fromDay.destinations.length,
          toDayDestinations: r.toDay.destinations.length,
          fromBaseLocation: r.fromDay.baseLocations?.[0]?.name,
          toBaseLocation: r.toDay.baseLocations?.[0]?.name,
          baseLocationsDifferent: areBaseLocationsDifferent(r.fromDay.baseLocations?.[0], r.toDay.baseLocations?.[0])
        })),
        tripDays: tripDays.map(d => ({
          id: d.id,
          baseLocation: d.baseLocations?.[0]?.name,
          destinations: d.destinations.map(dest => dest.name)
        }))
      })

      // Create individual segments for all routes
      for (const routeInfo of routesToShow) {
        const { fromDay, toDay, type } = routeInfo
        
        if (type === 'inter-day') {
          // Create segments: fromDay base → toDay destinations → toDay base
          const waypoints = buildInterDayWaypoints(fromDay, toDay)
          
          console.log(`RouteManager: Building inter-day segments ${fromDay.id} → ${toDay.id}`, {
            waypoints: waypoints.map(wp => ({
              name: wp.name,
              type: wp.type,
              dayId: wp.dayId,
              coordinates: wp.coordinates
            }))
          })
          
          // Create individual segments between consecutive waypoints
          for (let i = 0; i < waypoints.length - 1; i++) {
            const fromWaypoint = waypoints[i]
            const toWaypoint = waypoints[i + 1]
            
            const routeData = await calculateSegmentRoute(fromWaypoint, toWaypoint)
            
            if (routeData) {
              // Determine segment type
              let segmentType: RouteData['segmentType'] = 'base-to-base'
              if (fromWaypoint.type === 'base' && toWaypoint.type === 'destination') {
                segmentType = 'base-to-destination'
              } else if (fromWaypoint.type === 'destination' && toWaypoint.type === 'destination') {
                segmentType = 'destination-to-destination'
              } else if (fromWaypoint.type === 'destination' && toWaypoint.type === 'base') {
                segmentType = 'destination-to-base'
              }
              
              routeData.segmentType = segmentType
              
              const routeKey = `segment-${fromWaypoint.dayId}-${toWaypoint.dayId}-${i}`
              newRoutes.set(routeKey, routeData)
            }
          }
        } else if (type === 'intra-day') {
          // Create segments: base → each destination
          const baseLocation = fromDay.baseLocations![0]
          
          for (const destination of fromDay.destinations) {
            const fromWaypoint = {
              coordinates: baseLocation.coordinates,
              type: 'base' as const,
              name: baseLocation.name,
              dayId: fromDay.id
            }
            const toWaypoint = {
              coordinates: destination.coordinates,
              type: 'destination' as const,
              name: destination.name,
              dayId: fromDay.id
            }
            
            const routeData = await calculateSegmentRoute(fromWaypoint, toWaypoint)
            
            if (routeData) {
              routeData.segmentType = 'base-to-destination'
              
              const routeKey = `segment-${fromDay.id}-${destination.id}`
              newRoutes.set(routeKey, routeData)
            }
          }
        }
      }

      // Update map sources with all segments
      const allSegments = Array.from(newRoutes.entries()).map(([key, route]) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: route.coordinates
        },
        properties: {
          id: key,
          routeType: 'segment',
          segmentType: route.segmentType,
          duration: Math.round(route.duration / 60), // Convert to minutes
          distance: Math.round(route.distance / 1000), // Convert to km
          label: `${route.fromLocation} → ${route.toLocation}: ${Math.round(route.duration / 60)}min • ${Math.round(route.distance / 1000)}km`,
          fromDayId: route.fromDayId,
          toDayId: route.toDayId,
          fromLocation: route.fromLocation,
          toLocation: route.toLocation,
          bearing: calculateBearing(route.coordinates[0], route.coordinates[route.coordinates.length - 1])
        }
      }))

      // Update map sources
      if (map.getSource('route-segments')) {
        map.getSource('route-segments').setData({
          type: 'FeatureCollection',
          features: allSegments
        })
      }

      console.log('RouteManager: Segments updated', {
        totalSegments: allSegments.length,
        segmentDetails: allSegments.map(s => ({
          id: s.properties.id,
          label: s.properties.label,
          segmentType: s.properties.segmentType,
          fromDayId: s.properties.fromDayId,
          toDayId: s.properties.toDayId
        }))
      })

      } catch (error) {
        console.error('Error calculating routes:', error)
      } finally {
        onLoadingChange(false)
      }
  }, [map, hasTrip, token, tripDays, selectedDayId, getRoutesToShow, buildInterDayWaypoints, calculateSegmentRoute, calculateBearing, areBaseLocationsDifferent, onLoadingChange])

  // Debounced route calculation
  useEffect(() => {
    if (routeCalculationTimeoutRef.current) {
      clearTimeout(routeCalculationTimeoutRef.current)
    }
    
    routeCalculationTimeoutRef.current = setTimeout(() => {
      calculateRoutes()
    }, 200)

    return () => {
      if (routeCalculationTimeoutRef.current) {
        clearTimeout(routeCalculationTimeoutRef.current)
      }
    }
  }, [calculateRoutes])

  return null
}