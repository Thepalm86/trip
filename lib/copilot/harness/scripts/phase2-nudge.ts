import { ConversationScript, CopilotRuntimeContext } from '@/lib/copilot/types'
import { runConversationScript } from '@/lib/copilot/harness/conversation-harness'

const createIsoDate = (value: string) => new Date(value).toISOString()

const NUDGE_CONTEXT: CopilotRuntimeContext = {
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
      {
        id: 'day-2',
        date: createIsoDate('2024-05-02'),
        destinations: [],
        baseLocations: [],
        notes: '',
      },
    ],
    maybeLocations: [],
  },
  selection: {
    dayId: 'day-1',
    destinationId: null,
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
    emptyDayIds: ['day-2'],
    missingBaseLocationDayIds: ['day-1', 'day-2'],
    orphanMaybeLocationIds: [],
  },
  timestamp: Date.now(),
}

export const PHASE2_NUDGE_SCRIPT: ConversationScript = {
  description: 'Phase 2 proactive nudge for empty day',
  turns: [
    {
      user: 'Okay',
      expectedResponseIncludes: ['Day 2'],
      expectedActions: [
        {
          type: 'selectDay',
          payload: { dayId: 'day-2' },
        },
      ],
    },
  ],
}

export const runPhase2NudgeScript = (options?: { dispatchActions?: boolean }) =>
  runConversationScript(PHASE2_NUDGE_SCRIPT, {
    ...(options ?? {}),
    context: NUDGE_CONTEXT,
  })
