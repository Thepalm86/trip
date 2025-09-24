// Core types for Trip3 application

export interface Destination {
  id: string
  name: string
  description?: string
  coordinates: [number, number] // [longitude, latitude]
  category?: 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity'
  rating?: number
  imageUrl?: string
  estimatedDuration?: number // in hours
  openingHours?: string
  cost?: number
}

export interface TimelineDay {
  id: string
  date: Date
  destinations: Destination[]
  location?: DayLocation
}

export interface Trip {
  id: string
  name: string
  startDate: Date
  endDate: Date
  days: TimelineDay[]
  totalBudget?: number
  country: string
}

export interface DayLocation {
  name: string
  coordinates: [number, number]
  context?: string
}

export interface MapViewport {
  longitude: number
  latitude: number
  zoom: number
}

// Map marker types
export interface MarkerData {
  id: string
  coordinates: [number, number]
  name: string
  description?: string
  category: Destination['category']
}

// Timeline interactions
export interface TimelineActions {
  addDestinationToDay: (destination: Destination, dayId: string) => void
  removeDestinationFromDay: (destinationId: string, dayId: string) => void
  moveDestination: (destinationId: string, fromDayId: string, toDayId: string, newIndex: number) => void
  reorderDestinations: (dayId: string, startIndex: number, endIndex: number) => void
}

// Map interactions
export interface MapActions {
  onDestinationClick: (destination: Destination) => void
  onMapClick: (coordinates: [number, number]) => void
}
