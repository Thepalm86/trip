import {
  CopilotIntentHandler,
  CopilotIntentInput,
  CopilotSuggestion,
} from '@/lib/copilot/types'
import { generateSmartSuggestions } from '@/lib/copilot/suggestions'
import { createNoTripResponse } from '@/lib/copilot/intents/utils'

const extractDayNumber = (utterance: string): number | null => {
  const match = utterance.match(/day\s*(\d{1,2})/i)
  if (!match) return null
  const parsed = parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const takeFirstSentence = (text: string): string => {
  const segments = text.split(/(?<=[.!?])\s+/)
  return segments[0] ?? text
}

const selectSuggestionsForDay = (
  suggestions: CopilotSuggestion[],
  dayNumber: number,
): CopilotSuggestion[] => {
  return suggestions.filter((suggestion) => {
    const metadataDay = suggestion.metadata?.dayNumber
    if (typeof metadataDay === 'number') {
      return metadataDay === dayNumber
    }
    return false
  })
}

const summarizeSuggestions = (suggestions: CopilotSuggestion[]): string => {
  if (!suggestions.length) return ''

  const highlights = suggestions
    .slice(0, 2)
    .map((suggestion) => `${suggestion.title}: ${takeFirstSentence(suggestion.description)}`)

  return highlights.join(' ')
}

const canHandleSuggestionPrompt = ({ utterance, context }: CopilotIntentInput) => {
  if (!context.trip) return false
  return /\b(suggest|recommend|ideas?|what should we do|fill|plan).*/i.test(utterance)
}

export const smartSuggestionsIntent: CopilotIntentHandler = {
  name: 'smartSuggestions',
  canHandle: canHandleSuggestionPrompt,
  execute: (input) => {
    const { context, utterance } = input
    if (!context.trip) return createNoTripResponse()

    const allSuggestions = generateSmartSuggestions(context)
    if (!allSuggestions.length) {
      return {
        response: 'Looks like your itinerary is already well-filled for now. Ask me to search for something specific if you need more ideas.',
        actions: [],
      }
    }

    const requestedDayNumber = extractDayNumber(utterance)
    const targetedSuggestions = requestedDayNumber
      ? selectSuggestionsForDay(allSuggestions, requestedDayNumber)
      : allSuggestions

    if (requestedDayNumber && !targetedSuggestions.length) {
      const summary = summarizeSuggestions(allSuggestions)
      return {
        response: `I do not see a standout option for Day ${requestedDayNumber} yet, but here are a few high-impact ideas overall. ${summary}`,
        actions: [],
        suggestions: allSuggestions,
      }
    }

    const activeSuggestions = targetedSuggestions.length ? targetedSuggestions : allSuggestions
    const summary = summarizeSuggestions(activeSuggestions)

    const leadIn = requestedDayNumber
      ? `Here are a couple of ideas for Day ${requestedDayNumber}.`
      : 'Here are some ideas to keep the trip moving.'

    return {
      response: `${leadIn} ${summary}`.trim(),
      actions: [],
      suggestions: activeSuggestions,
    }
  },
}
