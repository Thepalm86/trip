'use client'

import { create } from 'zustand'
import { Destination, Trip, DayLocation } from '@/types'
import { addDays } from '@/lib/utils'
import { tripApi } from '@/lib/supabase/trip-api'

const DEBUG_TRIP_STORE = process.env.NEXT_PUBLIC_DEBUG_TRIP_STORE === 'true'
const debugTripStoreLog = (...args: unknown[]) => {
  if (DEBUG_TRIP_STORE) {
    console.log(...args)
  }
}

type SelectionOrigin = 'map' | 'timeline' | 'preview'

export type RouteSelectionSource = 'base' | 'destination' | 'explore'

export type RouteProfile = 'driving' | 'walking'

export interface MapRouteSelectionPoint {
  id: string
  label: string
  coordinates: [number, number]
  source: RouteSelectionSource
  dayId?: string
  meta?: Record<string, unknown>
}

interface AdHocRouteConfig {
  id: string
  from: MapRouteSelectionPoint
  to: MapRouteSelectionPoint
  profile: RouteProfile
}

interface AdHocRouteResult extends AdHocRouteConfig {
  durationSeconds: number
  distanceMeters: number
  coordinates: [number, number][]
}

interface SupabaseTripStore {
  // State
  currentTrip: Trip | null
  trips: Trip[]
  selectedDestination: Destination | null
  selectedBaseLocation: { dayId: string; index: number } | null
  selectedDayId: string | null
  selectionOrigin: SelectionOrigin | null
  error: string | null
  lastUpdate: number // Force re-renders
  hasLoadedTrips: boolean
  lastActiveTripId: string | null
  loading: {
    trips: boolean
    tripMutation: boolean
    destinationMutation: boolean
  }
  
  // Selection state
  selectedCardId: string | null
  selectedRouteSegmentId: string | null
  showDayRouteOverlay: boolean
  showAllDestinations: boolean
  routeModeEnabled: boolean
  routeSelectionStart: MapRouteSelectionPoint | null
  routeProfile: RouteProfile
  adHocRouteConfig: AdHocRouteConfig | null
  adHocRouteResult: AdHocRouteResult | null
  
  // Maybe locations state
  maybeLocations: Destination[]
  
  // Actions
  loadTrips: (options?: { force?: boolean; preferredTripId?: string | null }) => Promise<void>
  loadTrip: (tripId: string) => Promise<void>
  createTrip: (trip: Omit<Trip, 'id'>) => Promise<string>
  updateTrip: (tripId: string, updates: Partial<Trip>) => Promise<void>
  duplicateTrip: (tripId: string, newName: string) => Promise<string>
  
  addDestinationToDay: (destination: Destination, dayId: string, options?: { index?: number }) => Promise<void>
  updateDestination: (dayId: string, destinationId: string, destination: Destination) => Promise<void>
  removeDestinationFromDay: (destinationId: string, dayId: string) => Promise<void>
  addNewDay: () => Promise<void>
  duplicateDay: (dayId: string) => Promise<void>
  removeDay: (dayId: string) => Promise<void>
  updateDayNotes: (dayId: string, notes: string) => Promise<void>
  
  setSelectedDestination: (destination: Destination | null, origin?: SelectionOrigin) => void
  setSelectedDay: (dayId: string) => void
  setDayLocation: (dayId: string, location: DayLocation | null) => Promise<void>
  addBaseLocation: (dayId: string, location: DayLocation) => Promise<void>
  removeBaseLocation: (dayId: string, locationIndex: number) => Promise<void>
  updateBaseLocation: (dayId: string, locationIndex: number, location: DayLocation) => Promise<void>
  reorderBaseLocations: (dayId: string, fromIndex: number, toIndex: number) => Promise<void>
  duplicateBaseLocation: (sourceDayId: string, locationIndex: number, targetDayIds: string[]) => Promise<void>
  duplicateDestination: (sourceDayId: string, destinationId: string, targetDayIds: string[]) => Promise<void>

  moveDestination: (destinationId: string, fromDayId: string, toDayId: string, newIndex: number) => Promise<void>
  reorderDestinations: (dayId: string, startIndex: number, endIndex: number) => Promise<void>
  updateTripDates: (startDate: Date, endDate: Date) => Promise<void>
  ensureDayCount: (desiredCount: number) => Promise<void>

  // Trip selection
  setCurrentTripById: (tripId: string) => Promise<void>

  // Selection actions
  setSelectedCard: (cardId: string | null) => void
  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin?: SelectionOrigin) => void
  setSelectedRouteSegmentId: (routeId: string | null) => void
  setShowDayRouteOverlay: (show: boolean) => void
  setShowAllDestinations: (show: boolean) => void
  toggleShowAllDestinations: () => void
  toggleDayRouteOverlay: () => void
  setRouteModeEnabled: (enabled: boolean) => void
  setRouteProfile: (profile: RouteProfile) => void
  registerRouteSelection: (point: MapRouteSelectionPoint) => void
  clearAdHocRoute: () => void
  setAdHocRouteResult: (result: AdHocRouteResult | null) => void
  
  // Maybe locations actions
  addMaybeLocation: (destination: Destination) => void
  removeMaybeLocation: (destinationId: string) => void
  moveMaybeToDay: (destinationId: string, dayId: string) => Promise<void>
  setMaybeFavorite: (destinationId: string, isFavorite: boolean) => void
  
  
  // Utility
 setError: (error: string | null) => void
 clearError: () => void
}

export const useSupabaseTripStore = create<SupabaseTripStore>((set, get) => {
  const setLoading = (key: keyof SupabaseTripStore['loading'], value: boolean) => {
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    }))
  }

  return {
  // Initial state
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
  loading: {
    trips: false,
    tripMutation: false,
    destinationMutation: false,
  },
  
  // Selection state
  selectedCardId: null,
  selectedRouteSegmentId: null,
  showDayRouteOverlay: false,
  showAllDestinations: false,
  routeModeEnabled: false,
  routeSelectionStart: null,
  routeProfile: 'driving',
  adHocRouteConfig: null,
  adHocRouteResult: null,
  
  // Maybe locations state
  maybeLocations: [],

  // Load all trips for the user
  loadTrips: async (options) => {
    const state = get()
    const force = options?.force ?? false
    const preferredTripId = options?.preferredTripId ?? null
    if (state.loading.trips && !force) {
      return
    }

    debugTripStoreLog('SupabaseTripStore: Loading trips...')
    set({ error: null })
    setLoading('trips', true)
    try {
      const [trips, lastActiveFromPrefs] = await Promise.all([
        tripApi.getUserTrips(),
        tripApi.getLastActiveTripId().catch((error) => {
          console.warn('SupabaseTripStore: Unable to fetch last active trip preference', error)
          return null
        }),
      ])
      debugTripStoreLog('SupabaseTripStore: Trips loaded:', trips)
      
      // Set the first trip as current trip if none is selected
      const { currentTrip } = get()
      const targetTripId =
        preferredTripId ??
        lastActiveFromPrefs ??
        (currentTrip ? currentTrip.id : null)
      const newCurrentTrip = targetTripId
        ? trips.find(trip => trip.id === targetTripId) ?? (trips.length > 0 ? trips[0] : null)
        : (trips.length > 0 ? trips[0] : null)
      
      // Preserve selectedDayId if it's still valid, otherwise leave nothing selected
      const currentSelectedDayId = get().selectedDayId
      const isValidSelectedDay = newCurrentTrip?.days.some(day => day.id === currentSelectedDayId)
      const resolvedSelectedDayId = isValidSelectedDay
        ? currentSelectedDayId
        : newCurrentTrip?.days[0]?.id ?? null
      
      set((state) => {
        const currentTripId = state.currentTrip?.id ?? null
        const nextTripId = newCurrentTrip?.id ?? null
        const shouldResetRoute = currentTripId !== nextTripId

        return {
          trips,
          currentTrip: newCurrentTrip,
          selectedDayId: resolvedSelectedDayId,
          selectedDestination: null,
          selectedBaseLocation: null,
          selectionOrigin: null,
          hasLoadedTrips: true,
          lastActiveTripId: newCurrentTrip?.id ?? null,
          selectedCardId: shouldResetRoute ? null : state.selectedCardId,
          ...(shouldResetRoute
            ? {
                routeModeEnabled: false,
                routeSelectionStart: null,
                adHocRouteConfig: null,
                adHocRouteResult: null,
                selectedRouteSegmentId: null,
                showAllDestinations: false,
                showDayRouteOverlay: false,
              }
            : {}),
        }
      })
    } catch (error) {
      console.error('SupabaseTripStore: Error loading trips:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load trips',
        hasLoadedTrips: false,
        lastActiveTripId: null,
      })
    } finally {
      setLoading('trips', false)
    }
  },

  // Load a specific trip
  loadTrip: async (tripId: string) => {
    set({ error: null })
    setLoading('trips', true)
    try {
      const trip = await tripApi.getTrip(tripId)
      if (!trip) {
        set({
          error: 'Trip not found',
        })
        setLoading('trips', false)
        return
      }
      
      // Preserve selectedDayId if it's still valid, otherwise leave nothing selected
      const currentSelectedDayId = get().selectedDayId
      const isValidSelectedDay = trip.days.some(day => day.id === currentSelectedDayId)
      const nextSelectedDayId = isValidSelectedDay
        ? currentSelectedDayId
        : trip.days[0]?.id ?? null
      const currentTrips = get().trips
      const updatedTrips = currentTrips.some(existing => existing.id === trip.id)
        ? currentTrips.map(existing => (existing.id === trip.id ? trip : existing))
        : [...currentTrips, trip]
      
      set((state) => {
        const currentTripId = state.currentTrip?.id ?? null
        const nextTripId = trip.id ?? null
        const shouldResetRoute = currentTripId !== nextTripId

        return {
          currentTrip: trip,
          trips: updatedTrips,
          selectedDayId: nextSelectedDayId,
          selectedDestination: null,
          selectedBaseLocation: null,
          selectionOrigin: null,
          lastActiveTripId: trip.id,
          ...(shouldResetRoute
            ? {
                routeModeEnabled: false,
                routeSelectionStart: null,
                adHocRouteConfig: null,
                adHocRouteResult: null,
                selectedRouteSegmentId: null,
              }
            : {}),
        }
      })
      void tripApi.setLastActiveTrip(trip.id).catch(error => {
        console.error('SupabaseTripStore: Failed to persist active trip preference during loadTrip', error)
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load trip',
      })
    } finally {
      setLoading('trips', false)
    }
  },

  // Create a new trip
  createTrip: async (trip: Omit<Trip, 'id'>) => {
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      const tripId = await tripApi.createTrip(trip)
      await tripApi.setLastActiveTrip(tripId)
      await get().loadTrips({ force: true, preferredTripId: tripId })
      return tripId
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create trip',
      })
      throw error
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Update trip
  updateTrip: async (tripId: string, updates: Partial<Trip>) => {
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.updateTrip(tripId, updates)
      const refreshedTrip = await tripApi.getTrip(tripId)

      const { trips, currentTrip } = get()
      const updatedTrips = refreshedTrip
        ? trips.map(trip => (trip.id === tripId ? refreshedTrip : trip))
        : trips

      set({ 
        currentTrip: refreshedTrip ?? currentTrip,
        trips: updatedTrips,
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update trip',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Duplicate trip
  duplicateTrip: async (tripId: string, newName: string) => {
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      const newTripId = await tripApi.duplicateTrip(tripId, newName)
      await tripApi.setLastActiveTrip(newTripId)
      await get().loadTrips({ force: true, preferredTripId: newTripId })
      return newTripId
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to duplicate trip',
      })
      throw error
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Add destination to day
  addDestinationToDay: async (destination: Destination, dayId: string, options?: { index?: number }) => {
    debugTripStoreLog('SupabaseTripStore: Adding destination to day', { destination, dayId, options })
    set({ error: null })
    setLoading('destinationMutation', true)
    try {
      const createdDestination = await tripApi.addDestinationToDay(dayId, destination)
      debugTripStoreLog('SupabaseTripStore: Destination created in database', createdDestination)

      const { currentTrip, trips } = get()
      if (!currentTrip) {
        console.warn('SupabaseTripStore: No current trip found when adding destination')
        setLoading('destinationMutation', false)
        return
      }

      const targetDay = currentTrip.days.find((day) => day.id === dayId)
      if (!targetDay) {
        console.warn('SupabaseTripStore: Target day not found when adding destination', { dayId })
        setLoading('destinationMutation', false)
        return
      }

      const insertIndexRaw = options?.index ?? targetDay.destinations.length
      const insertIndex = Math.max(0, Math.min(targetDay.destinations.length, insertIndexRaw))
      const destinationsWithNew = [...targetDay.destinations]
      destinationsWithNew.splice(insertIndex, 0, createdDestination)

      await tripApi.reorderDestinations(dayId, destinationsWithNew.map((dest) => dest.id))

      const updatedTrip = {
        ...currentTrip,
        days: currentTrip.days.map((day) =>
          day.id === dayId ? { ...day, destinations: destinationsWithNew } : day
        ),
      }

      const updatedTrips = trips.map((trip) => (trip.id === currentTrip.id ? updatedTrip : trip))

      debugTripStoreLog('SupabaseTripStore: Updating local state with new destination', {
        dayId,
        insertIndex,
        newDestinationCount: destinationsWithNew.length,
      })

      set({
        currentTrip: updatedTrip,
        trips: updatedTrips,
        lastUpdate: Date.now(),
      })
    } catch (error) {
      console.error('SupabaseTripStore: Error adding destination', {
        message: error instanceof Error ? error.message : 'Unknown error',
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code,
        fullError: error,
      })
      set({
        error: error instanceof Error ? error.message : 'Failed to add destination',
      })
    } finally {
      setLoading('destinationMutation', false)
    }
  },

  // Update destination
  updateDestination: async (dayId: string, destinationId: string, destination: Destination) => {
    debugTripStoreLog('SupabaseTripStore: Updating destination', { dayId, destinationId, destination })
    set({ error: null })
    setLoading('destinationMutation', true)
    try {
      const updatedDestination = await tripApi.updateDestination(destinationId, destination)
      debugTripStoreLog('SupabaseTripStore: Destination updated in database', updatedDestination)

      // Update local state
      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { 
                  ...day, 
                  destinations: day.destinations.map(dest => 
                    dest.id === destinationId ? updatedDestination : dest
                  )
                }
              : day
          )
        }
        
        set({ 
          currentTrip: updatedTrip,
          trips: trips.map(trip => trip.id === currentTrip.id ? updatedTrip : trip),
        })
      }
    } catch (error) {
      console.error('SupabaseTripStore: Error updating destination:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        dayId,
        destinationId,
        destination
      })
      set({ error: error instanceof Error ? error.message : 'Failed to update destination' })
    } finally {
      setLoading('destinationMutation', false)
    }
  },

  // Remove destination from day
  removeDestinationFromDay: async (destinationId: string, dayId: string) => {
    set({ error: null })
    setLoading('destinationMutation', true)
    try {
      await tripApi.removeDestinationFromDay(destinationId)
      
      // Update local state
      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { ...day, destinations: day.destinations.filter(dest => dest.id !== destinationId) }
              : day
          )
        }

        const updatedDay = updatedTrip.days.find(day => day.id === dayId)
        if (updatedDay) {
          await tripApi.reorderDestinations(dayId, updatedDay.destinations.map(dest => dest.id))
        }

        const updatedTrips = trips.map(trip =>
          trip.id === currentTrip.id
            ? {
                ...trip,
                days: trip.days.map(day =>
                  day.id === dayId
                    ? { ...day, destinations: day.destinations.filter(dest => dest.id !== destinationId) }
                    : day
                ),
              }
            : trip
        )

        set({ currentTrip: updatedTrip, trips: updatedTrips })
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to remove destination',
      })
    } finally {
      setLoading('destinationMutation', false)
    }
  },

  // Add new day
  addNewDay: async () => {
    const { currentTrip } = get()
    if (!currentTrip) return

    set({ error: null })
    setLoading('tripMutation', true)
    try {
      const lastDay = currentTrip.days[currentTrip.days.length - 1]
      const newDate = lastDay ? addDays(lastDay.date, 1) : currentTrip.startDate
      await tripApi.addDay(currentTrip.id, newDate)

      const refreshedTrip = await tripApi.getTrip(currentTrip.id)
      const { trips } = get()
      const updatedTrips = refreshedTrip
        ? trips.map(trip => (trip.id === currentTrip.id ? refreshedTrip : trip))
        : trips

      set({
        currentTrip: refreshedTrip ?? currentTrip,
        trips: updatedTrips,
        selectedDayId: refreshedTrip?.days[refreshedTrip.days.length - 1]?.id ?? null,
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add day',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Duplicate day
  duplicateDay: async (dayId: string) => {
    const { currentTrip } = get()
    if (!currentTrip) return

    set({ error: null })
    setLoading('tripMutation', true)
    try {
      const dayIndex = currentTrip.days.findIndex(day => day.id === dayId)
      if (dayIndex === -1) return

      await tripApi.duplicateDay(currentTrip.id, dayId)

      const refreshedTrip = await tripApi.getTrip(currentTrip.id)
      const { trips } = get()
      const updatedTrips = refreshedTrip
        ? trips.map(trip => (trip.id === currentTrip.id ? refreshedTrip : trip))
        : trips

      const newSelectedDayId = refreshedTrip?.days[dayIndex + 1]?.id ?? dayId

      set({
        currentTrip: refreshedTrip ?? currentTrip,
        trips: updatedTrips,
        selectedDayId: newSelectedDayId ?? null,
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to duplicate day',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Remove day
  removeDay: async (dayId: string) => {
    const { currentTrip, selectedBaseLocation, selectedDestination } = get()
    if (!currentTrip || currentTrip.days.length <= 1) return

    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.removeDay(currentTrip.id, dayId)

      const refreshedTrip = await tripApi.getTrip(currentTrip.id)
      const { trips } = get()
      const updatedTrips = refreshedTrip
        ? trips.map(trip => (trip.id === currentTrip.id ? refreshedTrip : trip))
        : trips

      const shouldClearBaseSelection = selectedBaseLocation?.dayId === dayId
      const remainingTrip = refreshedTrip ?? currentTrip
      const destinationStillExists = selectedDestination
        ? remainingTrip.days.some(day => day.destinations.some(dest => dest.id === selectedDestination.id))
        : false

      set({ 
        currentTrip: remainingTrip,
        trips: updatedTrips,
        selectedDayId: refreshedTrip?.days[0]?.id ?? null,
        selectedBaseLocation: shouldClearBaseSelection ? null : selectedBaseLocation,
        selectedDestination: destinationStillExists ? selectedDestination : null,
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to remove day',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  updateDayNotes: async (dayId: string, notes: string) => {
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      const trimmed = notes.trim()
      const notesToPersist = trimmed.length > 0 ? notes : null

      await tripApi.setDayNotes(dayId, notesToPersist)

      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day =>
            day.id === dayId
              ? { ...day, notes: notesToPersist ?? '' }
              : day
          ),
        }

        set({
          currentTrip: updatedTrip,
          trips: trips.map(trip => (trip.id === updatedTrip.id ? updatedTrip : trip)),
          lastUpdate: Date.now(),
        })
      }
    } catch (error) {
      console.error('SupabaseTripStore: Failed to update day notes', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to update day notes',
      })
      throw error
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Set selected destination
  setSelectedDestination: (destination: Destination | null, origin: SelectionOrigin = 'timeline') => {
    set((state) => ({
      selectedDestination: destination,
      selectedBaseLocation: destination ? null : state.selectedBaseLocation,
      selectionOrigin: destination ? origin : null,
      selectedRouteSegmentId: destination ? null : state.selectedRouteSegmentId,
    }))
  },

  // Set selected day
  setSelectedDay: (dayId: string) => {
    set({ selectedDayId: dayId, selectedRouteSegmentId: null })
  },

  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin: SelectionOrigin = 'timeline') => {
    set((state) => ({
      selectedBaseLocation: payload,
      selectedDestination: payload ? null : state.selectedDestination,
      selectionOrigin: payload ? origin : null,
      selectedRouteSegmentId: payload ? null : state.selectedRouteSegmentId,
    }))
  },

  // Set day location (for backward compatibility - sets first base location)
  setDayLocation: async (dayId: string, location: DayLocation | null) => {
    debugTripStoreLog('SupabaseTripStore: Setting day location', { dayId, location })
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.setDayLocation(dayId, location)
      debugTripStoreLog('SupabaseTripStore: Day location updated in database')
      
      // Update local state
      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { 
                  ...day, 
                  baseLocations: location ? [location] : []
                } 
              : day
          )
        }
        const updatedTrips = trips.map(trip =>
          trip.id === currentTrip.id
            ? {
                ...trip,
                days: trip.days.map(day =>
                  day.id === dayId 
                    ? { 
                        ...day, 
                        baseLocations: location ? [location] : []
                      } 
                    : day
                ),
              }
            : trip
        )
        
        const { selectedBaseLocation } = get()
        let nextSelectedBaseLocation = selectedBaseLocation
        if (location) {
          nextSelectedBaseLocation = { dayId, index: 0 }
        } else if (selectedBaseLocation?.dayId === dayId) {
          nextSelectedBaseLocation = null
        }

        debugTripStoreLog('SupabaseTripStore: Updating local state with new location', { 
          dayId, 
          locationName: location?.name 
        })
        
        set({ 
          currentTrip: updatedTrip, 
          trips: updatedTrips, 
          selectedBaseLocation: nextSelectedBaseLocation,
          selectedDestination: nextSelectedBaseLocation ? null : get().selectedDestination,
          lastUpdate: Date.now()
        })
      } else {
        console.warn('SupabaseTripStore: No current trip found when setting day location')
      }
    } catch (error) {
      console.error('SupabaseTripStore: Error setting day location', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to set day location',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Add base location to day
  addBaseLocation: async (dayId: string, location: DayLocation) => {
    debugTripStoreLog('SupabaseTripStore: Adding base location', { dayId, location })
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.addBaseLocation(dayId, location)
      debugTripStoreLog('SupabaseTripStore: Base location added to database')
      
      // Update local state
      const { currentTrip, trips, selectedBaseLocation, selectedDestination } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { 
                  ...day, 
                  baseLocations: [...day.baseLocations, location]
                } 
              : day
          )
        }
        const updatedTrips = trips.map(trip =>
          trip.id === currentTrip.id
            ? {
                ...trip,
                days: trip.days.map(day =>
                  day.id === dayId 
                    ? { 
                        ...day, 
                        baseLocations: [...day.baseLocations, location]
                      } 
                    : day
                ),
              }
            : trip
        )
        
        set({
          currentTrip: updatedTrip,
          trips: updatedTrips,
          selectedBaseLocation,
          selectedDestination: selectedBaseLocation ? null : selectedDestination,
          lastUpdate: Date.now()
        })
      }
    } catch (error) {
      console.error('SupabaseTripStore: Error adding base location:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add base location',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Remove base location from day
  removeBaseLocation: async (dayId: string, locationIndex: number) => {
    debugTripStoreLog('SupabaseTripStore: Removing base location', { dayId, locationIndex })
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.removeBaseLocation(dayId, locationIndex)
      debugTripStoreLog('SupabaseTripStore: Base location removed from database')
      
      // Update local state
      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { 
                  ...day, 
                  baseLocations: day.baseLocations.filter((_, index) => index !== locationIndex)
                } 
              : day
          )
        }
        const updatedTrips = trips.map(trip =>
          trip.id === currentTrip.id
            ? {
                ...trip,
                days: trip.days.map(day =>
                  day.id === dayId 
                    ? { 
                        ...day, 
                        baseLocations: day.baseLocations.filter((_, index) => index !== locationIndex)
                      } 
                    : day
                ),
              }
            : trip
        )
        
        set({
          currentTrip: updatedTrip,
          trips: updatedTrips,
          lastUpdate: Date.now()
        })
      }
    } catch (error) {
      console.error('SupabaseTripStore: Error removing base location:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to remove base location',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Update base location
  updateBaseLocation: async (dayId: string, locationIndex: number, location: DayLocation) => {
    debugTripStoreLog('SupabaseTripStore: Updating base location', { dayId, locationIndex, location })
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.updateBaseLocation(dayId, locationIndex, location)
      debugTripStoreLog('SupabaseTripStore: Base location updated in database')
      
      // Update local state
      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { 
                  ...day, 
                  baseLocations: day.baseLocations.map((loc, index) => 
                    index === locationIndex ? location : loc
                  )
                } 
              : day
          )
        }
        const updatedTrips = trips.map(trip =>
          trip.id === currentTrip.id
            ? {
                ...trip,
                days: trip.days.map(day =>
                  day.id === dayId 
                    ? { 
                        ...day, 
                        baseLocations: day.baseLocations.map((loc, index) => 
                          index === locationIndex ? location : loc
                        )
                      } 
                    : day
                ),
              }
            : trip
        )
        
        set({
          currentTrip: updatedTrip,
          trips: updatedTrips,
          lastUpdate: Date.now()
        })
      }
    } catch (error) {
      console.error('SupabaseTripStore: Error updating base location:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update base location',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Reorder base locations
  reorderBaseLocations: async (dayId: string, fromIndex: number, toIndex: number) => {
    debugTripStoreLog('SupabaseTripStore: Reordering base locations', { dayId, fromIndex, toIndex })
    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.reorderBaseLocations(dayId, fromIndex, toIndex)
      debugTripStoreLog('SupabaseTripStore: Base locations reordered in database')
      
      // Update local state
      const { currentTrip, trips } = get()
      if (currentTrip) {
        const updatedTrip = {
          ...currentTrip,
          days: currentTrip.days.map(day => 
            day.id === dayId 
              ? { 
                  ...day, 
                  baseLocations: (() => {
                    const newBaseLocations = [...day.baseLocations]
                    const [movedLocation] = newBaseLocations.splice(fromIndex, 1)
                    newBaseLocations.splice(toIndex, 0, movedLocation)
                    return newBaseLocations
                  })()
                } 
              : day
          )
        }
        const updatedTrips = trips.map(trip =>
          trip.id === currentTrip.id
            ? {
                ...trip,
                days: trip.days.map(day =>
                  day.id === dayId 
                    ? { 
                        ...day, 
                        baseLocations: (() => {
                          const newBaseLocations = [...day.baseLocations]
                          const [movedLocation] = newBaseLocations.splice(fromIndex, 1)
                          newBaseLocations.splice(toIndex, 0, movedLocation)
                          return newBaseLocations
                        })()
                      } 
                    : day
                ),
              }
            : trip
        )
        
        set({
          currentTrip: updatedTrip,
          trips: updatedTrips,
          lastUpdate: Date.now()
        })
      }
    } catch (error) {
      console.error('SupabaseTripStore: Error reordering base locations:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reorder base locations',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  // Move destination between days
  moveDestination: async (destinationId: string, fromDayId: string, toDayId: string, newIndex: number) => {
    const { currentTrip } = get()
    if (!currentTrip) return

    set({ error: null })
    try {
      // Find the destination
      const fromDay = currentTrip.days.find(day => day.id === fromDayId)
      const destination = fromDay?.destinations.find(dest => dest.id === destinationId)
      
      if (!destination || !fromDay) return

      // Remove from source day
      const updatedFromDay = {
        ...fromDay,
        destinations: fromDay.destinations.filter(dest => dest.id !== destinationId)
      }

      // Add to target day
      const toDay = currentTrip.days.find(day => day.id === toDayId)
      if (!toDay) return

      const updatedToDayDestinations = [...toDay.destinations]
      const targetIndex = Math.max(0, Math.min(updatedToDayDestinations.length, newIndex))
      updatedToDayDestinations.splice(targetIndex, 0, destination)
      const updatedToDay = {
        ...toDay,
        destinations: updatedToDayDestinations
      }

      const updatedTrip = {
        ...currentTrip,
        days: currentTrip.days.map(day => 
          day.id === fromDayId ? updatedFromDay :
          day.id === toDayId ? updatedToDay : day
        )
      }

      await tripApi.moveDestination(destinationId, toDayId)

      const fromDayDestIds = updatedFromDay.destinations.map(dest => dest.id)
      const toDayDestIds = updatedToDayDestinations.map(dest => dest.id)

      if (fromDayDestIds.length) {
        await tripApi.reorderDestinations(fromDayId, fromDayDestIds)
      }
      await tripApi.reorderDestinations(toDayId, toDayDestIds)

      const { trips } = get()
      const updatedTrips = trips.map(trip =>
        trip.id === currentTrip.id
          ? {
              ...trip,
              days: trip.days.map(day => {
                if (day.id === fromDayId) {
                  return { ...day, destinations: updatedFromDay.destinations }
                }
                if (day.id === toDayId) {
                  return { ...day, destinations: updatedToDayDestinations }
                }
                return day
              }),
            }
          : trip
      )

      set({ currentTrip: updatedTrip, trips: updatedTrips, lastUpdate: Date.now() })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to move destination',
      })
    }
  },

  // Reorder destinations within a day
  reorderDestinations: async (dayId: string, startIndex: number, endIndex: number) => {
    const { currentTrip } = get()
    if (!currentTrip) return

    if (startIndex === endIndex) {
      return
    }

    set({ error: null })
    try {
      const day = currentTrip.days.find(day => day.id === dayId)
      if (!day) {
        return
      }

      const destinations = [...day.destinations]
      const maxIndex = Math.max(destinations.length - 1, 0)
      const safeStart = Math.max(0, Math.min(maxIndex, startIndex))
      const safeEnd = Math.max(0, Math.min(maxIndex, endIndex))

      if (safeStart === safeEnd) {
        return
      }

      const [movedDestination] = destinations.splice(safeStart, 1)
      if (!movedDestination) {
        return
      }
      destinations.splice(safeEnd, 0, movedDestination)

      const updatedTrip = {
        ...currentTrip,
        days: currentTrip.days.map(d => 
          d.id === dayId ? { ...d, destinations } : d
        )
      }

      // Update order indices in database
      await tripApi.reorderDestinations(dayId, destinations.map(dest => dest.id))
      
      const { trips } = get()
      const updatedTrips = trips.map(trip =>
        trip.id === currentTrip.id
          ? {
              ...trip,
              days: trip.days.map(d =>
                d.id === dayId ? { ...d, destinations } : d
              ),
            }
          : trip
      )

      set({ currentTrip: updatedTrip, trips: updatedTrips, lastUpdate: Date.now() })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reorder destinations',
      })
    }
  },

  // Update trip dates
  updateTripDates: async (startDate: Date, endDate: Date) => {
    const { currentTrip } = get()
    if (!currentTrip) return

    set({ error: null })
    setLoading('tripMutation', true)
    try {
      await tripApi.updateTripDates(currentTrip.id, startDate, endDate)

      const refreshedTrip = await tripApi.getTrip(currentTrip.id)
      const { trips, selectedDayId: currentSelectedDayId } = get()
      const nextTrip = refreshedTrip ?? currentTrip
      const nextSelectedDayId = (() => {
        const days = nextTrip?.days ?? []
        if (!days.length) return null
        const stillValid = currentSelectedDayId && days.some(day => day.id === currentSelectedDayId)
        return stillValid ? currentSelectedDayId : days[0].id
      })()

      const updatedTrips = refreshedTrip
        ? trips.map(trip => (trip.id === currentTrip.id ? refreshedTrip : trip))
        : trips

      set({
        currentTrip: nextTrip,
        trips: updatedTrips,
        selectedDayId: nextSelectedDayId,
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update trip dates',
      })
    } finally {
      setLoading('tripMutation', false)
    }
  },

  ensureDayCount: async (desiredCount: number) => {
    if (!Number.isFinite(desiredCount) || desiredCount <= 0) {
      return
    }

    const state = get()
    const trip = state.currentTrip
    if (!trip) return

    const start = trip.startDate ? new Date(trip.startDate) : null
    if (!start || Number.isNaN(start.getTime())) {
      return
    }

    start.setHours(0, 0, 0, 0)

    const currentCount = trip.days.length
    if (currentCount === desiredCount) {
      return
    }

    const targetEnd = addDays(start, desiredCount - 1)
    await state.updateTripDates(start, targetEnd)
  },

  setCurrentTripById: async (tripId: string) => {
    const state = get()
    const nextTrip = state.trips.find(trip => trip.id === tripId)
    if (!nextTrip) {
      console.warn('SupabaseTripStore: Attempted to select unknown trip', { tripId })
      return
    }

    const previousTripId = state.currentTrip?.id ?? null
    const nextFirstDayId = nextTrip.days[0]?.id ?? null

    set({
      currentTrip: nextTrip,
      selectedDayId: nextFirstDayId,
      selectedDestination: null,
      selectedBaseLocation: null,
      selectionOrigin: null,
      selectedCardId: null,
      selectedRouteSegmentId: null,
      routeSelectionStart: null,
      adHocRouteConfig: null,
      adHocRouteResult: null,
      lastActiveTripId: nextTrip.id,
      ...(previousTripId !== nextTrip.id
        ? {
            routeModeEnabled: false,
            showDayRouteOverlay: false,
            showAllDestinations: false,
          }
        : {}),
    })

    try {
      await tripApi.setLastActiveTrip(tripId)
    } catch (error) {
      console.error('SupabaseTripStore: Failed to persist active trip preference', error)
    }
  },

  // Set error
  setError: (error: string | null) => {
    set({ error })
  },

  // Clear error
  clearError: () => {
    set({ error: null })
  },

  // Set selected card
  setSelectedCard: (cardId: string | null) => {
    set({ selectedCardId: cardId })
  },

  setSelectedRouteSegmentId: (routeId: string | null) => {
    set({ selectedRouteSegmentId: routeId })
  },

  setShowDayRouteOverlay: (show: boolean) => {
    set({ showDayRouteOverlay: show })
  },

  toggleDayRouteOverlay: () => {
    set((state) => ({ showDayRouteOverlay: !state.showDayRouteOverlay }))
  },

  setShowAllDestinations: (show: boolean) => {
    set({ showAllDestinations: show })
  },

  toggleShowAllDestinations: () => {
    set((state) => ({ showAllDestinations: !state.showAllDestinations }))
  },

  setRouteModeEnabled: (enabled: boolean) => {
    set((state) => {
      if (state.routeModeEnabled === enabled) {
        return {}
      }

      if (!enabled) {
        return {
          routeModeEnabled: false,
          routeSelectionStart: null,
          adHocRouteConfig: null,
          adHocRouteResult: null,
          selectedRouteSegmentId: null,
        }
      }

      return {
        routeModeEnabled: true,
        routeSelectionStart: null,
        adHocRouteConfig: null,
        adHocRouteResult: null,
        selectedRouteSegmentId: null,
      }
    })
  },

  setRouteProfile: (profile: RouteProfile) => {
    set((state) => {
      if (state.routeProfile === profile) {
        return {}
      }

      if (!state.routeModeEnabled) {
        return { routeProfile: profile }
      }

      if (state.adHocRouteConfig) {
        return {
          routeProfile: profile,
          adHocRouteConfig: {
            ...state.adHocRouteConfig,
            profile,
          },
          adHocRouteResult: null,
        }
      }

      return { routeProfile: profile }
    })
  },

  registerRouteSelection: (point: MapRouteSelectionPoint) => {
    set((state) => {
      if (!state.routeModeEnabled) {
        return {}
      }

      const currentStart = state.routeSelectionStart
      const resetState = {
        adHocRouteConfig: null,
        adHocRouteResult: null,
        selectedRouteSegmentId: null,
      }

      if (!currentStart) {
        return {
          ...resetState,
          routeSelectionStart: point,
        }
      }

      const isSameSelection =
        currentStart.id === point.id &&
        currentStart.source === point.source &&
        currentStart.coordinates[0] === point.coordinates[0] &&
        currentStart.coordinates[1] === point.coordinates[1]

      if (isSameSelection) {
        return {
          ...resetState,
          routeSelectionStart: null,
        }
      }

      const routeId = `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      return {
        routeSelectionStart: null,
        adHocRouteConfig: {
          id: routeId,
          from: currentStart,
          to: point,
          profile: state.routeProfile,
        },
        adHocRouteResult: null,
        selectedRouteSegmentId: routeId,
      }
    })
  },

  clearAdHocRoute: () => {
    set({
      routeSelectionStart: null,
      adHocRouteConfig: null,
      adHocRouteResult: null,
      selectedRouteSegmentId: null,
    })
  },

  setAdHocRouteResult: (result: AdHocRouteResult | null) => {
    set((state) => ({
      adHocRouteResult: result,
      selectedRouteSegmentId: result?.id ?? state.selectedRouteSegmentId,
    }))
  },

  // Maybe locations actions
  addMaybeLocation: (destination: Destination) => {
    const { maybeLocations } = get()
    const exists = maybeLocations.some(loc => loc.id === destination.id)
    if (!exists) {
      set({ maybeLocations: [...maybeLocations, destination] })
    }
  },

  removeMaybeLocation: (destinationId: string) => {
    const { maybeLocations } = get()
    set({ maybeLocations: maybeLocations.filter(loc => loc.id !== destinationId) })
  },
  setMaybeFavorite: (destinationId: string, isFavorite: boolean) => {
    set((state) => ({
      maybeLocations: state.maybeLocations.map((location) =>
        location.id === destinationId
          ? { ...location, isFavorite }
          : location
      ),
    }))
  },

  moveMaybeToDay: async (destinationId: string, dayId: string) => {
    const { maybeLocations, currentTrip } = get()
    const destination = maybeLocations.find(loc => loc.id === destinationId)
    
    if (!destination || !currentTrip) return

    try {
      // Add destination to the day
      await get().addDestinationToDay(destination, dayId)
      
      // Remove from maybe locations
      get().removeMaybeLocation(destinationId)
    } catch (error) {
      console.error('Error moving maybe location to day:', error)
    }
  },

  duplicateBaseLocation: async (sourceDayId: string, locationIndex: number, targetDayIds: string[]) => {
    const uniqueTargets = Array.from(new Set(targetDayIds.filter(id => id && id !== sourceDayId)))
    if (uniqueTargets.length === 0) {
      return
    }

    debugTripStoreLog('SupabaseTripStore: Duplicating base location', { sourceDayId, locationIndex, targetDayIds: uniqueTargets })
    set({ error: null })
    setLoading('tripMutation', true)

    try {
      const { currentTrip, trips } = get()
      if (!currentTrip) {
        throw new Error('No active trip selected')
      }

      const sourceDay = currentTrip.days.find(day => day.id === sourceDayId)
      if (!sourceDay) {
        throw new Error('Source day not found')
      }

      const baseLocation = sourceDay.baseLocations[locationIndex]
      if (!baseLocation) {
        throw new Error('Accommodation to duplicate was not found')
      }

      const generateLinkId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID()
        }
        return `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }

      const cloneLocation = (): DayLocation => ({
        ...baseLocation,
        links: baseLocation.links
          ? baseLocation.links.map(link => ({
              ...link,
              id: generateLinkId(),
            }))
          : undefined,
      })

      const createdLocations: Record<string, DayLocation> = {}

      for (const targetDayId of uniqueTargets) {
        const targetDayExists = currentTrip.days.some(day => day.id === targetDayId)
        if (!targetDayExists) {
          console.warn('SupabaseTripStore: Target day not found while duplicating accommodation', { targetDayId })
          continue
        }

        const targetDay = currentTrip.days.find(day => day.id === targetDayId)
        if (!targetDay) {
          continue
        }

        const clonedLocation = cloneLocation()
        if (targetDay.baseLocations.length > 0) {
          await tripApi.updateBaseLocation(targetDayId, 0, clonedLocation)
        } else {
          await tripApi.addBaseLocation(targetDayId, clonedLocation)
        }
        createdLocations[targetDayId] = clonedLocation
      }

      if (Object.keys(createdLocations).length === 0) {
        return
      }

      const updateDays = (days: Trip['days']) =>
        days.map(day =>
          createdLocations[day.id]
            ? {
                ...day,
                baseLocations: [createdLocations[day.id]],
              }
            : day
        )

      const updatedTrip: Trip = {
        ...currentTrip,
        days: updateDays(currentTrip.days),
      }

      const updatedTrips = trips.map(trip =>
        trip.id === currentTrip.id
          ? {
              ...trip,
              days: updateDays(trip.days),
            }
          : trip
      )

      set({
        currentTrip: updatedTrip,
        trips: updatedTrips,
        lastUpdate: Date.now(),
      })
    } catch (error) {
      console.error('SupabaseTripStore: Error duplicating base location:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to duplicate accommodation',
      })
      throw error
    } finally {
      setLoading('tripMutation', false)
    }
  },

  duplicateDestination: async (sourceDayId: string, destinationId: string, targetDayIds: string[]) => {
    const uniqueTargets = Array.from(new Set(targetDayIds.filter(id => id && id !== sourceDayId)))
    if (uniqueTargets.length === 0) {
      return
    }

    debugTripStoreLog('SupabaseTripStore: Duplicating destination', { sourceDayId, destinationId, targetDayIds: uniqueTargets })
    set({ error: null })
    setLoading('destinationMutation', true)

    try {
      const { currentTrip, trips } = get()
      if (!currentTrip) {
        throw new Error('No active trip selected')
      }

      const sourceDay = currentTrip.days.find(day => day.id === sourceDayId)
      if (!sourceDay) {
        throw new Error('Source day not found')
      }

      const destination = sourceDay.destinations.find(dest => dest.id === destinationId)
      if (!destination) {
        throw new Error('Destination to duplicate was not found')
      }

      const generateLinkId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID()
        }
        return `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }

      const cloneDestination = (): Destination => ({
        ...destination,
        links: destination.links
          ? destination.links.map(link => ({
              ...link,
              id: generateLinkId(),
            }))
          : undefined,
      })

      const createdDestinations: Record<string, Destination[]> = {}

      for (const targetDayId of uniqueTargets) {
        const targetDayExists = currentTrip.days.some(day => day.id === targetDayId)
        if (!targetDayExists) {
          console.warn('SupabaseTripStore: Target day not found while duplicating destination', { targetDayId })
          continue
        }

        const destinationInput = cloneDestination()
        const createdDestination = await tripApi.addDestinationToDay(targetDayId, destinationInput)
        if (!createdDestinations[targetDayId]) {
          createdDestinations[targetDayId] = []
        }
        createdDestinations[targetDayId].push(createdDestination)
      }

      if (Object.keys(createdDestinations).length === 0) {
        return
      }

      const updateDays = (days: Trip['days']) =>
        days.map(day =>
          createdDestinations[day.id]
            ? {
                ...day,
                destinations: [...day.destinations, ...createdDestinations[day.id]],
              }
            : day
        )

      const updatedTrip: Trip = {
        ...currentTrip,
        days: updateDays(currentTrip.days),
      }

      const updatedTrips = trips.map(trip =>
        trip.id === currentTrip.id
          ? {
              ...trip,
              days: updateDays(trip.days),
            }
          : trip
      )

      set({
        currentTrip: updatedTrip,
        trips: updatedTrips,
        lastUpdate: Date.now(),
      })
    } catch (error) {
      console.error('SupabaseTripStore: Error duplicating destination:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to duplicate destination',
      })
      throw error
    } finally {
      setLoading('destinationMutation', false)
    }
  },
  }
});
