import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAuthenticatedUser, UnauthorizedError } from '@/lib/server/auth'
import { assistantActionEnvelopeSchema } from '@/lib/assistant/actions/types'
import { buildActionPreview, type ActionPreviewContext } from '@/lib/assistant/actions/preview'
import {
  ensureDayAccess,
  ensureDestinationAccess,
  ForbiddenError,
  NotFoundError,
} from '@/lib/server/assistant-actions'
import { recordAssistantActionAudit } from '@/lib/assistant/actions/audit'

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
})

class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)
    const rawBody = await request.json()
    const envelope = assistantActionEnvelopeSchema.parse(rawBody)

    const action = envelope.suggestedAction
    const context: ActionPreviewContext = {}

    switch (action.type) {
      case 'add_destination': {
        const access = await ensureDayAccess(user.id, action.dayId)
        context.dayLabel = access.label
        break
      }
      case 'update_destination': {
        const access = await ensureDestinationAccess(user.id, action.destinationId)
        if (access.day.id !== action.dayId) {
          throw new BadRequestError('Destination does not belong to the provided dayId')
        }
        context.destinationName = access.destination.name
        context.dayLabel = access.label
        break
      }
      case 'set_base_location': {
        const access = await ensureDayAccess(user.id, action.dayId)
        context.dayLabel = access.label
        break
      }
      case 'move_destination': {
        const origin = await ensureDestinationAccess(user.id, action.destinationId)
        if (origin.day.id !== action.fromDayId) {
          throw new BadRequestError('Destination does not belong to the provided fromDayId')
        }
        const target = await ensureDayAccess(user.id, action.toDayId)
        if (origin.trip.id !== target.trip.id) {
          throw new BadRequestError('Destination and target day are not part of the same trip')
        }
        context.destinationName = origin.destination.name
        context.fromDayLabel = origin.label
        context.toDayLabel = target.label
        break
      }
      case 'toggle_map_overlay':
        // Non-destructive UI action – no ownership validation required.
        break
      default:
        throw new BadRequestError('Unsupported action type')
    }

    const preview = buildActionPreview(action, context)

    recordAssistantActionAudit({
      event: 'preview',
      userId: user.id,
      actionType: preview.action.type,
      summary: preview.summary,
      payload: {
        action: preview.action,
        details: preview.details ?? null,
        rationale: envelope.rationale ?? null,
      },
    }).catch((auditError) => {
      console.warn('[assistant-actions] audit logging failed', auditError)
    })

    return NextResponse.json(
      {
        preview,
        rationale: envelope.rationale ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      )
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: 'NotFound', details: error.message },
        { status: 404 }
      )
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: 'Forbidden', details: error.message },
        { status: 403 }
      )
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json(
        { error: 'InvalidRequest', details: error.message },
        { status: 400 }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: 'InvalidRequest',
          details: error.flatten(),
        }),
        { status: 400 }
      )
    }

    console.error('[assistant-actions] preview error', error)
    return NextResponse.json(
      { error: 'ActionPreviewError' },
      { status: 500 }
    )
  }
}
