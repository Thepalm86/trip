'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import clsx from 'clsx'
import mapboxgl from 'mapbox-gl'
import { MapIntegration } from './MapIntegration'
import { ExploreSearchDock } from './ExploreSearchDock'

export interface InteractiveMapRef {
  getMap: () => mapboxgl.Map | null
}

type InteractiveMapVariant = 'default' | 'mini'

interface InteractiveMapProps {
  variant?: InteractiveMapVariant
  className?: string
  interactive?: boolean
}

type ViewportDetail = {
  center: {
    lng: number
    lat: number
  }
  zoom: number
  bearing: number
  pitch: number
}

const VIEWPORT_SYNC_EVENT = 'trip3-map:viewport-sync'
let lastViewportDetail: ViewportDetail | null = null

export const InteractiveMap = forwardRef<InteractiveMapRef, InteractiveMapProps>((props, ref) => {
  const { variant = 'default', className, interactive } = props
  const isMini = variant === 'mini'
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pendingViewportRef = useRef<ViewportDetail | null>(null)
  const allowInteractions = interactive ?? !isMini

  const applyViewport = useCallback((detail: ViewportDetail, animate = false) => {
    if (!map.current) {
      pendingViewportRef.current = detail
      return
    }
    const { center, zoom, bearing, pitch } = detail
    map.current.easeTo({
      center: [center.lng, center.lat],
      zoom,
      bearing,
      pitch,
      duration: animate ? 300 : 0,
    })
  }, [])

  const broadcastViewport = useCallback(() => {
    if (!map.current) return
    const center = map.current.getCenter()
    const detail: ViewportDetail = {
      center: { lng: center.lng, lat: center.lat },
      zoom: map.current.getZoom(),
      bearing: map.current.getBearing(),
      pitch: map.current.getPitch(),
    }
    lastViewportDetail = detail
    window.dispatchEvent(new CustomEvent<ViewportDetail>(VIEWPORT_SYNC_EVENT, { detail }))
  }, [])

  useEffect(() => {
    if (map.current) return // initialize map only once

    if (!mapContainer.current) return

    // Get Mapbox token from environment variables
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!mapboxToken) {
      console.error('Mapbox token not found. Please check your environment variables.')
      return
    }

    mapboxgl.accessToken = mapboxToken

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', // Dark theme to match our design
      center: [0, 20],
      zoom: 1.2,
      pitch: 0,
      bearing: 0,
      antialias: true,
      dragRotate: false,
      minZoom: 1,
      interactive: allowInteractions,
      attributionControl: !isMini,
    })

    map.current.touchZoomRotate?.disableRotation()

    // Add navigation controls for full map only
    if (!isMini) {
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    }

    // Ensure rotation remains locked after load (Mapbox re-enables it otherwise)
    map.current.on('load', () => {
      map.current?.resize()
      map.current?.touchZoomRotate?.disableRotation()
      setIsLoading(false)
      if (isMini) {
        if (pendingViewportRef.current) {
          applyViewport(pendingViewportRef.current, false)
          pendingViewportRef.current = null
        }
      } else {
        broadcastViewport()
      }
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [isMini, applyViewport, broadcastViewport, allowInteractions])

  // Listen for custom events to center map on destinations
  useEffect(() => {
    const handleCenterMapOnDestinations = (event: CustomEvent) => {
      if (!map.current) return

      const { coordinates, bounds, center, zoom } = event.detail

      if (bounds) {
        // Multiple destinations - fit bounds
        const mapBounds = new mapboxgl.LngLatBounds()
        coordinates.forEach((coord: { lng: number; lat: number }) => {
          mapBounds.extend([coord.lng, coord.lat])
        })
        
        map.current.fitBounds(mapBounds, {
          padding: 50,
          maxZoom: 15,
          duration: 1000
        })
      } else if (center && zoom) {
        // Single destination - center and zoom
        map.current.flyTo({
          center: [center.lng, center.lat],
          zoom: zoom,
          duration: 1000
        })
      }
    }

    window.addEventListener('centerMapOnDestinations', handleCenterMapOnDestinations as any)

    return () => {
      window.removeEventListener('centerMapOnDestinations', handleCenterMapOnDestinations as any)
    }
  }, [])

  useEffect(() => {
    if (!map.current || isMini) {
      return
    }

    const handleMoveEnd = () => {
      broadcastViewport()
    }

    map.current.on('moveend', handleMoveEnd)

    return () => {
      map.current?.off('moveend', handleMoveEnd)
    }
  }, [isMini, broadcastViewport, isLoading])

  useEffect(() => {
    if (!isMini) {
      return
    }

    const handleViewportSync = (event: Event) => {
      const detail = (event as CustomEvent<ViewportDetail>).detail
      if (!detail) return
      if (isLoading || !map.current) {
        pendingViewportRef.current = detail
        return
      }
      applyViewport(detail, false)
    }

    window.addEventListener(VIEWPORT_SYNC_EVENT, handleViewportSync)

    if (lastViewportDetail) {
      if (map.current && !isLoading) {
        applyViewport(lastViewportDetail, false)
      } else {
        pendingViewportRef.current = lastViewportDetail
      }
    }

    return () => {
      window.removeEventListener(VIEWPORT_SYNC_EVENT, handleViewportSync)
    }
  }, [isMini, isLoading, applyViewport])

  // Expose map instance to parent components
  useImperativeHandle(ref, () => ({
    getMap: () => map.current
  }), [])

  return (
    <div
      className={clsx(
        'relative h-full w-full bg-gradient-to-br from-slate-900 to-slate-800 flex-1',
        isMini && 'rounded-2xl overflow-hidden',
        className
      )}
      data-tour="map"
    >
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className={clsx(
          'absolute inset-0',
          isMini
            ? 'rounded-2xl [&_.mapboxgl-ctrl-attrib]:hidden [&_.mapboxgl-ctrl-bottom-left]:hidden [&_.mapboxgl-ctrl-bottom-right]:hidden [&_.mapboxgl-ctrl-logo]:hidden'
            : 'rounded-none',
          !allowInteractions && 'pointer-events-none'
        )}
      />
      
      {/* Map Overlay - Search */}
      {!isMini ? (
        <div className="absolute top-0 left-0 right-0 p-5 sm:p-6 bg-gradient-to-b from-black/45 to-transparent pointer-events-none z-10">
          <div className="pointer-events-auto">
            <ExploreSearchDock />
          </div>
        </div>
      ) : null}

      {/* Map Integration */}
      {map.current && !isLoading && (
        <MapIntegration map={map.current} mode={isMini ? 'compact' : 'full'} />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted text-sm text-center leading-normal">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
})

InteractiveMap.displayName = 'InteractiveMap'
