'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useAuth } from '@/lib/auth/auth-context'

export function TripLoader() {
  const { user } = useAuth()
  const router = useRouter()
  const loadTripsRef = useRef(useSupabaseTripStore.getState().loadTrips)

  useEffect(() => {
    loadTripsRef.current = useSupabaseTripStore.getState().loadTrips
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

    const ensureTripsLoaded = async () => {
      try {
        const store = useSupabaseTripStore.getState()
        if (!store.hasLoadedTrips && !store.isLoading) {
          await loadTripsRef.current()
        }
        if (cancelled) return

        const { currentTrip, trips } = useSupabaseTripStore.getState()
        if (!currentTrip && trips.length === 0) {
          router.replace('/setup')
        }
      } catch (error) {
        console.error('TripLoader: Error loading trips:', error)
        ensuredUserIdRef.current = null
      }
    }

    ensureTripsLoaded()

    return () => {
      cancelled = true
    }
  }, [router, user])

  return null
}
