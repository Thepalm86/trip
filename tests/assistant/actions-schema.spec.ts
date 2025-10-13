import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assistantUiActionCollectionSchema,
  assistantUiActionSchema,
} from '@/lib/assistant/actions'

test('assistantUiActionSchema accepts AddPlaceToItinerary payload', () => {
  const action = assistantUiActionSchema.parse({
    type: 'AddPlaceToItinerary',
    payload: {
      placeId: 'poi_123',
      fallbackQuery: 'Sunrise hike near Oia',
      tripId: 'trip_1',
      dayId: 'day_1',
      startTime: '2025-06-10T08:30:00Z',
      durationMinutes: 120,
      source: 'assistant',
      confidence: 0.82,
      lat: 25.375,
      lng: 37.098,
      notes: 'Suggested by assistant',
      tags: ['outdoors'],
    },
    meta: {
      requestId: '6b128b71-8c77-4072-8381-6ff23781410a',
      issuedAt: '2025-01-10T09:10:00Z',
      confidence: 0.82,
    },
  })

  assert.equal(action.type, 'AddPlaceToItinerary')
  assert.equal(action.payload.confidence, 0.82)
  assert.equal(action.payload.lat, 25.375)
})

test('assistantUiActionSchema accepts HH:MM startTime and custom requestId', () => {
  const action = assistantUiActionSchema.parse({
    type: 'AddPlaceToItinerary',
    payload: {
      placeId: 'poi_custom',
      fallbackQuery: 'Pienza',
      tripId: 'trip_123',
      dayId: 'day_4',
      startTime: '10:00',
      durationMinutes: 180,
      source: 'assistant',
      confidence: 0.9,
      lat: 43.0776,
      lng: 11.6775,
    },
    meta: {
      requestId: 'pienza-day4',
      issuedAt: '2025-01-10T09:30:00Z',
    },
  })

  assert.equal(action.payload.startTime, '10:00')
  assert.equal(action.meta?.requestId, 'pienza-day4')
})

test('assistantUiActionSchema enforces replacement payload when mode is replace', () => {
  assert.throws(() =>
    assistantUiActionSchema.parse({
      type: 'RemoveOrReplaceItem',
      payload: {
        tripId: 'trip_1',
        dayId: 'day_1',
        itemId: 'dest_42',
        mode: 'replace',
        userConfirmed: true,
      },
    })
  )

  const action = assistantUiActionSchema.parse({
    type: 'RemoveOrReplaceItem',
    payload: {
      tripId: 'trip_1',
      dayId: 'day_2',
      itemId: 'dest_007',
      mode: 'replace',
      userConfirmed: true,
      replacement: {
        placeId: 'poi_new',
        fallbackQuery: 'Dinner at Farm-to-Table Bistro',
        lat: -73.9851,
        lng: 40.7589,
      },
    },
  })

  assert.equal(action.payload.replacement?.placeId, 'poi_new')
})

test('assistantUiActionCollectionSchema rejects mismatched action arrays', () => {
  const validCollection = assistantUiActionCollectionSchema.parse([
    {
      type: 'AddPlaceToItinerary',
      payload: {
        placeId: 'poi_1',
        fallbackQuery: 'Morning kayak',
        tripId: 'trip_1',
        dayId: 'day_3',
        startTime: '2025-07-01T09:00:00Z',
        durationMinutes: 90,
        source: 'assistant',
        confidence: 0.7,
        lat: 2.33,
        lng: 48.86,
      },
    },
  ])

  assert.equal(validCollection.length, 1)

  assert.throws(() =>
    assistantUiActionCollectionSchema.parse([
      {
        type: 'AddPlaceToItinerary',
        payload: {
          placeId: 'poi_invalid',
          fallbackQuery: 'No trip id',
          // tripId intentionally omitted
          dayId: 'day_1',
          startTime: '2025-07-01T10:00:00Z',
          durationMinutes: 60,
          source: 'assistant',
          confidence: 0.5,
        },
      },
    ] as any)
  )
})
