import { ConversationScript, CopilotRuntimeContext } from '@/lib/copilot/types'
import { runConversationScript } from '@/lib/copilot/harness/conversation-harness'

const createIsoDate = (value: string) => new Date(value).toISOString()

const SAMPLE_CONTEXT: CopilotRuntimeContext = {
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
            description: 'Ancient amphitheater',
            coordinates: [12.4922, 41.8902],
            city: 'Rome',
            category: 'attraction',
          },
          {
            id: 'dest-vatican',
            name: 'Vatican Museums',
            description: 'Collections of art and history',
            coordinates: [12.4539, 41.9067],
            city: 'Vatican City',
            category: 'museum',
          },
        ],
        baseLocations: [],
        notes: '',
      },
      {
        id: 'day-2',
        date: createIsoDate('2024-05-02'),
        destinations: [
          {
            id: 'dest-florence',
            name: 'Uffizi Gallery',
            coordinates: [11.2558, 43.7687],
            city: 'Florence',
            category: 'museum',
          },
        ],
        baseLocations: [],
        notes: '',
      },
    ],
    maybeLocations: [
      {
        id: 'dest-lake-como',
        name: 'Lake Como',
        coordinates: [9.2572, 45.9851],
        city: 'Como',
        category: 'scenic',
      },
    ],
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
    emptyDayIds: [],
    missingBaseLocationDayIds: ['day-1', 'day-2'],
    orphanMaybeLocationIds: ['dest-lake-como'],
  },
  timestamp: Date.now(),
}

export const PHASE1_READ_ONLY_SCRIPT: ConversationScript = {
  description: 'Phase 1 read-only intents covering overview and map focus',
  turns: [
    {
      user: 'Give me an overview of my trip',
      expectedResponseIncludes: ['Italy Highlights runs'],
    },
    {
      user: 'Show day 1 on the map',
      expectedResponseIncludes: ['Centering on Day 1'],
      expectedActions: [
        { type: 'selectDay', payload: { dayId: 'day-1' } },
        {
          type: 'highlightMapArea',
          payload: { placeIds: ['dest-rome', 'dest-vatican'], reason: 'mapFocusIntent' },
        },
      ],
    },
  ],
}

export const runPhase1ReadOnlyScript = (options?: { dispatchActions?: boolean }) =>
  runConversationScript(PHASE1_READ_ONLY_SCRIPT, {
    ...(options ?? {}),
    context: SAMPLE_CONTEXT,
  })
