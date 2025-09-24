'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import type { Trip } from '@/types'

interface MapIntegrationProps {
  map: any
}

const DAY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange-red
]

interface RouteData {
  coordinates: [number, number][]
  duration: number
  distance: number
  isDayMarker?: boolean
  dayId?: string
  dayColor?: string
  dayNumber?: number
  isRouteDestination?: boolean
  destinationId?: string
  destinationName?: string
  dayIndex?: number
  destIndex?: number
  activityNumber?: number
  hasDestinationsOnRoute?: boolean
  destinationsOnRoute?: Array<{destination: any, dayIndex: number, destIndex: number}>
}

export function MapIntegration({ map }: MapIntegrationProps) {
  const { 
    currentTrip: storeTrip, 
    selectedDayId, 
    setSelectedDay, 
    selectedDestination, 
    setSelectedDestination 
  } = useSupabaseTripStore()

  const emptyTrip: Trip = {
    id: 'pending-trip',
    name: '',
    startDate: new Date(0),
    endDate: new Date(0),
    country: '',
    totalBudget: undefined,
    days: [],
  }

  const hasTrip = !!storeTrip
  const currentTrip = storeTrip ?? emptyTrip
  const tripDays = currentTrip.days
  
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
  const [activePopups, setActivePopups] = useState<mapboxgl.Popup[]>([])
  const routeCalculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveredBaseIdRef = useRef<string | null>(null)
  const hoveredDestinationIdRef = useRef<string | null>(null)
  const hoveredBaseRouteIdRef = useRef<string | null>(null)
  const hoveredDayRouteIdRef = useRef<string | null>(null)

  // Mapbox token
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // Calculate bearing between two points
  const calculateBearing = useCallback((start: [number, number], end: [number, number]) => {
    const startLat = start[1] * Math.PI / 180
    const startLng = start[0] * Math.PI / 180
    const endLat = end[1] * Math.PI / 180
    const endLng = end[0] * Math.PI / 180

    const dLng = endLng - startLng
    const y = Math.sin(dLng) * Math.cos(endLat)
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng)

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
  }, [])

  // Clear all popups
  const clearPopups = useCallback(() => {
    activePopups.forEach(popup => popup.remove())
    setActivePopups([])
  }, [activePopups])

  // Initialize map sources and layers
  useEffect(() => {
    console.log('MapIntegration: useEffect triggered', { map: !!map, hasTrip, currentTrip: !!currentTrip })
    if (!map || !hasTrip) {
      console.log('MapIntegration: Skipping initialization', { map: !!map, hasTrip })
      return
    }

    // Style load handler - SIMPLIFIED (no conflicting updates)
    const handleStyleLoad = () => {
      console.log('MapIntegration: Map style loaded')
    }

    map.on('styledata', handleStyleLoad)

    // Initialize sources and layers immediately
    const initializeMapSources = () => {
      console.log('🎯🎯🎯 MapIntegration: initializeMapSources called', { map: !!map, hasTrip })
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

      // Skip cluster layers since clustering is disabled
      // if (!map.getLayer('destinations-clusters')) {
      //   map.addLayer({
      //     id: 'destinations-clusters',
      //     type: 'circle',
      //     source: 'destinations',
      //     filter: ['has', 'point_count'],
      //     paint: {
      //       'circle-color': [
      //         'step',
      //         ['get', 'point_count'],
      //         '#3b82f6',
      //         5, '#22c55e',
      //         10, '#f59e0b',
      //         20, '#ef4444'
      //       ],
      //       'circle-radius': [
      //         'step',
      //         ['get', 'point_count'],
      //         15,
      //         5, 20,
      //         10, 25,
      //         20, 30
      //       ],
      //       'circle-stroke-width': 2,
      //       'circle-stroke-color': '#ffffff',
      //       'circle-opacity': 0.8
      //     }
      //   })
      // }

      // Skip cluster count layer since clustering is disabled
      // if (!map.getLayer('destinations-cluster-count')) {
      //   map.addLayer({
      //     id: 'destinations-cluster-count',
      //     type: 'symbol',
      //     source: 'destinations',
      //     filter: ['has', 'point_count'],
      //     layout: {
      //       'text-field': '{point_count_abbreviated}',
      //       'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      //       'text-size': 12
      //     },
      //     paint: {
      //       'text-color': '#ffffff',
      //       'text-halo-color': '#000000',
      //       'text-halo-width': 1
      //     }
      //   })
      // }

      // Destination markers - MATCHING BASE LOCATIONS EXACTLY
      if (!map.getLayer('destinations-layer')) {
        console.log('🎯 Creating destinations layers matching base locations')
        
        // Destination outer ring (like base locations)
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
              ['coalesce', ['get', 'dayColor'], '#3b82f6']
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

        // Destination activity numbers (like base locations)
        map.addLayer({
          id: 'destinations-activity-number',
          type: 'symbol',
          source: 'destinations',
          layout: {
            'text-field': ['get', 'activityNumber'],
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
            'line-color': '#3b82f6',
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
            'line-color': ['get', 'dayColor'],
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
      
      console.log('MapIntegration: initializeMapSources completed successfully')
      } catch (error) {
        console.error('Map initialization failed:', error)
      }
    }

    // Initialize sources and layers immediately
    console.log('🚀🚀🚀 MapIntegration: About to call initializeMapSources', { map: !!map, hasTrip })
    console.log('🚀🚀🚀 MapIntegration: Calling initializeMapSources from useEffect')
    initializeMapSources()
    console.log('🚀🚀🚀 MapIntegration: initializeMapSources call completed')
    
    // Also listen for style load in case it wasn't ready
    if (!map.isStyleLoaded()) {
      map.on('style.load', () => {
        console.log('MapIntegration: Style loaded, re-initializing sources')
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
        'destinations-activity-number',
        'destinations-labels',
        // Removed cluster layers since clustering is disabled
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

  // Update base location markers with enhanced data
  useEffect(() => {
    if (!map || !hasTrip) return

    console.log('MapIntegration: Updating base location markers', { 
      tripDaysCount: tripDays.length,
      daysWithLocations: tripDays.filter(day => day.location).length,
      tripDays: tripDays.map(day => ({ 
        id: day.id, 
        hasLocation: !!day.location,
        locationName: day.location?.name
      }))
    })

    // Add a small delay to ensure sources are initialized
    const timeoutId = setTimeout(() => {
      if (!map.getSource('base-locations')) return

      const baseLocationFeatures = tripDays
        .filter(day => day.location)
        .filter(day => !selectedDayId || selectedDayId === day.id) // Only show base location for selected day
        .map((day, index) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: day.location!.coordinates
          },
          properties: {
            name: day.location!.name,
            dayIndex: index,
            dayNumber: index + 1,
            dayId: day.id,
            context: day.location!.context,
            isSelected: selectedDayId === day.id,
            destinationCount: day.destinations.length
          }
        }))

      console.log('MapIntegration: Setting base location features on map', { 
        featureCount: baseLocationFeatures.length,
        features: baseLocationFeatures.map(f => ({ name: f.properties.name, dayId: f.properties.dayId }))
      })

      map.getSource('base-locations').setData({
        type: 'FeatureCollection',
        features: baseLocationFeatures
      })

      baseLocationFeatures.forEach((feature, index) => {
        const dayId = feature.properties.dayId
        map.setFeatureState(
          { source: 'base-locations', id: index },
          {
            selected: selectedDayId === dayId,
            hover: false
          }
        )
      })
    }, 50)

    return () => clearTimeout(timeoutId)
  }, [map, hasTrip, tripDays, selectedDayId])

  // Use the DAY_COLORS constant defined at the top

  // Destination markers update - SIMPLIFIED
  useEffect(() => {
    console.log('🚀 SIMPLE destination update triggered', { map: !!map, hasTrip, tripDaysCount: tripDays.length })
    if (!map || !hasTrip) return

    // Simple, direct update
    const updateDestinations = () => {
      if (!map.getSource('destinations') || !map.getLayer('destinations-layer')) {
        console.warn('⚠️ Source or layer not ready')
        return
      }

      // Create features with proper properties for numbers and colors
      const features = tripDays.flatMap((day, dayIndex) => {
        // Only show destination markers for the selected day
        if (selectedDayId && selectedDayId !== day.id) {
          return []
        }

        const dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length] || '#3b82f6'
        return day.destinations.map((destination, destIndex) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: destination.coordinates
          },
          properties: {
            name: destination.name,
            id: destination.id,
            dayIndex,
            dayNumber: dayIndex + 1,
            dayId: day.id,
            destIndex,
            activityNumber: destIndex + 1, // This will be the number shown on the marker
            destinationId: destination.id,
            dayColor: dayColor // This will be the color of the marker
          }
        }))
      })

      console.log('🎯 Setting SIMPLE destination features', { count: features.length })

      // Update source directly
      map.getSource('destinations').setData({
        type: 'FeatureCollection',
        features
      })

      console.log('✅ SIMPLE destination markers updated')
    }

    // Wait for map to be ready
    if (map.isStyleLoaded()) {
      updateDestinations()
    } else {
      map.once('styledata', updateDestinations)
    }
  }, [map, hasTrip, tripDays, selectedDayId])

  // Calculate and display routes - now reactive to trip changes
  useEffect(() => {
    if (!map || !token || !hasTrip) return

    const calculateRoutes = async () => {
      setIsLoadingRoutes(true)
      const newRoutes = new Map<string, RouteData>()

      try {
        // Calculate routes between base locations (including destinations along the way)
        const baseDaysWithLocation = tripDays.filter(day => day.location)
        if (baseDaysWithLocation.length > 1) {
          for (let i = 0; i < baseDaysWithLocation.length - 1; i++) {
            const currentDay = baseDaysWithLocation[i]
            const nextDay = baseDaysWithLocation[i + 1]
            const routeKey = `base-${currentDay.id}-${nextDay.id}`

            // Only show routes for the selected day (show route on the destination day)
            if (selectedDayId && selectedDayId !== nextDay.id) {
              continue
            }

            // Find days between these base locations
            const currentDayIndex = tripDays.findIndex(d => d.id === currentDay.id)
            const nextDayIndex = tripDays.findIndex(d => d.id === nextDay.id)
            
            if (currentDayIndex !== -1 && nextDayIndex !== -1) {
              // Get days between current and next base location
              const daysBetween = tripDays.slice(currentDayIndex + 1, nextDayIndex)
              
              // Collect all destinations from days between base locations AND from the destination day
              const destinationsOnRoute: Array<{destination: any, dayIndex: number, destIndex: number}> = []
              
              // Add destinations from days between base locations
              daysBetween.forEach((day, dayIndex) => {
                day.destinations.forEach((destination, destIndex) => {
                  destinationsOnRoute.push({
                    destination,
                    dayIndex: tripDays.findIndex(d => d.id === day.id),
                    destIndex
                  })
                })
              })
              
              // Add destinations from the destination day itself (like Siena on Day 2)
              nextDay.destinations.forEach((destination, destIndex) => {
                destinationsOnRoute.push({
                  destination,
                  dayIndex: nextDayIndex,
                  destIndex
                })
              })

              // Build waypoints: start → destinations → end
              const waypoints = [currentDay.location!.coordinates]
              
              // Add destinations in order
              destinationsOnRoute.forEach(item => {
                waypoints.push(item.destination.coordinates)
              })
              
              // Add end point
              waypoints.push(nextDay.location!.coordinates)

              // Only calculate route if we have multiple waypoints
              if (waypoints.length > 2) {
                try {
                  // Create waypoint string for Mapbox API
                  const waypointString = waypoints.map(coord => `${coord[0]},${coord[1]}`).join(';')
                  
                  const response = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/driving/${waypointString}?access_token=${token}&geometries=geojson&overview=full`
                  )

                  if (response.ok) {
                    const data = await response.json()
                    const route = data.routes[0]

                    newRoutes.set(routeKey, {
                      coordinates: route.geometry.coordinates,
                      duration: route.duration,
                      distance: route.distance,
                      hasDestinationsOnRoute: true,
                      destinationsOnRoute: destinationsOnRoute
                    })
                  }
                } catch (error) {
                  console.error('Error calculating multi-stop route:', error)
                }
              } else {
                // Simple route between base locations (no destinations)
                try {
                  const response = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/driving/${currentDay.location!.coordinates[0]},${currentDay.location!.coordinates[1]};${nextDay.location!.coordinates[0]},${nextDay.location!.coordinates[1]}?access_token=${token}&geometries=geojson&overview=full`
                  )

                  if (response.ok) {
                    const data = await response.json()
                    const route = data.routes[0]

                    newRoutes.set(routeKey, {
                      coordinates: route.geometry.coordinates,
                      duration: route.duration,
                      distance: route.distance,
                      hasDestinationsOnRoute: false
                    })
                  }
                } catch (error) {
                  console.error('Error calculating simple route:', error)
                }
              }
            }
          }
        }

        // Routes now automatically go through destinations, no need for separate markers
        // (Removed old logic that placed markers on routes)

        // Calculate routes within each day (between destinations)
        for (const day of tripDays) {
          if (day.destinations.length > 1) {
            // Only show routes for the selected day
            if (selectedDayId && selectedDayId !== day.id) {
              continue
            }

            const destinations = day.destinations.map(dest => dest.coordinates)
            
            for (let i = 0; i < destinations.length - 1; i++) {
              const from = destinations[i]
              const to = destinations[i + 1]
              const routeKey = `day-${day.id}-${i}-${i + 1}`

              try {
                const response = await fetch(
                  `https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}?access_token=${token}&geometries=geojson&overview=full`
                )
                
                if (response.ok) {
                  const data = await response.json()
                  const route = data.routes[0]
                  
                  newRoutes.set(routeKey, {
                    coordinates: route.geometry.coordinates,
                    duration: route.duration,
                    distance: route.distance
                  })
                }
              } catch (error) {
                console.error('Error calculating day route:', error)
              }
            }
          }
        }

        // Calculate routes from base locations to their destinations
        for (const day of tripDays) {
          if (day.location && day.destinations.length > 0) {
            // Only show routes for the selected day
            if (selectedDayId && selectedDayId !== day.id) {
              continue
            }

            const baseLocation = day.location.coordinates
            const dayColor = DAY_COLORS[tripDays.findIndex(d => d.id === day.id) % DAY_COLORS.length]
            
            for (const destination of day.destinations) {
              const routeKey = `base-dest-${day.id}-${destination.id}`
              
              // Skip base-to-destination routes if the destination is already included in a main route
              // Check if this destination is part of any main route (base-to-base route)
              const isDestinationInMainRoute = Array.from(newRoutes.keys()).some(key => {
                if (key.startsWith('base-') && !key.includes('base-dest-') && !key.includes('day-marker-')) {
                  const route = newRoutes.get(key)
                  return route && (route as any).destinationsOnRoute?.some((dest: any) => dest.destination.id === destination.id)
                }
                return false
              })
              
              if (isDestinationInMainRoute) {
                continue // Skip this base-to-destination route
              }
              
              try {
                const response = await fetch(
                  `https://api.mapbox.com/directions/v5/mapbox/walking/${baseLocation[0]},${baseLocation[1]};${destination.coordinates[0]},${destination.coordinates[1]}?access_token=${token}&geometries=geojson&overview=full`
                )
                
                if (response.ok) {
                  const data = await response.json()
                  const route = data.routes[0]
                  
                  newRoutes.set(routeKey, {
                    coordinates: route.geometry.coordinates,
                    duration: route.duration,
                    distance: route.distance
                  })
                }
              } catch (error) {
                console.error('Error calculating base-to-destination route:', error)
              }
            }
          }
        }

        // Routes are now directly applied to map sources below

        // Update routes on map with enhanced data
        const routeFeatures = Array.from(newRoutes.entries()).map(([key, route]) => {
          const isBaseRoute = key.startsWith('base-') && !key.includes('base-dest-') && !key.includes('day-marker-')
          const isDayRoute = key.startsWith('day-') && !key.includes('day-marker-')
          const isBaseDestRoute = key.startsWith('base-dest-')
          const isDayMarker = key.startsWith('day-marker-')
          
          let dayColor = '#10b981' // Default green for base routes
          let dayIndex = -1
          
          if (isDayRoute) {
            const dayId = key.split('-')[1]
            const day = tripDays.find(d => d.id === dayId)
            dayIndex = tripDays.findIndex(d => d.id === dayId)
            dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length]
          } else if (isBaseDestRoute) {
            const dayId = key.split('-')[2]
            dayIndex = tripDays.findIndex(d => d.id === dayId)
            dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length]
          } else if (isDayMarker) {
            dayColor = (route as any).dayColor || '#3b82f6'
            dayIndex = (route as any).dayNumber - 1
          }

          return {
            type: 'Feature' as const,
            geometry: {
              type: isDayMarker ? 'Point' as const : 'LineString' as const,
              coordinates: isDayMarker ? route.coordinates[0] : route.coordinates
            },
            properties: {
              id: key,
              duration: Math.round(route.duration / 3600 * 10) / 10, // Convert to hours (1 decimal)
              distance: Math.round(route.distance / 1000), // Convert to km
              label: `${Math.round(route.duration / 3600 * 10) / 10}h • ${Math.round(route.distance / 1000)}km`,
              dayColor,
              dayIndex,
              isBaseRoute,
              isDayRoute,
              isBaseDestRoute,
              isDayMarker,
              dayNumber: isDayMarker ? (route as any).dayNumber : undefined,
              bearing: isDayMarker ? 0 : calculateBearing(route.coordinates[0], route.coordinates[route.coordinates.length - 1])
            }
          }
        })

        // Separate base routes, day routes, and day markers
        const baseRouteFeatures = routeFeatures.filter(f => f.properties.isBaseRoute)
        const dayRouteFeatures = routeFeatures.filter(f => f.properties.isDayRoute || f.properties.isBaseDestRoute)
        const dayMarkerFeatures = routeFeatures.filter(f => f.properties.isDayMarker)

        if (map.getSource('routes')) {
          map.getSource('routes').setData({
            type: 'FeatureCollection',
            features: baseRouteFeatures
          })
        }

        if (map.getSource('day-routes')) {
          map.getSource('day-routes').setData({
            type: 'FeatureCollection',
            features: dayRouteFeatures
          })
        }

        // Update day markers source
        if (map.getSource('day-markers')) {
          map.getSource('day-markers').setData({
            type: 'FeatureCollection',
            features: dayMarkerFeatures
          })
        }

      } catch (error) {
        console.error('Error calculating routes:', error)
      } finally {
        setIsLoadingRoutes(false)
      }
    }

    // Debounce route calculation to avoid too many API calls
    if (routeCalculationTimeoutRef.current) {
      clearTimeout(routeCalculationTimeoutRef.current)
    }
    
    routeCalculationTimeoutRef.current = setTimeout(() => {
      calculateRoutes()
    }, 500) // Wait 500ms after last change

    return () => {
      if (routeCalculationTimeoutRef.current) {
        clearTimeout(routeCalculationTimeoutRef.current)
      }
    }
  }, [map, hasTrip, token, tripDays, selectedDayId, calculateBearing])

  // Add enhanced click handlers with bidirectional interactions
  useEffect(() => {
    if (!map || !hasTrip) return

    const handleBaseLocationClick = (e: any) => {
      const feature = e.features[0]
      if (feature) {
        const dayIndex = feature.properties.dayIndex
        const dayId = feature.properties.dayId
        const dayNumber = feature.properties.dayNumber
        
        // Bidirectional interaction: Select day in left panel
        setSelectedDay(dayId)
        clearPopups()
        
        // Enhanced popup with more information
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'custom-popup'
        })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(`
            <div class="p-3 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                  ${dayNumber}
                </div>
                <h3 class="font-semibold text-sm text-white">${feature.properties.name}</h3>
              </div>
              <p class="text-xs text-white/60 mb-2">Day ${dayNumber} Base Location</p>
              ${feature.properties.context ? `<p class="text-xs text-white/50 mb-2">${feature.properties.context}</p>` : ''}
              <div class="flex items-center gap-4 text-xs text-white/60">
                <span>${feature.properties.destinationCount} activities</span>
              </div>
            </div>
          `)
          .addTo(map)
        
        setActivePopups(prev => [...prev, popup])
      }
    }

    const handleDestinationClick = (e: any) => {
      const feature = e.features[0]
      if (feature) {
        const dayIndex = feature.properties.dayIndex
        const destIndex = feature.properties.destIndex
        const dayId = feature.properties.dayId
        const destinationId = feature.properties.destinationId
        
        // Bidirectional interaction: Select day and destination
        setSelectedDay(dayId)
        if (!hasTrip) return
        setSelectedDestination(tripDays[dayIndex].destinations[destIndex])
        clearPopups()
        
        // Enhanced popup with more information
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'custom-popup'
        })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(`
            <div class="p-3 min-w-[220px]">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background-color: ${feature.properties.dayColor}">
                  ${feature.properties.activityNumber}
                </div>
                <h3 class="font-semibold text-sm text-white">${feature.properties.name}</h3>
              </div>
              <p class="text-xs text-white/60 mb-2">Day ${feature.properties.dayNumber} • Activity ${feature.properties.activityNumber}</p>
              ${feature.properties.description ? `<p class="text-xs text-white/50 mb-2">${feature.properties.description}</p>` : ''}
              <div class="flex items-center gap-4 text-xs text-white/60">
                ${feature.properties.duration ? `<span>${feature.properties.duration}h</span>` : ''}
                ${feature.properties.cost ? `<span>€${feature.properties.cost}</span>` : ''}
                ${feature.properties.rating ? `<span class="flex items-center gap-1"><span class="text-yellow-400">⭐</span> ${feature.properties.rating.toFixed(1)}</span>` : ''}
              </div>
            </div>
          `)
          .addTo(map)
        
        setActivePopups(prev => [...prev, popup])
      }
    }

    // Removed cluster click handler since clustering is disabled

    // Add click handlers
    map.on('click', 'base-locations-layer', handleBaseLocationClick)
    // Destination click handler - REMOVED FOR REBUILD
    // Removed cluster click handler since clustering is disabled

    // Enhanced hover effects with feature states
    map.on('mouseenter', 'base-locations-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.dayIndex !== undefined) {
        map.setFeatureState(
          { source: 'base-locations', id: feature.properties.dayIndex },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'base-locations-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.dayIndex !== undefined) {
          map.setFeatureState(
            { source: 'base-locations', id: feature.properties.dayIndex },
            { hover: false }
          )
        }
      }
    })

    // Destination hover handlers - REMOVED FOR REBUILD

    // Removed cluster hover handlers since clustering is disabled

    // Route hover effects
    map.on('mouseenter', 'routes-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.id) {
        map.setFeatureState(
          { source: 'routes', id: feature.properties.id },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'routes-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.id) {
          map.setFeatureState(
            { source: 'routes', id: feature.properties.id },
            { hover: false }
          )
        }
      }
    })

    map.on('mouseenter', 'day-routes-layer', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.id) {
        map.setFeatureState(
          { source: 'day-routes', id: feature.properties.id },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'day-routes-layer', (e: any) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.id) {
          map.setFeatureState(
            { source: 'day-routes', id: feature.properties.id },
            { hover: false }
          )
        }
      }
    })

    // Route click handlers for distance/time popup
    map.on('click', 'routes-layer', (e: any) => {
      const feature = e.features[0]
      if (feature && feature.properties.label) {
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="route-popup">
              <strong>Route Information</strong><br>
              ${feature.properties.label}
            </div>
          `)
          .addTo(map)
      }
    })

    map.on('click', 'day-routes-layer', (e: any) => {
      const feature = e.features[0]
      if (feature && feature.properties.label) {
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="route-popup">
              <strong>Route Information</strong><br>
              ${feature.properties.label}
            </div>
          `)
          .addTo(map)
      }
    })

    return () => {
      map.off('click', 'base-locations-layer', handleBaseLocationClick)
      // Destination click cleanup - REMOVED FOR REBUILD
      // Removed cluster cleanup since clustering is disabled
      map.off('mouseenter', 'base-locations-layer')
      map.off('mouseleave', 'base-locations-layer')
      // Destination hover cleanup - REMOVED FOR REBUILD
      map.off('mouseenter', 'routes-layer')
      map.off('mouseleave', 'routes-layer')
      map.off('mouseenter', 'day-routes-layer')
      map.off('mouseleave', 'day-routes-layer')
      map.off('click', 'routes-layer')
      map.off('click', 'day-routes-layer')
    }
  }, [map, hasTrip, tripDays, selectedDayId, selectedDestination, setSelectedDay, setSelectedDestination, clearPopups])

  // Enhanced map bounds fitting with selection awareness
  useEffect(() => {
    if (!map || !hasTrip || !tripDays.length) return

    const allCoordinates = tripDays.flatMap(day => {
      const coords = []
      if (day.location) {
        coords.push(day.location.coordinates)
      }
      coords.push(...day.destinations.map(dest => dest.coordinates))
      return coords
    })

    if (allCoordinates.length > 0) {
      const bounds = allCoordinates.reduce((bounds, coord) => {
        return bounds.extend(coord)
      }, new mapboxgl.LngLatBounds(allCoordinates[0], allCoordinates[0]))

      // Only fit bounds if we have new coordinates or if it's the first load
      const currentCenter = map.getCenter()
      const currentZoom = map.getZoom()
      
      // Check if the map is showing the default Rome location (initial state)
      const isDefaultLocation = Math.abs(currentCenter.lng - 12.4964) < 0.1 && Math.abs(currentCenter.lat - 41.9028) < 0.1
      
      if (isDefaultLocation || allCoordinates.length > 0) {
        map.fitBounds(bounds, {
          padding: 80,
          maxZoom: 12,
          duration: 1000
        })
      }
    }
  }, [map, hasTrip, tripDays])

  // Update selection highlight
  useEffect(() => {
    if (!map || !hasTrip || !map.getSource('selection-highlight')) return

    let highlightFeature = null

    if (selectedDestination) {
      highlightFeature = {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: selectedDestination.coordinates
        },
        properties: {
          type: 'destination',
          id: selectedDestination.id
        }
      }
    } else if (selectedDayId) {
      const selectedDay = tripDays.find(day => day.id === selectedDayId)
      if (selectedDay?.location) {
        highlightFeature = {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: selectedDay.location.coordinates
          },
          properties: {
            type: 'base-location',
            id: selectedDay.id
          }
        }
      }
    }

    map.getSource('selection-highlight').setData({
      type: 'FeatureCollection',
      features: highlightFeature ? [highlightFeature] : []
    })
  }, [map, hasTrip, selectedDestination, selectedDayId, tripDays])

  if (!hasTrip) {
    return null
  }

  return (
    <div className="absolute top-4 right-4 z-10">
      {isLoadingRoutes && (
        <div className="glass-card rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-white">
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Calculating routes...</span>
          </div>
        </div>
      )}
    </div>
  )
}
