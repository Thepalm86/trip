'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useExploreStore } from '@/lib/store/explore-store'
import { getExploreCategoryMetadata, MarkerColors } from '@/lib/explore/categories'
import { fallbackCityFromFullName } from '@/lib/location/city'

type MarkerElements = {
  markerElement: HTMLDivElement
  mainCircle: HTMLDivElement
  outerRing: HTMLDivElement
  label: HTMLDivElement
  nameLabel: HTMLDivElement
  cityLabel: HTMLDivElement
}

type MarkerEntry = {
  marker: mapboxgl.Marker
  handleClick: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  elements: MarkerElements
}

function applyMarkerColors(
  elements: Pick<MarkerElements, 'outerRing' | 'mainCircle'>,
  colors: MarkerColors
) {
  elements.outerRing.style.backgroundColor = colors.ring
  elements.mainCircle.style.borderColor = colors.border
  elements.mainCircle.style.backgroundColor = colors.border
}

function createMarkerElement(
  displayName: string,
  city: string | null,
  colors: MarkerColors,
  isCityCategory: boolean
): MarkerElements {
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
  label.className = 'explore-marker-label absolute top-full left-1/2 transform -translate-x-1/2 mt-2 space-y-0.5 text-center'

  const nameLabel = document.createElement('div')
  nameLabel.className = 'text-white text-xs font-semibold leading-tight whitespace-nowrap max-w-48 truncate'
  nameLabel.textContent = displayName
  label.appendChild(nameLabel)

  const cityLabel = document.createElement('div')
  cityLabel.className = 'text-white/70 text-[10px] leading-tight whitespace-nowrap max-w-48 truncate'
  if (!isCityCategory && city) {
    cityLabel.textContent = city
  } else {
    cityLabel.style.display = 'none'
  }
  label.appendChild(cityLabel)

  label.style.opacity = '0.9'
  label.style.filter = 'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.6))'
  mainCircle.style.transition = 'transform 0.2s ease'

  wrapper.appendChild(label)

  applyMarkerColors({ outerRing, mainCircle }, colors)

  return {
    markerElement,
    mainCircle,
    outerRing,
    label,
    nameLabel,
    cityLabel,
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

    if (showMarkers) {
      activePlaces.forEach((place) => {
        if (!isCategoryVisible(place.category)) {
          return
        }

        const metadata = getExploreCategoryMetadata(place.category)
        const derivedCity = (() => {
          if (place.city && place.city.length > 0) {
            return place.city
          }
          const candidate = fallbackCityFromFullName(place.fullName)
          return candidate === 'Unknown' ? '' : candidate
        })()
        const displayName = metadata.key === 'city' && derivedCity ? derivedCity : place.name

        const existingEntry = markers.get(place.id)
        if (existingEntry) {
          const { marker: existingMarker, elements } = existingEntry
          const { markerElement, nameLabel, cityLabel, mainCircle, outerRing } = elements

          nameLabel.textContent = displayName

          if (metadata.key === 'city') {
            cityLabel.style.display = 'none'
            cityLabel.textContent = ''
          } else if (derivedCity) {
            cityLabel.style.display = ''
            cityLabel.textContent = derivedCity
          } else {
            cityLabel.style.display = 'none'
            cityLabel.textContent = ''
          }

          applyMarkerColors({ outerRing, mainCircle }, metadata.colors)

          markerElement.removeEventListener('click', existingEntry.handleClick)
          const handleClick = () => setSelectedPlace(place)
          markerElement.addEventListener('click', handleClick)

          markers.set(place.id, {
            ...existingEntry,
            marker: existingMarker,
            handleClick,
            elements,
          })
          return
        }

        const elements = createMarkerElement(displayName, derivedCity || null, metadata.colors, metadata.key === 'city')

        const handleClick = () => setSelectedPlace(place)

        const handleMouseEnter = () => {
          elements.mainCircle.style.transform = 'scale(1.1)'
          elements.label.style.opacity = '1'
        }

        const handleMouseLeave = () => {
          elements.mainCircle.style.transform = 'scale(1)'
          elements.label.style.opacity = '0.9'
        }

        const marker = new mapboxgl.Marker({
          element: elements.markerElement,
          anchor: 'bottom',
        })
          .setLngLat(place.coordinates)
          .addTo(map)

        elements.markerElement.style.cursor = 'pointer'
        elements.markerElement.addEventListener('click', handleClick)
        elements.markerElement.addEventListener('mouseenter', handleMouseEnter)
        elements.markerElement.addEventListener('mouseleave', handleMouseLeave)

        markers.set(place.id, {
          marker,
          handleClick,
          handleMouseEnter,
          handleMouseLeave,
          elements,
        })
      })
    }
  }, [map, activePlaces, setSelectedPlace, showMarkers, visibleCategories])

  useEffect(() => () => {
    const markers = markersRef.current
    markers.forEach((entry) => {
      const markerElement = entry.elements.markerElement
      markerElement.removeEventListener('click', entry.handleClick)
      markerElement.removeEventListener('mouseenter', entry.handleMouseEnter)
      markerElement.removeEventListener('mouseleave', entry.handleMouseLeave)
      entry.marker.remove()
    })
    markers.clear()
  }, [])

  return null
}
