import { Destination, DayLocation } from '@/types'
import { RouteSelectionSource } from '@/lib/store/supabase-trip-store'

export type CopilotContextSource = 'supabase' | 'local'

export interface CopilotTripDaySnapshot {
  id: string
  date: string
  destinations: Destination[]
  baseLocations: DayLocation[]
  notes: string
}

export interface CopilotTripSnapshot {
  id: string
  name: string
  startDate: string
  endDate: string
  country?: string | null
  days: CopilotTripDaySnapshot[]
  maybeLocations: Destination[]
}

export interface CopilotSelectionSnapshot {
  dayId: string | null
  destinationId: string | null
  baseLocation: { dayId: string; index: number } | null
  origin: 'map' | 'timeline' | 'preview' | null
  routeModeEnabled: boolean
  selectedRouteSegmentId: string | null
  adHocRoute: null | {
    fromId: string
    toId: string
    source: RouteSelectionSource
  }
}

export interface CopilotExplorePlaceSnapshot {
  id: string
  name: string
  coordinates: [number, number]
  category?: string
  city?: string
  isFavorite?: boolean
}

export interface CopilotExploreSnapshot {
  selectedPlaceId: string | null
  routeSelection: {
    startId: string | null
    endId: string | null
  }
  visibleCategoryKeys: string[] | null
  markersFilter: 'all' | 'favorites'
  activePlaceIds: string[]
  activePlaces: CopilotExplorePlaceSnapshot[]
}

export interface CopilotUnresolvedIssues {
  emptyDayIds: string[]
  missingBaseLocationDayIds: string[]
  orphanMaybeLocationIds: string[]
}

export interface CopilotRuntimeContext {
  source: CopilotContextSource
  trip: CopilotTripSnapshot | null
  selection: CopilotSelectionSnapshot
  explore: CopilotExploreSnapshot
  unresolved: CopilotUnresolvedIssues
  timestamp: number
}

export type CopilotActionType =
  | 'selectDay'
  | 'focusDestination'
  | 'openModal'
  | 'highlightMapArea'
  | 'mutateTrip'
  | 'noop'

export interface CopilotBaseAction<T extends CopilotActionType, P = undefined> {
  type: T
  payload: P
}

export type SelectDayAction = CopilotBaseAction<'selectDay', { dayId: string }>
export type FocusDestinationAction = CopilotBaseAction<'focusDestination', { destinationId: string; origin?: 'map' | 'timeline' | 'preview' }>
export type OpenModalAction = CopilotBaseAction<'openModal', { modalId: string; context?: Record<string, unknown> }>
export interface CopilotMapBounds {
  north: number
  south: number
  east: number
  west: number
}

export type HighlightMapAreaAction = CopilotBaseAction<'highlightMapArea', {
  bounds?: CopilotMapBounds
  coordinates?: [number, number][]
  placeIds?: string[]
  reason?: string
}>
export type MutateTripAction = CopilotBaseAction<'mutateTrip', { mutation: string; args?: Record<string, unknown> }>
export type NoopAction = CopilotBaseAction<'noop'>

export type CopilotAction =
  | SelectDayAction
  | FocusDestinationAction
  | OpenModalAction
  | HighlightMapAreaAction
  | MutateTripAction
  | NoopAction

export type CopilotActionStatus = 'accepted' | 'rejected' | 'failed'

export interface CopilotActionResult {
  status: CopilotActionStatus
  action: CopilotAction
  message?: string
  error?: Error
}

export type CopilotActionListener = (event: CopilotActionEvent) => void

export type CopilotActionEventType =
  | 'actionDispatched'
  | 'actionCompleted'
  | 'actionFailed'
  | 'actionRejected'

export interface CopilotActionEvent {
  type: CopilotActionEventType
  action: CopilotAction
  result?: CopilotActionResult
}

export interface CopilotActionBus {
  dispatch: (action: CopilotAction) => Promise<CopilotActionResult>
  subscribe: (listener: CopilotActionListener) => () => void
}

export interface CopilotActionValidator {
  name: string
  validate: (action: CopilotAction, context: CopilotRuntimeContext) => { ok: true } | { ok: false; reason: string }
}

export interface CopilotIntentInput {
  utterance: string
  context: CopilotRuntimeContext
}

export interface CopilotIntentOutput {
  response: string
  actions: CopilotAction[]
  suggestions?: CopilotSuggestion[]
}

export type CopilotSuggestionKind =
  | 'fillEmptyDay'
  | 'enrichDay'
  | 'maybePromotion'
  | 'exploreHighlight'

export type CopilotSuggestionActionVariant = 'primary' | 'secondary'

export interface CopilotSuggestionAction {
  label: string
  actions: CopilotAction[]
  variant?: CopilotSuggestionActionVariant
}

export interface CopilotSuggestion {
  id: string
  kind: CopilotSuggestionKind
  title: string
  description: string
  score: number
  actions: CopilotSuggestionAction[]
  metadata?: Record<string, unknown>
}

export interface CopilotIntentHandler {
  name: string
  canHandle: (input: CopilotIntentInput) => boolean
  execute: (input: CopilotIntentInput) => CopilotIntentOutput
}

export interface ConversationTurn {
  user: string
  expectedActions?: CopilotAction[]
  expectedResponseIncludes?: string[]
}

export interface ConversationScript {
  description: string
  turns: ConversationTurn[]
}

export interface ConversationHarnessResult {
  transcript: { user: string; response: string; actions: CopilotAction[] }[]
  mismatches: string[]
}
