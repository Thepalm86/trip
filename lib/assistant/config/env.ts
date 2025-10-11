import { z } from 'zod'

const assistantEnvSchema = z.object({
  ASSISTANT_MODEL_PRIMARY: z.string().default('gpt-4o'),
  ASSISTANT_MODEL_FALLBACK: z.string().default('gpt-4o-mini'),
  ASSISTANT_FEATURE_FLAG_KEY: z.string().default('assistant_v1_beta'),
  ASSISTANT_COST_BUDGET_WEEKLY: z.coerce.number().positive().default(600),
  ASSISTANT_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  ASSISTANT_SEMANTIC_MATCH_FUNCTION: z.string().optional(),
})

export type AssistantEnv = z.infer<typeof assistantEnvSchema>

let cachedEnv: AssistantEnv | null = null

export function loadAssistantEnv(): AssistantEnv {
  if (cachedEnv) return cachedEnv

  cachedEnv = assistantEnvSchema.parse({
    ASSISTANT_MODEL_PRIMARY: process.env.ASSISTANT_MODEL_PRIMARY,
    ASSISTANT_MODEL_FALLBACK: process.env.ASSISTANT_MODEL_FALLBACK,
    ASSISTANT_COST_BUDGET_WEEKLY: process.env.ASSISTANT_COST_BUDGET_WEEKLY,
    ASSISTANT_FEATURE_FLAG_KEY: process.env.ASSISTANT_FEATURE_FLAG_KEY,
    ASSISTANT_EMBEDDING_MODEL: process.env.ASSISTANT_EMBEDDING_MODEL,
    ASSISTANT_SEMANTIC_MATCH_FUNCTION: process.env.ASSISTANT_SEMANTIC_MATCH_FUNCTION,
  })

  return cachedEnv
}

export function resetAssistantEnvCache(): void {
  cachedEnv = null
}
