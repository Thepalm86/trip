import test from 'node:test'
import assert from 'node:assert/strict'

import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { tripApi } from '@/lib/supabase/trip-api'
import type { Trip, TimelineDay } from '@/types'

const resetStore = () => {
  useSupabaseTripStore.setState({
    currentTrip: null,
    trips: [],
    selectedDestination: null,
    selectedBaseLocation: null,
    selectedDayId: null,
    selectionOrigin: null,
    error: null,
    lastUpdate: Date.now(),
    hasLoadedTrips: false,
    lastActiveTripId: null,
    loading: { trips: false, tripMutation: false, destinationMutation: false },
    selectedCardId: null,
    selectedRouteSegmentId: null,
    showDayRouteOverlay: false,
    showAllDestinations: false,
    routeModeEnabled: false,
    routeSelectionStart: null,
    routeProfile: 'driving',
    adHocRouteConfig: null,
    adHocRouteResult: null,
    maybeLocations: [],
  })
}

const createMockTrip = (overrides: Partial<Trip> = {}): Trip => {
  const baseDay: TimelineDay = {
    id: 'day-1',
    dayOrder: 0,
    date: new Date('2025-01-01'),
    destinations: [],
    baseLocations: [],
  }

  return {
    id: 'trip-1',
    name: 'Focus Explorer',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-05'),
    country: 'IT',
    countries: ['IT', 'FR'],
    totalBudget: undefined,
    days: [baseDay],
    ...overrides,
  }
}

test('loadTrips hydrates multi-country focus selections', async () => {
  resetStore()

  const originalGetUserTrips = tripApi.getUserTrips
  const originalGetLastActiveTripId = tripApi.getLastActiveTripId

  tripApi.getUserTrips = async () => [createMockTrip()]
  tripApi.getLastActiveTripId = async () => 'trip-1'

  try {
    await useSupabaseTripStore.getState().loadTrips()
    const { currentTrip, trips, loading } = useSupabaseTripStore.getState()

    assert.deepEqual(currentTrip?.countries, ['IT', 'FR'])
    assert.equal(trips.length, 1)
    assert.deepEqual(trips[0].countries, ['IT', 'FR'])
    assert.equal(loading.trips, false)
  } finally {
    tripApi.getUserTrips = originalGetUserTrips
    tripApi.getLastActiveTripId = originalGetLastActiveTripId
  }
})

test('updateTrip persists multi-country array', async () => {
  resetStore()

  const baseTrip = createMockTrip({ countries: ['IT'] })
  useSupabaseTripStore.setState({
    currentTrip: baseTrip,
    trips: [baseTrip],
    hasLoadedTrips: true,
    lastActiveTripId: baseTrip.id,
  })

  const originalUpdateTrip = tripApi.updateTrip
  const originalGetTrip = tripApi.getTrip

  let receivedUpdates: Partial<Trip> | null = null
  tripApi.updateTrip = async (_tripId, updates) => {
    receivedUpdates = updates
  }
  tripApi.getTrip = async () =>
    createMockTrip({
      id: baseTrip.id,
      countries: ['IT', 'ES'],
    })

  try {
    await useSupabaseTripStore.getState().updateTrip(baseTrip.id, { countries: ['IT', 'ES'] })
    const { currentTrip } = useSupabaseTripStore.getState()

    assert.deepEqual(receivedUpdates?.countries, ['IT', 'ES'])
    assert.deepEqual(currentTrip?.countries, ['IT', 'ES'])
  } finally {
    tripApi.updateTrip = originalUpdateTrip
    tripApi.getTrip = originalGetTrip
  }
})
