import {
  CopilotAction,
  CopilotIntentHandler,
  CopilotIntentInput,
  CopilotTripSnapshot,
} from '@/lib/copilot/types'
import { createNoTripResponse } from '@/lib/copilot/intents/utils'

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const describeDestinations = (tripDay: CopilotTripSnapshot['days'][number]): string => {
  if (!tripDay.destinations.length) {
    return 'no destinations yet'
  }
  const names = tripDay.destinations.map((destination) => destination.name).filter(Boolean)
  if (!names.length) {
    return `${tripDay.destinations.length} destinations scheduled`
  }
  const sample = names.slice(0, 3)
  const remainder = names.length - sample.length
  return remainder > 0 ? `${sample.join(', ')} and ${remainder} more` : sample.join(', ')
}

const tripOverviewIntent: CopilotIntentHandler = {
  name: 'tripOverview',
  canHandle: ({ utterance, context }: CopilotIntentInput) => {
    if (!context.trip) return false
    return /(overview|summary|whole trip|plan look|how does (the )?trip)/i.test(utterance)
  },
  execute: ({ context }) => {
    if (!context.trip) return createNoTripResponse()

    const { trip } = context
    const dayCount = trip.days.length
    const emptyDays = context.unresolved.emptyDayIds.length
    const missingBases = context.unresolved.missingBaseLocationDayIds.length

    const responseParts = [
      `${trip.name} runs ${formatDate(trip.startDate)} to ${formatDate(trip.endDate)} with ${dayCount} days.`,
    ]

    if (emptyDays > 0) {
      responseParts.push(`${emptyDays} day${emptyDays === 1 ? '' : 's'} still open.`)
    }

    if (missingBases > 0) {
      responseParts.push(`${missingBases} day${missingBases === 1 ? '' : 's'} missing base locations.`)
    }

    if (!context.unresolved.orphanMaybeLocationIds.length) {
      responseParts.push('Maybe list is fully scheduled.')
    } else {
      responseParts.push(`${context.unresolved.orphanMaybeLocationIds.length} item${context.unresolved.orphanMaybeLocationIds.length === 1 ? '' : 's'} waiting in Maybe.`)
    }

    return {
      response: responseParts.join(' '),
      actions: [],
    }
  },
}

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

const findDayForIntent = (
  input: CopilotIntentInput,
  trip: CopilotTripSnapshot,
): { dayIndex: number; dayId: string } | null => {
  const indexFromUtterance = extractDayIndexFromUtterance(input.utterance, trip)
  if (indexFromUtterance !== null) {
    return { dayIndex: indexFromUtterance, dayId: trip.days[indexFromUtterance].id }
  }

  if (input.context.selection.dayId) {
    const selectedIndex = trip.days.findIndex((day) => day.id === input.context.selection.dayId)
    if (selectedIndex >= 0) {
      return { dayIndex: selectedIndex, dayId: trip.days[selectedIndex].id }
    }
  }

  return null
}

const daySummaryIntent: CopilotIntentHandler = {
  name: 'daySummary',
  canHandle: ({ utterance, context }) => {
    if (!context.trip) return false
    return /(day\s*\d+|what'?s on the (plan|agenda)|selected day)/i.test(utterance)
  },
  execute: (input) => {
    const { context } = input
    if (!context.trip) return createNoTripResponse()

    const daySelection = findDayForIntent(input, context.trip)
    if (!daySelection) {
      return {
        response: 'Tell me which day you want details for and I will pull it up.',
        actions: [],
      }
    }

    const tripDay = context.trip.days[daySelection.dayIndex]
    const dayNumber = daySelection.dayIndex + 1
    const destinationsSummary = describeDestinations(tripDay)
    const baseLocationSummary = tripDay.baseLocations[0]?.name ?? 'no base set'

    const response = `Day ${dayNumber} (${formatDate(tripDay.date)}) centers on ${baseLocationSummary} with ${destinationsSummary}.`

    return {
      response,
      actions: [
        {
          type: 'selectDay',
          payload: { dayId: tripDay.id },
        },
      ],
    }
  },
}

const determineHighlightTargets = (
  input: CopilotIntentInput,
  trip: CopilotTripSnapshot,
): {
  day?: { id: string; index: number }
  placeIds: string[]
  label: string
} | null => {
  const daySelection = findDayForIntent(input, trip)
  if (daySelection) {
    const day = trip.days[daySelection.dayIndex]
    const placeIds = day.destinations.map((destination) => destination.id)
    if (placeIds.length === 0) {
      return null
    }

    const label = `Day ${daySelection.dayIndex + 1}`
    return {
      day: { id: day.id, index: daySelection.dayIndex },
      placeIds,
      label,
    }
  }

  if (input.context.selection.destinationId) {
    const destinationId = input.context.selection.destinationId
    const matchingDay = trip.days.findIndex((day) =>
      day.destinations.some((destination) => destination.id === destinationId),
    )

    if (matchingDay >= 0) {
      const day = trip.days[matchingDay]
      return {
        day: { id: day.id, index: matchingDay },
        placeIds: [destinationId],
        label: day.destinations.find((dest) => dest.id === destinationId)?.name ?? 'the selected destination',
      }
    }

    // Fall back to maybe list
    const maybeDestination = trip.maybeLocations.find((destination) => destination.id === destinationId)
    if (maybeDestination) {
      return {
        placeIds: [destinationId],
        label: maybeDestination.name ?? 'the selected destination',
      }
    }
  }

  if (input.context.selection.dayId) {
    const selectedDayIndex = trip.days.findIndex((day) => day.id === input.context.selection.dayId)
    if (selectedDayIndex >= 0) {
      const day = trip.days[selectedDayIndex]
      const placeIds = day.destinations.map((destination) => destination.id)
      if (placeIds.length) {
        return {
          day: { id: day.id, index: selectedDayIndex },
          placeIds,
          label: `Day ${selectedDayIndex + 1}`,
        }
      }
    }
  }

  return null
}

const mapFocusIntent: CopilotIntentHandler = {
  name: 'mapFocus',
  canHandle: ({ utterance, context }) => {
    if (!context.trip) return false
    return /(show|focus|highlight|center).*(map|there|this)/i.test(utterance)
  },
  execute: (input) => {
    if (!input.context.trip) return createNoTripResponse()

    const target = determineHighlightTargets(input, input.context.trip)

    if (!target) {
      return {
        response: "I couldn't find any coordinates to highlight. Try selecting a day or destination first.",
        actions: [],
      }
    }

    const responseParts = [`Centering on ${target.label} on the map.`]

    const actions: CopilotAction[] = []

    if (target.day) {
      actions.push({ type: 'selectDay', payload: { dayId: target.day.id } })
    }

    actions.push({
      type: 'highlightMapArea',
      payload: {
        placeIds: target.placeIds,
        reason: 'mapFocusIntent',
      },
    })

    return {
      response: responseParts.join(' '),
      actions,
    }
  },
}

export const READ_ONLY_INTENTS: CopilotIntentHandler[] = [
  tripOverviewIntent,
  daySummaryIntent,
  mapFocusIntent,
]
