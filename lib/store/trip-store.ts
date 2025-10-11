'use client'

import { create } from 'zustand'
import { Destination, TimelineDay, Trip, DayLocation } from '@/types'
import { generateId, addDays } from '@/lib/utils'

interface TripStore {
  // State
  currentTrip: Trip
  selectedDestination: Destination | null
  selectedBaseLocation: { dayId: string; index: number } | null
  selectedDayId: string | null
  selectionOrigin: 'map' | 'timeline' | 'preview' | null
  
  // Actions
  addDestinationToDay: (destination: Destination, dayId: string) => void
  removeDestinationFromDay: (destinationId: string, dayId: string) => void
  addNewDay: () => void
  duplicateDay: (dayId: string) => void
  removeDay: (dayId: string) => void
  setSelectedDestination: (destination: Destination | null, origin?: 'map' | 'timeline' | 'preview') => void
  setSelectedDay: (dayId: string) => void
  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin?: 'map' | 'timeline' | 'preview') => void
  setDayLocation: (dayId: string, location: DayLocation | null) => void
  moveDestination: (destinationId: string, fromDayId: string, toDayId: string, newIndex: number) => void
  reorderDestinations: (dayId: string, startIndex: number, endIndex: number) => void
  updateTripDates: (startDate: Date, endDate: Date) => void
}

const createInitialTrip = (): Trip => {
  const startDate = new Date()
  const days: TimelineDay[] = Array.from({ length: 3 }, (_, index) => ({
    id: generateId(),
    dayOrder: index,
    date: addDays(startDate, index),
    destinations: [],
    baseLocations: [],
    openSlots: [],
    notes: '',
  }))

  return {
    id: generateId(),
    name: 'Italy Adventure',
    startDate,
    endDate: days[days.length - 1]?.date ?? startDate,
    country: 'IT',
    days,
  }
}

const initialTrip = createInitialTrip()

const createEmptyDay = (startDate: Date, order: number): TimelineDay => ({
  id: generateId(),
  dayOrder: order,
  date: addDays(startDate, order),
  destinations: [],
  baseLocations: [],
  openSlots: [],
  notes: '',
})

const reindexTripDays = (startDate: Date, days: TimelineDay[]): TimelineDay[] =>
  days.map((day, index) => ({
    ...day,
    dayOrder: index,
    date: addDays(startDate, index),
    openSlots: day.openSlots ?? [],
  }))

export const useTripStore = create<TripStore>((set) => ({
  // Initial state
  currentTrip: initialTrip,
  selectedDestination: null,
  selectedBaseLocation: null,
  selectedDayId: initialTrip.days[0]?.id ?? null,
  selectionOrigin: null,

  // Actions
  addDestinationToDay: (destination: Destination, dayId: string) => {
    set((state) => ({
      currentTrip: {
        ...state.currentTrip,
        days: state.currentTrip.days.map(day =>
          day.id === dayId
            ? { ...day, destinations: [...day.destinations, destination] }
            : day
        )
      }
    }))
  },

  removeDestinationFromDay: (destinationId: string, dayId: string) => {
    set((state) => ({
      currentTrip: {
        ...state.currentTrip,
        days: state.currentTrip.days.map(day =>
          day.id === dayId
            ? { ...day, destinations: day.destinations.filter(d => d.id !== destinationId) }
            : day
        )
      }
    }))
  },

  addNewDay: () => {
    set((state) => {
      const nextOrder = state.currentTrip.days.length
      const newDay = createEmptyDay(state.currentTrip.startDate, nextOrder)
      const reindexedDays = reindexTripDays(state.currentTrip.startDate, [...state.currentTrip.days, newDay])
      const nextEndDate = reindexedDays[reindexedDays.length - 1]?.date ?? state.currentTrip.endDate
      return {
        currentTrip: {
          ...state.currentTrip,
          days: reindexedDays,
          endDate: nextEndDate
        },
        selectedDayId: newDay.id
      }
    })
  },

  duplicateDay: (dayId: string) => {
    set((state) => {
      const dayToDuplicate = state.currentTrip.days.find(day => day.id === dayId)
      if (!dayToDuplicate) return state

      const dayIndex = state.currentTrip.days.findIndex(day => day.id === dayId)
      const newDay: TimelineDay = {
        id: generateId(),
        dayOrder: dayToDuplicate.dayOrder + 1,
        date: addDays(dayToDuplicate.date, 1),
        destinations: dayToDuplicate.destinations.map(dest => ({
          ...dest,
          id: generateId() // Generate new IDs for destinations
        })),
        baseLocations: dayToDuplicate.baseLocations
          ? dayToDuplicate.baseLocations.map(baseLocation => ({ ...baseLocation }))
          : [],
        openSlots: dayToDuplicate.openSlots ? [...dayToDuplicate.openSlots] : [],
        notes: dayToDuplicate.notes,
      }

      // Insert the duplicated day right after the original
      const newDays = [...state.currentTrip.days]
      newDays.splice(dayIndex + 1, 0, newDay)

      const reindexedDays = reindexTripDays(state.currentTrip.startDate, newDays)
      const nextEndDate = reindexedDays[reindexedDays.length - 1]?.date ?? state.currentTrip.endDate

      return {
        currentTrip: {
          ...state.currentTrip,
          days: reindexedDays,
          endDate: nextEndDate
        },
        selectedDayId: newDay.id
      }
    })
  },

  removeDay: (dayId: string) => {
    set((state) => {
      if (state.currentTrip.days.length <= 1) return state // Don't remove the last day

      const remainingDays = state.currentTrip.days.filter(day => day.id !== dayId)
      const reindexedDays = reindexTripDays(state.currentTrip.startDate, remainingDays)
      const nextEndDate = reindexedDays[reindexedDays.length - 1]?.date ?? state.currentTrip.endDate

      return {
        currentTrip: {
          ...state.currentTrip,
          days: reindexedDays,
          endDate: nextEndDate
        },
        selectedDayId: reindexedDays[0]?.id ?? null
      }
    })
  },

  setSelectedDestination: (destination: Destination | null, origin: 'map' | 'timeline' | 'preview' = 'timeline') => {
    set((state) => ({
      selectedDestination: destination,
      selectedBaseLocation: destination ? null : state.selectedBaseLocation,
      selectionOrigin: destination ? origin : null,
    }))
  },

  setSelectedDay: (dayId: string) => {
    set({ selectedDayId: dayId })
  },

  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin: 'map' | 'timeline' | 'preview' = 'timeline') => {
    set((state) => ({
      selectedBaseLocation: payload,
      selectedDestination: payload ? null : state.selectedDestination,
      selectionOrigin: payload ? origin : null,
    }))
  },

  setDayLocation: (dayId: string, location: DayLocation | null) => {
    set((state) => ({
      currentTrip: {
        ...state.currentTrip,
        days: state.currentTrip.days.map(day =>
          day.id === dayId
            ? { ...day, baseLocations: location ? [location] : [] }
            : day
        )
      }
    }))
  },

  moveDestination: (destinationId: string, fromDayId: string, toDayId: string, newIndex: number) => {
    set((state) => {
      // Find the destination to move
      const fromDay = state.currentTrip.days.find(d => d.id === fromDayId)
      const destination = fromDay?.destinations.find(d => d.id === destinationId)
      
      if (!destination) return state

      // Remove from source day
      const updatedDays = state.currentTrip.days.map(day => {
        if (day.id === fromDayId) {
          return { ...day, destinations: day.destinations.filter(d => d.id !== destinationId) }
        }
        return day
      })

      // Add to target day at specific index
      const finalDays = updatedDays.map(day => {
        if (day.id === toDayId) {
          const newDestinations = [...day.destinations]
          newDestinations.splice(newIndex, 0, destination)
          return { ...day, destinations: newDestinations }
        }
        return day
      })

      return {
        currentTrip: {
          ...state.currentTrip,
          days: finalDays
        }
      }
    })
  },

  reorderDestinations: (dayId: string, startIndex: number, endIndex: number) => {
    set((state) => {
      const updatedDays = state.currentTrip.days.map(day => {
        if (day.id === dayId) {
          const newDestinations = [...day.destinations]
          const [removed] = newDestinations.splice(startIndex, 1)
          newDestinations.splice(endIndex, 0, removed)
          return { ...day, destinations: newDestinations }
        }
        return day
      })

      return {
        currentTrip: {
          ...state.currentTrip,
          days: updatedDays
        }
      }
    })
  },

  updateTripDates: (startDate: Date, endDate: Date) => {
    set((state) => {
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1
      const desiredCount = Math.max(daysDiff, 1)
      let updatedDays = [...state.currentTrip.days]

      if (desiredCount > updatedDays.length) {
        for (let i = updatedDays.length; i < desiredCount; i++) {
          updatedDays.push(createEmptyDay(startDate, i))
        }
      } else if (desiredCount < updatedDays.length) {
        updatedDays = updatedDays.slice(0, desiredCount)
      }

      const reindexedDays = reindexTripDays(startDate, updatedDays)

      const nextSelectedDayId = (() => {
        if (!reindexedDays.length) return null
        const stillValid =
          state.selectedDayId && reindexedDays.some(day => day.id === state.selectedDayId)
        return stillValid ? state.selectedDayId : reindexedDays[0].id
      })()

      return {
        currentTrip: {
          ...state.currentTrip,
          startDate,
          endDate,
          days: reindexedDays
        },
        selectedDayId: nextSelectedDayId
      }
    })
  },
}))
