import { CopilotRuntimeContext, CopilotActionResult, MutateTripAction } from '@/lib/copilot/types'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useTripStore } from '@/lib/store/trip-store'

export type CopilotMutationHandler = (
  action: MutateTripAction,
  context: CopilotRuntimeContext,
) => Promise<CopilotActionResult>

const mutationHandlers = new Map<string, CopilotMutationHandler>()

export const registerCopilotMutation = (name: string, handler: CopilotMutationHandler) => {
  mutationHandlers.set(name, handler)
}

export const getCopilotMutation = (name: string): CopilotMutationHandler | undefined =>
  mutationHandlers.get(name)

export const listCopilotMutations = () => Array.from(mutationHandlers.keys())

const createNotImplementedResult = (
  action: MutateTripAction,
): CopilotActionResult => ({
  status: 'failed',
  action,
  message: `Mutation "${action.payload.mutation}" is not registered.`,
  error: new Error(`Copilot mutation not registered: ${action.payload.mutation}`),
})

export const runCopilotMutation = async (
  action: MutateTripAction,
  context: CopilotRuntimeContext,
): Promise<CopilotActionResult> => {
  const handler = getCopilotMutation(action.payload.mutation)
  if (!handler) {
    return createNotImplementedResult(action)
  }

  return handler(action, context)
}

const failResult = (
  action: MutateTripAction,
  message: string,
  error?: unknown,
): CopilotActionResult => ({
  status: 'failed',
  action,
  message,
  error: error instanceof Error ? error : error ? new Error(String(error)) : undefined,
})

registerCopilotMutation('addDay', async (action, context) => {
  try {
    if (context.source === 'supabase') {
      await useSupabaseTripStore.getState().addNewDay()
    } else {
      useTripStore.getState().addNewDay()
    }

    return {
      status: 'accepted',
      action,
      message: 'Added a new day to the trip.',
    }
  } catch (error) {
    return failResult(action, 'Unable to add a new day right now.', error)
  }
})

registerCopilotMutation('removeDestination', async (action, context) => {
  const args = action.payload.args ?? {}
  const destinationId = typeof args.destinationId === 'string'
    ? args.destinationId
    : context.selection.destinationId ?? undefined

  const dayIdFromArgs = typeof args.dayId === 'string' ? args.dayId : undefined

  let resolvedDayId = dayIdFromArgs

  if (!resolvedDayId && destinationId && context.trip) {
    const day = context.trip.days.find((tripDay) =>
      tripDay.destinations.some((destination) => destination.id === destinationId),
    )
    if (day) {
      resolvedDayId = day.id
    }
  }

  if (!destinationId) {
    return {
      status: 'rejected',
      action,
      message: 'I could not figure out which destination to remove.',
    }
  }

  if (!resolvedDayId) {
    return {
      status: 'rejected',
      action,
      message: 'I could not match that destination to any trip day.',
    }
  }

  try {
    if (context.source === 'supabase') {
      await useSupabaseTripStore.getState().removeDestinationFromDay(destinationId, resolvedDayId)
      useSupabaseTripStore.getState().setSelectedDestination(null)
    } else {
      useTripStore.getState().removeDestinationFromDay(destinationId, resolvedDayId)
      useTripStore.getState().setSelectedDestination(null)
    }

    return {
      status: 'accepted',
      action,
      message: 'Removed the destination from the day.',
    }
  } catch (error) {
    return failResult(action, 'Unable to remove that destination right now.', error)
  }
})

registerCopilotMutation('moveMaybeToDay', async (action, context) => {
  if (context.source !== 'supabase') {
    return failResult(action, 'Moving maybe destinations is only supported on synced trips right now.')
  }

  const args = action.payload.args ?? {}
  const destinationId = typeof args.destinationId === 'string'
    ? args.destinationId
    : context.selection.destinationId ?? undefined

  const targetDayIndexFromArgs = typeof args.dayNumber === 'number' ? args.dayNumber - 1 : undefined
  const targetDayIdFromArgs = typeof args.dayId === 'string' ? args.dayId : undefined

  let targetDayId = targetDayIdFromArgs

  if (!targetDayId && typeof args.dayIndex === 'number') {
    const day = context.trip?.days?.[args.dayIndex]
    if (day) targetDayId = day.id
  }

  if (!targetDayId && targetDayIndexFromArgs !== undefined && context.trip) {
    const day = context.trip.days[targetDayIndexFromArgs]
    if (day) targetDayId = day.id
  }

  if (!targetDayId && context.selection.dayId) {
    targetDayId = context.selection.dayId
  }

  if (!destinationId) {
    return {
      status: 'rejected',
      action,
      message: 'Select a maybe destination first or specify its id.',
    }
  }

  if (!targetDayId) {
    return {
      status: 'rejected',
      action,
      message: 'Tell me which day to move that destination into.',
    }
  }

  try {
    await useSupabaseTripStore.getState().moveMaybeToDay(destinationId, targetDayId)
    useSupabaseTripStore.getState().setSelectedDay(targetDayId)

    return {
      status: 'accepted',
      action,
      message: 'Moved the destination into your itinerary.',
    }
  } catch (error) {
    return failResult(action, 'Unable to move that destination right now.', error)
  }
})

registerCopilotMutation('updateDayNotes', async (action, context) => {
  const args = action.payload.args ?? {}
  const notesRaw = typeof args.notes === 'string' ? args.notes : undefined
  const notes = notesRaw?.trim()

  const targetDayId = typeof args.dayId === 'string'
    ? args.dayId
    : (() => {
        if (typeof args.dayNumber === 'number' && context.trip) {
          const day = context.trip.days[args.dayNumber - 1]
          return day?.id
        }
        return context.selection.dayId ?? undefined
      })()

  if (!notes) {
    return {
      status: 'rejected',
      action,
      message: 'Please include the note text you want to save.',
    }
  }

  if (!targetDayId) {
    return {
      status: 'rejected',
      action,
      message: 'I need to know which day to attach that note to.',
    }
  }

  try {
    if (context.source === 'supabase') {
      await useSupabaseTripStore.getState().updateDayNotes(targetDayId, notes)
      useSupabaseTripStore.getState().setSelectedDay(targetDayId)
    } else {
      useTripStore.getState().updateDayNotes(targetDayId, notes)
      useTripStore.getState().setSelectedDay(targetDayId)
    }

    return {
      status: 'accepted',
      action,
      message: 'Updated the notes for that day.',
    }
  } catch (error) {
    return failResult(action, 'Unable to update day notes right now.', error)
  }
})
