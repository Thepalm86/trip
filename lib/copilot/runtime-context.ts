import { useTripStore } from '@/lib/store/trip-store'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useExploreStore } from '@/lib/store/explore-store'
import { Destination, ExplorePlace, Trip } from '@/types'
import {
  CopilotRuntimeContext,
  CopilotTripSnapshot,
  CopilotContextSource,
  CopilotUnresolvedIssues,
  CopilotExplorePlaceSnapshot,
} from '@/lib/copilot/types'

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const toIsoString = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date(value).toISOString()
}

const cloneDestination = (destination: Destination): Destination => deepClone(destination)

const cloneExplorePlace = (place: ExplorePlace): CopilotExplorePlaceSnapshot => ({
  id: place.id,
  name: place.name,
  coordinates: [...place.coordinates],
  category: place.category,
  city: place.city,
  isFavorite: place.isFavorite,
})

const buildTripSnapshot = (
  trip: Trip,
  maybeLocations: Destination[],
): CopilotTripSnapshot => ({
  id: trip.id,
  name: trip.name,
  startDate: toIsoString(trip.startDate),
  endDate: toIsoString(trip.endDate),
  country: (trip as { country?: string | null }).country ?? null,
  days: trip.days.map((day) => ({
    id: day.id,
    date: toIsoString(day.date),
    destinations: day.destinations.map(cloneDestination),
    baseLocations: Array.isArray(day.baseLocations)
      ? day.baseLocations.map((location) => ({ ...location }))
      : [],
    notes: day.notes ?? '',
  })),
  maybeLocations: maybeLocations.map(cloneDestination),
})

const deriveUnresolvedIssues = (trip: CopilotTripSnapshot | null): CopilotUnresolvedIssues => {
  if (!trip) {
    return {
      emptyDayIds: [],
      missingBaseLocationDayIds: [],
      orphanMaybeLocationIds: [],
    }
  }

  const emptyDayIds = trip.days
    .filter((day) => day.destinations.length === 0)
    .map((day) => day.id)

  const missingBaseLocationDayIds = trip.days
    .filter((day) => day.baseLocations.length === 0)
    .map((day) => day.id)

  const scheduledDestinationIds = new Set(
    trip.days.flatMap((day) => day.destinations.map((destination) => destination.id)),
  )

  const orphanMaybeLocationIds = trip.maybeLocations
    .filter((destination) => !scheduledDestinationIds.has(destination.id))
    .map((destination) => destination.id)

  return {
    emptyDayIds,
    missingBaseLocationDayIds,
    orphanMaybeLocationIds,
  }
}

export const snapshotCopilotRuntimeContext = (): CopilotRuntimeContext => {
  const supabaseState = useSupabaseTripStore.getState()
  const localTripState = useTripStore.getState()
  const exploreState = useExploreStore.getState()

  const tripFromSupabase = supabaseState.currentTrip
  const tripFromLocal = localTripState.currentTrip
  const source: CopilotContextSource = tripFromSupabase ? 'supabase' : 'local'

  const activeTrip = tripFromSupabase ?? tripFromLocal
  const maybeLocations = tripFromSupabase ? supabaseState.maybeLocations : []

  const tripSnapshot = activeTrip ? buildTripSnapshot(activeTrip, maybeLocations) : null

  const selection = {
    dayId: tripFromSupabase ? supabaseState.selectedDayId : localTripState.selectedDayId,
    destinationId: tripFromSupabase
      ? supabaseState.selectedDestination?.id ?? null
      : localTripState.selectedDestination?.id ?? null,
   baseLocation: tripFromSupabase
      ? supabaseState.selectedBaseLocation
        ? { ...supabaseState.selectedBaseLocation }
        : null
      : localTripState.selectedBaseLocation
        ? { ...localTripState.selectedBaseLocation }
        : null,
    origin: tripFromSupabase ? supabaseState.selectionOrigin : localTripState.selectionOrigin,
    routeModeEnabled: tripFromSupabase ? supabaseState.routeModeEnabled : false,
    selectedRouteSegmentId: tripFromSupabase ? supabaseState.selectedRouteSegmentId : null,
    adHocRoute: tripFromSupabase && supabaseState.adHocRouteConfig
      ? {
          fromId: supabaseState.adHocRouteConfig.from.id,
          toId: supabaseState.adHocRouteConfig.to.id,
          source: supabaseState.adHocRouteConfig.from.source,
        }
      : null,
  }

  const explore = {
    selectedPlaceId: exploreState.selectedPlace?.id ?? null,
    routeSelection: {
      startId: exploreState.routeSelection.start?.id ?? null,
      endId: exploreState.routeSelection.end?.id ?? null,
    },
    visibleCategoryKeys: exploreState.visibleCategories
      ? [...exploreState.visibleCategories]
      : null,
    markersFilter: exploreState.markersFilter,
    activePlaceIds: exploreState.activePlaces.map((place) => place.id),
    activePlaces: exploreState.activePlaces.map(cloneExplorePlace),
  }

  const unresolved = deriveUnresolvedIssues(tripSnapshot)

  return {
    source,
    trip: tripSnapshot,
    selection,
    explore,
    unresolved,
    timestamp: Date.now(),
  }
}

export type SnapshotCopilotRuntimeContext = ReturnType<typeof snapshotCopilotRuntimeContext>
