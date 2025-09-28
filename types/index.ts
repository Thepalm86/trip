// Core types for Traveal application

export interface Destination {
  id: string
  name: string
  description?: string
  coordinates: [number, number] // [longitude, latitude]
  city?: string
  category?: 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity' | string
  rating?: number
  imageUrl?: string
  estimatedDuration?: number // in hours
  openingHours?: string
  cost?: number
  notes?: string
  links?: LocationLink[]
}

export interface TimelineDay {
  id: string
  date: Date
  destinations: Destination[]
  baseLocations: DayLocation[]
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

export interface LocationLink {
  id: string
  type: 'airbnb' | 'booking' | 'hotels' | 'google_maps' | 'tripadvisor' | 'website' | 'other'
  label: string
  url: string
}

export interface DayLocation {
  name: string
  coordinates: [number, number]
  context?: string
  city?: string
  notes?: string
  links?: LocationLink[]
}

export interface MapViewport {
  longitude: number
  latitude: number
  zoom: number
}

export interface ExplorePlace {
  id: string
  name: string
  fullName: string
  coordinates: [number, number]
  category?: string
  context?: string
  city?: string
  notes?: string
  source: 'mapbox' | 'cache'
  relevance?: number
  metadata?: Record<string, unknown>
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
