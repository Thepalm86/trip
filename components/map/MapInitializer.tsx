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

        // Routes source
        if (!map.getSource('routes')) {
          map.addSource('routes', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
        }

        // Day markers source (for markers on routes between base location changes)
        if (!map.getSource('day-markers')) {
          map.addSource('day-markers', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
        }

        // Day routes source (routes within a day)
        if (!map.getSource('day-routes')) {
          map.addSource('day-routes', {
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

      // Add base location markers layer with enhanced styling
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
              12
            ],
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#34d399',
              ['boolean', ['feature-state', 'hover'], false], '#22c55e',
              '#10b981'
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 4,
              ['boolean', ['feature-state', 'hover'], false], 3,
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
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 2.5],
            'text-optional': true
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
              12
            ],
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#34d399',
              ['boolean', ['feature-state', 'hover'], false], '#22c55e',
              ['coalesce', ['get', 'markerColor'], '#3b82f6']
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 4,
              ['boolean', ['feature-state', 'hover'], false], 3,
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
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 2.5],
            'text-optional': true
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

      // Add routes layer with enhanced styling
      if (!map.getLayer('routes-layer')) {
        // Route shadow/glow effect
        map.addLayer({
          id: 'routes-shadow',
          type: 'line',
          source: 'routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 8,
            'line-opacity': 0.2,
            'line-blur': 2
          }
        })

        // Main route line
        map.addLayer({
          id: 'routes-layer',
          type: 'line',
          source: 'routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#10b981',
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 6,
              4
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 1,
              0.8
            ]
          }
        })

        // Route direction arrows
        map.addLayer({
          id: 'routes-arrows',
          type: 'symbol',
          source: 'routes',
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

        // Route labels (distance/duration)
        map.addLayer({
          id: 'routes-labels',
          type: 'symbol',
          source: 'routes',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-anchor': 'center',
            'symbol-placement': 'line',
            'text-offset': [0, 0],
            'text-optional': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#10b981',
            'text-halo-width': 2,
            'text-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 1,
              0.9
            ]
          }
        })
      }

      // Add day routes layer with enhanced styling
      if (!map.getLayer('day-routes-layer')) {
        // Day route shadow
        map.addLayer({
          id: 'day-routes-shadow',
          type: 'line',
          source: 'day-routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['coalesce', ['get', 'dayColor'], '#10b981'],
            'line-width': 6,
            'line-opacity': 0.15,
            'line-blur': 1
          }
        })

        // Main day route line
        map.addLayer({
          id: 'day-routes-layer',
          type: 'line',
          source: 'day-routes',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['coalesce', ['get', 'dayColor'], '#10b981'],
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 4,
              3
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 0.8,
              0.6
            ],
            'line-dasharray': [2, 2]
          }
        })
      }

      // Day markers layer (markers on routes between base location changes)
      if (!map.getLayer('day-markers-layer')) {
        map.addLayer({
          id: 'day-markers-layer',
          type: 'circle',
          source: 'day-markers',
          paint: {
            'circle-radius': 10,
            'circle-color': ['get', 'dayColor'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        })

        // Day marker numbers
        map.addLayer({
          id: 'day-markers-number',
          type: 'symbol',
          source: 'day-markers',
          layout: {
            'text-field': ['get', 'dayNumber'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'text-anchor': 'center',
            'text-offset': [0, 0]
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        })
      }

      // Add selection highlight layer
      if (!map.getLayer('selection-highlight-layer')) {
        map.addLayer({
          id: 'selection-highlight-layer',
          type: 'circle',
          source: 'selection-highlight',
          paint: {
            'circle-radius': 25,
            'circle-color': '#34d399',
            'circle-opacity': 0.1,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#34d399',
            'circle-stroke-opacity': 0.6
          }
        })
      }
      
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
        'day-markers-layer',
        'day-markers-number',
        'day-routes-layer',
        'day-routes-shadow',
        'routes-labels',
        'routes-arrows',
        'routes-layer',
        'routes-shadow',
        'destinations-layer',
        'destinations-outer',
        'destinations-activity-letter',
        'destinations-labels',
        'base-locations-labels',
        'base-locations-day-number',
        'base-locations-layer',
        'base-locations-outer'
      ]
      
      layers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }
      })

      const sources = ['selection-highlight', 'day-routes', 'routes', 'destinations', 'base-locations']
      sources.forEach(sourceId => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId)
        }
      })
    }
  }, [map, hasTrip])

  return null
}
