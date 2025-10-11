import { supabaseAdmin } from '@/lib/server/supabase-admin'

type ActionAuditEvent = 'preview' | 'execute'

interface ActionAuditInput {
  event: ActionAuditEvent
  userId: string
  actionType: string
  summary: string
  payload: Record<string, unknown>
}

const TABLE_NAME = 'assistant_action_logs'

export async function recordAssistantActionAudit(input: ActionAuditInput): Promise<void> {
  try {
    await supabaseAdmin.from(TABLE_NAME).insert({
      event_type: input.event,
      user_id: input.userId,
      action_type: input.actionType,
      summary: input.summary,
      payload: input.payload,
    })
  } catch (error) {
    console.warn('[assistant-actions] audit insert failed', error)
  }
}
