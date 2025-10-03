import {
  ConversationHarnessResult,
  ConversationScript,
  CopilotAction,
  CopilotIntentOutput,
  CopilotRuntimeContext,
} from '@/lib/copilot/types'
import { COPILOT_INTENTS } from '@/lib/copilot/intents'
import { snapshotCopilotRuntimeContext } from '@/lib/copilot/runtime-context'
import { copilotActionBus } from '@/lib/copilot/action-bus'
import { getProactiveNudge } from '@/lib/copilot/nudges'

interface EvaluateOptions {
  dispatchActions?: boolean
  context?: CopilotRuntimeContext | (() => CopilotRuntimeContext)
}

const fallbackResponse: CopilotIntentOutput = {
  response: "I'm still learning that request. Try asking about the trip overview or a specific day.",
  actions: [],
}

const resolveContext = (
  override?: CopilotRuntimeContext | (() => CopilotRuntimeContext),
): CopilotRuntimeContext => {
  if (!override) return snapshotCopilotRuntimeContext()
  return typeof override === 'function' ? override() : override
}

const evaluateUtterance = (
  utterance: string,
  contextOverride?: CopilotRuntimeContext | (() => CopilotRuntimeContext),
): CopilotIntentOutput => {
  const context = resolveContext(contextOverride)
  const input = { utterance, context }
  const handler = COPILOT_INTENTS.find((intent) => intent.canHandle(input))
  if (!handler) {
    const proactive = getProactiveNudge(input)
    return proactive ?? fallbackResponse
  }
  return handler.execute(input)
}

const dispatchActionsIfNeeded = async (actions: CopilotAction[], options?: EvaluateOptions) => {
  if (!options?.dispatchActions) return
  for (const action of actions) {
    await copilotActionBus.dispatch(action)
  }
}

export const evaluateCopilotTurn = async (
  utterance: string,
  options?: EvaluateOptions,
): Promise<CopilotIntentOutput> => {
  const output = evaluateUtterance(utterance, options?.context)
  await dispatchActionsIfNeeded(output.actions, options)
  return output
}

const compareActions = (expected: CopilotAction[], actual: CopilotAction[]) => {
  if (expected.length !== actual.length) return false
  return expected.every((expectedAction, index) => {
    const actualAction = actual[index]
    return (
      actualAction.type === expectedAction.type &&
      JSON.stringify(actualAction.payload) === JSON.stringify(expectedAction.payload)
    )
  })
}

export const runConversationScript = async (
  script: ConversationScript,
  options?: EvaluateOptions,
): Promise<ConversationHarnessResult> => {
  const transcript: ConversationHarnessResult['transcript'] = []
  const mismatches: string[] = []

  for (const turn of script.turns) {
    const output = await evaluateCopilotTurn(turn.user, options)
    transcript.push({ user: turn.user, response: output.response, actions: output.actions })

    if (turn.expectedResponseIncludes) {
      const missingFragment = turn.expectedResponseIncludes.find(
        (fragment) => !output.response.includes(fragment),
      )
      if (missingFragment) {
        mismatches.push(`Expected response to include "${missingFragment}" for turn "${turn.user}"`)
      }
    }

    if (turn.expectedActions && !compareActions(turn.expectedActions, output.actions)) {
      mismatches.push(`Expected actions ${JSON.stringify(turn.expectedActions)} but received ${JSON.stringify(output.actions)}`)
    }
  }

  return { transcript, mismatches }
}
