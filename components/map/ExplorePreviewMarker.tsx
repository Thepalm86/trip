'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useExploreStore } from '@/lib/store/explore-store'
import { getExploreCategoryMetadata, MarkerColors } from '@/lib/explore/categories'

function applyMarkerColors(
  elements: {
    outerRing: HTMLDivElement
    mainCircle: HTMLDivElement
  },
  colors: MarkerColors
) {
  elements.outerRing.style.backgroundColor = colors.ring
  elements.mainCircle.style.borderColor = colors.border
  elements.mainCircle.style.backgroundColor = colors.border
}

function createMarkerElement(name: string, colors: MarkerColors) {
  const markerElement = document.createElement('div')
  markerElement.className = 'explore-marker'

  const wrapper = document.createElement('div')
  wrapper.className = 'relative'
  markerElement.appendChild(wrapper)

  const outerRing = document.createElement('div')
  outerRing.className = 'absolute inset-0 w-8 h-8 rounded-full opacity-25 transition-colors duration-200'
  wrapper.appendChild(outerRing)

  const mainCircle = document.createElement('div')
  mainCircle.className = 'relative w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform duration-200'
  wrapper.appendChild(mainCircle)

  const innerDot = document.createElement('div')
  innerDot.className = 'w-2 h-2 bg-white rounded-full'
  mainCircle.appendChild(innerDot)

  const label = document.createElement('div')
  label.className = 'explore-marker-label absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-white text-xs font-semibold whitespace-nowrap max-w-48 truncate'
  label.textContent = name
  wrapper.appendChild(label)

  label.style.opacity = '0.8'
  label.style.filter = 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.6))'
  mainCircle.style.transition = 'transform 0.2s ease'

  applyMarkerColors({ outerRing, mainCircle }, colors)

  return { markerElement, mainCircle, outerRing, label }
}

type MarkerEntry = {
  marker: mapboxgl.Marker
  handleClick: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  elements: {
    markerElement: HTMLDivElement
    mainCircle: HTMLDivElement
    outerRing: HTMLDivElement
    label: HTMLDivElement
  }
}

export function ExplorePreviewMarker({ map }: { map: mapboxgl.Map | null }) {
  const activePlaces = useExploreStore((state) => state.activePlaces)
  const showMarkers = useExploreStore((state) => state.showMarkers)
  const visibleCategories = useExploreStore((state) => state.visibleCategories)
  const setSelectedPlace = useExploreStore((state) => state.setSelectedPlace)
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map())

  const getCategoryKey = (category?: string) => getExploreCategoryMetadata(category).key

  const isCategoryVisible = (category?: string) => {
    if (!visibleCategories) return true
    return visibleCategories.includes(getCategoryKey(category))
  }

  useEffect(() => {
    if (!map) return

    const markers = markersRef.current
    const activeLookup = new Map(activePlaces.map((place) => [place.id, place]))

    // Remove markers that are no longer active or if markers are hidden
    markers.forEach((entry, placeId) => {
      const place = activeLookup.get(placeId)
      if (!place || !showMarkers || !isCategoryVisible(place.category)) {
        const markerElement = entry.elements.markerElement
        markerElement.removeEventListener('click', entry.handleClick)
        markerElement.removeEventListener('mouseenter', entry.handleMouseEnter)
        markerElement.removeEventListener('mouseleave', entry.handleMouseLeave)
        entry.marker.remove()
        markers.delete(placeId)
      }
    })

    // Add or update markers for active places (only if showMarkers is true)
    if (showMarkers) {
      activePlaces.forEach((place) => {
        if (!isCategoryVisible(place.category)) {
          return
        }
        const existingEntry = markers.get(place.id)

        if (existingEntry) {
          const { marker: existingMarker, elements } = existingEntry
          const { markerElement, label, mainCircle, outerRing } = elements

          if (label.textContent !== place.name) {
            label.textContent = place.name
          }

          const { colors } = getExploreCategoryMetadata(place.category)
          applyMarkerColors({ outerRing, mainCircle }, colors)

          markerElement.removeEventListener('click', existingEntry.handleClick)
          const handleClick = () => {
            setSelectedPlace(place)
          }
          markerElement.addEventListener('click', handleClick)

          markers.set(place.id, {
            ...existingEntry,
            marker: existingMarker,
            handleClick,
            elements,
          })
          return
        }

        const { colors } = getExploreCategoryMetadata(place.category)
        const { markerElement, mainCircle, outerRing, label } = createMarkerElement(place.name, colors)

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

        markers.set(place.id, {
          marker,
          handleClick,
          handleMouseEnter,
          handleMouseLeave,
          elements: { markerElement, mainCircle, outerRing, label }
        })
      })
    }

  }, [map, activePlaces, setSelectedPlace, showMarkers, visibleCategories])

  useEffect(() => {
    return () => {
      const markers = markersRef.current
      markers.forEach((entry) => {
        const markerElement = entry.elements.markerElement
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
