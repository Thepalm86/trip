import {
  CopilotRuntimeContext,
  CopilotSuggestion,
  CopilotSuggestionAction,
  CopilotSuggestionKind,
  CopilotTripSnapshot,
} from '@/lib/copilot/types'
import { getExploreCategoryLabel } from '@/lib/explore/categories'

const MAX_SUGGESTIONS = 4
const MAX_DESTINATIONS_PER_DAY = 3

const normalize = (value?: string | null): string | null => {
  if (!value) return null
  return value.trim().toLowerCase()
}

const formatDayDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const describeDayCity = (day: CopilotTripSnapshot['days'][number]): string | null => {
  const primaryBase = day.baseLocations[0]
  if (primaryBase?.city) return primaryBase.city
  if (primaryBase?.name) return primaryBase.name

  const firstDestination = day.destinations[0]
  if (!firstDestination) return null
  return firstDestination.city ?? firstDestination.name ?? null
}

interface DayOpportunityCandidate {
  candidateId: string
  kind: CopilotSuggestionKind
  score: number
  title: string
  description: string
  actions: CopilotSuggestionAction[]
  metadata: Record<string, unknown>
}

const computeMaybeSuggestionForDay = (
  context: CopilotRuntimeContext,
  day: CopilotTripSnapshot['days'][number],
  dayIndex: number,
  maybeCandidate: CopilotTripSnapshot['maybeLocations'][number],
): DayOpportunityCandidate | null => {
  const candidateName = maybeCandidate.name ?? 'this destination'
  const dayNumber = dayIndex + 1
  const dayCity = describeDayCity(day)
  const candidateCity = maybeCandidate.city

  const normalizedDayCity = normalize(dayCity)
  const normalizedCandidateCity = normalize(candidateCity)

  const baseScore = day.destinations.length === 0 ? 60 : Math.max(24, 36 - day.destinations.length * 6)
  let score = baseScore

  if (maybeCandidate.isFavorite) {
    score += 10
  }

  if (maybeCandidate.category) {
    const normalizedCategory = maybeCandidate.category.toLowerCase()
    if (['attraction', 'activity'].includes(normalizedCategory)) {
      score += 6
    }
    if (normalizedCategory === 'restaurant' && day.destinations.length === 0) {
      score -= 4 // make sure we favor full-day activities first
    }
  }

  if (normalizedDayCity && normalizedCandidateCity && normalizedDayCity === normalizedCandidateCity) {
    score += 16
  }

  if (typeof maybeCandidate.rating === 'number') {
    score += Math.min(10, maybeCandidate.rating * 2)
  }

  score += Math.max(0, 12 - dayIndex) // earlier days slightly favored

  if (score < 30) {
    return null
  }

  const summaryParts: string[] = []
  if (day.destinations.length === 0) {
    summaryParts.push('This day is still wide open.')
  } else {
    summaryParts.push(`Only ${day.destinations.length} stop${day.destinations.length === 1 ? '' : 's'} planned so far.`)
  }

  if (candidateCity) {
    const matchLabel = normalizedDayCity && normalizedDayCity === normalizedCandidateCity
      ? `${candidateName} keeps you in ${candidateCity}.`
      : `${candidateName} is in ${candidateCity}.`
    summaryParts.push(matchLabel)
  }

  if (maybeCandidate.isFavorite) {
    summaryParts.push('You already marked it as a favorite.')
  }

  const description = summaryParts.join(' ')

  const actions: CopilotSuggestionAction[] = []

  if (Array.isArray(maybeCandidate.coordinates) && maybeCandidate.coordinates.length === 2) {
    actions.push({
      label: 'Preview on map',
      actions: [
        {
          type: 'highlightMapArea',
          payload: {
            coordinates: [maybeCandidate.coordinates],
            placeIds: [maybeCandidate.id],
            reason: 'smartSuggestion:maybe',
          },
        },
      ],
    })
  }

  if (context.source === 'supabase') {
    actions.push({
      label: 'Schedule it',
      variant: 'primary',
      actions: [
        { type: 'selectDay', payload: { dayId: day.id } },
        {
          type: 'mutateTrip',
          payload: {
            mutation: 'moveMaybeToDay',
            args: {
              destinationId: maybeCandidate.id,
              dayId: day.id,
            },
          },
        },
      ],
    })
  } else {
    actions.push({
      label: 'Focus this day',
      variant: 'primary',
      actions: [{ type: 'selectDay', payload: { dayId: day.id } }],
    })
  }

  const kind: CopilotSuggestionKind = day.destinations.length === 0 ? 'fillEmptyDay' : 'enrichDay'
  const dateLabel = formatDayDate(day.date)

  return {
    candidateId: maybeCandidate.id,
    kind,
    score,
    title: `Add ${candidateName} to Day ${dayNumber}`,
    description: `${description} (${dateLabel})`,
    actions,
    metadata: {
      dayId: day.id,
      dayNumber,
      dayDate: day.date,
      destinationId: maybeCandidate.id,
      destinationName: maybeCandidate.name,
      category: maybeCandidate.category ?? null,
    },
  }
}

const buildMaybeSuggestions = (context: CopilotRuntimeContext): CopilotSuggestion[] => {
  const trip = context.trip
  if (!trip) return []
  if (!trip.maybeLocations.length) return []

  const scheduledDestinationIds = new Set(
    trip.days.flatMap((day) => day.destinations.map((destination) => destination.id)),
  )

  const availableMaybe = trip.maybeLocations.filter((destination) => !scheduledDestinationIds.has(destination.id))
  if (!availableMaybe.length) return []

  const usedMaybeIds = new Set<string>()
  const suggestions: CopilotSuggestion[] = []

  trip.days.forEach((day, dayIndex) => {
    if (day.destinations.length >= MAX_DESTINATIONS_PER_DAY) {
      return
    }

    const candidates = availableMaybe
      .filter((destination) => !usedMaybeIds.has(destination.id))
      .map((destination) => computeMaybeSuggestionForDay(context, day, dayIndex, destination))
      .filter((value): value is DayOpportunityCandidate => Boolean(value))
      .sort((a, b) => b.score - a.score)

    const top = candidates[0]
    if (!top) {
      return
    }

    usedMaybeIds.add(top.candidateId)

    suggestions.push({
      id: `suggestion-${top.candidateId}-day-${day.id}`,
      kind: top.kind,
      title: top.title,
      description: top.description,
      score: top.score,
      actions: top.actions,
      metadata: top.metadata,
    })
  })

  return suggestions
}

const buildExploreSuggestions = (context: CopilotRuntimeContext): CopilotSuggestion[] => {
  const { explore, trip } = context
  const { activePlaces } = explore
  if (!activePlaces.length) return []

  const scheduledIds = new Set<string>()
  const maybeIds = new Set<string>()

  if (trip) {
    trip.days.forEach((day) => {
      day.destinations.forEach((destination) => scheduledIds.add(destination.id))
    })
    trip.maybeLocations.forEach((destination) => maybeIds.add(destination.id))
  }

  return activePlaces
    .filter((place) => !scheduledIds.has(place.id) && !maybeIds.has(place.id))
    .map((place, index) => {
      const categoryLabel = getExploreCategoryLabel(place.category)
      const descriptionParts: string[] = [`${categoryLabel} saved in Explore.`]

      if (place.city) {
        descriptionParts.push(`Located near ${place.city}.`)
      }

      if (place.isFavorite) {
        descriptionParts.push('Marked as a favorite—want to work it in?')
      } else {
        descriptionParts.push('Ask me to add it to a day or your Maybe list when ready.')
      }

      const actions: CopilotSuggestionAction[] = []

      actions.push({
        label: 'Map preview',
        variant: 'primary',
        actions: [
          {
            type: 'highlightMapArea',
            payload: {
              placeIds: [place.id],
              coordinates: [place.coordinates],
              reason: 'smartSuggestion:explore',
            },
          },
        ],
      })

      return {
        id: `explore-${place.id}`,
        kind: 'exploreHighlight' as CopilotSuggestionKind,
        title: `Explore ${place.name}`,
        description: descriptionParts.join(' '),
        score: (place.isFavorite ? 40 : 24) + Math.max(0, 8 - index),
        actions,
        metadata: {
          placeId: place.id,
          category: place.category ?? null,
          city: place.city ?? null,
        },
      }
    })
}

export const generateSmartSuggestions = (context: CopilotRuntimeContext): CopilotSuggestion[] => {
  const suggestions: CopilotSuggestion[] = []

  suggestions.push(...buildMaybeSuggestions(context))
  suggestions.push(...buildExploreSuggestions(context))

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
}
