import { supabaseAdmin } from './supabase-admin'

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export interface TripRow {
  id: string
  user_id: string
  name: string
}

export interface DayRow {
  id: string
  trip_id: string
  day_order: number
  date: string
}

export interface DestinationRow {
  id: string
  day_id: string
  name: string
}

export interface DayAccessResult {
  trip: TripRow
  day: DayRow
  label: string
}

export interface DestinationAccessResult extends DayAccessResult {
  destination: DestinationRow
}

async function fetchTripById(tripId: string): Promise<TripRow> {
  const { data, error } = await supabaseAdmin
    .from('user_trips')
    .select('id, user_id, name')
    .eq('id', tripId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new NotFoundError('Trip not found')
  }

  return data
}

async function fetchDayById(dayId: string): Promise<DayRow> {
  const { data, error } = await supabaseAdmin
    .from('trip_days')
    .select('id, trip_id, day_order, date')
    .eq('id', dayId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new NotFoundError('Day not found')
  }

  return data
}

async function fetchDestinationById(destinationId: string): Promise<DestinationRow> {
  const { data, error } = await supabaseAdmin
    .from('trip_destinations')
    .select('id, day_id, name')
    .eq('id', destinationId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new NotFoundError('Destination not found')
  }

  return data
}

export function formatDayLabel(day: DayRow): string {
  const date = new Date(day.date)
  const formattedDate = Number.isNaN(date.valueOf())
    ? null
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return formattedDate
    ? `Day ${day.day_order} (${formattedDate})`
    : `Day ${day.day_order}`
}

export async function ensureDayAccess(userId: string, dayId: string): Promise<DayAccessResult> {
  const day = await fetchDayById(dayId)
  const trip = await fetchTripById(day.trip_id)

  if (trip.user_id !== userId) {
    throw new ForbiddenError('Day does not belong to this user')
  }

  return {
    trip,
    day,
    label: formatDayLabel(day),
  }
}

export async function ensureDestinationAccess(
  userId: string,
  destinationId: string
): Promise<DestinationAccessResult> {
  const destination = await fetchDestinationById(destinationId)
  const access = await ensureDayAccess(userId, destination.day_id)

  return {
    ...access,
    destination,
  }
}
