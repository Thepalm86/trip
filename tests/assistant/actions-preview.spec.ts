import test from 'node:test'
import assert from 'node:assert/strict'

import { buildActionPreview } from '@/lib/assistant/actions/preview'

test('buildActionPreview summarises add_destination intent', () => {
  const preview = buildActionPreview(
    {
      type: 'add_destination',
      dayId: 'day-5',
      destination: {
        name: 'Evening Food Tour',
      },
      metadata: {
        confidence: 0.92,
      },
    },
    {
      dayLabel: 'Day 5 (Apr 18)',
    }
  )

  assert.equal(preview.requiresConfirmation, true)
  assert.match(preview.summary, /Evening Food Tour/)
  assert.match(preview.summary, /Day 5/)
  assert.equal(preview.action.type, 'add_destination')
  assert.equal(preview.details?.dayId, 'day-5')
})

test('buildActionPreview detects intra-day move', () => {
  const preview = buildActionPreview(
    {
      type: 'move_destination',
      destinationId: 'dest-10',
      fromDayId: 'day-2',
      toDayId: 'day-2',
      insertIndex: 3,
    },
    {
      destinationName: 'Gallery Visit',
      fromDayLabel: 'Day 2 (Apr 11)',
    }
  )

  assert.match(preview.summary, /Reorder/)
  assert.match(preview.summary, /Gallery Visit/)
  assert.equal(preview.details?.destinationId, 'dest-10')
})
