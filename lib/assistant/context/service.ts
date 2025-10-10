import { supabaseAdmin } from '@/lib/server/supabase-admin'
import type {
  AssistantContext,
  AssistantUIContext,
  AssistantDestination,
  AssistantDay,
  AssistantTrip,
  AssistantUser,
} from '@/lib/assistant/context/types'
import {
  assistantContextSchema,
  assistantUserSchema,
} from '@/lib/assistant/context/types'

type BuildContextOptions = {
  userId: string
  ui?: AssistantUIContext
  selectedTripId?: string
}

type TripRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  country_code: string | null
  status: string | null
  notes: string | null
  trip_days: TripDayRow[]
}

type TripDayRow = {
  id: string
  date: string
  day_order: number
  base_location_name: string | null
  base_location_coordinates: string | null
  base_location_context: string | null
  base_locations_json: BaseLocationJson[] | null
  notes: string | null
  trip_destinations: TripDestinationRow[]
}

type BaseLocationJson = {
  name: string
  coordinates?: [number, number]
  context?: string
}

type TripDestinationRow = {
  id: string
  day_id: string | null
  name: string
  description: string | null
  coordinates: string | null
  city: string | null
  category: string | null
  rating: number | null
  image_url: string | null
  estimated_duration_hours: number | null
  opening_hours: string | null
  cost: number | null
  order_index: number | null
  notes: string | null
  links_json: unknown
}

type ExplorePlaceRow = {
  id: string
  name: string
  longitude: number
  latitude: number
  category: string | null
  context: string | null
  notes: string | null
  links_json: unknown
  metadata: Record<string, unknown> | null
  is_favorite: boolean | null
}

type UserPreferenceRow = {
  user_id: string
  default_country: string | null
  preferred_categories: string[] | null
  budget_range_min: number | null
  budget_range_max: number | null
  travel_style: string[] | null
  interests: string[] | null
  accessibility: string[] | null
  dietary: string[] | null
}

function parsePoint(pointStr: string | null): [number, number] | undefined {
  if (!pointStr) return undefined
  const match = pointStr.match(/\(([^,]+),([^)]+)\)/)
  if (!match) return undefined
  const lng = Number.parseFloat(match[1])
  const lat = Number.parseFloat(match[2])
  if (Number.isNaN(lng) || Number.isNaN(lat)) return undefined
  return [lng, lat]
}

type LinkLike = {
  label?: string
  title?: string
  url?: string
}

function parseLinks(links: unknown): AssistantDestination['links'] {
  if (!links) return undefined
  if (typeof links === 'string') {
    try {
      const parsed = JSON.parse(links)
      return parseLinks(parsed)
    } catch {
      return undefined
    }
  }

  if (Array.isArray(links)) {
    const normalized = links
      .map((value) => {
        if (typeof value === 'string') {
          return { label: value, url: value }
        }
        if (value && typeof value === 'object') {
          const entry = value as LinkLike
          if (typeof entry.url === 'string') {
            return {
              label: entry.label || entry.title || entry.url,
              url: entry.url,
            }
          }
        }
        return null
      })
      .filter((value): value is { label: string; url: string } => Boolean(value))

    return normalized.length ? normalized : undefined
  }

  return undefined
}

function sortDays(days: TripDayRow[]): TripDayRow[] {
  return [...days].sort((a, b) => a.day_order - b.day_order)
}

function sortDestinations(destinations: TripDestinationRow[]): TripDestinationRow[] {
  return [...destinations].sort((a, b) => {
    const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER
    const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER
    if (orderA === orderB) {
      return a.name.localeCompare(b.name)
    }
    return orderA - orderB
  })
}

function mapBaseLocations(day: TripDayRow) {
  if (Array.isArray(day.base_locations_json) && day.base_locations_json.length > 0) {
    return day.base_locations_json
      .map((base) => ({
        name: base.name,
        coordinates: base.coordinates ?? parsePoint(day.base_location_coordinates) ?? undefined,
        context: base.context ?? undefined,
      }))
      .filter((base) => base.name && base.coordinates) as AssistantDay['baseLocations']
  }

  if (day.base_location_name) {
    const coords = parsePoint(day.base_location_coordinates)
    if (!coords) return undefined
    return [
      {
        name: day.base_location_name,
        coordinates: coords,
        context: day.base_location_context ?? undefined,
      },
    ]
  }

  return undefined
}

function mapDestination(destination: TripDestinationRow): AssistantDestination {
  const coordinates = parsePoint(destination.coordinates) ?? [0, 0]
  return {
    id: destination.id,
    name: destination.name,
    description: destination.description ?? undefined,
    category: destination.category ?? undefined,
    city: destination.city ?? undefined,
    coordinates,
    durationHours: destination.estimated_duration_hours ?? undefined,
    notes: destination.notes ?? undefined,
    cost: destination.cost ?? undefined,
    links: parseLinks(destination.links_json),
  }
}

function mapTripDay(day: TripDayRow): AssistantDay {
  const destinations = sortDestinations(day.trip_destinations ?? []).map(mapDestination)

  return {
    dayOrder: day.day_order,
    date: day.date,
    baseLocations: mapBaseLocations(day),
    destinations,
    openSlots: [],
    notes: day.notes ?? undefined,
  }
}

function mapTrip(row: TripRow): AssistantTrip {
  const days = sortDays(row.trip_days ?? []).map(mapTripDay)
  return {
    id: row.id,
    name: row.name,
    country: row.country_code ?? undefined,
    window: {
      start: row.start_date,
      end: row.end_date,
    },
    days,
  }
}

function mapExploreMarkers(rows: ExplorePlaceRow[]) {
  return rows.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : undefined
    const sourceValue =
      metadata && typeof metadata['source'] === 'string'
        ? (metadata['source'] as string)
        : undefined

    return {
      id: row.id,
      name: row.name,
      coordinates: [row.longitude, row.latitude] as [number, number],
      category: row.category ?? undefined,
      context: row.context ?? row.notes ?? undefined,
      source: sourceValue === 'assistant' ? 'assistant' : 'user',
      metadata,
    }
  })
}

function mapUserPreferences(row: UserPreferenceRow | null): AssistantUser['preferences'] {
  if (!row) return undefined
  return {
    budgetRange:
      row.budget_range_min || row.budget_range_max
        ? { min: row.budget_range_min ?? undefined, max: row.budget_range_max ?? undefined }
        : undefined,
    travelStyle: row.travel_style ?? undefined,
    interests: row.interests ?? undefined,
    accessibility: row.accessibility ?? undefined,
    dietary: row.dietary ?? undefined,
  }
}

async function fetchTrip(options: BuildContextOptions): Promise<TripRow | null> {
  const { userId, selectedTripId } = options
  if (!userId) return null

  const baseQuery = supabaseAdmin
    .from('user_trips')
    .select(
      `
      id,
      name,
      start_date,
      end_date,
      country_code,
      status,
      notes,
      trip_days (
        id,
        date,
        day_order,
        base_location_name,
        base_location_coordinates,
        base_location_context,
        base_locations_json,
        notes,
        trip_destinations (
          id,
          day_id,
          name,
          description,
          coordinates,
          city,
          category,
          rating,
          image_url,
          estimated_duration_hours,
          opening_hours,
          cost,
          order_index,
          notes,
          links_json
        )
      )
    `
    )
    .eq('user_id', userId)

  if (selectedTripId) {
    const { data, error } = await baseQuery.eq('id', selectedTripId).maybeSingle()
    if (error) {
      console.error('[assistant] fetchTrip error', error)
      return null
    }
    if (data) return data as TripRow
  }

  const { data, error } = await baseQuery
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[assistant] fetchTrip fallback error', error)
    return null
  }

  return (data?.[0] as TripRow) ?? null
}

async function fetchExploreMarkers(userId: string): Promise<ExplorePlaceRow[]> {
  const { data, error } = await supabaseAdmin
    .from('explore_places')
    .select(
      `
        id,
        name,
        longitude,
        latitude,
        category,
        context,
        notes,
        links_json,
        metadata,
        is_favorite
      `
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[assistant] fetchExploreMarkers error', error)
    return []
  }

  return (data as ExplorePlaceRow[]) ?? []
}

async function fetchUserPreferences(userId: string): Promise<UserPreferenceRow | null> {
  const { data, error } = await supabaseAdmin
    .from('user_trip_preferences')
    .select(
      `
        user_id,
        default_country,
        preferred_categories,
        budget_range_min,
        budget_range_max,
        travel_style,
        interests,
        accessibility,
        dietary
      `
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[assistant] fetchUserPreferences error', error)
    return null
  }

  return (data as UserPreferenceRow) ?? null
}

export async function buildAssistantContext(
  options: BuildContextOptions
): Promise<AssistantContext> {
  const { userId, ui } = options
  const [tripRow, exploreRows, preferenceRow] = await Promise.all([
    fetchTrip(options),
    fetchExploreMarkers(userId),
    fetchUserPreferences(userId),
  ])

  const trip = tripRow ? mapTrip(tripRow) : undefined
  const exploreMarkers = mapExploreMarkers(exploreRows)

  const user = assistantUserSchema.parse({
    id: userId,
    preferences: mapUserPreferences(preferenceRow),
  })

  const contextObject = {
    user,
    trip,
    exploreMarkers,
    ui,
    generatedAt: new Date().toISOString(),
  }

  return assistantContextSchema.parse(contextObject)
}

export const __testables = {
  parsePoint,
  parseLinks,
  mapDestination,
  mapTripDay,
  mapTrip,
  mapExploreMarkers,
  mapUserPreferences,
}
