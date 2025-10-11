import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addDestinationActionSchema,
  assistantActionIntentSchema,
  assistantStructuredPlanSchema,
  moveDestinationActionSchema,
  updateDestinationActionSchema,
} from '@/lib/assistant/actions/types'

test('add_destination schema accepts minimal payload', () => {
  const result = addDestinationActionSchema.parse({
    type: 'add_destination',
    dayId: 'day-1',
    destination: {
      name: 'Sunrise Hike',
    },
  })

  assert.equal(result.dayId, 'day-1')
  assert.equal(result.destination.name, 'Sunrise Hike')
  assert.equal(result.destination.notes, undefined)
})

test('add_destination schema rejects invalid ISO timestamps', () => {
  assert.throws(() =>
    addDestinationActionSchema.parse({
      type: 'add_destination',
      dayId: 'day-1',
      destination: {
        name: 'Late Dinner',
        startTimeIso: 'not-a-date',
      },
    })
  )
})

test('update_destination schema rejects empty changes object', () => {
  assert.throws(() =>
    updateDestinationActionSchema.parse({
      type: 'update_destination',
      dayId: 'day-1',
      destinationId: 'dest-42',
      changes: {},
    })
  )
})

test('assistantActionIntentSchema validates union members', () => {
  const payload = assistantActionIntentSchema.parse({
    type: 'toggle_map_overlay',
    overlay: 'all_destinations',
    metadata: {
      summary: 'Show itinerary overview',
      confidence: 0.82,
    },
  })

  assert.equal(payload.overlay, 'all_destinations')
  assert.equal(payload.metadata?.summary, 'Show itinerary overview')
})

test('move_destination schema supports intra-day moves with insertIndex', () => {
  const result = moveDestinationActionSchema.parse({
    type: 'move_destination',
    destinationId: 'dest-10',
    fromDayId: 'day-2',
    toDayId: 'day-2',
    insertIndex: 1,
  })

  assert.equal(result.insertIndex, 1)
})

test('assistantStructuredPlanSchema accepts a multi-step plan', () => {
  const plan = assistantStructuredPlanSchema.parse({
    steps: [
      {
        type: 'add_destination',
        dayId: 'day-1',
        destination: { name: 'San Gimignano' },
      },
      {
        type: 'toggle_map_overlay',
        overlay: 'explore_markers',
      },
    ],
    rationale: 'Fill time around Florence with nearby highlights.',
  })

  assert.equal(plan.steps.length, 2)
  assert.equal(plan.steps[0].type, 'add_destination')
  assert.equal(plan.rationale, 'Fill time around Florence with nearby highlights.')
})
