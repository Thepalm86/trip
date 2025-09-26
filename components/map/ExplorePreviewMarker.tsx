'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useExploreStore } from '@/lib/store/explore-store'

type MarkerEntry = {
  marker: mapboxgl.Marker
  handleClick: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
}

export function ExplorePreviewMarker({ map }: { map: mapboxgl.Map | null }) {
  const activePlaces = useExploreStore((state) => state.activePlaces)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map())

  useEffect(() => {
    if (!map) return

    const markers = markersRef.current
    const activeIds = new Set(activePlaces.map((place) => place.id))

    // Remove markers that are no longer active
    markers.forEach((entry, placeId) => {
      if (!activeIds.has(placeId)) {
        const markerElement = entry.marker.getElement()
        markerElement.removeEventListener('click', entry.handleClick)
        markerElement.removeEventListener('mouseenter', entry.handleMouseEnter)
        markerElement.removeEventListener('mouseleave', entry.handleMouseLeave)
        entry.marker.remove()
        markers.delete(placeId)
      }
    })

    // Add markers for new active places
    activePlaces.forEach((place) => {
      if (markers.has(place.id)) return

      const handleClick = () => {
        setSelectedPlace(place)
      }

      const handleMouseEnter = () => {
        const mainCircle = markerElement.querySelector('.relative.w-8')
        const label = markerElement.querySelector('.absolute.top-full')
        if (mainCircle) mainCircle.style.transform = 'scale(1.1)'
        if (label) label.style.opacity = '1'
      }

      const handleMouseLeave = () => {
        const mainCircle = markerElement.querySelector('.relative.w-8')
        const label = markerElement.querySelector('.absolute.top-full')
        if (mainCircle) mainCircle.style.transform = 'scale(1)'
        if (label) label.style.opacity = '0.8'
      }

      const markerElement = document.createElement('div')
      markerElement.className = 'explore-marker'
      markerElement.innerHTML = `
        <div class="relative">
          <!-- Outer ring -->
          <div class="absolute inset-0 w-8 h-8 bg-cyan-500 rounded-full opacity-20"></div>
          
          <!-- Main circle -->
          <div class="relative w-8 h-8 bg-cyan-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </div>
          
          <!-- Label -->
          <div class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-slate-800/90 text-white text-xs font-semibold rounded-lg shadow-lg border border-white/20 backdrop-blur-sm whitespace-nowrap max-w-48 truncate">
            ${place.name}
          </div>
        </div>
      `

      const marker = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'bottom'
      })
        .setLngLat(place.coordinates)
        .addTo(map)

      markerElement.style.cursor = 'pointer'
      markerElement.addEventListener('click', handleClick)
      markerElement.addEventListener('mouseenter', handleMouseEnter)
      markerElement.addEventListener('mouseleave', handleMouseLeave)

      // Set initial label opacity and transition
      const label = markerElement.querySelector('.absolute.top-full')
      if (label) {
        label.style.opacity = '0.8'
        label.style.transition = 'opacity 0.2s ease'
      }
      
      // Add transition to main circle
      const mainCircle = markerElement.querySelector('.relative.w-8')
      if (mainCircle) {
        mainCircle.style.transition = 'transform 0.2s ease'
      }

      markers.set(place.id, { marker, handleClick, handleMouseEnter, handleMouseLeave })

      map.flyTo({ center: place.coordinates, zoom: 11, essential: true })
    })

  }, [map, activePlaces, setSelectedPlace])

  useEffect(() => {
    return () => {
      const markers = markersRef.current
      markers.forEach((entry) => {
        const markerElement = entry.marker.getElement()
        markerElement.removeEventListener('click', entry.handleClick)
        markerElement.removeEventListener('mouseenter', entry.handleMouseEnter)
        markerElement.removeEventListener('mouseleave', entry.handleMouseLeave)
        entry.marker.remove()
      })
      markers.clear()
    }
  }, [])

  return null
}
