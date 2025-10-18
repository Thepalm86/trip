'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/auth/auth-guard'
import { SetupWizard } from '@/components/setup/SetupWizard'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

export function SetupPageClient() {
  const router = useRouter()
  const hasLoadedTrips = useSupabaseTripStore((state) => state.hasLoadedTrips)
  const isTripsLoading = useSupabaseTripStore((state) => state.loading.trips)
  const trips = useSupabaseTripStore((state) => state.trips)
  const loadTrips = useSupabaseTripStore((state) => state.loadTrips)
  const forceSetupRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const flag = window.sessionStorage.getItem('trip3:force-setup')
    if (flag) {
      forceSetupRef.current = true
      window.sessionStorage.removeItem('trip3:force-setup')
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedTrips && !isTripsLoading) {
      void loadTrips()
    }
  }, [hasLoadedTrips, isTripsLoading, loadTrips])

  useEffect(() => {
    if (hasLoadedTrips && trips.length > 0) {
      if (forceSetupRef.current) {
        return
      }
      router.replace('/')
    }
  }, [hasLoadedTrips, router, trips.length])

  return (
    <AuthGuard>
      <SetupWizard />
    </AuthGuard>
  )
}
