import { ConversationScript, CopilotRuntimeContext } from '@/lib/copilot/types'
import { runConversationScript } from '@/lib/copilot/harness/conversation-harness'

const createIsoDate = (value: string) => new Date(value).toISOString()

const EDITING_CONTEXT: CopilotRuntimeContext = {
  source: 'local',
  trip: {
    id: 'trip-demo',
    name: 'Italy Highlights',
    startDate: createIsoDate('2024-05-01'),
    endDate: createIsoDate('2024-05-03'),
    country: 'IT',
    days: [
      {
        id: 'day-1',
        date: createIsoDate('2024-05-01'),
        destinations: [
          {
            id: 'dest-rome',
            name: 'Colosseum',
            coordinates: [12.4922, 41.8902],
            city: 'Rome',
            category: 'attraction',
          },
        ],
        baseLocations: [],
        notes: '',
      },
    ],
    maybeLocations: [],
  },
  selection: {
    dayId: 'day-1',
    destinationId: 'dest-rome',
    baseLocation: null,
    origin: 'timeline',
    routeModeEnabled: false,
    selectedRouteSegmentId: null,
    adHocRoute: null,
  },
  explore: {
    selectedPlaceId: null,
    routeSelection: {
      startId: null,
      endId: null,
    },
    visibleCategoryKeys: null,
    markersFilter: 'all',
    activePlaceIds: [],
    activePlaces: [],
  },
  unresolved: {
    emptyDayIds: [],
    missingBaseLocationDayIds: ['day-1'],
    orphanMaybeLocationIds: [],
  },
  timestamp: Date.now(),
}

export const PHASE2_EDITING_SCRIPT: ConversationScript = {
  description: 'Phase 2 editing intents covering add day and remove destination',
  turns: [
    {
      user: 'Add another day to this trip',
      expectedResponseIncludes: ['Adding Day 2'],
      expectedActions: [
        {
          type: 'mutateTrip',
          payload: { mutation: 'addDay' },
        },
      ],
    },
    {
      user: 'Remove this destination',
      expectedResponseIncludes: ['Removing Colosseum'],
      expectedActions: [
        {
          type: 'mutateTrip',
          payload: { mutation: 'removeDestination', args: { destinationId: 'dest-rome' } },
        },
      ],
    },
    {
      user: 'Add note "Remember to book tickets" to day 1',
      expectedResponseIncludes: ['Updating notes for Day 1'],
      expectedActions: [
        {
          type: 'mutateTrip',
          payload: {
            mutation: 'updateDayNotes',
            args: { dayId: 'day-1', notes: 'Remember to book tickets' },
          },
        },
      ],
    },
  ],
}

export const runPhase2EditingScript = (options?: { dispatchActions?: boolean }) =>
  runConversationScript(PHASE2_EDITING_SCRIPT, {
    ...(options ?? {}),
    context: EDITING_CONTEXT,
  })
