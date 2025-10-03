import { useTripStore } from '@/lib/store/trip-store'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import {
  CopilotAction,
  CopilotActionBus,
  CopilotActionEvent,
  CopilotActionEventType,
  CopilotActionListener,
  CopilotActionResult,
  CopilotActionValidator,
  CopilotRuntimeContext,
  CopilotTripSnapshot,
} from '@/lib/copilot/types'
import { snapshotCopilotRuntimeContext } from '@/lib/copilot/runtime-context'
import { centerMapOnCoordinates, centerMapWithBounds, dispatchOpenModal } from '@/lib/copilot/ui-bridge'
import { runCopilotMutation } from '@/lib/copilot/mutations'

const listeners = new Set<CopilotActionListener>()

const emit = (event: CopilotActionEvent) => {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch (error) {
      console.error('CopilotActionBus listener error', error)
    }
  })
}

const validatorList: CopilotActionValidator[] = [
  {
    name: 'validateSelectDayExists',
    validate: (action, context) => {
      if (action.type !== 'selectDay') return { ok: true }
      if (!context.trip) {
        return { ok: false, reason: 'No active trip available' }
      }
      const exists = context.trip.days.some((day) => day.id === action.payload.dayId)
      return exists ? { ok: true } : { ok: false, reason: 'Day not found in active trip' }
    },
  },
  {
    name: 'validateFocusDestinationExists',
    validate: (action, context) => {
      if (action.type !== 'focusDestination') return { ok: true }
      if (!context.trip) {
        return { ok: false, reason: 'No active trip to select destination from' }
      }
      const destinationExists = context.trip.days.some((day) =>
        day.destinations.some((destination) => destination.id === action.payload.destinationId),
      )
      return destinationExists ? { ok: true } : { ok: false, reason: 'Destination not present in trip' }
    },
  },
  {
    name: 'validateOpenModalPayload',
    validate: (action) => {
      if (action.type !== 'openModal') return { ok: true }
      return action.payload.modalId ? { ok: true } : { ok: false, reason: 'Modal id required' }
    },
  },
  {
    name: 'validateHighlightMapAreaPayload',
    validate: (action, context) => {
      if (action.type !== 'highlightMapArea') return { ok: true }

      const hasPlaceIds = Array.isArray(action.payload.placeIds) && action.payload.placeIds.length > 0
      const hasCoordinates = Array.isArray(action.payload.coordinates) && action.payload.coordinates.length > 0
      const hasBounds = Boolean(action.payload.bounds)

      if (!hasPlaceIds && !hasCoordinates && !hasBounds) {
        return { ok: false, reason: 'Highlight action requires placeIds, coordinates, or bounds.' }
      }

      if (hasPlaceIds) {
        const missing = action.payload.placeIds!.filter((placeId) => {
          const knownTripIds = new Set(
            context.trip
              ? context.trip.days.flatMap((day) => day.destinations.map((destination) => destination.id))
              : [],
          )
          if (context.trip) {
            context.trip.maybeLocations.forEach((destination) => knownTripIds.add(destination.id))
          }

          const knownExploreIds = new Set(context.explore.activePlaceIds)
          return !knownTripIds.has(placeId) && !knownExploreIds.has(placeId)
        })

        if (missing.length > 0) {
          return { ok: false, reason: `Copilot cannot locate coordinates for: ${missing.join(', ')}` }
        }
      }

      return { ok: true }
    },
  },
  {
    name: 'validateMutateTripPayload',
    validate: (action) => {
      if (action.type !== 'mutateTrip') return { ok: true }
      return action.payload.mutation ? { ok: true } : { ok: false, reason: 'Mutation name required' }
    },
  },
]

const findDestinationInTrip = (
  trip: CopilotTripSnapshot | null,
  destinationId: string,
) => {
  if (!trip) return null
  for (const day of trip.days) {
    const destination = day.destinations.find((item) => item.id === destinationId)
    if (destination) return destination
  }
  return null
}

const buildDestinationCoordinateLookup = (
  trip: CopilotTripSnapshot | null,
): Map<string, [number, number]> => {
  const lookup = new Map<string, [number, number]>()
  if (!trip) return lookup

  for (const day of trip.days) {
    for (const destination of day.destinations) {
      const coordinates = destination.coordinates as [number, number] | undefined
      if (Array.isArray(coordinates) && coordinates.length === 2) {
        lookup.set(destination.id, coordinates)
      }
    }
  }

  for (const destination of trip.maybeLocations) {
    const coordinates = destination.coordinates as [number, number] | undefined
    if (Array.isArray(coordinates) && coordinates.length === 2) {
      lookup.set(destination.id, coordinates)
    }
  }

  return lookup
}

const collectCoordinatesFromPayload = (
  action: CopilotAction,
  context: CopilotRuntimeContext,
): [number, number][] => {
  if (action.type !== 'highlightMapArea') return []

  const collected: [number, number][] = []

  if (Array.isArray(action.payload.coordinates)) {
    action.payload.coordinates.forEach((coordinate) => {
      if (Array.isArray(coordinate) && coordinate.length === 2) {
        collected.push(coordinate)
      }
    })
  }

  if (Array.isArray(action.payload.placeIds) && action.payload.placeIds.length > 0) {
    const lookup = buildDestinationCoordinateLookup(context.trip)
    action.payload.placeIds.forEach((placeId) => {
      const coordinate = lookup.get(placeId)
      if (coordinate) {
        collected.push(coordinate)
      }
    })
  }

  return collected
}

const executeAction = async (
  action: CopilotAction,
  context: CopilotRuntimeContext,
): Promise<CopilotActionResult> => {
  switch (action.type) {
    case 'selectDay': {
      const dayId = action.payload.dayId
      if (context.source === 'supabase') {
        useSupabaseTripStore.getState().setSelectedDay(dayId)
      } else {
        useTripStore.getState().setSelectedDay(dayId)
      }
      return { status: 'accepted', action, message: `Selected day ${dayId}` }
    }
    case 'focusDestination': {
      const destination = findDestinationInTrip(context.trip, action.payload.destinationId)
      if (!destination) {
        return { status: 'rejected', action, message: 'Destination not available in context' }
      }
      const origin = action.payload.origin ?? 'timeline'
      if (context.source === 'supabase') {
        useSupabaseTripStore.getState().setSelectedDestination(destination, origin)
      } else {
        useTripStore.getState().setSelectedDestination(destination, origin)
      }
      return { status: 'accepted', action, message: `Focused destination ${destination.id}` }
    }
    case 'openModal': {
      if (action.payload.modalId === 'destinationOverview') {
        const destinationIdFromContext = typeof action.payload.context?.destinationId === 'string'
          ? action.payload.context?.destinationId
          : undefined

        const destinationId = destinationIdFromContext ?? context.selection.destinationId ?? undefined

        if (!destinationId) {
          return {
            status: 'rejected',
            action,
            message: 'No destination specified to open in the overview modal.',
          }
        }

        const destination = findDestinationInTrip(context.trip, destinationId)
        if (!destination) {
          return {
            status: 'rejected',
            action,
            message: 'The requested destination is not part of the current trip.',
          }
        }

        if (context.source === 'supabase') {
          useSupabaseTripStore.getState().setSelectedDestination(destination, 'preview')
        } else {
          useTripStore.getState().setSelectedDestination(destination, 'preview')
        }

        return {
          status: 'accepted',
          action,
          message: `Opened destination overview for ${destination.name ?? destination.id}.`,
        }
      }

      dispatchOpenModal(action.payload.modalId, action.payload.context)
      return { status: 'accepted', action, message: `Requested modal ${action.payload.modalId}` }
    }
    case 'highlightMapArea': {
      if (action.payload.bounds) {
        centerMapWithBounds(action.payload.bounds)
        return { status: 'accepted', action, message: 'Highlighted map area with bounds' }
      }

      const coordinates = collectCoordinatesFromPayload(action, context)

      if (!coordinates.length) {
        return { status: 'rejected', action, message: 'No coordinates available to highlight on the map' }
      }

      centerMapOnCoordinates(coordinates)
      return { status: 'accepted', action, message: 'Highlighted map area' }
    }
    case 'mutateTrip': {
      return runCopilotMutation(action, context)
    }
    case 'noop':
    default:
      return { status: 'accepted', action, message: 'No operation performed' }
  }
}

const determineEventType = (result: CopilotActionResult): CopilotActionEventType => {
  switch (result.status) {
    case 'accepted':
      return 'actionCompleted'
    case 'rejected':
      return 'actionRejected'
    case 'failed':
    default:
      return 'actionFailed'
  }
}

const dispatch = async (action: CopilotAction): Promise<CopilotActionResult> => {
  const context = snapshotCopilotRuntimeContext()

  for (const validator of validatorList) {
    const outcome = validator.validate(action, context)
    if (!outcome.ok) {
      const result: CopilotActionResult = {
        status: 'rejected',
        action,
        message: outcome.reason,
      }
      emit({ type: 'actionRejected', action, result })
      return result
    }
  }

  emit({ type: 'actionDispatched', action })

  try {
    const result = await executeAction(action, context)
    const eventType = determineEventType(result)
    emit({ type: eventType, action, result })
    return result
  } catch (error) {
    const result: CopilotActionResult = {
      status: 'failed',
      action,
      message: error instanceof Error ? error.message : 'Unknown error dispatching action',
      error: error instanceof Error ? error : new Error('Unknown error dispatching action'),
    }
    emit({ type: 'actionFailed', action, result })
    return result
  }
}

const subscribe = (listener: CopilotActionListener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const copilotActionBus: CopilotActionBus = {
  dispatch,
  subscribe,
}

export const registerCopilotActionValidator = (validator: CopilotActionValidator) => {
  validatorList.push(validator)
}
