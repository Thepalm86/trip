import { supabaseAdmin } from './supabase-admin'
import {
  ensureDayAccess,
  ensureDestinationAccess,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  formatDayLabel,
} from './assistant-actions'
import type { AssistantActionIntent } from '@/lib/assistant/actions/types'

interface ExecutionResult {
  summary: string
}

type DayLocationsJson = Array<{
  name: string
  coordinates?: [number, number]
  context?: string
  notes?: string
  links?: Array<{ label: string; url: string }>
}>

function formatPoint(coordinates?: [number, number]) {
  if (!coordinates || coordinates.length !== 2) return null
  return `(${coordinates[0]},${coordinates[1]})`
}

function minutesToHours(minutes?: number) {
  if (typeof minutes !== 'number') return null
  return Math.round((minutes / 60) * 100) / 100
}

async function reorderDayDestinations(dayId: string) {
  const { data, error } = await supabaseAdmin
    .from('trip_destinations')
    .select('id')
    .eq('day_id', dayId)
    .order('order_index', { ascending: true })

  if (error) throw error
  if (!data) return

  for (let index = 0; index < data.length; index += 1) {
    const destination = data[index]
    const { error: updateError } = await supabaseAdmin
      .from('trip_destinations')
      .update({ order_index: index })
      .eq('id', destination.id)

    if (updateError) throw updateError
  }
}

async function executeAddDestination(userId: string, action: AssistantActionIntent): Promise<ExecutionResult> {
  if (action.type !== 'add_destination') {
    throw new ValidationError('Invalid action payload for add_destination executor')
  }

  const access = await ensureDayAccess(userId, action.dayId)

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('trip_destinations')
    .select('id, order_index')
    .eq('day_id', action.dayId)
    .order('order_index', { ascending: true })

  if (existingError) throw existingError

  const current = existing ?? []
  const targetIndex = Math.min(
    Math.max(action.insertIndex ?? current.length, 0),
    current.length
  )

  if (current.length) {
    const bumpPayload = current
      .filter((dest) => dest.order_index >= targetIndex)
      .map((dest) => ({
        id: dest.id,
        order_index: dest.order_index + 1,
      }))

    for (const item of bumpPayload) {
      const { error: updateError } = await supabaseAdmin
        .from('trip_destinations')
        .update({ order_index: item.order_index })
        .eq('id', item.id)

      if (updateError) throw updateError
    }
  }

  const destination = action.destination
  const insertPayload = {
    day_id: action.dayId,
    name: destination.name,
    description: null,
    coordinates: formatPoint(destination.coordinates),
    city: destination.city ?? null,
    category: destination.category ?? null,
    order_index: targetIndex,
    notes: destination.notes ?? null,
    estimated_duration_hours: minutesToHours(destination.estimatedDurationMinutes),
    links_json: destination.links ? JSON.stringify(destination.links) : null,
  }

  const { error: insertError } = await supabaseAdmin
    .from('trip_destinations')
    .insert(insertPayload)
  if (insertError) throw insertError

  return {
    summary: `Added “${destination.name}” to ${formatDayLabel(access.day)}`,
  }
}

async function executeUpdateDestination(userId: string, action: AssistantActionIntent): Promise<ExecutionResult> {
  if (action.type !== 'update_destination') {
    throw new ValidationError('Invalid action payload for update_destination executor')
  }

  const access = await ensureDestinationAccess(userId, action.destinationId)
  if (access.day.id !== action.dayId) {
    throw new ValidationError('Destination does not belong to supplied dayId')
  }

  const changes = action.changes
  const updatePayload: Record<string, unknown> = {}

  if (changes.name) updatePayload.name = changes.name
  if (changes.category) updatePayload.category = changes.category
  if (changes.city) updatePayload.city = changes.city
  if (changes.notes) updatePayload.notes = changes.notes
  if (changes.coordinates) updatePayload.coordinates = formatPoint(changes.coordinates)
  if (typeof changes.estimatedDurationMinutes === 'number') {
    updatePayload.estimated_duration_hours = minutesToHours(changes.estimatedDurationMinutes)
  }
  if (changes.links) updatePayload.links_json = JSON.stringify(changes.links)

  if (Object.keys(updatePayload).length === 0) {
    throw new ValidationError('No valid fields provided to update.')
  }

  const { error } = await supabaseAdmin
    .from('trip_destinations')
    .update(updatePayload)
    .eq('id', action.destinationId)

  if (error) throw error

  const name = changes.name ?? access.destination.name
  return {
    summary: `Updated “${name}” on ${formatDayLabel(access.day)}`,
  }
}

async function executeSetBaseLocation(userId: string, action: AssistantActionIntent): Promise<ExecutionResult> {
  if (action.type !== 'set_base_location') {
    throw new ValidationError('Invalid action payload for set_base_location executor')
  }

  const access = await ensureDayAccess(userId, action.dayId)

  const { data: dayRow, error: dayError } = await supabaseAdmin
    .from('trip_days')
    .select('base_locations_json')
    .eq('id', action.dayId)
    .maybeSingle()

  if (dayError) throw dayError

  const existing: DayLocationsJson = Array.isArray(dayRow?.base_locations_json)
    ? (dayRow!.base_locations_json as DayLocationsJson)
    : []

  const target = {
    name: action.location.name,
    coordinates: action.location.coordinates,
    context: action.location.context,
    notes: action.location.notes,
    links: action.location.links,
  }

  let nextLocations: DayLocationsJson
  if (action.replaceExisting !== false) {
    nextLocations = [target]
  } else {
    const clone = [...existing]
    const index = Math.min(
      Math.max(action.locationIndex ?? clone.length, 0),
      clone.length
    )
    clone.splice(index, 0, target)
    nextLocations = clone
  }

  const primary = nextLocations[0] ?? null

  const updatePayload = {
    base_locations_json: nextLocations,
    base_location_name: primary?.name ?? null,
    base_location_coordinates: primary?.coordinates ? formatPoint(primary.coordinates) : null,
    base_location_context: primary?.context ?? null,
  }

  const { error } = await supabaseAdmin
    .from('trip_days')
    .update(updatePayload)
    .eq('id', action.dayId)

  if (error) throw error

  return {
    summary: `Updated base location for ${formatDayLabel(access.day)} to “${action.location.name}”`,
  }
}

async function executeMoveDestination(userId: string, action: AssistantActionIntent): Promise<ExecutionResult> {
  if (action.type !== 'move_destination') {
    throw new ValidationError('Invalid action payload for move_destination executor')
  }

  const origin = await ensureDestinationAccess(userId, action.destinationId)
  if (origin.day.id !== action.fromDayId) {
    throw new ValidationError('Destination does not belong to supplied fromDayId')
  }

  const targetDay = await ensureDayAccess(userId, action.toDayId)
  if (origin.trip.id !== targetDay.trip.id) {
    throw new ForbiddenError('Destination can only be moved within the same trip')
  }

  const { error: transferError } = await supabaseAdmin
    .from('trip_destinations')
    .update({ day_id: action.toDayId })
    .eq('id', action.destinationId)

  if (transferError) throw transferError

  // Reorder source day (after removal)
  await reorderDayDestinations(action.fromDayId)

  // Reorder target day with new insert index
  const { data: toDayDestinations, error: toDayError } = await supabaseAdmin
    .from('trip_destinations')
    .select('id')
    .eq('day_id', action.toDayId)
    .order('order_index', { ascending: true })

  if (toDayError) throw toDayError
  if (!toDayDestinations) throw new NotFoundError('Target day destinations not found')

  const filtered = toDayDestinations
    .map((dest) => dest.id)
    .filter((id) => id !== action.destinationId)

  const insertIndex = Math.min(
    Math.max(action.insertIndex ?? filtered.length, 0),
    filtered.length
  )
  filtered.splice(insertIndex, 0, action.destinationId)

  for (let index = 0; index < filtered.length; index += 1) {
    const destinationId = filtered[index]
    const { error: updateError } = await supabaseAdmin
      .from('trip_destinations')
      .update({ order_index: index })
      .eq('id', destinationId)

    if (updateError) throw updateError
  }

  const destinationName = origin.destination.name
  return {
    summary: `Moved “${destinationName}” from ${formatDayLabel(origin.day)} to ${formatDayLabel(targetDay.day)}`,
  }
}

async function executeToggleOverlay(action: AssistantActionIntent): Promise<ExecutionResult> {
  if (action.type !== 'toggle_map_overlay') {
    throw new ValidationError('Invalid action payload for toggle_map_overlay executor')
  }

  const stateLabel = action.enabled === false ? 'Hid' : 'Showing'
  return {
    summary: `${stateLabel} ${action.overlay.replace(/_/g, ' ')} overlay`,
  }
}

export async function executeAssistantAction(
  userId: string,
  action: AssistantActionIntent
): Promise<ExecutionResult> {
  console.info('[assistant-actions] executing intent', {
    userId,
    type: action.type,
    action,
  })
  switch (action.type) {
    case 'add_destination':
      return executeAddDestination(userId, action)
    case 'update_destination':
      return executeUpdateDestination(userId, action)
    case 'set_base_location':
      return executeSetBaseLocation(userId, action)
    case 'move_destination':
      return executeMoveDestination(userId, action)
    case 'toggle_map_overlay':
      return executeToggleOverlay(action)
    default:
      throw new ValidationError(`Unsupported action type: ${(action as AssistantActionIntent).type}`)
  }
}
