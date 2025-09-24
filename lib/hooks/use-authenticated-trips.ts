'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

export function useAuthenticatedTrips() {
  const { user, loading: authLoading } = useAuth()
  const { 
    loadTrips, 
    trips, 
    currentTrip, 
    isLoading, 
    error,
    createTrip,
    updateTrip,
    addDestinationToDay,
    removeDestinationFromDay,
    setDayLocation,
    duplicateDay,
    removeDay,
    addNewDay,
    moveDestination,
    reorderDestinations,
    updateTripDates
  } = useSupabaseTripStore()

  // Load trips when user is authenticated
  useEffect(() => {
    if (user && !authLoading) {
      loadTrips()
    }
  }, [user, authLoading, loadTrips])

  return {
    // Auth state
    user,
    isAuthenticated: !!user,
    authLoading,
    
    // Trip state
    trips,
    currentTrip,
    isLoading,
    error,
    
    // Trip actions
    createTrip,
    updateTrip,
    addDestinationToDay,
    removeDestinationFromDay,
    setDayLocation,
    duplicateDay,
    removeDay,
    addNewDay,
    moveDestination,
    reorderDestinations,
    updateTripDates,
    loadTrips
  }
}
