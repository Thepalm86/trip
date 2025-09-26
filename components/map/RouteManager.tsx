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
    locationId?: string
  }>
  segmentType?: 'base-to-destination' | 'destination-to-destination' | 'destination-to-base' | 'base-to-base' | 'inter-day'
  visibility?: 'overview' | 'selected-inbound' | 'selected-outbound' | 'selected-intra-day'
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

  const coordinatesMatch = useCallback((a?: [number, number], b?: [number, number]) => {
    if (!a || !b) return false
    return a[0] === b[0] && a[1] === b[1]
  }, [])

  const toWaypoint = useCallback((dayId: string, role: 'base' | 'destination', payload: { name: string; coordinates: [number, number]; id?: string }) => ({
    coordinates: payload.coordinates,
    type: role,
    name: payload.name,
    dayId,
    locationId: payload.id
  }), [])

  const getDayStartAnchor = useCallback((day: Trip['days'][0]) => {
    // For inbound routes, we want to connect to the first destination of the day
    // not the base location (where we sleep)
    const firstDestination = day.destinations[0]
    if (firstDestination) {
      return toWaypoint(day.id, 'destination', firstDestination)
    }

    // Fallback to base location only if no destinations exist
    const base = day.baseLocations?.[0]
    if (base) {
      return toWaypoint(day.id, 'base', base)
    }

    return null
  }, [toWaypoint])

  const getDayEndAnchor = useCallback((day: Trip['days'][0]) => {
    const base = day.baseLocations?.[0]
    if (base) {
      return toWaypoint(day.id, 'base', base)
    }

    const lastDestination = day.destinations[day.destinations.length - 1]
    if (lastDestination) {
      return toWaypoint(day.id, 'destination', lastDestination)
    }

    return null
  }, [toWaypoint])

  const buildInterDaySegment = useCallback((fromDay: Trip['days'][0], toDay: Trip['days'][0]) => {
    const origin = getDayEndAnchor(fromDay)
    const destination = getDayStartAnchor(toDay)

    if (!origin || !destination) return null
    if (coordinatesMatch(origin.coordinates, destination.coordinates)) return null

    return { origin, destination }
  }, [getDayEndAnchor, getDayStartAnchor, coordinatesMatch])

  const buildIntraDaySegments = useCallback((day: Trip['days'][0]) => {
    const segments: Array<{ key: string; from: RouteData['waypoints'][0]; to: RouteData['waypoints'][0]; segmentType: RouteData['segmentType'] }> = []
    
    // Build sequential route: previous day's end → destinations → current day's base
    const destinations = day.destinations
    if (destinations.length === 0) return segments

    // Create sequential route through all destinations
    for (let i = 0; i < destinations.length - 1; i++) {
      const current = toWaypoint(day.id, 'destination', destinations[i])
      const next = toWaypoint(day.id, 'destination', destinations[i + 1])
      if (!coordinatesMatch(current.coordinates, next.coordinates)) {
        segments.push({
          key: `intra-${day.id}-sequence-${i}-${current.locationId ?? current.coordinates.join(',')}-${next.locationId ?? next.coordinates.join(',')}`,
          from: current,
          to: next,
          segmentType: 'destination-to-destination'
        })
      }
    }

    // Add route from last destination to base (if base exists and is different)
    const base = day.baseLocations?.[0]
    if (base && destinations.length > 0) {
      const lastDestination = toWaypoint(day.id, 'destination', destinations[destinations.length - 1])
      const baseWaypoint = toWaypoint(day.id, 'base', base)
      
      if (!coordinatesMatch(lastDestination.coordinates, baseWaypoint.coordinates)) {
        segments.push({
          key: `intra-${day.id}-final-${lastDestination.locationId ?? lastDestination.coordinates.join(',')}-${baseWaypoint.locationId ?? baseWaypoint.coordinates.join(',')}`,
          from: lastDestination,
          to: baseWaypoint,
          segmentType: 'destination-to-base'
        })
      }
    }

    return segments
  }, [coordinatesMatch, toWaypoint])

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

  const getRoutesToShow = useCallback(() => {
    const interDayRoutes: Array<{
      key: string
      fromDay: Trip['days'][0]
      toDay: Trip['days'][0]
      origin: RouteData['waypoints'][0]
      destination: RouteData['waypoints'][0]
      visibility: RouteData['visibility']
    }> = []
    const intraDaySegments: Array<{
      key: string
      from: RouteData['waypoints'][0]
      to: RouteData['waypoints'][0]
      segmentType: RouteData['segmentType']
    }> = []

    if (!tripDays.length) {
      return { interDayRoutes, intraDaySegments }
    }

    if (!selectedDayId) {
      for (let i = 0; i < tripDays.length - 1; i++) {
        const fromDay = tripDays[i]
        const toDay = tripDays[i + 1]
        const segment = buildInterDaySegment(fromDay, toDay)

        if (segment) {
          interDayRoutes.push({
            key: `inter-${fromDay.id}-${toDay.id}`,
            fromDay,
            toDay,
            origin: segment.origin,
            destination: segment.destination,
            visibility: 'overview'
          })
        }
      }

      return { interDayRoutes, intraDaySegments }
    }

    const selectedDayIndex = tripDays.findIndex(day => day.id === selectedDayId)

    if (selectedDayIndex === -1) {
      return { interDayRoutes, intraDaySegments }
    }

    const selectedDay = tripDays[selectedDayIndex]

    if (selectedDayIndex > 0) {
      const previousDay = tripDays[selectedDayIndex - 1]
      const inbound = buildInterDaySegment(previousDay, selectedDay)

      if (inbound) {
        interDayRoutes.push({
          key: `inter-${previousDay.id}-${selectedDay.id}`,
          fromDay: previousDay,
          toDay: selectedDay,
          origin: inbound.origin,
          destination: inbound.destination,
          visibility: 'selected-inbound'
        })
      }
    }

    // Note: Outbound routes are not shown on the departing day
    // Inter-day routes "belong" to the landing day, not the departing day
    // The outbound route will be shown as an inbound route when viewing the next day

    buildIntraDaySegments(selectedDay).forEach(segment => {
      intraDaySegments.push(segment)
    })

    return { interDayRoutes, intraDaySegments }
  }, [tripDays, selectedDayId, buildInterDaySegment, buildIntraDaySegments])

  // Main route calculation function
  const calculateRoutes = useCallback(async () => {
    if (!map || !token || !hasTrip || tripDays.length === 0) return

    onLoadingChange(true)
    const newRoutes = new Map<string, RouteData>()

    try {
      const { interDayRoutes, intraDaySegments } = getRoutesToShow()

      console.log('RouteManager: Calculating routes', {
        selectedDayId,
        interDayCount: interDayRoutes.length,
        intraDayCount: intraDaySegments.length,
        interDay: interDayRoutes.map(route => ({
          key: route.key,
          fromDayId: route.fromDay.id,
          toDayId: route.toDay.id,
          origin: route.origin.name,
          destination: route.destination.name,
          visibility: route.visibility
        })),
        intraDay: intraDaySegments.map(segment => ({
          key: segment.key,
          fromDayId: segment.from.dayId,
          toDayId: segment.to.dayId,
          from: segment.from.name,
          to: segment.to.name,
          type: segment.segmentType
        }))
      })

      for (const route of interDayRoutes) {
        const routeData = await calculateSegmentRoute(route.origin, route.destination)

        if (routeData) {
          routeData.segmentType = 'inter-day'
          routeData.visibility = route.visibility
          newRoutes.set(route.key, routeData)
        }
      }

      // Mark intra-day routes as part of the selected day context
      for (const segment of intraDaySegments) {
        const routeData = await calculateSegmentRoute(segment.from, segment.to)

        if (routeData) {
          routeData.segmentType = segment.segmentType
          routeData.visibility = 'selected-intra-day'
          newRoutes.set(segment.key, routeData)
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
          visibility: route.visibility,
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
  }, [map, hasTrip, token, tripDays, selectedDayId, getRoutesToShow, calculateSegmentRoute, calculateBearing, onLoadingChange])

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
