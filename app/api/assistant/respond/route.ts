import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { requireAuthenticatedUser, UnauthorizedError } from '@/lib/server/auth'
import { assistantMessageSchema } from '@/lib/assistant/context/types'
import { runPromptGuard } from '@/lib/assistant/prompt-guard'
import { buildAssistantContext } from '@/lib/assistant/context/service'
import { orchestrateAssistantResponse } from '@/lib/assistant/orchestrator'
import { recordAssistantTelemetry } from '@/lib/assistant/telemetry'
import { assembleAssistantKnowledge } from '@/lib/assistant/knowledge'

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)
    const rawBody = await request.json()
    const payload = assistantMessageSchema.parse(rawBody)

    const guardResult = runPromptGuard(payload.message.content)
    if (!guardResult.allow) {
      await recordAssistantTelemetry({
        userId: user.id,
        conversationId: payload.conversationId,
        messageId: payload.message.id,
        model: 'prompt_guard',
        blocked: true,
        blockReason: guardResult.reason,
      })

      return NextResponse.json(
        {
          reply: guardResult.message,
          blocked: true,
          reason: guardResult.reason,
        },
        { status: 200 }
      )
    }

    const baseContext = await buildAssistantContext({
      userId: user.id,
      ui: payload.uiFingerprint,
      selectedTripId: payload.uiFingerprint?.selectedTripId,
    })

    const knowledge = await assembleAssistantKnowledge(baseContext, payload.message.content)
    const context = knowledge ? { ...baseContext, knowledge } : baseContext

    const orchestration = await orchestrateAssistantResponse({
      payload,
      context,
      user,
    })

    await recordAssistantTelemetry({
      userId: user.id,
      conversationId: payload.conversationId,
      messageId: payload.message.id,
      model: orchestration.metadata.model,
      promptTokens: orchestration.metadata.promptTokens,
      completionTokens: orchestration.metadata.completionTokens,
      totalTokens: orchestration.metadata.totalTokens,
      costUsd: orchestration.metadata.costEstimateUsd,
    })

    return NextResponse.json(
      {
        reply: orchestration.reply,
        metadata: orchestration.metadata,
        followUps: orchestration.followUps,
        structuredPlan: orchestration.structuredPlan ?? null,
        planRationale: orchestration.planRationale ?? null,
        context,
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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: 'InvalidRequest',
          details: error.flatten(),
        }),
        { status: 400 }
      )
    }

    console.error('[assistant] respond route error', error)
    return NextResponse.json(
      { error: 'AssistantResponseError' },
      { status: 500 }
    )
  }
}
