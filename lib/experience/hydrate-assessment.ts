import type { Trip } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import type { NewUserAssessmentResult } from '@/lib/experience/assessment-types'
import { addDays } from '@/lib/utils'

export async function hydrateTripFromAssessment(result: NewUserAssessmentResult) {
  const store = useSupabaseTripStore.getState()
  let { currentTrip, updateTrip, updateTripDates, ensureDayCount, loadTrips } = store

  if (!currentTrip && loadTrips) {
    try {
      await loadTrips()
    } catch (error) {
      console.error('hydrateTripFromAssessment: loadTrips failed', error)
    }
    const nextState = useSupabaseTripStore.getState()
    currentTrip = nextState.currentTrip
    updateTrip = nextState.updateTrip
    updateTripDates = nextState.updateTripDates
    ensureDayCount = nextState.ensureDayCount
  }

  if (!currentTrip) {
    return
  }

  const firstDestination = result.destinations[0]
  const desiredDayCount = Math.max(result.durationDays, 1)

  try {
    if (firstDestination) {
      const desiredName = `Trip to ${firstDestination.name}`
      const updates: Partial<Trip> = {}

      if (currentTrip.name !== desiredName) {
        updates.name = desiredName
      }
      if (firstDestination.country && currentTrip.country !== firstDestination.country) {
        updates.country = firstDestination.country
      }

      if (Object.keys(updates).length > 0) {
        await updateTrip(currentTrip.id, updates)
      }
    }

    if (result.datesKnown && result.startDate && result.endDate) {
      const start = new Date(result.startDate)
      const end = new Date(result.endDate)

      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        await updateTripDates(start, end)
        await ensureDayCount(desiredDayCount)
      }
    } else {
      if (desiredDayCount > 0) {
        const baseStart = currentTrip.startDate ? new Date(currentTrip.startDate) : new Date()
        baseStart.setHours(0, 0, 0, 0)
        const calculatedEnd = addDays(baseStart, desiredDayCount - 1)
        await updateTripDates(baseStart, calculatedEnd)
        await ensureDayCount(desiredDayCount)
      }
    }
  } catch (error) {
    console.error('hydrateTripFromAssessment: Failed', error)
  } finally {
    try {
      await useSupabaseTripStore.getState().loadTrips()
    } catch (error) {
      console.error('hydrateTripFromAssessment: loadTrips refresh failed', error)
    }
  }
}
