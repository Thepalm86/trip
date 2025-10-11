'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapIntegration } from './MapIntegration'
import { ExploreSearchDock } from './ExploreSearchDock'

export interface InteractiveMapRef {
  getMap: () => mapboxgl.Map | null
}

export const InteractiveMap = forwardRef<InteractiveMapRef>((props, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
    })

    map.current.touchZoomRotate?.disableRotation()

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Ensure rotation remains locked after load (Mapbox re-enables it otherwise)
    map.current.on('load', () => {
      map.current?.resize()
      map.current?.touchZoomRotate?.disableRotation()
      setIsLoading(false)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

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

  // Expose map instance to parent components
  useImperativeHandle(ref, () => ({
    getMap: () => map.current
  }), [])

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-slate-900 to-slate-800 flex-1" data-tour="map">
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0 rounded-none"
      />
      
      {/* Map Overlay - Search */}
      <div className="absolute top-0 left-0 right-0 p-5 sm:p-6 bg-gradient-to-b from-black/45 to-transparent pointer-events-none z-10">
        <div className="pointer-events-auto">
          <ExploreSearchDock />
        </div>
      </div>

      {/* Map Integration */}
      {map.current && !isLoading && (
        <MapIntegration map={map.current} />
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
