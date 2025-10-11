import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAuthenticatedUser, UnauthorizedError } from '@/lib/server/auth'
import { assistantActionIntentSchema } from '@/lib/assistant/actions/types'
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/server/assistant-actions'
import { executeAssistantAction } from '@/lib/server/assistant-action-executor'
import { recordAssistantActionAudit } from '@/lib/assistant/actions/audit'

const executeRequestSchema = z.union([
  z.object({
    actions: z.array(assistantActionIntentSchema).min(1).max(6),
  }),
  z.object({
    action: assistantActionIntentSchema,
  }),
])

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)
    const rawBody = await request.json()
    const parsed = executeRequestSchema.parse(rawBody)
    const requestActions = 'actions' in parsed ? parsed.actions : [parsed.action]

    const summaries: string[] = []

    for (const action of requestActions) {
      const result = await executeAssistantAction(user.id, action)
      summaries.push(result.summary)

      recordAssistantActionAudit({
        event: 'execute',
        userId: user.id,
        actionType: action.type,
        summary: result.summary,
        payload: {
          action,
        },
      }).catch((auditError) => {
        console.warn('[assistant-actions] execute audit failed', auditError)
      })
    }

    return NextResponse.json(
      {
        summaries,
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

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'InvalidRequest', details: error.message },
        { status: 400 }
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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'InvalidRequest',
          details: error.flatten(),
        },
        { status: 400 }
      )
    }

    console.error('[assistant-actions] execute error', error)
    return NextResponse.json(
      { error: 'ActionExecuteError' },
      { status: 500 }
    )
  }
}
