import { createClient } from '@supabase/supabase-js'
import { Destination, TimelineDay, Trip, DayLocation } from '@/types'
import { addDays } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Database types matching our schema
interface DatabaseTrip {
  id: string
  user_id: string
  name: string
  start_date: string
  end_date: string
  country_code: string
  total_budget?: number
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
}

interface DatabaseDay {
  id: string
  trip_id: string
  date: string
  day_order: number
  base_location_name?: string
  base_location_coordinates?: string // POINT as string
  base_location_context?: string
  base_locations_json?: DayLocation[] // New field for multiple base locations
  notes?: string
  created_at: string
  updated_at: string
}

interface DatabaseDestination {
  id: string
  day_id: string
  name: string
  description?: string
  coordinates: string // POINT as string
  city?: string
  category?: 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity'
  rating?: number
  image_url?: string
  estimated_duration_hours?: number
  opening_hours?: string
  cost?: number
  order_index: number
  notes?: string
  links_json?: string
  created_at: string
  updated_at: string
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const user = data?.user
  if (!user) {
    throw new Error('User is not authenticated')
  }
  return user.id
}

// Helper functions to convert between database and app types
function parsePoint(pointStr: string): [number, number] {
  if (!pointStr) return [0, 0]
  const match = pointStr.match(/\(([^,]+),([^)]+)\)/)
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2])] // [lng, lat] - don't swap!
  }
  return [0, 0]
}

function formatPoint(coordinates: [number, number]): string {
  return `(${coordinates[0]},${coordinates[1]})`
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Map Mapbox geocoder categories to our allowed categories
function mapCategoryToAllowed(category: string): 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity' {
  const categoryMap: Record<string, 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity'> = {
    'locality': 'city',
    'place': 'city',
    'city': 'city',
    'town': 'city',
    'village': 'city',
    'neighborhood': 'city',
    'poi': 'attraction',
    'attraction': 'attraction',
    'museum': 'attraction',
    'landmark': 'attraction',
    'restaurant': 'restaurant',
    'food': 'restaurant',
    'cafe': 'restaurant',
    'hotel': 'hotel',
    'accommodation': 'hotel',
    'activity': 'activity',
    'entertainment': 'activity',
    'park': 'activity',
    'nature': 'activity'
  }
  
  return categoryMap[category.toLowerCase()] || 'attraction' // Default to 'attraction' for unknown categories
}

function dbDestinationToDestination(dest: DatabaseDestination): Destination {
  return {
    id: dest.id,
    name: dest.name,
    description: dest.description ?? undefined,
    coordinates: parsePoint(dest.coordinates),
    city: dest.city ?? undefined,
    category: dest.category ?? undefined,
    rating: dest.rating ?? undefined,
    imageUrl: dest.image_url ?? undefined,
    estimatedDuration: dest.estimated_duration_hours ?? undefined,
    openingHours: dest.opening_hours ?? undefined,
    cost: dest.cost ?? undefined,
    notes: dest.notes ?? undefined,
    links: dest.links_json ? JSON.parse(dest.links_json) : undefined,
  }
}

function dbDayToTimelineDay(day: DatabaseDay, destinations: DatabaseDestination[] = []): TimelineDay {
  const dayDestinations = destinations
    .filter(dest => dest.day_id === day.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map(dbDestinationToDestination)

  // Handle both old single location format and new multiple base locations format
  let baseLocations: DayLocation[] = []
  
  if (day.base_locations_json && Array.isArray(day.base_locations_json)) {
    // New format: multiple base locations stored as JSON
    baseLocations = day.base_locations_json
  } else if (day.base_location_name) {
    // Old format: single base location
    baseLocations = [{
      name: day.base_location_name,
      coordinates: parsePoint(day.base_location_coordinates || ''),
      context: day.base_location_context ?? undefined,
    }]
  }

  return {
    id: day.id,
    date: new Date(day.date),
    destinations: dayDestinations,
    baseLocations: baseLocations,
  }
}

function dbTripToAppTrip(dbTrip: DatabaseTrip, days: DatabaseDay[], destinations: DatabaseDestination[]): Trip {
  const tripDays: TimelineDay[] = days.map(day => dbDayToTimelineDay(day, destinations))

  return {
    id: dbTrip.id,
    name: dbTrip.name,
    startDate: new Date(dbTrip.start_date),
    endDate: new Date(dbTrip.end_date),
    country: dbTrip.country_code,
    totalBudget: dbTrip.total_budget,
    days: tripDays
  }
}

// API Functions
export const tripApi = {
  // Get all trips for the current user
  async getUserTrips(): Promise<Trip[]> {
    const userId = await getAuthenticatedUserId()

    const { data: trips, error } = await supabase
      .from('user_trips')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!trips.length) {
      return []
    }

    const tripIds = trips.map(trip => trip.id)
    if (!tripIds.length) {
      return trips.map(trip => ({
        id: trip.id,
        name: trip.name,
        startDate: new Date(trip.start_date),
        endDate: new Date(trip.end_date),
        country: trip.country_code,
        totalBudget: trip.total_budget,
        days: [],
      }))
    }
    
    // Get days for all trips
    const { data: days, error: daysError } = await supabase
      .from('trip_days')
      .select('*')
      .in('trip_id', tripIds)
      .order('day_order')

    if (daysError) throw daysError

    if (!days.length) {
      return trips.map(trip => ({
        id: trip.id,
        name: trip.name,
        startDate: new Date(trip.start_date),
        endDate: new Date(trip.end_date),
        country: trip.country_code,
        totalBudget: trip.total_budget,
        days: [],
      }))
    }

    const dayIds = days.map(day => day.id)
    if (!dayIds.length) {
      return trips.map(trip => dbTripToAppTrip(trip, days.filter(d => d.trip_id === trip.id), []))
    }
    
    // Get destinations for all days
    const { data: destinations, error: destError } = await supabase
      .from('trip_destinations')
      .select('*')
      .in('day_id', dayIds)
      .order('order_index')

    if (destError) throw destError

    // Group data by trip
    return trips.map(trip => {
      const tripDays = days.filter(day => day.trip_id === trip.id)
      const tripDestinations = destinations.filter(dest => 
        tripDays.some(day => day.id === dest.day_id)
      )
      return dbTripToAppTrip(trip, tripDays, tripDestinations)
    })
  },

  // Get a single trip with all details
  async getTrip(tripId: string): Promise<Trip | null> {
    const userId = await getAuthenticatedUserId()

    // Get trip
    const { data: trip, error: tripError } = await supabase
      .from('user_trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', userId)
      .single()

    if (tripError) throw tripError
    if (!trip) return null

    // Get days
    const { data: days, error: daysError } = await supabase
      .from('trip_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_order')

    if (daysError) throw daysError

    // Get destinations
    const dayIds = days.map(day => day.id)
    let destinations: DatabaseDestination[] = []

    if (dayIds.length) {
      const { data, error: destError } = await supabase
        .from('trip_destinations')
        .select('*')
        .in('day_id', dayIds)
        .order('order_index')

      if (destError) throw destError
      destinations = data ?? []
    }

    return dbTripToAppTrip(trip, days, destinations)
  },

  // Create a new trip
  async createTrip(trip: Omit<Trip, 'id'>): Promise<string> {
    const userId = await getAuthenticatedUserId()

    const { data, error } = await supabase
      .from('user_trips')
      .insert({
        name: trip.name,
        start_date: formatDateOnly(trip.startDate),
        end_date: formatDateOnly(trip.endDate),
        country_code: trip.country,
        total_budget: trip.totalBudget,
        status: 'planning',
        user_id: userId,
      })
      .select('id')
      .single()

    if (error) throw error

    // Create days
    const dayInserts = trip.days.map((day, index) => ({
      trip_id: data.id,
      date: formatDateOnly(day.date),
      day_order: index,
      base_location_name: day.location?.name,
      base_location_coordinates: day.location?.coordinates ? formatPoint(day.location.coordinates) : null,
      base_location_context: day.location?.context,
      notes: undefined
    }))

    const { data: days, error: daysError } = await supabase
      .from('trip_days')
      .insert(dayInserts)
      .select('*')

    if (daysError) throw daysError

    // Create destinations
    const destinationInserts: any[] = []
    trip.days.forEach((day, dayIndex) => {
      const dayData = days.find(d => d.day_order === dayIndex)
      if (dayData) {
        day.destinations.forEach((dest, destIndex) => {
          destinationInserts.push({
            day_id: dayData.id,
            name: dest.name,
            description: dest.description,
            coordinates: formatPoint(dest.coordinates),
            category: dest.category,
            rating: dest.rating,
            image_url: dest.imageUrl,
            estimated_duration_hours: dest.estimatedDuration,
            opening_hours: dest.openingHours,
            cost: dest.cost,
            order_index: destIndex,
            notes: undefined
          })
        })
      }
    })

    if (destinationInserts.length > 0) {
      const { error: destError } = await supabase
        .from('trip_destinations')
        .insert(destinationInserts)

      if (destError) throw destError
    }

    return data.id
  },

  // Update trip
  async updateTrip(tripId: string, updates: Partial<Trip>): Promise<void> {
    const userId = await getAuthenticatedUserId()
    const updateData: any = {}
    
    if (updates.name) updateData.name = updates.name
    if (updates.startDate) updateData.start_date = updates.startDate.toISOString().split('T')[0]
    if (updates.endDate) updateData.end_date = updates.endDate.toISOString().split('T')[0]
    if (updates.country) updateData.country_code = updates.country
    if (updates.totalBudget !== undefined) updateData.total_budget = updates.totalBudget

    const { error } = await supabase
      .from('user_trips')
      .update(updateData)
      .eq('id', tripId)
      .eq('user_id', userId)

    if (error) throw error
  },

  // Add destination to day
  async addDestinationToDay(dayId: string, destination: Destination): Promise<Destination> {
    console.log('TripAPI: Adding destination to day', { dayId, destination })
    
    // Get current max order_index for this day
    const { data: maxOrder, error: orderError } = await supabase
      .from('trip_destinations')
      .select('order_index')
      .eq('day_id', dayId)
      .order('order_index', { ascending: false })
      .limit(1)

    if (orderError) {
      console.error('TripAPI: Error getting max order index', orderError)
      throw orderError
    }

    const nextOrder = maxOrder.length > 0 ? maxOrder[0].order_index + 1 : 0
    console.log('TripAPI: Next order index', nextOrder)

    const insertData = {
      day_id: dayId,
      name: destination.name,
      description: destination.description,
      coordinates: formatPoint(destination.coordinates),
      city: destination.city,
      category: destination.category ? mapCategoryToAllowed(destination.category) : 'attraction',
      rating: destination.rating,
      image_url: destination.imageUrl,
      estimated_duration_hours: destination.estimatedDuration,
      opening_hours: destination.openingHours,
      cost: destination.cost,
      notes: destination.notes,
      links_json: destination.links ? JSON.stringify(destination.links) : null,
      order_index: nextOrder
    }
    
    console.log('TripAPI: Inserting destination data', insertData)
    console.log('TripAPI: Formatted coordinates:', insertData.coordinates)
    console.log('TripAPI: Original coordinates:', destination.coordinates)
    console.log('TripAPI: Category mapping:', { 
      original: destination.category, 
      mapped: insertData.category 
    })


    const { data, error } = await supabase
      .from('trip_destinations')
      .insert(insertData)
      .select('*')
      .single()

    if (error) {
      console.error('TripAPI: Error inserting destination', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      })
      throw error
    }

    console.log('TripAPI: Destination inserted successfully', data)
    return dbDestinationToDestination(data)
  },

  // Remove destination from day
  async removeDestinationFromDay(destinationId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_destinations')
      .delete()
      .eq('id', destinationId)

    if (error) throw error
  },

  async updateDestination(destinationId: string, destination: Destination): Promise<Destination> {
    console.log('TripAPI: Updating destination', { destinationId, destination })
    
    // Check authentication first
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('TripAPI: Authentication check', { user: user?.id, authError })
    
    if (authError || !user) {
      throw new Error('User not authenticated')
    }
    
    // First check if the destination exists
    const { data: existingDestination, error: checkError } = await supabase
      .from('trip_destinations')
      .select('id')
      .eq('id', destinationId)
      .single()

    if (checkError) {
      console.error('TripAPI: Destination not found', { destinationId, checkError })
      throw new Error(`Destination with ID ${destinationId} not found`)
    }
    
    const updateData: any = {
      name: destination.name,
      coordinates: formatPoint(destination.coordinates),
      city: destination.city,
      category: destination.category ? mapCategoryToAllowed(destination.category) : 'attraction',
      estimated_duration_hours: destination.estimatedDuration,
      cost: destination.cost,
      notes: destination.notes,
      links_json: destination.links ? JSON.stringify(destination.links) : null
    }

    console.log('TripAPI: Update data being sent', updateData)

    const { data, error } = await supabase
      .from('trip_destinations')
      .update(updateData)
      .eq('id', destinationId)
      .select()
      .single()

    if (error) {
      console.error('TripAPI: Update destination error', {
        error,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        updateData,
        destinationId
      })
      throw error
    }
    
    console.log('TripAPI: Destination updated successfully', data)
    return dbDestinationToDestination(data)
  },

  async moveDestination(destinationId: string, toDayId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_destinations')
      .update({ day_id: toDayId })
      .eq('id', destinationId)

    if (error) throw error
  },

  // Set day location (for backward compatibility - sets first base location)
  async setDayLocation(dayId: string, location: DayLocation | null): Promise<void> {
    const updateData: any = {}
    
    if (location) {
      updateData.base_location_name = location.name
      updateData.base_location_coordinates = formatPoint(location.coordinates)
      updateData.base_location_context = location.context
    } else {
      updateData.base_location_name = null
      updateData.base_location_coordinates = null
      updateData.base_location_context = null
    }

    const { error } = await supabase
      .from('trip_days')
      .update(updateData)
      .eq('id', dayId)

    if (error) throw error
  },

  // Add base location to day
  async addBaseLocation(dayId: string, location: DayLocation): Promise<void> {
    // For now, we'll store multiple base locations as JSON in a single field
    // In a production system, you might want a separate table for base locations
    const { data: dayData, error: fetchError } = await supabase
      .from('trip_days')
      .select('base_locations_json')
      .eq('id', dayId)
      .single()

    if (fetchError) throw fetchError

    const existingBaseLocations = dayData?.base_locations_json || []
    const updatedBaseLocations = [...existingBaseLocations, location]

    const { error } = await supabase
      .from('trip_days')
      .update({ base_locations_json: updatedBaseLocations })
      .eq('id', dayId)

    if (error) throw error
  },

  // Remove base location from day
  async removeBaseLocation(dayId: string, locationIndex: number): Promise<void> {
    const { data: dayData, error: fetchError } = await supabase
      .from('trip_days')
      .select('base_locations_json')
      .eq('id', dayId)
      .single()

    if (fetchError) throw fetchError

    const existingBaseLocations = dayData?.base_locations_json || []
    const updatedBaseLocations = existingBaseLocations.filter((_: any, index: number) => index !== locationIndex)

    const { error } = await supabase
      .from('trip_days')
      .update({ base_locations_json: updatedBaseLocations })
      .eq('id', dayId)

    if (error) throw error
  },

  // Update base location
  async updateBaseLocation(dayId: string, locationIndex: number, location: DayLocation): Promise<void> {
    const { data: dayData, error: fetchError } = await supabase
      .from('trip_days')
      .select('base_locations_json')
      .eq('id', dayId)
      .single()

    if (fetchError) throw fetchError

    const existingBaseLocations = dayData?.base_locations_json || []
    const updatedBaseLocations = [...existingBaseLocations]
    updatedBaseLocations[locationIndex] = location

    const { error } = await supabase
      .from('trip_days')
      .update({ base_locations_json: updatedBaseLocations })
      .eq('id', dayId)

    if (error) throw error
  },

  // Reorder base locations
  async reorderBaseLocations(dayId: string, fromIndex: number, toIndex: number): Promise<void> {
    const { data: dayData, error: fetchError } = await supabase
      .from('trip_days')
      .select('base_locations_json')
      .eq('id', dayId)
      .single()

    if (fetchError) throw fetchError

    const existingBaseLocations = dayData?.base_locations_json || []
    const updatedBaseLocations = [...existingBaseLocations]
    const [movedLocation] = updatedBaseLocations.splice(fromIndex, 1)
    updatedBaseLocations.splice(toIndex, 0, movedLocation)

    const { error } = await supabase
      .from('trip_days')
      .update({ base_locations_json: updatedBaseLocations })
      .eq('id', dayId)

    if (error) throw error
  },

  // Reorder destinations within a day
  async reorderDestinations(dayId: string, destinationIds: string[]): Promise<void> {
    if (!destinationIds.length) return
    // Update order_index for each destination
    const updates = destinationIds.map((destId, index) => ({
      id: destId,
      order_index: index
    }))

    for (const update of updates) {
      const { error } = await supabase
        .from('trip_destinations')
        .update({ order_index: update.order_index })
        .eq('id', update.id)

      if (error) throw error
    }
  },

  // Duplicate trip
  async duplicateTrip(tripId: string, newName: string): Promise<string> {
    // Get original trip
    const originalTrip = await this.getTrip(tripId)
    if (!originalTrip) throw new Error('Trip not found')

    // Create new trip with new name
    const newTrip = {
      ...originalTrip,
      name: newName
    }
    delete (newTrip as any).id // Remove id so it gets a new one

    return await this.createTrip(newTrip)
  },

  // Get trip statistics
  async getTripStats(tripId: string): Promise<any> {
    const trip = await this.getTrip(tripId)
    if (!trip) return null

    const totalDestinations = trip.days.reduce((acc, day) => acc + day.destinations.length, 0)
    const totalDuration = trip.days.reduce((acc, day) => 
      acc + day.destinations.reduce((dayAcc, dest) => dayAcc + (dest.estimatedDuration || 2), 0), 0
    )
    const totalCost = trip.days.reduce((acc, day) => 
      acc + day.destinations.reduce((dayAcc, dest) => dayAcc + (dest.cost || 0), 0), 0
    )

    return {
      totalDestinations,
      totalDuration,
      totalCost,
      daysCount: trip.days.length
    }
  },

  async addDay(tripId: string, date: Date, location?: DayLocation | null): Promise<TimelineDay> {
    const { data: existingDays, error: existingError } = await supabase
      .from('trip_days')
      .select('day_order')
      .eq('trip_id', tripId)
      .order('day_order')

    if (existingError) throw existingError

    const nextOrder = existingDays?.length ?? 0

    const { data, error } = await supabase
      .from('trip_days')
      .insert({
        trip_id: tripId,
        date: formatDateOnly(date),
        day_order: nextOrder,
        base_location_name: location?.name ?? null,
        base_location_coordinates: location?.coordinates ? formatPoint(location.coordinates) : null,
        base_location_context: location?.context ?? null,
      })
      .select('*')
      .single()

    if (error) throw error

    await this.normalizeTripDays(tripId)

    return dbDayToTimelineDay(data)
  },

  async duplicateDay(tripId: string, dayId: string): Promise<void> {
    const { data: day, error: dayError } = await supabase
      .from('trip_days')
      .select('*')
      .eq('id', dayId)
      .single()

    if (dayError) throw dayError

    const { data: destinations, error: destError } = await supabase
      .from('trip_destinations')
      .select('*')
      .eq('day_id', dayId)

    if (destError) throw destError

    const newDate = addDays(new Date(day.date), 1)

    const { data: subsequentDays, error: subsequentError } = await supabase
      .from('trip_days')
      .select('id, day_order')
      .eq('trip_id', tripId)
      .gt('day_order', day.day_order)
      .order('day_order', { ascending: false })

    if (subsequentError) throw subsequentError

    for (const d of subsequentDays ?? []) {
      const { error: updateError } = await supabase
        .from('trip_days')
        .update({ day_order: d.day_order + 1 })
        .eq('id', d.id)

      if (updateError) throw updateError
    }

    const { data: newDay, error: insertError } = await supabase
      .from('trip_days')
      .insert({
        trip_id: tripId,
        date: formatDateOnly(newDate),
        day_order: day.day_order + 1,
        base_location_name: day.base_location_name,
        base_location_coordinates: day.base_location_coordinates,
        base_location_context: day.base_location_context,
      })
      .select('*')
      .single()

    if (insertError) throw insertError

    if (destinations && destinations.length) {
      const duplicateDestinations = destinations.map(destination => ({
        day_id: newDay.id,
        name: destination.name,
        description: destination.description,
        coordinates: destination.coordinates,
        category: destination.category,
        rating: destination.rating,
        image_url: destination.image_url,
        estimated_duration_hours: destination.estimated_duration_hours,
        opening_hours: destination.opening_hours,
        cost: destination.cost,
        order_index: destination.order_index,
        notes: destination.notes,
      }))

      const { error: duplicateError } = await supabase
        .from('trip_destinations')
        .insert(duplicateDestinations)

      if (duplicateError) throw duplicateError
    }

    await this.normalizeTripDays(tripId)
  },

  async removeDay(tripId: string, dayId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_days')
      .delete()
      .eq('id', dayId)

    if (error) throw error

    await this.normalizeTripDays(tripId)
  },

  async updateTripDates(tripId: string, startDate: Date, endDate: Date): Promise<void> {
    console.log('TripAPI: Updating trip dates', { tripId, startDate, endDate })
    
    const { error: tripUpdateError } = await supabase
      .from('user_trips')
      .update({
        start_date: formatDateOnly(startDate),
        end_date: formatDateOnly(endDate),
      })
      .eq('id', tripId)

    if (tripUpdateError) throw tripUpdateError

    // Calculate the number of days needed
    const timeDiff = endDate.getTime() - startDate.getTime()
    const daysNeeded = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
    console.log('TripAPI: Days needed for new date range:', daysNeeded)

    // Get existing days
    const { data: existingDays, error: daysError } = await supabase
      .from('trip_days')
      .select('id, day_order')
      .eq('trip_id', tripId)
      .order('day_order')

    if (daysError) throw daysError

    const currentDayCount = existingDays?.length || 0
    console.log('TripAPI: Current day count:', currentDayCount)

    if (daysNeeded > currentDayCount) {
      // Need to add more days
      const daysToAdd = daysNeeded - currentDayCount
      console.log('TripAPI: Adding', daysToAdd, 'new days')
      
      const newDays = []
      for (let i = 0; i < daysToAdd; i++) {
        const dayDate = addDays(startDate, currentDayCount + i)
        newDays.push({
          trip_id: tripId,
          date: formatDateOnly(dayDate),
          day_order: currentDayCount + i,
          base_location_name: null,
          base_location_coordinates: null,
          base_location_context: null,
          notes: null
        })
      }

      const { error: insertError } = await supabase
        .from('trip_days')
        .insert(newDays)

      if (insertError) throw insertError
    } else if (daysNeeded < currentDayCount) {
      // Need to remove excess days
      const daysToRemove = currentDayCount - daysNeeded
      console.log('TripAPI: Removing', daysToRemove, 'excess days')
      
      // Get the days to remove (the last ones)
      const daysToDelete = existingDays?.slice(-daysToRemove) || []
      
      for (const day of daysToDelete) {
        // First delete destinations for these days
        const { error: deleteDestinationsError } = await supabase
          .from('trip_destinations')
          .delete()
          .eq('day_id', day.id)
        
        if (deleteDestinationsError) throw deleteDestinationsError

        // Then delete the day
        const { error: deleteDayError } = await supabase
          .from('trip_days')
          .delete()
          .eq('id', day.id)
        
        if (deleteDayError) throw deleteDayError
      }
    }

    // Update dates for all remaining days
    const { data: allDays, error: finalDaysError } = await supabase
      .from('trip_days')
      .select('id')
      .eq('trip_id', tripId)
      .order('day_order')

    if (finalDaysError) throw finalDaysError

    let currentDate = new Date(startDate)
    for (const [index, day] of (allDays ?? []).entries()) {
      const { error: updateError } = await supabase
        .from('trip_days')
        .update({
          day_order: index,
          date: formatDateOnly(currentDate),
        })
        .eq('id', day.id)

      if (updateError) throw updateError
      currentDate = addDays(currentDate, 1)
    }

    console.log('TripAPI: Trip dates updated successfully')
  },

  async normalizeTripDays(tripId: string): Promise<void> {
    const { data: trip, error: tripError } = await supabase
      .from('user_trips')
      .select('start_date')
      .eq('id', tripId)
      .single()

    if (tripError) throw tripError

    const { data: days, error: daysError } = await supabase
      .from('trip_days')
      .select('id, day_order')
      .eq('trip_id', tripId)
      .order('day_order')

    if (daysError) throw daysError

    let currentDate = new Date(trip.start_date)
    for (const [index, day] of (days ?? []).entries()) {
      const { error: updateError } = await supabase
        .from('trip_days')
        .update({
          day_order: index,
          date: formatDateOnly(currentDate),
        })
        .eq('id', day.id)

      if (updateError) throw updateError
      currentDate = addDays(currentDate, 1)
    }

    if (days && days.length) {
      const finalDate = addDays(new Date(trip.start_date), days.length - 1)
      const { error: updateTripError } = await supabase
        .from('user_trips')
        .update({ end_date: formatDateOnly(finalDate) })
        .eq('id', tripId)

      if (updateTripError) throw updateTripError
    }
  },
}
