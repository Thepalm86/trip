'use client'

import { useEffect } from 'react'
import { Destination } from '@/types'

interface ExplorationMarkerManagerProps {
  map: any
  explorationLocations: Destination[]
  selectedDestination: Destination | null
  setSelectedDestination: (destination: Destination | null) => void
}

export function ExplorationMarkerManager({ 
  map, 
  explorationLocations, 
  selectedDestination, 
  setSelectedDestination 
}: ExplorationMarkerManagerProps) {

  // Update exploration markers using the same approach as MarkerManager
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return

    const updateExplorationMarkers = () => {
      if (!map.getSource('exploration-locations') || !map.getLayer('exploration-locations-layer')) {
        console.warn('⚠️ Exploration source or layer not ready')
        return
      }

      // Create features with proper properties - same structure as timeline markers
      const features = explorationLocations.map((location, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: location.coordinates
        },
        properties: {
          name: location.name,
          id: location.id,
          description: location.description,
          category: location.category,
          rating: location.rating,
          estimatedDuration: location.estimatedDuration,
          explorationIndex: index,
          activityLetter: String.fromCharCode(65 + index), // Convert to letters: A, B, C, etc.
          markerColor: '#f97316' // Orange color for exploration markers
        }
      }))

      console.log('🎯 ExplorationMarkerManager: Setting exploration features', { count: features.length })

      // Update source directly
      map.getSource('exploration-locations').setData({
        type: 'FeatureCollection',
        features
      })

      // Update feature states for selection
      features.forEach((feature, index) => {
        const isSelected = selectedDestination?.id === feature.properties.id
        map.setFeatureState(
          { source: 'exploration-locations', id: index },
          {
            selected: isSelected,
            hover: false
          }
        )
      })

      console.log('✅ ExplorationMarkerManager: Exploration markers updated')
    }

    // Wait for map to be ready
    if (map.isStyleLoaded()) {
      updateExplorationMarkers()
    } else {
      map.once('styledata', updateExplorationMarkers)
    }
  }, [map, explorationLocations, selectedDestination, setSelectedDestination])

  return null
}
