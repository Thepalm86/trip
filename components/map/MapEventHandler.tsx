'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { LineString as GeoJSONLineString } from 'geojson'
import type { Trip } from '@/types'
import { useSupabaseTripStore, MapRouteSelectionPoint } from '@/lib/store/supabase-trip-store'

function createElement(
  tag: string,
  className: string,
  textContent?: string | number
) {
  const element = document.createElement(tag)
  element.className = className
  if (textContent !== undefined) {
    element.textContent = String(textContent)
  }
  return element
}

const isMapDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_MAP === 'true'

function buildRouteSegmentPopupContent({
  durationLabel,
  distanceLabel,
}: {
  durationLabel: string
  distanceLabel: string
}) {
  const container = createElement('div', 'route-popup-content route-popup-compact')
  const metrics = createElement('div', 'route-popup-metrics')

  const durationMetric = createElement('div', 'route-popup-metric')
  durationMetric.appendChild(createElement('span', 'route-popup-metric-label', 'Time'))
  durationMetric.appendChild(createElement('span', 'route-popup-metric-value route-popup-duration', durationLabel))

  const distanceMetric = createElement('div', 'route-popup-metric')
  distanceMetric.appendChild(createElement('span', 'route-popup-metric-label', 'Distance'))
  distanceMetric.appendChild(createElement('span', 'route-popup-metric-value route-popup-distance', distanceLabel))

  metrics.appendChild(durationMetric)
  metrics.appendChild(distanceMetric)
  container.appendChild(metrics)

  return container
}

interface MapEventHandlerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  selectedDestination: any
  selectedBaseLocation: { dayId: string; index: number } | null
  setSelectedDay: (dayId: string) => void
  setSelectedDestination: (destination: any, origin?: 'map' | 'timeline') => void
  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin?: 'map' | 'timeline') => void
  setSelectedCard: (cardId: string | null) => void
  selectedRouteSegmentId: string | null
  setSelectedRouteSegmentId: (routeId: string | null) => void
}

export function MapEventHandler({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId, 
  selectedDestination,
  selectedBaseLocation: _selectedBaseLocation,
  setSelectedDay,
  setSelectedDestination,
  setSelectedBaseLocation,
  setSelectedCard,
  selectedRouteSegmentId,
  setSelectedRouteSegmentId,
}: MapEventHandlerProps) {
  const [, setActivePopups] = useState<mapboxgl.Popup[]>([])
  const routeModeEnabled = useSupabaseTripStore((state) => state.routeModeEnabled)
  const registerRouteSelection = useSupabaseTripStore((state) => state.registerRouteSelection)

  const lastHoveredRouteIdRef = useRef<string | number | null>(null)
  const lastHoveredDayRouteOverlayIdRef = useRef<string | number | null>(null)

  // Format duration from minutes to hours/minutes
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }

  // Clear all popups
  const clearPopups = useCallback(() => {
    setActivePopups(prev => {
      if (isMapDebugEnabled) {
        console.debug('MapEventHandler: clearing popups', { count: prev.length })
      }
      prev.forEach(popup => popup.remove())
      return []
    })
  }, [])

  const clearRouteSegmentHoverState = useCallback(() => {
    if (!map) {
      lastHoveredRouteIdRef.current = null
      return
    }

    const routeId = lastHoveredRouteIdRef.current
    if (routeId !== null && map.getSource('route-segments')) {
      map.setFeatureState(
        { source: 'route-segments', id: routeId },
        { hover: false }
      )
    }

    lastHoveredRouteIdRef.current = null
  }, [map])

  const clearDayRouteOverlayHoverState = useCallback(() => {
    if (!map) {
      lastHoveredDayRouteOverlayIdRef.current = null
      return
    }

    const overlayId = lastHoveredDayRouteOverlayIdRef.current
    if (overlayId !== null && map.getSource('day-route-overlay')) {
      map.setFeatureState(
        { source: 'day-route-overlay', id: overlayId },
        { hover: false }
      )
    }

    lastHoveredDayRouteOverlayIdRef.current = null
  }, [map])

  const clearRouteHoverState = useCallback(() => {
    clearRouteSegmentHoverState()
    clearDayRouteOverlayHoverState()
  }, [clearRouteSegmentHoverState, clearDayRouteOverlayHoverState])

  const showRouteSegmentPopup = useCallback((feature: mapboxgl.MapboxGeoJSONFeature, lngLat: mapboxgl.LngLatLike) => {
    if (!map || !feature?.properties?.label) {
      return
    }

    const durationValue = typeof feature.properties.duration === 'number'
      ? feature.properties.duration
      : 0
    const distanceValue = typeof feature.properties.distance === 'number'
      ? feature.properties.distance
      : 0

    const formattedDistance = `${Math.max(distanceValue, 0).toLocaleString(undefined, {
      maximumFractionDigits: 0
    })} km`

    clearPopups()

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: 'route-segment-popup'
    })
      .setLngLat(lngLat)
      .setDOMContent(
        buildRouteSegmentPopupContent({
          durationLabel: formatDuration(durationValue),
          distanceLabel: formattedDistance,
        })
      )
      .addTo(map)

    setActivePopups(prev => [...prev, popup])
  }, [clearPopups, map])

  // Add enhanced click handlers with bidirectional interactions
  useEffect(() => {
    if (!map || !hasTrip) return

    const applyRouteSelection = (routeId: string | null) => {
      if (!map.getSource('route-segments')) {
        return
      }

      const queryFeatures = map.querySourceFeatures('route-segments') as mapboxgl.MapboxGeoJSONFeature[]
      const seen = new Set<string>()

      queryFeatures.forEach((feature: mapboxgl.MapboxGeoJSONFeature) => {
        const rawId = feature?.id ?? feature?.properties?.id
        if (rawId === undefined || rawId === null) {
          return
        }

        const featureId = String(rawId)
        if (seen.has(featureId)) {
          return
        }
        seen.add(featureId)

        map.setFeatureState(
          { source: 'route-segments', id: featureId },
          {
            active: routeId ? featureId === routeId : false,
            dimmed: routeId ? featureId !== routeId : false
          }
        )
      })
    }

    const focusRouteBounds = (
      routeId: string | null,
      options: { skipFitBounds?: boolean } = {}
    ) => {
      if (!routeId || !map.getSource('route-segments') || options.skipFitBounds) {
        return
      }

      const candidates = map.querySourceFeatures('route-segments', {
        filter: ['==', ['get', 'id'], routeId]
      }) as mapboxgl.MapboxGeoJSONFeature[]

      if (!candidates.length) {
        return
      }

      const geometry = candidates[0].geometry as GeoJSONLineString | undefined
      if (!geometry || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
        return
      }

      let bounds: mapboxgl.LngLatBounds | undefined
      geometry.coordinates.forEach(coord => {
        if (!bounds) {
          bounds = new mapboxgl.LngLatBounds(coord as [number, number], coord as [number, number])
        } else {
          bounds.extend(coord as [number, number])
        }
      })

      if (bounds) {
        map.fitBounds(bounds, {
          padding: { top: 100, bottom: 140, left: 180, right: 180 },
          duration: 450,
          maxZoom: 12.5
        })
      }
    }

    const handleBaseLocationClick = (e: any) => {
      const feature = e.features[0]
      if (!feature) return

      const dayId = feature.properties.dayId as string
      const baseIndex = typeof feature.properties.baseIndex === 'number' ? feature.properties.baseIndex : 0

      if (routeModeEnabled) {
        const geometry = feature.geometry as { coordinates?: [number, number] }
        const coordinates = Array.isArray(geometry?.coordinates)
          ? (geometry.coordinates as [number, number])
          : undefined
        if (!coordinates) {
          return
        }

        const selectionPoint: MapRouteSelectionPoint = {
          id: feature.properties.cardId ?? `base-${dayId}-${baseIndex}`,
          label: feature.properties.name ?? 'Base location',
          coordinates,
          source: 'base',
          dayId,
          meta: {
            city: feature.properties.city,
          },
        }

        registerRouteSelection(selectionPoint)
        return
      }


      setSelectedDay(dayId)
      setSelectedDestination(null)
      setSelectedBaseLocation({ dayId, index: baseIndex }, 'map')
      setSelectedCard(`base-${dayId}-${baseIndex}`)
      clearPopups()
    }

    const handleDestinationClick = (e: any) => {
      const feature = e.features[0]
      if (!feature) {
        return
      }

      const dayIndex = feature.properties.dayIndex
      const destIndex = feature.properties.destIndex
      const dayId = feature.properties.dayId
      const destinationId = feature.properties.destinationId

      if (routeModeEnabled) {
        const geometry = feature.geometry as { coordinates?: [number, number] }
        const coordinates = Array.isArray(geometry?.coordinates)
          ? (geometry.coordinates as [number, number])
          : undefined
        if (!coordinates) {
          return
        }

        const selectionPoint: MapRouteSelectionPoint = {
          id: destinationId ?? feature.properties.id ?? `dest-${dayId}-${destIndex}`,
          label: feature.properties.name ?? 'Destination',
          coordinates,
          source: 'destination',
          dayId,
          meta: {
            dayIndex,
            destIndex,
          },
        }

        registerRouteSelection(selectionPoint)
        return
      }

      // Bidirectional interaction: Select day and destination
      setSelectedDay(dayId)
      if (!hasTrip) return
      setSelectedDestination(tripDays[dayIndex].destinations[destIndex], 'map')
      setSelectedBaseLocation(null)
      setSelectedCard(`dest-${destinationId}`)
      clearPopups()
    }


    // Add click handlers
    map.on('click', 'base-locations-layer', handleBaseLocationClick)
    map.on('click', 'destinations-layer', handleDestinationClick)

    // Enhanced hover effects with feature states
    map.on('mouseenter', 'base-locations-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.dayIndex !== undefined) {
        map.setFeatureState(
          { source: 'base-locations', id: feature.properties.dayIndex },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'base-locations-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.dayIndex !== undefined) {
          map.setFeatureState(
            { source: 'base-locations', id: feature.properties.dayIndex },
            { hover: false }
          )
        }
      }
    })

    // Destination hover handlers
    map.on('mouseenter', 'destinations-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.dayIndex !== undefined) {
        map.setFeatureState(
          { source: 'destinations', id: feature.properties.dayIndex },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'destinations-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.dayIndex !== undefined) {
          map.setFeatureState(
            { source: 'destinations', id: feature.properties.dayIndex },
            { hover: false }
          )
        }
      }
    })


    // Inter-day route hover effects
    map.on('mouseenter', 'inter-day-routes-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.id) {
        map.setFeatureState(
          { source: 'inter-day-routes', id: feature.properties.id },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'inter-day-routes-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.id) {
          map.setFeatureState(
            { source: 'inter-day-routes', id: feature.properties.id },
            { hover: false }
          )
        }
      }
    })

    // Intra-day route hover effects
    map.on('mouseenter', 'intra-day-routes-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.id) {
        map.setFeatureState(
          { source: 'intra-day-routes', id: feature.properties.id },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'intra-day-routes-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.id) {
          map.setFeatureState(
            { source: 'intra-day-routes', id: feature.properties.id },
            { hover: false }
          )
        }
      }
    })

    // Route segment click handlers for distance/time popup
    const handleRouteSegmentClick = (e: any) => {
      const feature = e.features[0]
      if (!feature) {
        return
      }

      const markerFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['destinations-layer', 'base-locations-layer']
      })

      if (markerFeatures.length > 0) {
        return
      }

      const featureId = feature.id ?? feature.properties?.id
      if (featureId) {
        const featureIdStr = String(featureId)
        ;(map as any).__skipNextRouteFit = null
        setSelectedRouteSegmentId(featureIdStr)
        applyRouteSelection(featureIdStr)
        focusRouteBounds(featureIdStr)
      }

    }

    map.on('click', 'route-segments-layer', handleRouteSegmentClick)

    const handleDayRouteOverlayClick = (e: any) => {
      const feature = e.features[0]
      if (!feature) {
        return
      }

      const markerFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['destinations-layer', 'base-locations-layer']
      })

      if (markerFeatures.length > 0) {
        return
      }

      const featureId = feature.id ?? feature.properties?.id
      if (featureId) {
        const featureIdStr = String(featureId)
        setSelectedRouteSegmentId(featureIdStr)
        applyRouteSelection(featureIdStr)
        focusRouteBounds(featureIdStr)
      }

    }

    const handleDayRouteOverlayMouseEnter = (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features?.[0]
      if (!feature) {
        return
      }

      const featureId = feature.id ?? feature.properties?.id
      if (featureId) {
        map.setFeatureState(
          { source: 'day-route-overlay', id: featureId },
          { hover: true }
        )
        lastHoveredDayRouteOverlayIdRef.current = featureId
      }

      const geometry = feature.geometry as GeoJSONLineString | undefined
      const coordinates = Array.isArray(geometry?.coordinates) ? geometry!.coordinates : []

      if (coordinates.length === 0) {
        return
      }

      const midpoint = coordinates[Math.floor(coordinates.length / 2)] as [number, number]
      showRouteSegmentPopup(feature, midpoint)
    }

    const handleDayRouteOverlayMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      clearDayRouteOverlayHoverState()
      clearPopups()
    }

    if (map.getLayer('day-route-overlay')) {
      map.on('click', 'day-route-overlay', handleDayRouteOverlayClick)
      map.on('mouseenter', 'day-route-overlay', handleDayRouteOverlayMouseEnter)
      map.on('mouseleave', 'day-route-overlay', handleDayRouteOverlayMouseLeave)
    }

    const handleRouteSegmentMouseEnter = (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (!feature) {
        return
      }

      const featureId = feature.id ?? feature.properties?.id
      if (!featureId) {
        return
      }

      map.setFeatureState(
        { source: 'route-segments', id: featureId },
        { hover: true }
      )

      lastHoveredRouteIdRef.current = featureId

      const geometry = feature.geometry as GeoJSONLineString | undefined
      const coordinates = Array.isArray(geometry?.coordinates) ? geometry!.coordinates : []

      if (coordinates.length === 0) {
        return
      }

      const midpoint = coordinates[Math.floor(coordinates.length / 2)] as [number, number]
      showRouteSegmentPopup(feature, midpoint)
    }

    const handleRouteSegmentMouseLeave = () => {
      map.getCanvas().style.cursor = ''
      clearRouteSegmentHoverState()
      clearPopups()
    }

    map.on('mouseenter', 'route-segments-layer', handleRouteSegmentMouseEnter)
    map.on('mouseleave', 'route-segments-layer', handleRouteSegmentMouseLeave)

    const handleMapMouseMove = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (!map) {
        return
      }

      if (lastHoveredRouteIdRef.current === null && lastHoveredDayRouteOverlayIdRef.current === null) {
        return
      }

      const layersToCheck: string[] = []
      if (map.getLayer('route-segments-layer')) {
        layersToCheck.push('route-segments-layer')
      }
      if (map.getLayer('day-route-overlay')) {
        layersToCheck.push('day-route-overlay')
      }

      if (layersToCheck.length === 0) {
        return
      }

      const features = map.queryRenderedFeatures(e.point, {
        layers: layersToCheck
      }) as mapboxgl.MapboxGeoJSONFeature[]

      if (features.length === 0) {
        clearRouteHoverState()
        clearPopups()
      }
    }

    map.on('mousemove', handleMapMouseMove)

    // Close popups when clicking on empty areas (not on route segments)
    const handleGeneralClick = (e: mapboxgl.MapMouseEvent) => {
      const routeFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['route-segments-layer', 'day-route-overlay']
      })

      if (routeFeatures.length > 0) {
        return
      }

      const baseFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['base-locations-layer']
      })

      const destinationFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['destinations-layer']
      })

      if (baseFeatures.length > 0 || destinationFeatures.length > 0) {
        return
      }

      clearPopups()
      setSelectedDestination(null)
      setSelectedBaseLocation(null)
      setSelectedCard(null)
    }

    map.on('click', handleGeneralClick)

    const handleTimelineRouteSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{ routeId: string | null; skipFocus?: boolean }>
      const routeId = customEvent.detail?.routeId ?? null
      const skipFocus = customEvent.detail?.skipFocus ?? false
      if (skipFocus && typeof map?.getZoom === 'function') {
        ;(map as any).__skipNextRouteFit = { zoom: map.getZoom() }
      } else {
        ;(map as any).__skipNextRouteFit = null
      }
      applyRouteSelection(routeId)
      if (routeId) {
        focusRouteBounds(routeId, { skipFitBounds: skipFocus })
      }
    }

    window.addEventListener('timelineRouteSelect', handleTimelineRouteSelect)

    const hasLayer = (layerId: string) => {
      if (!map || typeof map.getStyle !== 'function') {
        return false
      }
      const style = map.getStyle()
      if (!style || !Array.isArray(style.layers)) {
        return false
      }
      return style.layers.some((layer: mapboxgl.AnyLayer) => layer.id === layerId)
    }

    return () => {
      if (!map) {
        window.removeEventListener('timelineRouteSelect', handleTimelineRouteSelect)
        return
      }

      map.off('click', 'base-locations-layer', handleBaseLocationClick)
      map.off('click', 'destinations-layer', handleDestinationClick)
      map.off('mouseenter', 'base-locations-layer')
      map.off('mouseleave', 'base-locations-layer')
      map.off('mouseenter', 'destinations-layer')
      map.off('mouseleave', 'destinations-layer')
      map.off('mouseenter', 'inter-day-routes-layer')
      map.off('mouseleave', 'inter-day-routes-layer')
      map.off('mouseenter', 'intra-day-routes-layer')
      map.off('mouseleave', 'intra-day-routes-layer')
      map.off('click', 'inter-day-routes-layer')
      map.off('click', 'intra-day-routes-layer')
      map.off('click', 'route-segments-layer', handleRouteSegmentClick)
      if (hasLayer('day-route-overlay')) {
        map.off('click', 'day-route-overlay', handleDayRouteOverlayClick)
        map.off('mouseenter', 'day-route-overlay', handleDayRouteOverlayMouseEnter)
        map.off('mouseleave', 'day-route-overlay', handleDayRouteOverlayMouseLeave)
      }
      if (hasLayer('route-segments-layer')) {
        map.off('mouseenter', 'route-segments-layer', handleRouteSegmentMouseEnter)
        map.off('mouseleave', 'route-segments-layer', handleRouteSegmentMouseLeave)
      }
      map.off('mousemove', handleMapMouseMove)
      map.off('click', handleGeneralClick)
      window.removeEventListener('timelineRouteSelect', handleTimelineRouteSelect)
    }
  }, [
    map,
    hasTrip,
    tripDays,
    selectedDayId,
    selectedDestination,
    setSelectedDay,
    setSelectedDestination,
    setSelectedBaseLocation,
    setSelectedCard,
    selectedRouteSegmentId,
    setSelectedRouteSegmentId,
    clearPopups,
    clearRouteHoverState,
    clearRouteSegmentHoverState,
    clearDayRouteOverlayHoverState,
    routeModeEnabled,
    registerRouteSelection,
    showRouteSegmentPopup,
  ])

  return null
}
