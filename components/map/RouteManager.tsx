'use client'

import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import type { Trip } from '@/types'
import { useSupabaseTripStore, MapRouteSelectionPoint, RouteProfile } from '@/lib/store/supabase-trip-store'
import {
  buildIntraFinalKey,
  buildIntraSequenceKey,
  buildInterDayKey,
  getRouteColorForWaypoint,
  getWaypointKey,
} from '@/lib/map/route-style'
import { getExploreCategoryMetadata } from '@/lib/explore/categories'

const isMapDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_MAP === 'true'

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
    listIndex?: number
    baseIndex?: number
    category?: string
  }>
  segmentType?: 'base-to-destination' | 'destination-to-destination' | 'destination-to-base' | 'base-to-base' | 'inter-day' | 'ad-hoc'
  visibility?: 'overview' | 'selected-inbound' | 'selected-outbound' | 'selected-intra-day'
}

interface RouteManagerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  token: string
  onLoadingChange: (loading: boolean) => void
  showDayRouteOverlay: boolean
}

export function RouteManager({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId, 
  token, 
  onLoadingChange,
  showDayRouteOverlay,
}: RouteManagerProps) {
  const routeCalculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const routeCache = useRef<Map<string, RouteData>>(new Map())
  const currentFeatureIdsRef = useRef<string[]>([])
  const selectedRouteSegmentIdRef = useRef<string | null>(null)

  const selectedRouteSegmentId = useSupabaseTripStore(state => state.selectedRouteSegmentId)
  const adHocRouteConfig = useSupabaseTripStore((state) => state.adHocRouteConfig)
  const adHocRouteResult = useSupabaseTripStore((state) => state.adHocRouteResult)
  const setAdHocRouteResult = useSupabaseTripStore((state) => state.setAdHocRouteResult)
  const routeModeEnabled = useSupabaseTripStore((state) => state.routeModeEnabled)

  selectedRouteSegmentIdRef.current = selectedRouteSegmentId

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

  const toWaypoint = useCallback((dayId: string, role: 'base' | 'destination', payload: { name: string; coordinates: [number, number]; id?: string; index?: number; category?: string }) => ({
    coordinates: payload.coordinates,
    type: role,
    name: payload.name,
    dayId,
    locationId: payload.id,
    listIndex: role === 'destination' ? payload.index : undefined,
    baseIndex: role === 'base' ? payload.index : undefined,
    category: role === 'destination' ? payload.category : undefined
  }), [])

  const selectionToWaypoint = useCallback((selection: MapRouteSelectionPoint) => {
    const dayId = selection.dayId ?? 'ad-hoc'
    const role: 'base' | 'destination' = selection.source === 'base' ? 'base' : 'destination'
    const indexMeta = role === 'destination' ? selection.meta?.destIndex : selection.meta?.baseIndex
    const safeIndex = typeof indexMeta === 'number' ? indexMeta : undefined
    const categoryMeta = typeof selection.meta?.category === 'string' ? (selection.meta.category as string) : undefined

    return toWaypoint(dayId, role, {
      name: selection.label,
      coordinates: selection.coordinates,
      id: selection.id,
      index: safeIndex,
      category: categoryMeta,
    })
  }, [toWaypoint])

  const getDayStartAnchor = useCallback((day: Trip['days'][0]) => {
    // For inbound routes, we want to connect to the first destination of the day
    // not the base location (where we sleep)
    const firstDestination = day.destinations[0]
    if (firstDestination) {
      return toWaypoint(day.id, 'destination', {
        name: firstDestination.name,
        coordinates: firstDestination.coordinates,
        id: firstDestination.id,
        index: 0,
        category: firstDestination.category
      })
    }

    // Fallback to base location only if no destinations exist
    const base = day.baseLocations?.[0]
    if (base) {
      return toWaypoint(day.id, 'base', {
        name: base.name,
        coordinates: base.coordinates,
        index: 0
      })
    }

    return null
  }, [toWaypoint])

  const getDayEndAnchor = useCallback((day: Trip['days'][0]) => {
    const base = day.baseLocations?.[0]
    if (base) {
      return toWaypoint(day.id, 'base', {
        name: base.name,
        coordinates: base.coordinates,
        index: 0
      })
    }

    const lastDestination = day.destinations[day.destinations.length - 1]
    if (lastDestination) {
      return toWaypoint(day.id, 'destination', {
        name: lastDestination.name,
        coordinates: lastDestination.coordinates,
        id: lastDestination.id,
        index: day.destinations.length - 1,
        category: lastDestination.category
      })
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
      const current = toWaypoint(day.id, 'destination', {
        name: destinations[i].name,
        coordinates: destinations[i].coordinates,
        id: destinations[i].id,
        index: i,
        category: destinations[i].category
      })
      const next = toWaypoint(day.id, 'destination', {
        name: destinations[i + 1].name,
        coordinates: destinations[i + 1].coordinates,
        id: destinations[i + 1].id,
        index: i + 1,
        category: destinations[i + 1].category
      })
      if (!coordinatesMatch(current.coordinates, next.coordinates)) {
        const fromKey = getWaypointKey(current.locationId, current.coordinates)
        const toKey = getWaypointKey(next.locationId, next.coordinates)
        segments.push({
          key: buildIntraSequenceKey(day.id, i, fromKey, toKey),
          from: current,
          to: next,
          segmentType: 'destination-to-destination'
        })
      }
    }

    // Add route from last destination to base (if base exists and is different)
    const base = day.baseLocations?.[0]
    if (base && destinations.length > 0) {
      const lastDestination = toWaypoint(day.id, 'destination', {
        name: destinations[destinations.length - 1].name,
        coordinates: destinations[destinations.length - 1].coordinates,
        id: destinations[destinations.length - 1].id,
        index: destinations.length - 1,
        category: destinations[destinations.length - 1].category
      })
      const baseWaypoint = toWaypoint(day.id, 'base', {
        name: base.name,
        coordinates: base.coordinates,
        index: 0
      })
      
      if (!coordinatesMatch(lastDestination.coordinates, baseWaypoint.coordinates)) {
        const fromKey = getWaypointKey(lastDestination.locationId, lastDestination.coordinates)
        const toKey = getWaypointKey(baseWaypoint.locationId, baseWaypoint.coordinates)
        segments.push({
          key: buildIntraFinalKey(day.id, fromKey, toKey),
          from: lastDestination,
          to: baseWaypoint,
          segmentType: 'destination-to-base'
        })
      }
    }

    return segments
  }, [coordinatesMatch, toWaypoint])

  // Calculate individual segment route between two points
  const calculateSegmentRoute = useCallback(async (fromWaypoint: RouteData['waypoints'][0], toWaypoint: RouteData['waypoints'][0], profile: RouteProfile = 'driving') => {
    const coordinates = [fromWaypoint.coordinates, toWaypoint.coordinates]
    const cacheKey = `${profile}:${coordinates.map(coord => `${coord[0]},${coord[1]}`).join('-')}-segment`
    
    // Check cache first
    if (routeCache.current.has(cacheKey)) {
      return routeCache.current.get(cacheKey)!
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates
          .map(coord => `${coord[0]},${coord[1]}`)
          .join(';')}?access_token=${token}&geometries=geojson&overview=full`
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

  useEffect(() => {
    if (!map || !token) {
      return
    }

    if (!routeModeEnabled) {
      if (adHocRouteResult) {
        setAdHocRouteResult(null)
      }
      return
    }

    if (!adHocRouteConfig) {
      return
    }

    if (
      adHocRouteResult &&
      adHocRouteResult.id === adHocRouteConfig.id &&
      adHocRouteResult.profile === adHocRouteConfig.profile
    ) {
      return
    }

    let cancelled = false

    const run = async () => {
      const origin = selectionToWaypoint(adHocRouteConfig.from)
      const destination = selectionToWaypoint(adHocRouteConfig.to)

      if (coordinatesMatch(origin.coordinates, destination.coordinates)) {
        setAdHocRouteResult(null)
        return
      }

      const routeData = await calculateSegmentRoute(origin, destination, adHocRouteConfig.profile)

      if (!routeData || cancelled) {
        if (!cancelled) {
          setAdHocRouteResult(null)
        }
        return
      }

      setAdHocRouteResult({
        ...adHocRouteConfig,
        durationSeconds: routeData.duration,
        distanceMeters: routeData.distance,
        coordinates: routeData.coordinates,
      })
    }

    run()

    return () => {
      cancelled = true
    }
  }, [
    map,
    token,
    routeModeEnabled,
    adHocRouteConfig,
    adHocRouteResult,
    selectionToWaypoint,
    calculateSegmentRoute,
    coordinatesMatch,
    setAdHocRouteResult,
  ])

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
          key: buildInterDayKey(fromDay.id, toDay.id),
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
          key: buildInterDayKey(previousDay.id, selectedDay.id),
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

      if (isMapDebugEnabled) {
        console.debug('RouteManager: calculating routes', {
          selectedDayId,
          interDayCount: interDayRoutes.length,
          intraDayCount: intraDaySegments.length,
        })
      }

      const routePromises: Promise<void>[] = []

      interDayRoutes.forEach(route => {
        routePromises.push(
          calculateSegmentRoute(route.origin, route.destination).then(routeData => {
            if (!routeData) return

            newRoutes.set(route.key, {
              ...routeData,
              segmentType: 'inter-day',
              visibility: route.visibility,
            })
          })
        )
      })

      intraDaySegments.forEach(segment => {
        routePromises.push(
          calculateSegmentRoute(segment.from, segment.to).then(routeData => {
            if (!routeData) return

            newRoutes.set(segment.key, {
              ...routeData,
              segmentType: segment.segmentType,
              visibility: 'selected-intra-day',
            })
          })
        )
      })

      await Promise.all(routePromises)

      if (adHocRouteResult && Array.isArray(adHocRouteResult.coordinates) && adHocRouteResult.coordinates.length > 1) {
        const fromWaypoint = selectionToWaypoint(adHocRouteResult.from)
        const toWaypointData = selectionToWaypoint(adHocRouteResult.to)

        newRoutes.set(adHocRouteResult.id, {
          coordinates: adHocRouteResult.coordinates,
          duration: adHocRouteResult.durationSeconds,
          distance: adHocRouteResult.distanceMeters,
          routeType: 'segment',
          fromDayId: fromWaypoint.dayId,
          toDayId: toWaypointData.dayId,
          fromLocation: fromWaypoint.name,
          toLocation: toWaypointData.name,
          waypoints: [fromWaypoint, toWaypointData],
          segmentType: 'ad-hoc',
          visibility: 'selected-intra-day',
        })
      }

      // Update map sources with all segments
      const allSegments: FeatureCollection<LineString>['features'] = Array.from(newRoutes.entries()).map(([key, route]) => {
        const endWaypoint = route.waypoints[route.waypoints.length - 1]
        let lineColor = getRouteColorForWaypoint(endWaypoint)

        if (route.segmentType === 'destination-to-destination' && endWaypoint.category) {
          lineColor = getExploreCategoryMetadata(endWaypoint.category).colors.border
        }
        const startCoord = route.coordinates[0]
        const endCoord = route.coordinates[route.coordinates.length - 1]
        const startKey = `${startCoord[0]},${startCoord[1]}`
        const endKey = `${endCoord[0]},${endCoord[1]}`
        const normalizedKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`

        const feature: Feature<LineString> = {
          type: 'Feature',
          id: key,
          geometry: {
            type: 'LineString',
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
            bearing: calculateBearing(startCoord, endCoord),
            lineColor,
            parallelGroupKey: normalizedKey
          }
        }

        return feature
      })

      const parallelGroups = new Map<string, Feature<LineString>[]>()

      allSegments.forEach(feature => {
        const groupKey = feature.properties?.parallelGroupKey
        if (!groupKey) return
        if (!parallelGroups.has(groupKey)) {
          parallelGroups.set(groupKey, [])
        }
        parallelGroups.get(groupKey)!.push(feature)
      })

      const baseSpacing = 6

      parallelGroups.forEach(features => {
        if (features.length === 1) {
          features[0].properties = {
            ...features[0].properties,
            lineOffset: 0
          }
          return
        }

        const sorted = [...features].sort((a, b) => {
          const idA = String(a.id ?? '')
          const idB = String(b.id ?? '')
          return idA.localeCompare(idB)
        })

        const count = sorted.length
        const offsets: number[] = []

        if (count % 2 === 1) {
          const midpoint = (count - 1) / 2
          for (let i = 0; i < count; i++) {
            offsets.push((i - midpoint) * baseSpacing)
          }
        } else {
          const midpoint = count / 2 - 0.5
          for (let i = 0; i < count; i++) {
            offsets.push((i - midpoint) * baseSpacing)
          }
        }

        sorted.forEach((feature, index) => {
          feature.properties = {
            ...feature.properties,
            lineOffset: offsets[index]
          }
        })
      })

      const selectedId = selectedRouteSegmentIdRef.current
      const visibleSegments = selectedId
        ? allSegments.filter(feature => {
            const featureId = typeof feature.id === 'string' ? feature.id : feature.properties?.id
            return featureId === selectedId
          })
        : []

      const overlaySegments = showDayRouteOverlay
        ? allSegments.filter(feature => feature.properties?.visibility === 'selected-intra-day')
        : []

      // Update map sources
      if (map.getSource('route-segments')) {
        const data: FeatureCollection<LineString> = {
          type: 'FeatureCollection',
          features: visibleSegments
        }
        map.getSource('route-segments').setData(data)
        currentFeatureIdsRef.current = visibleSegments
          .map(feature => (typeof feature.id === 'string' ? feature.id : feature.properties?.id))
          .filter((id): id is string => typeof id === 'string')
      }

      if (map.getSource('day-route-overlay')) {
        const overlayData: FeatureCollection<LineString> = {
          type: 'FeatureCollection',
          features: overlaySegments
        }
        map.getSource('day-route-overlay').setData(overlayData)
      }

      if (isMapDebugEnabled) {
        console.debug('RouteManager: segments updated', {
          totalSegments: allSegments.length,
          visibleSegments: visibleSegments.length,
        })
      }

      if (map && selectedId && visibleSegments.length > 0) {
        const skipFitConfig = (map as any).__skipNextRouteFit
        if (skipFitConfig) {
          (map as any).__skipNextRouteFit = null
        }
        const segment = visibleSegments[0]
        const coords = segment.geometry?.coordinates ?? []
        if (coords.length > 0) {
          let bounds = new mapboxgl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
          coords.forEach(coord => {
            bounds = bounds.extend(coord as [number, number])
          })
          if (skipFitConfig && typeof map.easeTo === 'function' && typeof bounds.getCenter === 'function') {
            const preservedZoom = typeof skipFitConfig.zoom === 'number' ? skipFitConfig.zoom : map.getZoom?.()
            const center = bounds.getCenter()
            map.easeTo({
              center,
              zoom: preservedZoom,
              duration: 450,
            })
          } else {
            map.fitBounds(bounds, {
              padding: { top: 100, bottom: 140, left: 180, right: 180 },
              duration: 450,
              maxZoom: 12.5
            })
          }
        }
      }

      // Reapply selection highlight after data refresh
      if (map && map.getSource('route-segments')) {
        const selectedId = selectedRouteSegmentIdRef.current
        currentFeatureIdsRef.current.forEach(featureId => {
          map.setFeatureState(
            { source: 'route-segments', id: featureId },
            {
              active: selectedId ? featureId === selectedId : false,
              dimmed: selectedId ? featureId !== selectedId : false
            }
          )
        })
      }

      } catch (error) {
        console.error('Error calculating routes:', error)
      } finally {
        onLoadingChange(false)
      }
  }, [
    map,
    hasTrip,
    token,
    tripDays,
    selectedDayId,
    getRoutesToShow,
    calculateSegmentRoute,
    calculateBearing,
    onLoadingChange,
    selectedRouteSegmentId,
    showDayRouteOverlay,
    adHocRouteResult,
    selectionToWaypoint,
  ])

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

  // Apply feature state changes when selection updates
  useEffect(() => {
    if (!map || !map.getSource('route-segments')) {
      return
    }

    currentFeatureIdsRef.current.forEach(featureId => {
      map.setFeatureState(
        { source: 'route-segments', id: featureId },
        {
          active: selectedRouteSegmentId ? featureId === selectedRouteSegmentId : false,
          dimmed: selectedRouteSegmentId ? featureId !== selectedRouteSegmentId : false
        }
      )
    })
  }, [map, selectedRouteSegmentId])

  return null
}
