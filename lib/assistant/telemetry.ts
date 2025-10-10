import { supabaseAdmin } from '@/lib/server/supabase-admin'

type TelemetryInput = {
  userId: string
  conversationId?: string
  messageId: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  model: string
  costUsd?: number
  blocked?: boolean
  blockReason?: string
}

const TABLE_NAME = 'assistant_logs'

export async function recordAssistantTelemetry(input: TelemetryInput): Promise<void> {
  try {
    await supabaseAdmin.from(TABLE_NAME).insert({
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId,
      model: input.model,
      prompt_tokens: input.promptTokens ?? null,
      completion_tokens: input.completionTokens ?? null,
      total_tokens: input.totalTokens ?? null,
      cost_usd: input.costUsd ?? null,
      blocked: input.blocked ?? false,
      block_reason: input.blockReason ?? null,
    })
  } catch (error) {
    console.warn('[assistant] telemetry insert failed', error)
  }
}
