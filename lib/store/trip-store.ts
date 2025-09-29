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
  selectionOrigin: 'map' | 'timeline' | null
  
  // Actions
  addDestinationToDay: (destination: Destination, dayId: string) => void
  removeDestinationFromDay: (destinationId: string, dayId: string) => void
  addNewDay: () => void
  duplicateDay: (dayId: string) => void
  removeDay: (dayId: string) => void
  setSelectedDestination: (destination: Destination | null, origin?: 'map' | 'timeline') => void
  setSelectedDay: (dayId: string) => void
  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin?: 'map' | 'timeline') => void
  setDayLocation: (dayId: string, location: DayLocation | null) => void
  moveDestination: (destinationId: string, fromDayId: string, toDayId: string, newIndex: number) => void
  reorderDestinations: (dayId: string, startIndex: number, endIndex: number) => void
  updateTripDates: (startDate: Date, endDate: Date) => void
}

const createInitialTrip = (): Trip => ({
  id: generateId(),
  name: 'Italy Adventure',
  startDate: new Date(),
  endDate: addDays(new Date(), 2),
  country: 'IT',
  days: [
    {
      id: generateId(),
      date: new Date(),
      destinations: [],
      baseLocations: [],
    },
    {
      id: generateId(),
      date: addDays(new Date(), 1),
      destinations: [],
      baseLocations: [],
    },
    {
      id: generateId(),
      date: addDays(new Date(), 2),
      destinations: [],
      baseLocations: [],
    }
  ]
})

const initialTrip = createInitialTrip()

export const useTripStore = create<TripStore>((set, get) => ({
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
      const newDay: TimelineDay = {
        id: generateId(),
        date: addDays(state.currentTrip.startDate, state.currentTrip.days.length),
        destinations: [],
        baseLocations: [],
      }
      return {
        currentTrip: {
          ...state.currentTrip,
          days: [...state.currentTrip.days, newDay],
          endDate: newDay.date
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
        date: addDays(dayToDuplicate.date, 1),
        destinations: dayToDuplicate.destinations.map(dest => ({
          ...dest,
          id: generateId() // Generate new IDs for destinations
        })),
        baseLocations: dayToDuplicate.baseLocations
          ? dayToDuplicate.baseLocations.map(baseLocation => ({ ...baseLocation }))
          : [],
      }

      // Insert the duplicated day right after the original
      const newDays = [...state.currentTrip.days]
      newDays.splice(dayIndex + 1, 0, newDay)

      // Update dates for all subsequent days
      const updatedDays = newDays.map((day, index) => ({
        ...day,
        date: addDays(state.currentTrip.startDate, index)
      }))

      return {
        currentTrip: {
          ...state.currentTrip,
          days: updatedDays,
          endDate: updatedDays[updatedDays.length - 1].date
        },
        selectedDayId: newDay.id
      }
    })
  },

  removeDay: (dayId: string) => {
    set((state) => {
      if (state.currentTrip.days.length <= 1) return state // Don't remove the last day

      const updatedDays = state.currentTrip.days.filter(day => day.id !== dayId)
      
      // Update dates for remaining days
      const finalDays = updatedDays.map((day, index) => ({
        ...day,
        date: addDays(state.currentTrip.startDate, index)
      }))

      return {
        currentTrip: {
          ...state.currentTrip,
          days: finalDays,
          endDate: finalDays[finalDays.length - 1].date
        },
        selectedDayId: finalDays[0]?.id ?? null
      }
    })
  },

  setSelectedDestination: (destination: Destination | null, origin: 'map' | 'timeline' = 'timeline') => {
    set((state) => ({
      selectedDestination: destination,
      selectedBaseLocation: destination ? null : state.selectedBaseLocation,
      selectionOrigin: destination ? origin : null,
    }))
  },

  setSelectedDay: (dayId: string) => {
    set({ selectedDayId: dayId })
  },

  setSelectedBaseLocation: (payload: { dayId: string; index: number } | null, origin: 'map' | 'timeline' = 'timeline') => {
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
      const currentDaysCount = state.currentTrip.days.length
      
      let updatedDays = [...state.currentTrip.days]
      
      // Update existing days with new dates
      updatedDays = updatedDays.map((day, index) => ({
        ...day,
        date: addDays(startDate, index)
      }))
      
      // Add new days if the trip is longer
      if (daysDiff > currentDaysCount) {
        for (let i = currentDaysCount; i < daysDiff; i++) {
          updatedDays.push({
            id: generateId(),
            date: addDays(startDate, i),
            destinations: [],
            baseLocations: [],
          })
        }
      }
      
      // Remove extra days if the trip is shorter
      if (daysDiff < currentDaysCount) {
        updatedDays = updatedDays.slice(0, daysDiff)
      }

      const nextSelectedDayId = (() => {
        if (!updatedDays.length) return null
        const stillValid = state.selectedDayId && updatedDays.some(day => day.id === state.selectedDayId)
        return stillValid ? state.selectedDayId : updatedDays[0].id
      })()

      return {
        currentTrip: {
          ...state.currentTrip,
          startDate,
          endDate,
          days: updatedDays
        },
        selectedDayId: nextSelectedDayId
      }
    })
  },
}))
