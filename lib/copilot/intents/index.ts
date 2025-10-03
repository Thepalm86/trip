import { READ_ONLY_INTENTS } from '@/lib/copilot/intents/read-only'
import { EDITING_INTENTS } from '@/lib/copilot/intents/editing'
import { smartSuggestionsIntent } from '@/lib/copilot/intents/suggestions'

export const COPILOT_INTENTS = [
  ...READ_ONLY_INTENTS,
  ...EDITING_INTENTS,
  smartSuggestionsIntent,
]
