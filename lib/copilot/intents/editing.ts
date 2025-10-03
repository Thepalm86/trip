import {
  CopilotAction,
  CopilotIntentHandler,
  CopilotIntentInput,
  CopilotTripSnapshot,
} from '@/lib/copilot/types'
import { createNoTripResponse } from '@/lib/copilot/intents/utils'

const extractDayIndexFromUtterance = (
  utterance: string,
  trip: CopilotTripSnapshot,
): number | null => {
  const dayMatch = utterance.match(/day\s*(\d{1,2})/i)
  if (dayMatch) {
    const requestedIndex = parseInt(dayMatch[1], 10) - 1
    if (requestedIndex >= 0 && requestedIndex < trip.days.length) {
      return requestedIndex
    }
  }
  return null
}

const resolveDayIdFromInput = (
  input: CopilotIntentInput,
  trip: CopilotTripSnapshot,
): { dayId: string; dayIndex: number } | null => {
  const dayIndex = extractDayIndexFromUtterance(input.utterance, trip)
  if (dayIndex !== null) {
    return { dayId: trip.days[dayIndex].id, dayIndex }
  }

  if (input.context.selection.dayId) {
    const selectedIndex = trip.days.findIndex((day) => day.id === input.context.selection.dayId)
    if (selectedIndex >= 0) {
      return { dayId: trip.days[selectedIndex].id, dayIndex: selectedIndex }
    }
  }

  return null
}

const addDayIntent: CopilotIntentHandler = {
  name: 'addDay',
  canHandle: ({ utterance, context }) => {
    if (!context.trip) return false
    return /(add|another|one more|extra).*day/i.test(utterance)
  },
  execute: ({ context }) => {
    if (!context.trip) return createNoTripResponse()

    const newDayNumber = context.trip.days.length + 1
    const response = `Adding Day ${newDayNumber} to ${context.trip.name}.`

    const actions: CopilotAction[] = [
      {
        type: 'mutateTrip',
        payload: {
          mutation: 'addDay',
        },
      },
    ]

    return {
      response,
      actions,
    }
  },
}

const removeDestinationIntent: CopilotIntentHandler = {
  name: 'removeDestination',
  canHandle: ({ utterance, context }) => {
    if (!context.trip) return false
    if (!context.selection.destinationId) return false
    return /(remove|delete|drop).*(destination|this)/i.test(utterance)
  },
  execute: ({ context }) => {
    if (!context.trip) return createNoTripResponse()

    const destinationId = context.selection.destinationId
    if (!destinationId) {
      return {
        response: "Select a destination first and I'll remove it for you.",
        actions: [],
      }
    }

    const destination = context.trip.days
      .flatMap((day) => day.destinations)
      .find((dest) => dest.id === destinationId)

    const destinationName = destination?.name ?? 'the selected destination'

    const actions: CopilotAction[] = [
      {
        type: 'mutateTrip',
        payload: {
          mutation: 'removeDestination',
          args: {
            destinationId,
          },
        },
      },
    ]

    return {
      response: `Removing ${destinationName} from your itinerary.`,
      actions,
    }
  },
}

const moveMaybeToDayIntent: CopilotIntentHandler = {
  name: 'moveMaybeToDay',
  canHandle: ({ utterance, context }) => {
    if (!context.trip) return false
    return /(add|move|schedule|put).*(day\s*\d+)/i.test(utterance)
  },
  execute: (input) => {
    if (!input.context.trip) return createNoTripResponse()

    const trip = input.context.trip
    const dayMatch = resolveDayIdFromInput(input, trip)
    if (!dayMatch) {
      return {
        response: 'Let me know which day you want to move that into.',
        actions: [],
      }
    }

    const destinationId = input.context.selection.destinationId
      ?? (trip.maybeLocations.length === 1 ? trip.maybeLocations[0].id : undefined)

    if (!destinationId) {
      return {
        response: 'Select a maybe destination first and I can move it into the day you choose.',
        actions: [],
      }
    }

    const destinationName = trip.maybeLocations.find((destination) => destination.id === destinationId)?.name

    const response = destinationName
      ? `Moving ${destinationName} to Day ${dayMatch.dayIndex + 1}.`
      : `Moving that destination to Day ${dayMatch.dayIndex + 1}.`

    const actions: CopilotAction[] = [
      {
        type: 'mutateTrip',
        payload: {
          mutation: 'moveMaybeToDay',
          args: {
            destinationId,
            dayId: dayMatch.dayId,
          },
        },
      },
    ]

    return {
      response,
      actions,
    }
  },
}

const extractQuotedText = (utterance: string): string | null => {
  const quoteMatch = utterance.match(/["'“”‘’`](.+?)["'“”‘’`]/)
  return quoteMatch ? quoteMatch[1].trim() : null
}

const updateDayNotesIntent: CopilotIntentHandler = {
  name: 'updateDayNotes',
  canHandle: ({ utterance, context }) => {
    if (!context.trip) return false
    return /(add|set|update).*(note)/i.test(utterance)
  },
  execute: (input) => {
    if (!input.context.trip) return createNoTripResponse()

    const trip = input.context.trip
    const dayMatch = resolveDayIdFromInput(input, trip)
    if (!dayMatch) {
      return {
        response: 'Tell me which day you want to update the notes for.',
        actions: [],
      }
    }

    const noteText = extractQuotedText(input.utterance)
    if (!noteText) {
      return {
        response: 'Please include the note in quotes so I know what to save.',
        actions: [],
      }
    }

    const response = `Updating notes for Day ${dayMatch.dayIndex + 1}.`

    const actions: CopilotAction[] = [
      {
        type: 'mutateTrip',
        payload: {
          mutation: 'updateDayNotes',
          args: {
            dayId: dayMatch.dayId,
            notes: noteText,
          },
        },
      },
    ]

    return {
      response,
      actions,
    }
  },
}

export const EDITING_INTENTS: CopilotIntentHandler[] = [
  addDayIntent,
  removeDestinationIntent,
  moveMaybeToDayIntent,
  updateDayNotesIntent,
]
