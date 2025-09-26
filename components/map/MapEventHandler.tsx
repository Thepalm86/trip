'use client'

import { useEffect, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Trip } from '@/types'

interface MapEventHandlerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  selectedDestination: any
  setSelectedDay: (dayId: string) => void
  setSelectedDestination: (destination: any) => void
}

export function MapEventHandler({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId, 
  selectedDestination,
  setSelectedDay,
  setSelectedDestination
}: MapEventHandlerProps) {
  const [activePopups, setActivePopups] = useState<mapboxgl.Popup[]>([])

  // Format duration from minutes to hours/minutes
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }

  // Clear all popups
  const clearPopups = useCallback(() => {
    console.log('clearPopups called')
    setActivePopups(prev => {
      console.log('Clearing popups, current count:', prev.length)
      prev.forEach(popup => popup.remove())
      return []
    })
  }, [])

  // Add enhanced click handlers with bidirectional interactions
  useEffect(() => {
    if (!map || !hasTrip) return

    const handleBaseLocationClick = (e: any) => {
      const feature = e.features[0]
      if (feature) {
        const dayIndex = feature.properties.dayIndex
        const dayId = feature.properties.dayId
        const dayNumber = feature.properties.dayNumber
        
        // Bidirectional interaction: Select day in left panel
        setSelectedDay(dayId)
        clearPopups()
        
        // Enhanced popup with more information
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'custom-popup'
        })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(`
            <div class="p-3 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                  ${dayNumber}
                </div>
                <h3 class="font-semibold text-sm text-white">${feature.properties.name}</h3>
              </div>
              <p class="text-xs text-white/60 mb-2">Day ${dayNumber} Base Location</p>
              ${feature.properties.context ? `<p class="text-xs text-white/50 mb-2">${feature.properties.context}</p>` : ''}
              <div class="flex items-center gap-4 text-xs text-white/60">
                <span>${feature.properties.destinationCount} activities</span>
              </div>
            </div>
          `)
          .addTo(map)
        
        setActivePopups(prev => [...prev, popup])
      }
    }

    const handleDestinationClick = (e: any) => {
      const feature = e.features[0]
      if (feature) {
        const dayIndex = feature.properties.dayIndex
        const destIndex = feature.properties.destIndex
        const dayId = feature.properties.dayId
        const destinationId = feature.properties.destinationId
        
        // Bidirectional interaction: Select day and destination
        setSelectedDay(dayId)
        if (!hasTrip) return
        setSelectedDestination(tripDays[dayIndex].destinations[destIndex])
        clearPopups()
        
        // Enhanced popup with more information
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'custom-popup'
        })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(`
            <div class="p-3 min-w-[220px]">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background-color: ${feature.properties.markerColor || '#3b82f6'}">
                  ${feature.properties.activityLetter}
                </div>
                <h3 class="font-semibold text-sm text-white">${feature.properties.name}</h3>
              </div>
              <p class="text-xs text-white/60 mb-2">Day ${feature.properties.dayNumber} • Activity ${feature.properties.activityLetter}</p>
              ${feature.properties.description ? `<p class="text-xs text-white/50 mb-2">${feature.properties.description}</p>` : ''}
              <div class="flex items-center gap-4 text-xs text-white/60">
                ${feature.properties.duration ? `<span>${feature.properties.duration}h</span>` : ''}
                ${feature.properties.cost ? `<span>€${feature.properties.cost}</span>` : ''}
                ${feature.properties.rating ? `<span class="flex items-center gap-1"><span class="text-yellow-400">⭐</span> ${feature.properties.rating.toFixed(1)}</span>` : ''}
              </div>
            </div>
          `)
          .addTo(map)
        
        setActivePopups(prev => [...prev, popup])
      }
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
    map.on('click', 'route-segments-layer', (e: any) => {
      const feature = e.features[0]
      if (feature && feature.properties.label) {
        console.log('Route segment clicked, clearing existing popups')
        // Clear any existing popups first
        clearPopups()
        
        const segmentType = feature.properties.segmentType
        const segmentTypeLabel = {
          'base-to-destination': 'Base to Destination',
          'destination-to-destination': 'Destination to Destination', 
          'destination-to-base': 'Destination to Base',
          'base-to-base': 'Base to Base'
        }[segmentType] || 'Route Segment'
        
        console.log('Creating new route segment popup')
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false, // Disable closeOnClick to prevent conflicts
          className: 'route-segment-popup'
        })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="route-popup-content">
              <div class="route-popup-header">
                <div class="route-popup-icon ${segmentType}"></div>
                <div class="route-popup-title">${segmentTypeLabel}</div>
              </div>
              <div class="route-popup-route">${feature.properties.fromLocation} → ${feature.properties.toLocation}</div>
              <div class="route-popup-details">
                <div class="route-popup-duration">⏱️ ${formatDuration(feature.properties.duration)}</div>
                <div class="route-popup-distance">📏 ${feature.properties.distance} km</div>
              </div>
            </div>
          `)
          .addTo(map)
        
        // Add to active popups for tracking
        setActivePopups(prev => {
          console.log('Adding popup to active popups, current count:', prev.length)
          return [...prev, popup]
        })
      }
    })

    // Close popups when clicking on empty areas (not on route segments)
    map.on('click', (e) => {
      // Check if the click is on a route segment
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['route-segments-layer']
      })
      
      // Only clear popups if not clicking on a route segment
      if (features.length === 0) {
        clearPopups()
      }
    })

    return () => {
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
      map.off('click', 'route-segments-layer')
      map.off('click') // Remove general click handler
    }
  }, [map, hasTrip, tripDays, selectedDayId, selectedDestination, setSelectedDay, setSelectedDestination, clearPopups])

  return null
}
