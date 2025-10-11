'use client'

import { useEffect } from 'react'

interface MapInitializerProps {
  map: any
  hasTrip: boolean
}

const isMapDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_MAP === 'true'

export function MapInitializer({ map, hasTrip }: MapInitializerProps) {
  
  // Initialize map sources and layers
  useEffect(() => {
    if (!map || !hasTrip) {
      return
    }

    // Style load handler - SIMPLIFIED (no conflicting updates)
    const handleStyleLoad = () => {
      if (isMapDebugEnabled) {
        console.debug('MapInitializer: map style loaded')
      }
    }

    map.on('styledata', handleStyleLoad)

    // Initialize sources and layers immediately
    const initializeMapSources = () => {
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
          map.addSource('destinations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          })
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

        if (!map.getSource('day-route-overlay')) {
          map.addSource('day-route-overlay', {
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
            'line-color': ['coalesce', ['get', 'lineColor'], '#3b82f6'],
            'line-width': 7,
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'active'], false], 0.6,
              ['boolean', ['feature-state', 'dimmed'], false], 0.05,
              ['==', ['get', 'visibility'], 'overview'], 0.15,
              0.25
            ],
            'line-blur': 4,
            'line-offset': ['coalesce', ['get', 'lineOffset'], 0]
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
            'line-color': ['coalesce', ['get', 'lineColor'], '#3b82f6'],
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'active'], false], 5.5,
              ['boolean', ['feature-state', 'hover'], false], 4.5,
              3.5
            ],
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'active'], false], 1,
              ['boolean', ['feature-state', 'dimmed'], false], 0.25,
              ['boolean', ['feature-state', 'hover'], false], 0.95,
              ['==', ['get', 'visibility'], 'overview'], 0.55,
              0.85
            ],
            'line-offset': ['coalesce', ['get', 'lineOffset'], 0]
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
          },
          paint: {
            'icon-color': ['coalesce', ['get', 'lineColor'], '#ffffff'],
            'icon-opacity': [
              'case',
              ['boolean', ['feature-state', 'dimmed'], false], 0.3,
              ['==', ['get', 'visibility'], 'overview'], 0.6,
              0.9
            ]
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
            'text-halo-color': ['coalesce', ['get', 'lineColor'], '#2563eb'],
            'text-halo-width': 3,
            'text-opacity': 0 // Hidden by default
          }
        })
      }

      if (!map.getLayer('day-route-overlay')) {
        map.addLayer({
          id: 'day-route-overlay',
          type: 'line',
          source: 'day-route-overlay',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': ['coalesce', ['get', 'lineColor'], '#38bdf8'],
            'line-width': 3.5,
            'line-opacity': 0.35,
            'line-blur': 1.2,
            'line-dasharray': [1.5, 1.5]
          }
        }, 'route-segments-shadow')
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
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.95,
              ['get', 'isPrimaryDay'],
              0.85,
              0.55
            ]
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
              ['get', 'name'],
              { 'font-scale': 1.0 },
              ['case',
                ['==', ['coalesce', ['get', 'city'], ''], ''],
                '',
                ['concat', '\n', ['coalesce', ['get', 'city'], '']]
              ],
              { 'font-scale': 0.85, 'text-color': '#e5e7eb' }
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
              ['get', 'isPrimaryDay'],
              0.8,
              0.6
            ]
          }
        })
        
        if (isMapDebugEnabled) {
          console.debug('MapInitializer: base location layers created')
        }
      }

      // Destination markers - MATCHING BASE LOCATIONS EXACTLY
      if (!map.getLayer('destinations-layer')) {
        if (isMapDebugEnabled) {
          console.debug('MapInitializer: creating destination layers')
        }
        
        // Destination outer ring (match marker color with soft opacity)
        map.addLayer({
          id: 'destinations-outer',
          type: 'circle',
          source: 'destinations',
          paint: {
            'circle-radius': 18,
            'circle-color': ['coalesce', ['get', 'markerColor'], '#3b82f6'],
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
              ['boolean', ['feature-state', 'selected'], false],
              ['coalesce', ['get', 'markerColorSelected'], ['coalesce', ['get', 'markerColor'], '#3b82f6']],
              ['boolean', ['feature-state', 'hover'], false],
              ['coalesce', ['get', 'markerColorHover'], ['coalesce', ['get', 'markerColor'], '#60a5fa']],
              ['get', 'isCardSelected'],
              ['coalesce', ['get', 'markerColorSelected'], ['coalesce', ['get', 'markerColor'], '#3b82f6']],
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
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.95,
              ['get', 'isPrimaryDay'],
              0.9,
              0.55
            ]
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
              ['get', 'name'],
              { 'font-scale': 1.0 },
              ['case',
                ['==', ['coalesce', ['get', 'city'], ''], ''],
                '',
                ['concat', '\n', ['coalesce', ['get', 'city'], '']]
              ],
              { 'font-scale': 0.85, 'text-color': '#e5e7eb' }
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
              ['get', 'isPrimaryDay'],
              0.85,
              0.6
            ]
          }
        })
        
        if (isMapDebugEnabled) {
          console.debug('MapInitializer: destination layers created')
        }
      }


      // Selection highlight layer disabled - using marker styling for selection feedback instead
      
      if (isMapDebugEnabled) {
        console.debug('MapInitializer: initializeMapSources completed successfully')
      }
      } catch (error) {
        console.error('Map initialization failed:', error)
      }
    }

    // Initialize sources and layers immediately
    if (isMapDebugEnabled) {
      console.debug('MapInitializer: initializing map sources', { map: !!map, hasTrip })
    }
    initializeMapSources()
    if (isMapDebugEnabled) {
      console.debug('MapInitializer: initializeMapSources call completed')
    }
    
    // Also listen for style load in case it wasn't ready
    if (!map.isStyleLoaded()) {
      map.on('style.load', () => {
        if (isMapDebugEnabled) {
          console.debug('MapInitializer: style loaded, re-initializing sources')
        }
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
            if (isMapDebugEnabled) {
              console.debug('MapInitializer: ignore layer removal error', layerId, error)
            }
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
            if (isMapDebugEnabled) {
              console.debug('MapInitializer: ignore source removal error', sourceId, error)
            }
          }
        })
      }
    }
  }, [map, hasTrip])

  return null
}
