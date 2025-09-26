'use client'

import { useEffect } from 'react'

interface MapInitializerProps {
  map: any
  hasTrip: boolean
}

export function MapInitializer({ map, hasTrip }: MapInitializerProps) {
  
  // Initialize map sources and layers
  useEffect(() => {
    console.log('MapInitializer: useEffect triggered', { map: !!map, hasTrip })
    if (!map || !hasTrip) {
      console.log('MapInitializer: Skipping initialization', { map: !!map, hasTrip })
      return
    }

    // Style load handler - SIMPLIFIED (no conflicting updates)
    const handleStyleLoad = () => {
      console.log('MapInitializer: Map style loaded')
    }

    map.on('styledata', handleStyleLoad)

    // Initialize sources and layers immediately
    const initializeMapSources = () => {
      console.log('🎯🎯🎯 MapInitializer: initializeMapSources called', { map: !!map, hasTrip })
      try {
        // Base location markers source
        if (!map.getSource('base-locations')) {
          map.addSource('base-locations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            },
            cluster: false
          })
        }

        // Destination markers source - SIMPLIFIED
        if (!map.getSource('destinations')) {
          console.log('🎯 Creating SIMPLE destinations source')
          map.addSource('destinations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
          console.log('✅ Simple destinations source created')
        }


        // Route segments source (all individual segments)
        if (!map.getSource('route-segments')) {
          map.addSource('route-segments', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
        }

        // Selection highlight source
        if (!map.getSource('selection-highlight')) {
          map.addSource('selection-highlight', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
        }




      // Add route segments layer (all individual segments - driving routes)
      if (!map.getLayer('route-segments-shadow')) {
        // Route segment shadow/glow effect
        map.addLayer({
          id: 'route-segments-shadow',
          type: 'line',
          source: 'route-segments',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'visibility'], 'overview'], '#f59e0b',        // Orange for overview inter-day routes
              ['==', ['get', 'visibility'], 'selected-inbound'], '#10b981', // Green for inbound routes
              ['==', ['get', 'visibility'], 'selected-intra-day'], '#3b82f6', // Blue for intra-day routes
              '#8b5cf6' // Default purple for other cases
            ],
            'line-width': 8,
            'line-opacity': 0.2,
            'line-blur': 2
          }
        })

        // Main route segment line
        map.addLayer({
          id: 'route-segments-layer',
          type: 'line',
          source: 'route-segments',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'visibility'], 'overview'], '#f59e0b',        // Orange for overview inter-day routes
              ['==', ['get', 'visibility'], 'selected-inbound'], '#10b981', // Green for inbound routes
              ['==', ['get', 'visibility'], 'selected-intra-day'], '#3b82f6', // Blue for intra-day routes
              '#8b5cf6' // Default purple for other cases
            ],
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 6,
              4
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 1,
              ['==', ['get', 'visibility'], 'overview'], 0.6, // More subtle for overview routes
              0.8
            ]
          }
        })

        // Add cursor pointer for route segments
        map.on('mouseenter', 'route-segments-layer', () => {
          map.getCanvas().style.cursor = 'pointer'
        })

        map.on('mouseleave', 'route-segments-layer', () => {
          map.getCanvas().style.cursor = ''
        })

        // Route segment direction arrows
        map.addLayer({
          id: 'route-segments-arrows',
          type: 'symbol',
          source: 'route-segments',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 200,
            'icon-image': 'arrow-right',
            'icon-size': 0.8,
            'icon-rotate': ['get', 'bearing'],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true
          }
        })

        // Route segment labels (distance/duration) - hidden by default
        map.addLayer({
          id: 'route-segments-labels',
          type: 'symbol',
          source: 'route-segments',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'center',
            'symbol-placement': 'line',
            'text-offset': [0, 0],
            'text-optional': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': [
              'case',
              ['==', ['get', 'visibility'], 'overview'], '#d97706',
              ['==', ['get', 'visibility'], 'selected-inbound'], '#059669',
              ['==', ['get', 'visibility'], 'selected-intra-day'], '#1e40af',
              '#7c3aed'
            ],
            'text-halo-width': 3,
            'text-opacity': 0 // Hidden by default
          }
        })
      }


      // Base location markers layer with enhanced styling
      if (!map.getLayer('base-locations-layer')) {
        // Base location outer ring
        map.addLayer({
          id: 'base-locations-outer',
          type: 'circle',
          source: 'base-locations',
          paint: {
            'circle-radius': 18,
            'circle-color': '#10b981',
            'circle-opacity': 0.2,
            'circle-stroke-width': 0
          }
        })

        // Base location main circle
        map.addLayer({
          id: 'base-locations-layer',
          type: 'circle',
          source: 'base-locations',
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 16,
              ['boolean', ['feature-state', 'selected'], false], 14,
              ['get', 'isCardSelected'], 16,
              12
            ],
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#34d399',
              ['boolean', ['feature-state', 'hover'], false], '#22c55e',
              ['get', 'isCardSelected'], '#34d399',
              '#10b981'
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 4,
              ['boolean', ['feature-state', 'hover'], false], 3,
              ['get', 'isCardSelected'], 4,
              2
            ],
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.95
          }
        })

        // Base location day number
        map.addLayer({
          id: 'base-locations-day-number',
          type: 'symbol',
          source: 'base-locations',
          layout: {
            'text-field': ['get', 'dayNumber'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-anchor': 'center',
            'text-offset': [0, 0]
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        })

        // Base location labels
        map.addLayer({
          id: 'base-locations-labels',
          type: 'symbol',
          source: 'base-locations',
          layout: {
            'text-field': [
              'format',
              ['get', 'city'],
              { 'font-scale': 1.0 },
              '\n',
              {},
              ['get', 'name'],
              { 'font-scale': 0.8, 'text-color': '#e5e7eb' }
            ],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 1.5],
            'text-optional': true,
            'text-line-height': 1.2
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
            'text-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.9,
              0.8
            ]
          }
        })
        
        console.log('✅ Base location layers created')
      }

      // Destination markers - MATCHING BASE LOCATIONS EXACTLY
      if (!map.getLayer('destinations-layer')) {
        console.log('🎯 Creating destinations layers matching base locations')
        
        // Destination outer ring (consistent blue)
        map.addLayer({
          id: 'destinations-outer',
          type: 'circle',
          source: 'destinations',
          paint: {
            'circle-radius': 18,
            'circle-color': '#3b82f6',
            'circle-opacity': 0.2,
            'circle-stroke-width': 0
          }
        })

        // Destination main circle (like base locations)
        map.addLayer({
          id: 'destinations-layer',
          type: 'circle',
          source: 'destinations',
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 16,
              ['boolean', ['feature-state', 'selected'], false], 14,
              ['get', 'isCardSelected'], 16,
              12
            ],
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#3b82f6',
              ['boolean', ['feature-state', 'hover'], false], '#60a5fa',
              ['get', 'isCardSelected'], '#3b82f6',
              ['coalesce', ['get', 'markerColor'], '#3b82f6']
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 4,
              ['boolean', ['feature-state', 'hover'], false], 3,
              ['get', 'isCardSelected'], 4,
              2
            ],
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.95
          }
        })

        // Destination activity letters (A, B, C, etc.)
        map.addLayer({
          id: 'destinations-activity-letter',
          type: 'symbol',
          source: 'destinations',
          layout: {
            'text-field': ['get', 'activityLetter'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-anchor': 'center',
            'text-offset': [0, 0]
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        })

        // Destination labels (like base locations)
        map.addLayer({
          id: 'destinations-labels',
          type: 'symbol',
          source: 'destinations',
          layout: {
            'text-field': [
              'format',
              ['get', 'city'],
              { 'font-scale': 1.0 },
              '\n',
              {},
              ['get', 'name'],
              { 'font-scale': 0.8, 'text-color': '#e5e7eb' }
            ],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 1.5],
            'text-optional': true,
            'text-line-height': 1.2
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2,
            'text-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.9,
              0.8
            ]
          }
        })
        
        console.log('✅ Destination layers created matching base locations')
      }


      // Selection highlight layer disabled - using marker styling for selection feedback instead
      
      console.log('MapInitializer: initializeMapSources completed successfully')
      } catch (error) {
        console.error('Map initialization failed:', error)
      }
    }

    // Initialize sources and layers immediately
    console.log('🚀🚀🚀 MapInitializer: About to call initializeMapSources', { map: !!map, hasTrip })
    console.log('🚀🚀🚀 MapInitializer: Calling initializeMapSources from useEffect')
    initializeMapSources()
    console.log('🚀🚀🚀 MapInitializer: initializeMapSources call completed')
    
    // Also listen for style load in case it wasn't ready
    if (!map.isStyleLoaded()) {
      map.on('style.load', () => {
        console.log('MapInitializer: Style loaded, re-initializing sources')
        initializeMapSources()
      })
    }

    return () => {
      // Cleanup layers and sources on unmount
      if (!map) return
      
      // Cleanup event listeners
      map.off('styledata', handleStyleLoad)
      
      // Cleanup layers and sources
      const layers = [
        'selection-highlight-layer',
        'intra-day-routes-labels',
        'intra-day-routes-layer',
        'intra-day-routes-shadow',
        'inter-day-routes-labels',
        'inter-day-routes-arrows',
        'inter-day-routes-layer',
        'inter-day-routes-shadow',
        'destinations-layer',
        'destinations-outer',
        'destinations-activity-letter',
        'destinations-labels',
        'base-locations-labels',
        'base-locations-day-number',
        'base-locations-layer',
        'base-locations-outer'
      ]
      
      const canAccessStyle = typeof map?.getStyle === 'function' && !!map.getStyle()

      if (canAccessStyle && typeof map.removeLayer === 'function') {
        layers.forEach(layerId => {
          try {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId)
            }
          } catch (error) {
            console.debug('MapInitializer: ignore layer removal error', layerId, error)
          }
        })
      }

      if (canAccessStyle && typeof map.removeSource === 'function') {
        const sources = ['selection-highlight', 'intra-day-routes', 'inter-day-routes', 'destinations', 'base-locations']
        sources.forEach(sourceId => {
          try {
            if (map.getSource(sourceId)) {
              map.removeSource(sourceId)
            }
          } catch (error) {
            console.debug('MapInitializer: ignore source removal error', sourceId, error)
          }
        })
      }
    }
  }, [map, hasTrip])

  return null
}
