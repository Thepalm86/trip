'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useTripStore } from '@/lib/store/trip-store'

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
}

export function MapIntegration({ map }: MapIntegrationProps) {
  const { 
    currentTrip, 
    selectedDayId, 
    setSelectedDay, 
    selectedDestination, 
    setSelectedDestination 
  } = useTripStore()
  
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
    if (!map) return

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

        // Destination markers source with clustering
        if (!map.getSource('destinations')) {
          map.addSource('destinations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            },
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
          })
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

      // Add destination cluster circles
      if (!map.getLayer('destinations-clusters')) {
        map.addLayer({
          id: 'destinations-clusters',
          type: 'circle',
          source: 'destinations',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#3b82f6',
              5, '#22c55e',
              10, '#f59e0b',
              20, '#ef4444'
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              15,
              5, 20,
              10, 25,
              20, 30
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8
          }
        })
      }

      // Add destination cluster labels
      if (!map.getLayer('destinations-cluster-count')) {
        map.addLayer({
          id: 'destinations-cluster-count',
          type: 'symbol',
          source: 'destinations',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        })
      }

      // Add individual destination markers
      if (!map.getLayer('destinations-layer')) {
        map.addLayer({
          id: 'destinations-layer',
          type: 'circle',
          source: 'destinations',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 10,
              ['boolean', ['feature-state', 'selected'], false], 9,
              8
            ],
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#60a5fa',
              ['boolean', ['feature-state', 'hover'], false], '#3b82f6',
              ['get', 'dayColor']
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 3,
              ['boolean', ['feature-state', 'hover'], false], 2,
              1
            ],
            'circle-stroke-color': '#ffffff',
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 1,
              ['boolean', ['feature-state', 'hover'], false], 0.9,
              0.8
            ]
          }
        })

        // Add destination activity numbers
        map.addLayer({
          id: 'destinations-activity-number',
          type: 'symbol',
          source: 'destinations',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'activityNumber'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 9,
            'text-anchor': 'center',
            'text-offset': [0, 0]
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        })

        // Add destination labels (only for selected/hovered)
        map.addLayer({
          id: 'destinations-labels',
          type: 'symbol',
          source: 'destinations',
          filter: ['!', ['has', 'point_count']],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Medium', 'Arial Unicode MS Medium'],
            'text-size': 10,
            'text-anchor': 'top',
            'text-offset': [0, 1.5],
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
              0
            ]
          }
        })
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
      
      } catch (error) {
        console.error('Map initialization failed:', error)
      }
    }

    // Initialize sources and layers - try immediately, then on style load if needed
    const tryInitialize = () => {
      initializeMapSources()
    }

    // Always try to initialize immediately
    tryInitialize()
    
    // Also listen for style load in case it wasn't ready
    if (!map.isStyleLoaded()) {
      map.on('style.load', tryInitialize)
    }

    return () => {
      // Cleanup layers and sources on unmount
      
      // Cleanup layers and sources
      const layers = [
        'selection-highlight-layer',
        'day-routes-layer',
        'day-routes-shadow',
        'routes-labels',
        'routes-arrows',
        'routes-layer',
        'routes-shadow',
        'destinations-labels',
        'destinations-activity-number',
        'destinations-layer',
        'destinations-cluster-count',
        'destinations-clusters',
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
  }, [map])

  // Update base location markers with enhanced data
  useEffect(() => {
    if (!map) return

    // Add a small delay to ensure sources are initialized
    const timeoutId = setTimeout(() => {
      if (!map.getSource('base-locations')) return

    const baseLocationFeatures = currentTrip.days
      .filter(day => day.location)
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

      map.getSource('base-locations').setData({
        type: 'FeatureCollection',
        features: baseLocationFeatures
      })

      // Update feature states for selection
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
      
    }, 50) // 50ms delay

    return () => clearTimeout(timeoutId)
  }, [map, currentTrip.days, selectedDayId])

  // Use the DAY_COLORS constant defined at the top

  // Update destination markers with enhanced data and day colors
  useEffect(() => {
    if (!map) return

    // Add a small delay to ensure sources are initialized
    const timeoutId = setTimeout(() => {
      if (!map.getSource('destinations')) return

    const destinationFeatures = currentTrip.days.flatMap((day, dayIndex) =>
      day.destinations.map((destination, destIndex) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: destination.coordinates
        },
        properties: {
          name: destination.name,
          dayIndex,
          dayNumber: dayIndex + 1,
          dayId: day.id,
          destIndex,
          activityNumber: destIndex + 1,
          destinationId: destination.id,
          description: destination.description,
          rating: destination.rating,
          category: destination.category,
          dayColor: DAY_COLORS[dayIndex % DAY_COLORS.length],
          duration: destination.estimatedDuration,
          cost: destination.cost,
          isSelected: selectedDestination?.id === destination.id
        }
      }))
    )

      map.getSource('destinations').setData({
        type: 'FeatureCollection',
        features: destinationFeatures
      })

      // Update feature states for selection
      destinationFeatures.forEach((feature, index) => {
        const destinationId = feature.properties.destinationId
        map.setFeatureState(
          { source: 'destinations', id: index },
          { 
            selected: selectedDestination?.id === destinationId,
            hover: false
          }
        )
      })
    }, 50) // 50ms delay

    return () => clearTimeout(timeoutId)
  }, [map, currentTrip.days, selectedDestination])

  // Calculate and display routes - now reactive to trip changes
  useEffect(() => {
    if (!map || !token) return

    const calculateRoutes = async () => {
      setIsLoadingRoutes(true)
      const newRoutes = new Map<string, RouteData>()

      try {
        // Calculate routes between base locations (only for sequential days with base locations)
        const baseDaysWithLocation = currentTrip.days.filter(day => day.location)
        if (baseDaysWithLocation.length > 1) {
          for (let i = 0; i < baseDaysWithLocation.length - 1; i++) {
            const currentDay = baseDaysWithLocation[i]
            const nextDay = baseDaysWithLocation[i + 1]
            const from = currentDay.location!.coordinates
            const to = nextDay.location!.coordinates
            const routeKey = `base-${currentDay.id}-${nextDay.id}`

            try {
              const response = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?access_token=${token}&geometries=geojson&overview=full`
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
              console.error('Error calculating route:', error)
            }
          }
        }

        // Calculate routes within each day (between destinations)
        for (const day of currentTrip.days) {
          if (day.destinations.length > 1) {
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

        // Routes are now directly applied to map sources below

        // Update routes on map with enhanced data
        const routeFeatures = Array.from(newRoutes.entries()).map(([key, route]) => {
          const isBaseRoute = key.startsWith('base-')
          const isDayRoute = key.startsWith('day-')
          
          let dayColor = '#10b981' // Default green for base routes
          let dayIndex = -1
          
          if (isDayRoute) {
            const dayId = key.split('-')[1]
            const day = currentTrip.days.find(d => d.id === dayId)
            dayIndex = currentTrip.days.findIndex(d => d.id === dayId)
            dayColor = DAY_COLORS[dayIndex % DAY_COLORS.length]
          }

          return {
            type: 'Feature' as const,
            geometry: {
              type: 'LineString' as const,
              coordinates: route.coordinates
            },
            properties: {
              id: key,
              duration: Math.round(route.duration / 60), // Convert to minutes
              distance: Math.round(route.distance / 1000), // Convert to km
              label: `${Math.round(route.duration / 60)}min • ${Math.round(route.distance / 1000)}km`,
              dayColor,
              dayIndex,
              isBaseRoute,
              isDayRoute,
              bearing: calculateBearing(route.coordinates[0], route.coordinates[route.coordinates.length - 1])
            }
          }
        })

        // Separate base routes and day routes
        const baseRouteFeatures = routeFeatures.filter(f => f.properties.isBaseRoute)
        const dayRouteFeatures = routeFeatures.filter(f => f.properties.isDayRoute)

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
  }, [map, token, currentTrip.days, calculateBearing])

  // Add enhanced click handlers with bidirectional interactions
  useEffect(() => {
    if (!map) return

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
        setSelectedDestination(currentTrip.days[dayIndex].destinations[destIndex])
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

    const handleClusterClick = (e: any) => {
      const feature = e.features[0]
      if (feature) {
        const clusterId = feature.properties.cluster_id
        const source = map.getSource('destinations')
        
        if (source.getClusterExpansionZoom) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return
            
            map.easeTo({
              center: feature.geometry.coordinates,
              zoom: zoom
            })
          })
        }
      }
    }

    // Add click handlers
    map.on('click', 'base-locations-layer', handleBaseLocationClick)
    map.on('click', 'destinations-layer', handleDestinationClick)
    map.on('click', 'destinations-clusters', handleClusterClick)

    // Enhanced hover effects with feature states
    map.on('mouseenter', 'base-locations-layer', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.dayIndex !== undefined) {
        map.setFeatureState(
          { source: 'base-locations', id: feature.properties.dayIndex },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'base-locations-layer', (e) => {
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

    map.on('mouseenter', 'destinations-layer', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.destinationId) {
        map.setFeatureState(
          { source: 'destinations', id: feature.properties.destinationId },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'destinations-layer', (e) => {
      map.getCanvas().style.cursor = ''
      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        if (feature && feature.properties.destinationId) {
          map.setFeatureState(
            { source: 'destinations', id: feature.properties.destinationId },
            { hover: false }
          )
        }
      }
    })

    map.on('mouseenter', 'destinations-clusters', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'destinations-clusters', () => {
      map.getCanvas().style.cursor = ''
    })

    // Route hover effects
    map.on('mouseenter', 'routes-layer', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.id) {
        map.setFeatureState(
          { source: 'routes', id: feature.properties.id },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'routes-layer', (e) => {
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

    map.on('mouseenter', 'day-routes-layer', (e) => {
      map.getCanvas().style.cursor = 'pointer'
      const feature = e.features[0]
      if (feature && feature.properties.id) {
        map.setFeatureState(
          { source: 'day-routes', id: feature.properties.id },
          { hover: true }
        )
      }
    })

    map.on('mouseleave', 'day-routes-layer', (e) => {
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

    return () => {
      map.off('click', 'base-locations-layer', handleBaseLocationClick)
      map.off('click', 'destinations-layer', handleDestinationClick)
      map.off('click', 'destinations-clusters', handleClusterClick)
      map.off('mouseenter', 'base-locations-layer')
      map.off('mouseleave', 'base-locations-layer')
      map.off('mouseenter', 'destinations-layer')
      map.off('mouseleave', 'destinations-layer')
      map.off('mouseenter', 'destinations-clusters')
      map.off('mouseleave', 'destinations-clusters')
      map.off('mouseenter', 'routes-layer')
      map.off('mouseleave', 'routes-layer')
      map.off('mouseenter', 'day-routes-layer')
      map.off('mouseleave', 'day-routes-layer')
    }
  }, [map, currentTrip.days, selectedDayId, selectedDestination, setSelectedDay, setSelectedDestination, clearPopups])

  // Enhanced map bounds fitting with selection awareness
  useEffect(() => {
    if (!map || !currentTrip.days.length) return

    const allCoordinates = currentTrip.days.flatMap(day => {
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
  }, [map, currentTrip.days])

  // Update selection highlight
  useEffect(() => {
    if (!map || !map.getSource('selection-highlight')) return

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
      const selectedDay = currentTrip.days.find(day => day.id === selectedDayId)
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
  }, [map, selectedDestination, selectedDayId, currentTrip.days])

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
