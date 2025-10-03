import {
  CopilotAction,
  CopilotIntentInput,
  CopilotIntentOutput,
} from '@/lib/copilot/types'
import { generateSmartSuggestions } from '@/lib/copilot/suggestions'

const buildEmptyDayNudge = (input: CopilotIntentInput): CopilotIntentOutput | null => {
  const { trip, unresolved } = input.context
  if (!trip) return null
  if (!unresolved.emptyDayIds.length) return null

  const emptyDayId = unresolved.emptyDayIds[0]
  const emptyDayIndex = trip.days.findIndex((day) => day.id === emptyDayId)
  if (emptyDayIndex < 0) return null

  const dayNumber = emptyDayIndex + 1
  const dateDescriptor = new Date(trip.days[emptyDayIndex].date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  const response = `Day ${dayNumber} (${dateDescriptor}) is still open. Want to add destinations or notes there?`

  const actions: CopilotAction[] = [
    {
      type: 'selectDay',
      payload: { dayId: emptyDayId },
    },
  ]

  return { response, actions }
}

const buildSmartSuggestionNudge = (input: CopilotIntentInput): CopilotIntentOutput | null => {
  const suggestions = generateSmartSuggestions(input.context)
  if (!suggestions.length) return null

  const candidate = suggestions.find((suggestion) => suggestion.kind === 'fillEmptyDay')
    ?? suggestions[0]

  if (!candidate) return null

  const primaryAction = candidate.actions.find((action) => action.variant === 'primary')
    ?? candidate.actions[0]

  const response = `${candidate.title}. ${candidate.description}`

  return {
    response,
    actions: primaryAction ? [...primaryAction.actions] : [],
    suggestions: [candidate],
  }
}

export const getProactiveNudge = (input: CopilotIntentInput): CopilotIntentOutput | null => {
  return buildSmartSuggestionNudge(input) ?? buildEmptyDayNudge(input)
}
