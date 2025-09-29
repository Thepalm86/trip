'use client'

import { useState } from 'react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import type { Trip } from '@/types'
import { RouteManager } from './RouteManager'
import { MarkerManager } from './MarkerManager'
import { MapInitializer } from './MapInitializer'
import { MapEventHandler } from './MapEventHandler'
import { MapCleanup } from './MapCleanup'
import { ExplorePreviewDrawer } from './ExplorePreviewDrawer'
import { ExplorePreviewMarker } from './ExplorePreviewMarker'
import { ExploreMarkersToggle } from './ExploreMarkersToggle'
import { ItineraryPreviewDrawer } from './ItineraryPreviewDrawer'
import { ExploreMapFocus } from './ExploreMapFocus'
import { CountryFocus } from './CountryFocus'

/**
 * MapIntegration - Orchestrates all map-related components
 * 
 * This component has been refactored from a monolithic 1,400+ line component
 * into a clean, maintainable architecture with focused responsibilities:
 * 
 * - MapInitializer: Handles map setup, sources, and layers
 * - RouteManager: Handles route calculation and rendering
 * - MarkerManager: Handles marker creation and management
 * - MapEventHandler: Handles click/hover/popup interactions
 * - MapCleanup: Handles memory management and cleanup
 * 
 * Each component has a single responsibility and can be tested/maintained independently.
 */

interface MapIntegrationProps {
  map: any
}

export function MapIntegration({ map }: MapIntegrationProps) {
  const { 
    currentTrip: storeTrip, 
    selectedDayId, 
    setSelectedDay, 
    selectedDestination, 
    setSelectedDestination,
    selectedCardId,
    setSelectedCard,
    selectedBaseLocation,
    setSelectedBaseLocation,
    selectedRouteSegmentId,
    setSelectedRouteSegmentId,
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

  // Mapbox token
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!hasTrip) {
    return null
  }

  return (
    <>
      <MapInitializer
        map={map}
        hasTrip={hasTrip}
      />
      
      {/* Show trip routes and markers */}
      <RouteManager
        map={map}
        hasTrip={hasTrip}
        tripDays={tripDays}
        selectedDayId={selectedDayId}
        token={token || ''}
        onLoadingChange={setIsLoadingRoutes}
      />
      <MarkerManager
        map={map}
        hasTrip={hasTrip}
        tripDays={tripDays}
        selectedDayId={selectedDayId}
        selectedCardId={selectedCardId}
      />
      <MapEventHandler
        map={map}
        hasTrip={hasTrip}
        tripDays={tripDays}
        selectedDayId={selectedDayId}
        selectedDestination={selectedDestination}
        setSelectedDay={setSelectedDay}
        setSelectedDestination={setSelectedDestination}
        selectedBaseLocation={selectedBaseLocation}
        setSelectedBaseLocation={setSelectedBaseLocation}
        setSelectedCard={setSelectedCard}
        selectedRouteSegmentId={selectedRouteSegmentId}
        setSelectedRouteSegmentId={setSelectedRouteSegmentId}
      />
      <MapCleanup
        map={map}
        hasTrip={hasTrip}
        tripDays={tripDays}
        selectedDayId={selectedDayId}
        selectedDestination={selectedDestination}
      />
      <ExplorePreviewMarker map={map} />
      <ExploreMarkersToggle map={map} />
      <ExploreMapFocus map={map} />
      <CountryFocus map={map} />
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

      <ExplorePreviewDrawer />
      <ItineraryPreviewDrawer />
    </>
  )
}
