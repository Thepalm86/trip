'use client'

import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import { useExploreStore } from '@/lib/store/explore-store'
import { getExploreCategoryMetadata, MarkerColors } from '@/lib/explore/categories'
import { fallbackCityFromFullName } from '@/lib/location/city'
import { useSupabaseTripStore, MapRouteSelectionPoint } from '@/lib/store/supabase-trip-store'

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
  elements.outerRing.style.backgroundColor = 'transparent'
  elements.outerRing.style.border = `2px solid ${colors.ring}`
  elements.mainCircle.style.borderColor = colors.border
  elements.mainCircle.style.backgroundColor = 'transparent'
}

function applyHighlightState(
  elements: MarkerElements,
  colors: MarkerColors,
  isHighlighted: boolean,
  isFavorite: boolean
) {
  if (isHighlighted || isFavorite) {
    const borderColor = isFavorite ? '#fbbf24' : colors.border
    const ringColor = isFavorite ? '#fbbf2433' : colors.ring
    const ringScale = isHighlighted ? 1.3 : 1.2
    const circleScale = isHighlighted ? 1.15 : 1.12
    elements.outerRing.style.display = 'block'
    elements.outerRing.style.backgroundColor = ringColor
    elements.outerRing.style.boxShadow = `0 0 0 10px ${ringColor}`
    elements.outerRing.style.transform = `scale(${ringScale})`
    elements.mainCircle.style.transform = `scale(${circleScale})`
    elements.mainCircle.style.boxShadow = `0 0 0 4px ${borderColor}66, 0 12px 30px ${borderColor}40`
    elements.mainCircle.style.borderColor = borderColor
    elements.label.style.opacity = '1'
  } else {
    elements.outerRing.style.display = 'none'
    elements.outerRing.style.boxShadow = ''
    elements.outerRing.style.transform = 'scale(1)'
    elements.mainCircle.style.transform = 'scale(1)'
    elements.mainCircle.style.boxShadow = '0 6px 14px rgba(15, 23, 42, 0.28)'
    elements.mainCircle.style.borderColor = colors.border
    elements.label.style.opacity = '0.9'
  }
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
  outerRing.style.display = 'none'
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
  const markersFilter = useExploreStore((state) => state.markersFilter)
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map())
  const routeModeEnabled = useSupabaseTripStore((state) => state.routeModeEnabled)
  const registerRouteSelection = useSupabaseTripStore((state) => state.registerRouteSelection)
  const routeSelectionStart = useSupabaseTripStore((state) => state.routeSelectionStart)
  const adHocRouteConfig = useSupabaseTripStore((state) => state.adHocRouteConfig)
  const adHocRouteResult = useSupabaseTripStore((state) => state.adHocRouteResult)

  const highlightedPlaceIds = useMemo(() => {
    if (!routeModeEnabled) {
      return new Set<string>()
    }

    const ids = new Set<string>()
    const addPoint = (point?: MapRouteSelectionPoint | null) => {
      if (point && point.source === 'explore') {
        ids.add(point.id)
      }
    }

    if (adHocRouteResult) {
      addPoint(adHocRouteResult.from)
      addPoint(adHocRouteResult.to)
      return ids
    }

    if (adHocRouteConfig) {
      addPoint(adHocRouteConfig.from)
      addPoint(adHocRouteConfig.to)
      return ids
    }

    addPoint(routeSelectionStart)
    return ids
  }, [routeModeEnabled, routeSelectionStart, adHocRouteConfig, adHocRouteResult])

  const getCategoryKey = (category?: string) => getExploreCategoryMetadata(category).key

  const isCategoryVisible = (category?: string) => {
    if (!visibleCategories) return true
    return visibleCategories.includes(getCategoryKey(category))
  }

  const filteredPlaces = useMemo(() => (
    markersFilter === 'favorites'
      ? activePlaces.filter((place) => place.isFavorite)
      : activePlaces
  ), [activePlaces, markersFilter])

  useEffect(() => {
    if (!map) return

    const markers = markersRef.current
    const activeLookup = new Map(filteredPlaces.map((place) => [place.id, place]))

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
      filteredPlaces.forEach((place) => {
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

          const isHighlighted = highlightedPlaceIds.has(place.id)
          const isFavorite = Boolean(place.isFavorite)
          const baseScale = isHighlighted ? 'scale(1.15)' : isFavorite ? 'scale(1.12)' : 'scale(1)'

          markerElement.removeEventListener('click', existingEntry.handleClick)
          markerElement.removeEventListener('mouseenter', existingEntry.handleMouseEnter)
          markerElement.removeEventListener('mouseleave', existingEntry.handleMouseLeave)

          const handleClick = () => {
            if (routeModeEnabled) {
              const selectionPoint: MapRouteSelectionPoint = {
                id: place.id,
                label: place.name,
                coordinates: place.coordinates,
                source: 'explore',
                meta: {
                  category: place.category,
                  city: place.city,
                },
              }
              registerRouteSelection(selectionPoint)
              return
            }
            setSelectedPlace(place)
          }

          const handleMouseEnter = () => {
            if (isHighlighted) {
              elements.mainCircle.style.transform = 'scale(1.19)'
            } else if (isFavorite) {
              elements.mainCircle.style.transform = 'scale(1.16)'
            } else {
              elements.mainCircle.style.transform = 'scale(1.08)'
            }
            elements.label.style.opacity = '1'
          }

          const handleMouseLeave = () => {
            elements.mainCircle.style.transform = baseScale
            elements.label.style.opacity = (isHighlighted || isFavorite) ? '1' : '0.9'
          }

          markerElement.style.cursor = 'pointer'
          markerElement.addEventListener('click', handleClick)
          markerElement.addEventListener('mouseenter', handleMouseEnter)
          markerElement.addEventListener('mouseleave', handleMouseLeave)

          applyHighlightState(elements, metadata.colors, isHighlighted, isFavorite)

          markers.set(place.id, {
            ...existingEntry,
            marker: existingMarker,
            handleClick,
            handleMouseEnter,
            handleMouseLeave,
            elements,
          })
          return
        }

        const elements = createMarkerElement(displayName, derivedCity || null, metadata.colors, metadata.key === 'city')

        const isHighlighted = highlightedPlaceIds.has(place.id)
        const isFavorite = Boolean(place.isFavorite)
        const baseScale = isHighlighted ? 'scale(1.15)' : isFavorite ? 'scale(1.12)' : 'scale(1)'

        const handleClick = () => {
          if (routeModeEnabled) {
            const selectionPoint: MapRouteSelectionPoint = {
              id: place.id,
              label: place.name,
              coordinates: place.coordinates,
              source: 'explore',
              meta: {
                category: place.category,
                city: place.city,
              },
            }
            registerRouteSelection(selectionPoint)
            return
          }
          setSelectedPlace(place)
        }

        const handleMouseEnter = () => {
          if (isHighlighted) {
            elements.mainCircle.style.transform = 'scale(1.19)'
          } else if (isFavorite) {
            elements.mainCircle.style.transform = 'scale(1.16)'
          } else {
            elements.mainCircle.style.transform = 'scale(1.08)'
          }
          elements.label.style.opacity = '1'
        }

        const handleMouseLeave = () => {
          elements.mainCircle.style.transform = baseScale
          elements.label.style.opacity = (isHighlighted || isFavorite) ? '1' : '0.9'
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

        applyHighlightState(elements, metadata.colors, isHighlighted, isFavorite)

        markers.set(place.id, {
          marker,
          handleClick,
          handleMouseEnter,
          handleMouseLeave,
          elements,
        })
      })
    }
  }, [map, filteredPlaces, setSelectedPlace, showMarkers, visibleCategories, routeModeEnabled, registerRouteSelection, highlightedPlaceIds])

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
