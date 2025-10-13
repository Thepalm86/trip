'use client'

import { useEffect, useRef } from 'react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useAuth } from '@/lib/auth/auth-context'

export function TripLoader() {
  const { user } = useAuth()
  const loadTripsRef = useRef(useSupabaseTripStore.getState().loadTrips)
  const createTripRef = useRef(useSupabaseTripStore.getState().createTrip)

  useEffect(() => {
    loadTripsRef.current = useSupabaseTripStore.getState().loadTrips
    createTripRef.current = useSupabaseTripStore.getState().createTrip
  })

  const hasEnsuredTripRef = useRef(false)

  useEffect(() => {
    if (!user) return
    if (hasEnsuredTripRef.current) return
    hasEnsuredTripRef.current = true

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
          const today = new Date()
          const defaultTrip = {
            name: 'My First Trip',
            startDate: today,
            endDate: today,
            country: '',
            days: [],
          }

          await createTripRef.current(defaultTrip)
        }
      } catch (error) {
        console.error('TripLoader: Error ensuring trips:', error)
      }
    }

    ensureTrip()

    return () => {
      cancelled = true
    }
  }, [user])

  return null // This component doesn't render anything
}
