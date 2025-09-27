'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useExploreStore } from '@/lib/store/explore-store'

function createMarkerElement(name: string) {
  const markerElement = document.createElement('div')
  markerElement.className = 'explore-marker'

  const wrapper = document.createElement('div')
  wrapper.className = 'relative'
  markerElement.appendChild(wrapper)

  const outerRing = document.createElement('div')
  outerRing.className = 'absolute inset-0 w-8 h-8 bg-cyan-500 rounded-full opacity-20'
  wrapper.appendChild(outerRing)

  const mainCircle = document.createElement('div')
  mainCircle.className = 'relative w-8 h-8 bg-cyan-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg'
  wrapper.appendChild(mainCircle)

  const innerDot = document.createElement('div')
  innerDot.className = 'w-2 h-2 bg-white rounded-full'
  mainCircle.appendChild(innerDot)

  const label = document.createElement('div')
  label.className = 'absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-slate-800/90 text-white text-xs font-semibold rounded-lg shadow-lg border border-white/20 backdrop-blur-sm whitespace-nowrap max-w-48 truncate'
  label.textContent = name
  wrapper.appendChild(label)

  label.style.opacity = '0.8'
  label.style.transition = 'opacity 0.2s ease'
  mainCircle.style.transition = 'transform 0.2s ease'

  return { markerElement, mainCircle, label }
}

type MarkerEntry = {
  marker: mapboxgl.Marker
  handleClick: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
}

export function ExplorePreviewMarker({ map }: { map: mapboxgl.Map | null }) {
  const activePlaces = useExploreStore((state) => state.activePlaces)
  const showMarkers = useExploreStore((state) => state.showMarkers)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map())

  useEffect(() => {
    if (!map) return

    const markers = markersRef.current
    const activeIds = new Set(activePlaces.map((place) => place.id))

    // Remove markers that are no longer active or if markers are hidden
    markers.forEach((entry, placeId) => {
      if (!activeIds.has(placeId) || !showMarkers) {
        const markerElement = entry.marker.getElement()
        markerElement.removeEventListener('click', entry.handleClick)
        markerElement.removeEventListener('mouseenter', entry.handleMouseEnter)
        markerElement.removeEventListener('mouseleave', entry.handleMouseLeave)
        entry.marker.remove()
        markers.delete(placeId)
      }
    })

    // Add markers for new active places (only if showMarkers is true)
    if (showMarkers) {
      activePlaces.forEach((place) => {
        if (markers.has(place.id)) return

        const { markerElement, mainCircle, label } = createMarkerElement(place.name)

        const handleClick = () => {
          setSelectedPlace(place)
        }

        const handleMouseEnter = () => {
          mainCircle.style.transform = 'scale(1.1)'
          label.style.opacity = '1'
        }

        const handleMouseLeave = () => {
          mainCircle.style.transform = 'scale(1)'
          label.style.opacity = '0.8'
        }

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

        markers.set(place.id, { marker, handleClick, handleMouseEnter, handleMouseLeave })
      })
    }

  }, [map, activePlaces, setSelectedPlace, showMarkers])

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
