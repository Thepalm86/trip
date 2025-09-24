'use client'

import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Trip } from '@/types'

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

interface RouteManagerProps {
  map: any
  hasTrip: boolean
  tripDays: Trip['days']
  selectedDayId: string | null
  token: string
  onLoadingChange: (loading: boolean) => void
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

export function RouteManager({ 
  map, 
  hasTrip, 
  tripDays, 
  selectedDayId, 
  token, 
  onLoadingChange 
}: RouteManagerProps) {
  const routeCalculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Calculate and display routes - now reactive to trip changes
  useEffect(() => {
    if (!map || !token || !hasTrip) return

    const calculateRoutes = async () => {
      onLoadingChange(true)
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
        onLoadingChange(false)
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
  }, [map, hasTrip, token, tripDays, selectedDayId, calculateBearing, onLoadingChange])

  return null
}
