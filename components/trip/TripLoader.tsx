'use client'

import { useEffect, useRef } from 'react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { addDays } from '@/lib/utils'
import { useAuth } from '@/lib/auth/auth-context'

export function TripLoader() {
  const { user } = useAuth()
  const loadTripsRef = useRef(useSupabaseTripStore.getState().loadTrips)
  const createTripRef = useRef(useSupabaseTripStore.getState().createTrip)

  useEffect(() => {
    loadTripsRef.current = useSupabaseTripStore.getState().loadTrips
    createTripRef.current = useSupabaseTripStore.getState().createTrip
  })

  const ensuredUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      ensuredUserIdRef.current = null
      return
    }
    if (ensuredUserIdRef.current === user.id) {
      return
    }
    ensuredUserIdRef.current = user.id

    let cancelled = false

    const ensureTrip = async () => {
      console.log('TripLoader: User authenticated, loading trips...')
      try {
        const store = useSupabaseTripStore.getState()
        if (store.isLoading) {
          return
        }
        if (store.hasLoadedTrips && store.currentTrip) {
          return
        }

        await loadTripsRef.current()
        if (cancelled) return

        const { currentTrip, trips } = useSupabaseTripStore.getState()

        if (!currentTrip && trips.length === 0) {
          console.log('TripLoader: No trips found, creating default trip...')
          const startDate = new Date()
          const endDate = addDays(startDate, 1)
          const firstDayId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2)
          const secondDayId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2)
          const defaultTrip = {
            name: 'My First Trip',
            startDate,
            endDate,
            country: '',
            days: [
              {
                id: `temp-day-${firstDayId}`,
                dayOrder: 0,
                date: startDate,
                destinations: [],
                baseLocations: [],
                openSlots: [],
                notes: undefined,
              },
              {
                id: `temp-day-${secondDayId}`,
                dayOrder: 1,
                date: endDate,
                destinations: [],
                baseLocations: [],
                openSlots: [],
                notes: undefined,
              },
            ],
          }

          await createTripRef.current(defaultTrip)
        }
      } catch (error) {
        console.error('TripLoader: Error ensuring trips:', error)
        // Allow retry if initialization fails
        ensuredUserIdRef.current = null
      }
    }

    ensureTrip()

    return () => {
      cancelled = true
    }
  }, [user])

  return null // This component doesn't render anything
}
