'use client'

import { useEffect } from 'react'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useAuth } from '@/lib/auth/auth-context'

export function TripLoader() {
  const { user } = useAuth()
  const { loadTrips, createTrip } = useSupabaseTripStore()

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const ensureTrip = async () => {
      console.log('TripLoader: User authenticated, loading trips...')
      try {
        await loadTrips()
        if (cancelled) return

        const { currentTrip, trips } = useSupabaseTripStore.getState()

        if (!currentTrip && trips.length === 0) {
          console.log('TripLoader: No trips found, creating default trip...')
          const today = new Date()
          const defaultTrip = {
            name: 'My First Trip',
            startDate: today,
            endDate: today,
            country: 'IT',
            days: [],
          }

          await createTrip(defaultTrip)
        }
      } catch (error) {
        console.error('TripLoader: Error ensuring trips:', error)
      }
    }

    ensureTrip()

    return () => {
      cancelled = true
    }
  }, [user, loadTrips, createTrip])

  return null // This component doesn't render anything
}
