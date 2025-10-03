import { CopilotAction, CopilotIntentOutput } from '@/lib/copilot/types'

export const createNoTripResponse = (): CopilotIntentOutput => ({
  response: "I don't have an active trip to reference yet.",
  actions: [] as CopilotAction[],
})
