'use client'

import { useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { useExploreStore } from '@/lib/store/explore-store'

interface ExploreMapFocusProps {
  map: mapboxgl.Map | null
}

export function ExploreMapFocus({ map }: ExploreMapFocusProps) {
  const lastAddedPlace = useExploreStore((state) => state.lastAddedPlace)
  const clearLastAddedPlace = useExploreStore((state) => state.clearLastAddedPlace)

  useEffect(() => {
    if (!map) return
    if (!lastAddedPlace) return

    const [lng, lat] = lastAddedPlace.coordinates

    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 10),
      speed: 1.4,
      curve: 1.2,
    })

    clearLastAddedPlace()
  }, [map, lastAddedPlace, clearLastAddedPlace])

  return null
}
