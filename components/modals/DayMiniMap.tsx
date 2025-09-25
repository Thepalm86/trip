'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { TimelineDay, Destination } from '@/types'

interface DayMiniMapProps {
  day: TimelineDay
  timeSlots: Array<{
    id: string
    destination?: Destination
    startTime: string
    endTime: string
    activity: string
  }>
  className?: string
}

export function DayMiniMap({ day, timeSlots, className = '' }: DayMiniMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (map.current) return // initialize map only once

    if (!mapContainer.current) return

    // Get Mapbox token from environment variables
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!mapboxToken) {
      setError('Mapbox token not found')
      setIsLoading(false)
      return
    }

    mapboxgl.accessToken = mapboxToken

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [12.4964, 41.9028], // Default to Rome
        zoom: 10,
        pitch: 0,
        bearing: 0,
        antialias: true,
        dragRotate: false,
        scrollZoom: true,
        boxZoom: true,
        dragPan: true,
        keyboard: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        attributionControl: true,
      })

      // Add navigation controls for interactive map
      map.current.addControl(new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true
      }), 'top-right')

      map.current.on('load', () => {
        setIsLoading(false)
        updateMapWithDestinations()
      })

      map.current.on('error', (e) => {
        console.error('Map error:', e)
        setError('Failed to load map')
        setIsLoading(false)
      })

    } catch (err) {
      console.error('Error initializing map:', err)
      setError('Failed to initialize map')
      setIsLoading(false)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  const updateMapWithDestinations = () => {
    if (!map.current) return

    // Get all destinations from time slots
    const destinations = timeSlots
      .filter(slot => slot.destination)
      .map(slot => slot.destination!)
      .filter(Boolean)

    if (destinations.length === 0) {
      // If no destinations, show base location if available
      if (day.location) {
        map.current.setCenter(day.location.coordinates as [number, number])
        map.current.setZoom(12)
      }
      return
    }

    // Calculate bounds to fit all destinations
    const coordinates = destinations.map(dest => dest.coordinates)
    
    if (coordinates.length === 1) {
      // Single destination
      map.current.setCenter(coordinates[0] as [number, number])
      map.current.setZoom(14)
    } else {
      // Multiple destinations - fit bounds
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord as [number, number])
      }, new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]))

      map.current.fitBounds(bounds, {
        padding: 40,
        maxZoom: 14
      })
    }

    // Add markers for each destination
    destinations.forEach((destination, index) => {
      const marker = new mapboxgl.Marker({
        color: getMarkerColor(index),
        scale: 0.8
      })
        .setLngLat(destination.coordinates as [number, number])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-2">
                <h3 class="font-semibold text-sm text-gray-900">${destination.name}</h3>
                <p class="text-xs text-gray-600">${destination.description || ''}</p>
              </div>
            `)
        )
        .addTo(map.current!)

      // Store marker reference for cleanup
      ;(marker as any).destinationId = destination.id
    })

    // Add route if multiple destinations
    if (destinations.length > 1) {
      addRouteToMap(destinations)
    }
  }

  const addRouteToMap = async (destinations: Destination[]) => {
    if (!map.current) return

    try {
      const coordinates = destinations.map(dest => dest.coordinates)
      const coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';')

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&access_token=${mapboxgl.accessToken}`
      )

      if (!response.ok) throw new Error('Route request failed')

      const data = await response.json()

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        
        // Add route source
        if (map.current.getSource('route')) {
          map.current.removeSource('route')
        }
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route')
        }

        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          }
        })

        // Add route layer
        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
            'line-opacity': 0.8
          }
        })
      }
    } catch (error) {
      console.error('Error adding route:', error)
    }
  }

  const getMarkerColor = (index: number) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
    return colors[index % colors.length]
  }

  // Update map when timeSlots change
  useEffect(() => {
    if (map.current && !isLoading) {
      // Clear existing markers and routes
      const markers = document.querySelectorAll('.mapboxgl-marker')
      markers.forEach(marker => marker.remove())

      if (map.current.getSource('route')) {
        map.current.removeSource('route')
      }
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route')
      }

      updateMapWithDestinations()
    }
  }, [timeSlots, isLoading])

  if (error) {
    return (
      <div className={`bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl border border-white/10 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2">
            <span className="text-red-400 text-xs">!</span>
          </div>
          <p className="text-white/60 text-xs">Map unavailable</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl border border-white/10 overflow-hidden ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="absolute inset-0"
      />
      
      {/* Map Header */}
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <span className="text-blue-400 text-xs">🗺️</span>
          </div>
          <h3 className="text-sm font-semibold text-white">Day Route</h3>
        </div>
        <p className="text-white/60 text-xs mt-1">
          {timeSlots.length} activities • {timeSlots.filter(slot => slot.destination).length} destinations
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white/60 text-xs">Loading map...</p>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isLoading && timeSlots.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>Route</span>
            <div className="w-2 h-2 rounded-full bg-green-500 ml-2"></div>
            <span>Destinations</span>
          </div>
        </div>
      )}
    </div>
  )
}
