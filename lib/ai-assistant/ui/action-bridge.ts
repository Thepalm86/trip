'use client'

import { useCallback } from 'react'

import {
  assistantUiActionCollectionSchema,
  type AssistantAddPlacePayload,
  type AssistantRemoveOrReplacePayload,
  type AssistantReschedulePayload,
  type AssistantUiAction,
} from '@/lib/assistant/actions'
import { type Destination } from '@/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'

type TripStoreApi = ReturnType<typeof useSupabaseTripStore.getState>

export type AssistantActionDispatchMeta = {
  conversationId?: string
  responseMessageId?: string
}

export type AssistantActionDispatchResult = {
  action: AssistantUiAction
  status: 'applied' | 'skipped' | 'failed'
  reason?: string
}

type ScheduleMetadata = {
  minutes?: number
  durationMinutes?: number
  confidence?: number
}

export const SCHEDULE_NOTE_PREFIX = '[assistant-schedule]'

function minutesFromIso(iso?: string | null): number | undefined {
  if (!iso) return undefined
  const isoMatch = iso.match(/T(\d{2}):(\d{2})/)
  if (isoMatch) {
    const hours = Number.parseInt(isoMatch[1] ?? '', 10)
    const minutes = Number.parseInt(isoMatch[2] ?? '', 10)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours * 60 + minutes
    }
  }

  const timeMatch = iso.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (timeMatch) {
    const hours = Number.parseInt(timeMatch[1] ?? '', 10)
    const minutes = Number.parseInt(timeMatch[2] ?? '', 10)
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours * 60 + minutes
    }
  }

  return undefined
}

function formatMinutes(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function stripScheduleMetadata(notes?: string | null): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter((line) => !line.trim().startsWith(SCHEDULE_NOTE_PREFIX))
    .join('\n')
    .trim()
}

function extractScheduleMetadata(notes?: string | null): ScheduleMetadata {
  if (!notes) return {}
  const scheduleLine = notes
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(SCHEDULE_NOTE_PREFIX))

  if (!scheduleLine) return {}

  const tokens = scheduleLine.slice(SCHEDULE_NOTE_PREFIX.length).trim().split(/\s+/)
  const metadata: ScheduleMetadata = {}

  tokens.forEach((token) => {
    const [key, rawValue] = token.split('=')
    if (!key || rawValue === undefined) return
    switch (key) {
      case 'start': {
        const timeMatch = rawValue.match(/^(\d{2}):(\d{2})$/)
        if (timeMatch) {
          metadata.minutes = Number.parseInt(timeMatch[1], 10) * 60 + Number.parseInt(timeMatch[2], 10)
        }
        break
      }
      case 'duration': {
        const value = Number.parseInt(rawValue, 10)
        if (!Number.isNaN(value)) {
          metadata.durationMinutes = value
        }
        break
      }
      case 'confidence': {
        const value = Number.parseInt(rawValue, 10)
        if (!Number.isNaN(value)) {
          metadata.confidence = value / 100
        }
        break
      }
      default:
        break
    }
  })

  return metadata
}

function composeScheduleNotes(params: {
  userNotes?: string | null
  minutes?: number
  durationMinutes?: number
  confidence?: number
}): string | undefined {
  const { userNotes, minutes, durationMinutes, confidence } = params
  const sanitizedUserNotes = stripScheduleMetadata(userNotes)

  if (minutes === undefined) {
    return sanitizedUserNotes || undefined
  }

  const tokens: string[] = [`start=${formatMinutes(minutes)}`]
  if (durationMinutes !== undefined) {
    tokens.push(`duration=${Math.max(0, Math.round(durationMinutes))}`)
  }
  if (confidence !== undefined) {
    tokens.push(`confidence=${Math.max(0, Math.min(100, Math.round(confidence * 100)))}`)
  }

  const scheduleLine = `${SCHEDULE_NOTE_PREFIX} ${tokens.join(' ')}`
  return sanitizedUserNotes ? `${scheduleLine}\n${sanitizedUserNotes}` : scheduleLine
}

function calculateInsertionIndex(
  destinations: Destination[],
  desiredMinutes: number | undefined,
  excludeId?: string
): { index: number; snapshot: Destination[] } {
  const snapshot = excludeId
    ? destinations.filter((destination) => destination.id !== excludeId)
    : [...destinations]

  if (desiredMinutes === undefined) {
    return { index: snapshot.length, snapshot }
  }

  for (let index = 0; index < snapshot.length; index += 1) {
    const schedule = extractScheduleMetadata(snapshot[index]?.notes)
    const existingMinutes = schedule.minutes ?? Number.POSITIVE_INFINITY
    if (desiredMinutes < existingMinutes) {
      return { index, snapshot }
    }
  }

  return { index: snapshot.length, snapshot }
}

/**
 * Builds a destination record compatible with the Supabase trip store.
 */
function buildDestinationDraft(
  payload: Pick<
    AssistantAddPlacePayload,
    'fallbackQuery' | 'placeId' | 'lat' | 'lng' | 'durationMinutes' | 'notes' | 'tags'
  >,
  options: { minutes?: number; durationMinutes?: number; confidence?: number }
): Destination | null {
  if (payload.lat === undefined || payload.lng === undefined) {
    return null
  }

  const id = payload.placeId || `temp-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  const durationMinutes = options.durationMinutes ?? payload.durationMinutes
  const estimatedDuration =
    durationMinutes !== undefined && Number.isFinite(durationMinutes)
      ? Number((durationMinutes / 60).toFixed(2))
      : undefined

  const notes = composeScheduleNotes({
    userNotes: payload.notes,
    minutes: options.minutes,
    durationMinutes,
    confidence: options.confidence,
  })

  return {
    id,
    name: payload.fallbackQuery,
    coordinates: [payload.lng, payload.lat],
    category: payload.tags?.[0],
    estimatedDuration: estimatedDuration && estimatedDuration > 0 ? estimatedDuration : undefined,
    notes: notes || undefined,
  }
}

function findDestinationById(dayId: string, destinationId: string) {
  const { currentTrip } = useSupabaseTripStore.getState()
  const day = currentTrip?.days.find((entry) => entry.id === dayId)
  return day?.destinations.find((dest) => dest.id === destinationId)
}

function findLatestDestinationMatch(dayId: string, matcher: (destination: Destination) => boolean) {
  const { currentTrip } = useSupabaseTripStore.getState()
  const day = currentTrip?.days.find((entry) => entry.id === dayId)
  if (!day) return undefined
  return [...day.destinations].reverse().find(matcher)
}

async function applyAddPlace(
  payload: AssistantAddPlacePayload,
  confidence: number | undefined,
  addDestinationToDay: TripStoreApi['addDestinationToDay'],
  setSelectedDay: TripStoreApi['setSelectedDay'],
  setSelectedDestination: TripStoreApi['setSelectedDestination']
) {
  const { currentTrip } = useSupabaseTripStore.getState()
  if (!currentTrip) {
    return { status: 'skipped' as const, reason: 'No active trip in progress.' }
  }

  const targetDay = currentTrip.days.find((day) => day.id === payload.dayId)
  if (!targetDay) {
    return { status: 'skipped' as const, reason: `Unknown dayId ${payload.dayId}` }
  }

  const minutes = minutesFromIso(payload.startTime)
  const draft = buildDestinationDraft(payload, {
    minutes,
    durationMinutes: payload.durationMinutes,
    confidence,
  })

  if (!draft) {
    return { status: 'skipped' as const, reason: 'Missing coordinates for place insertion.' }
  }

  const { index } = calculateInsertionIndex(targetDay.destinations, minutes)
  await addDestinationToDay(draft, payload.dayId, { index })
  setSelectedDay(payload.dayId)

  const created = findLatestDestinationMatch(payload.dayId, (dest) => {
    const sameName = dest.name === draft.name
    const sameCoords =
      Math.abs(dest.coordinates?.[0] - draft.coordinates[0]) < 0.0001 &&
      Math.abs(dest.coordinates?.[1] - draft.coordinates[1]) < 0.0001
    return sameName && sameCoords
  })

  if (created) {
    setSelectedDestination(created, 'timeline')
  }

  return { status: 'applied' as const }
}

async function applyReschedule(
  payload: AssistantReschedulePayload,
  moveDestination: TripStoreApi['moveDestination'],
  updateDestination: TripStoreApi['updateDestination'],
  setSelectedDay: TripStoreApi['setSelectedDay'],
  setSelectedDestination: TripStoreApi['setSelectedDestination']
) {
  if ((payload.lockedDependencies?.length ?? 0) > 0 && !payload.userConfirmed) {
    return {
      status: 'skipped' as const,
      reason: 'Reschedule requires explicit confirmation due to locked dependencies.',
    }
  }

  const origin = findDestinationById(payload.dayId, payload.itemId)
  if (!origin) {
    return {
      status: 'skipped' as const,
      reason: `Unable to locate itinerary item ${payload.itemId}`,
    }
  }

  const { currentTrip } = useSupabaseTripStore.getState()
  if (!currentTrip) {
    return { status: 'skipped' as const, reason: 'No active trip in progress.' }
  }

  const targetDay = currentTrip.days.find((day) => day.id === payload.newDayId)
  if (!targetDay) {
    return { status: 'skipped' as const, reason: `Unknown target dayId ${payload.newDayId}` }
  }

  const minutes = minutesFromIso(payload.newStartTime)
  const { index } = calculateInsertionIndex(targetDay.destinations, minutes, payload.itemId)
  await moveDestination(payload.itemId, payload.dayId, payload.newDayId, index)
  setSelectedDay(payload.newDayId)

  const moved = findDestinationById(payload.newDayId, payload.itemId)
  if (moved) {
    const updatedNotes = composeScheduleNotes({
      userNotes: moved.notes,
      minutes,
      durationMinutes: payload.newDurationMinutes,
    })

    const updatedDestination: Destination = {
      ...moved,
      estimatedDuration:
        payload.newDurationMinutes !== undefined
          ? Number((payload.newDurationMinutes / 60).toFixed(2))
          : moved.estimatedDuration,
      notes: updatedNotes ?? undefined,
    }

    await updateDestination(payload.newDayId, moved.id, updatedDestination)
    const refreshed = findDestinationById(payload.newDayId, moved.id)
    if (refreshed) {
      setSelectedDestination(refreshed, 'timeline')
    }
  }

  return { status: 'applied' as const }
}

async function applyRemoveOrReplace(
  payload: AssistantRemoveOrReplacePayload,
  removeDestinationFromDay: TripStoreApi['removeDestinationFromDay'],
  addDestinationToDay: TripStoreApi['addDestinationToDay'],
  setSelectedDestination: TripStoreApi['setSelectedDestination']
) {
  if (!payload.userConfirmed) {
    return {
      status: 'skipped' as const,
      reason: 'Removal or replacement requires explicit user confirmation.',
    }
  }

  const { currentTrip } = useSupabaseTripStore.getState()
  if (!currentTrip) {
    return { status: 'skipped' as const, reason: 'No active trip in progress.' }
  }

  const day = currentTrip.days.find((entry) => entry.id === payload.dayId)
  if (!day) {
    return { status: 'skipped' as const, reason: `Unknown dayId ${payload.dayId}` }
  }

  const existingIndex = day.destinations.findIndex((dest) => dest.id === payload.itemId)
  const existing = existingIndex >= 0 ? day.destinations[existingIndex] : undefined

  if (!existing) {
    return {
      status: 'skipped' as const,
      reason: `Unable to locate itinerary item ${payload.itemId}`,
    }
  }

  const existingSchedule = extractScheduleMetadata(existing.notes)
  await removeDestinationFromDay(payload.itemId, payload.dayId)
  setSelectedDestination(null)

  if (payload.mode === 'replace' && payload.replacement) {
    const startMinutes =
      minutesFromIso(payload.replacement.startTime) ?? existingSchedule.minutes
    const durationMinutes =
      payload.replacement.durationMinutes ??
      existingSchedule.durationMinutes ??
      (existing.estimatedDuration ? existing.estimatedDuration * 60 : undefined)

    const draft = buildDestinationDraft(
      {
        fallbackQuery: payload.replacement.fallbackQuery,
        placeId: payload.replacement.placeId,
        lat: payload.replacement.lat,
        lng: payload.replacement.lng,
        durationMinutes: durationMinutes ?? payload.replacement.durationMinutes ?? 90,
        notes: payload.replacement.notes,
        tags: payload.replacement.tags,
      },
      {
        minutes: startMinutes,
        durationMinutes,
      }
    )

    if (!draft) {
      return {
        status: 'skipped' as const,
        reason: 'Replacement missing coordinates; removed original but did not insert an alternative.',
      }
    }

    const insertIndex = Math.max(0, existingIndex)
    await addDestinationToDay(draft, payload.dayId, { index: insertIndex })
    const created = findLatestDestinationMatch(payload.dayId, (dest) => dest.name === draft.name)
    if (created) {
      setSelectedDestination(created, 'timeline')
    }
  }

  return { status: 'applied' as const }
}

export function useAssistantActionBridge() {
  const addDestinationToDay = useSupabaseTripStore((state) => state.addDestinationToDay)
  const moveDestination = useSupabaseTripStore((state) => state.moveDestination)
  const updateDestination = useSupabaseTripStore((state) => state.updateDestination)
  const removeDestinationFromDay = useSupabaseTripStore((state) => state.removeDestinationFromDay)
  const setSelectedDay = useSupabaseTripStore((state) => state.setSelectedDay)
  const setSelectedDestination = useSupabaseTripStore((state) => state.setSelectedDestination)

  return useCallback(
    async (
      actions: AssistantUiAction[] | undefined | null,
      meta?: AssistantActionDispatchMeta
    ): Promise<AssistantActionDispatchResult[]> => {
      if (!actions?.length) {
        return []
      }

      const parsed = assistantUiActionCollectionSchema.safeParse(actions)
      if (!parsed.success) {
        console.warn('[assistant-ui] Invalid actions payload', {
          meta,
          issues: parsed.error.issues,
        })
        return []
      }

      const dedupedActions: AssistantUiAction[] = []
      const seenKeys = new Set<string>()

      parsed.data.forEach((action) => {
        const requestIdKey = action.meta?.requestId ? `meta:${action.meta.requestId}` : null
        const payloadKey = JSON.stringify({ type: action.type, payload: action.payload })
        const compoundKey = requestIdKey ?? payloadKey
        if (!seenKeys.has(compoundKey)) {
          seenKeys.add(compoundKey)
          dedupedActions.push(action)
        }
      })

      const results: AssistantActionDispatchResult[] = []

      for (const action of dedupedActions) {
        try {
          switch (action.type) {
            case 'AddPlaceToItinerary': {
              const outcome = await applyAddPlace(
                action.payload,
                action.meta?.confidence ?? action.payload.confidence,
                addDestinationToDay,
                setSelectedDay,
                setSelectedDestination
              )
              results.push({ action, ...outcome })
              break
            }
            case 'RescheduleItineraryItem': {
              const outcome = await applyReschedule(
                action.payload,
                moveDestination,
                updateDestination,
                setSelectedDay,
                setSelectedDestination
              )
              results.push({ action, ...outcome })
              break
            }
            case 'RemoveOrReplaceItem': {
              const outcome = await applyRemoveOrReplace(
                action.payload,
                removeDestinationFromDay,
                addDestinationToDay,
                setSelectedDestination
              )
              results.push({ action, ...outcome })
              break
            }
            default: {
              results.push({
                action,
                status: 'skipped',
                reason: `Unsupported assistant action type ${(action as AssistantUiAction).type}`,
              })
            }
          }
        } catch (error) {
          console.error('[assistant-ui] Failed to apply assistant action', {
            meta,
            action,
            error,
          })
          results.push({
            action,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return results
    },
    [
      addDestinationToDay,
      moveDestination,
      updateDestination,
      removeDestinationFromDay,
      setSelectedDay,
      setSelectedDestination,
    ]
  )
}
