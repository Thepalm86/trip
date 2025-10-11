import OpenAI from 'openai'

import type {
  AssistantContext,
  AssistantMessagePayload,
} from '@/lib/assistant/context/types'
import { loadAssistantEnv } from '@/lib/assistant/config/env'
import {
  assistantActionIntentSchema,
} from '@/lib/assistant/actions/types'
import type { AssistantActionIntent, AssistantStructuredPlan } from '@/lib/assistant/actions/types'
import { z } from 'zod'

type OrchestratorInput = {
  payload: AssistantMessagePayload
  context: AssistantContext
  user: {
    id: string
    email?: string
  }
}

type OrchestratorResult = {
  reply: string
  metadata: {
    model: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    costEstimateUsd?: number
  }
  followUps: string[]
  structuredPlan?: AssistantStructuredPlan | null
  planRationale?: string | null
  structuredOutputAttempted: boolean
  structuredParseError?: unknown
  rawModelResponse?: string | null
}

const openAiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const assistantModelResponseSchema = z.object({
  reply: z.string().min(1),
  rationale: z.string().optional(),
  structuredPlan: z
    .object({
      steps: z
        .array(
          z
            .object({
              type: z.string(),
            })
            .passthrough()
        )
        .min(1)
        .max(6),
      rationale: z.string().optional(),
    })
    .optional(),
})

type AssistantModelResponse = z.infer<typeof assistantModelResponseSchema>

const COORDINATES_JSON_SCHEMA = {
  type: 'array',
  items: { type: 'number' },
  minItems: 2,
  maxItems: 2,
  description: '[lng, lat] tuple.',
}

const DESTINATION_LINK_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'url'],
  properties: {
    label: {
      type: 'string',
      minLength: 1,
      maxLength: 48,
    },
    url: {
      type: 'string',
      minLength: 1,
    },
  },
}

const OPTIONAL_STRING = (minLength: number, maxLength: number) => ({
  anyOf: [
    { type: 'string', minLength, maxLength },
    { type: 'null' },
  ],
})

const OPTIONAL_COORDINATES = {
  anyOf: [COORDINATES_JSON_SCHEMA, { type: 'null' }],
}

const OPTIONAL_LINKS = {
  anyOf: [
    {
      type: 'array',
      items: DESTINATION_LINK_JSON_SCHEMA,
      maxItems: 6,
    },
    { type: 'null' },
  ],
}

const DESTINATION_PAYLOAD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 160 },
    category: OPTIONAL_STRING(1, 48),
    city: OPTIONAL_STRING(1, 120),
    notes: OPTIONAL_STRING(1, 2000),
    coordinates: OPTIONAL_COORDINATES,
    estimatedDurationMinutes: {
      anyOf: [
        { type: 'integer', minimum: 1, maximum: 24 * 60 },
        { type: 'null' },
      ],
    },
    startTimeIso: {
      anyOf: [
        { type: 'string', format: 'date-time' },
        { type: 'null' },
      ],
    },
    endTimeIso: {
      anyOf: [
        { type: 'string', format: 'date-time' },
        { type: 'null' },
      ],
    },
    links: OPTIONAL_LINKS,
  },
}

const BASE_LOCATION_PAYLOAD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    name: OPTIONAL_STRING(1, 160),
    coordinates: OPTIONAL_COORDINATES,
    context: OPTIONAL_STRING(1, 2000),
    notes: OPTIONAL_STRING(1, 2000),
    links: OPTIONAL_LINKS,
  },
}

const METADATA_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    actionId: { type: 'string', format: 'uuid' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string', minLength: 1, maxLength: 320 },
    source: { type: 'string', enum: ['assistant', 'user'] },
  },
  required: [],
}

const TOGGLE_OVERLAY_PAYLOAD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    visibleCategories: {
      anyOf: [
        {
          type: 'array',
          items: { type: 'string' },
        },
        { type: 'null' },
      ],
    },
    filter: {
      anyOf: [
        { type: 'string', enum: ['all', 'favorites'] },
        { type: 'null' },
      ],
    },
  },
}

const ACTION_PLAN_STEP_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: [
        'add_destination',
        'update_destination',
        'set_base_location',
        'move_destination',
        'toggle_map_overlay',
      ],
      description: 'Discriminator for allowed assistant action intents.',
    },
    dayId: { type: 'string', minLength: 1 },
    destinationId: { type: 'string', minLength: 1 },
    fromDayId: { type: 'string', minLength: 1 },
    toDayId: { type: 'string', minLength: 1 },
    insertIndex: { type: 'integer', minimum: 0 },
    destination: DESTINATION_PAYLOAD_JSON_SCHEMA,
    changes: DESTINATION_PAYLOAD_JSON_SCHEMA,
    location: BASE_LOCATION_PAYLOAD_JSON_SCHEMA,
    replaceExisting: { type: 'boolean' },
    locationIndex: { type: 'integer', minimum: 0 },
    overlay: { type: 'string', enum: ['all_destinations', 'explore_markers', 'day_routes'] },
    enabled: { type: 'boolean' },
    payload: TOGGLE_OVERLAY_PAYLOAD_JSON_SCHEMA,
    metadata: METADATA_JSON_SCHEMA,
  },
}

const STRUCTURED_PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['steps'],
  properties: {
    rationale: {
      type: 'string',
      description: 'Optional inline rationale (prefer top-level rationale field).',
    },
    steps: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: ACTION_PLAN_STEP_JSON_SCHEMA,
    },
  },
}

const MODEL_RESPONSE_JSON_SCHEMA = {
  name: 'assistant_action_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['reply'],
    properties: {
      reply: {
        type: 'string',
        description: 'Natural-language reply for the user.'
      },
      rationale: {
        type: 'string',
        description: 'Brief reasoning for the suggested action.',
      },
      structuredPlan: STRUCTURED_PLAN_JSON_SCHEMA,
    },
  },
  strict: true,
} as const

const SYSTEM_PROMPT = `You are Trip3, an expert travel assistant embedded inside the Trip3 planning application.

Always answer as a collaborative planner who understands itineraries, destinations, accommodations, activities, and the user's stated preferences.

Guidelines:
- Reference the itinerary data exactly as provided in context (dates, day order, destinations, accommodations).
- Be concise but specific, favour bullet lists or short paragraphs.
- When the context lacks the required information, say so and propose concrete next steps (e.g., suggest researching, adding an item, or using Explore).
- Highlight time-sensitive constraints such as bookings or day/time gaps when relevant.
- Suggest at most 3 actionable next steps.
- Never invent reservations, tickets, or costs that are not present in the context.
- Respect the user’s preferences (budget, style, dietary, accessibility).
- Keep the tone optimistic, professional, and friendly.`.trim()

const ACTION_OUTPUT_INSTRUCTIONS = `RESPOND IN JSON ONLY. Your response must follow the schema provided via response_format:
- Always include a "reply" string summarising your guidance.
- Only include "structuredPlan" when you can produce one or more actionable steps; otherwise omit it entirely.
- When you emit "structuredPlan", add a brief "rationale" explaining why the steps help.
- Each step must set "type" to one of: add_destination, update_destination, set_base_location, move_destination, toggle_map_overlay.
- Provide the fields appropriate for that "type" (e.g., add_destination needs dayId and destination.name; move_destination must include destinationId, fromDayId, and toDayId; toggle_map_overlay needs overlay). Leave unused fields out.
- Keep your explanation in the top-level "rationale" field; do not add extra keys inside structuredPlan.
- Use [longitude, latitude] arrays for all coordinates and copy IDs exactly as shown in context.
- Never return more than 6 steps in a single plan. If the user requests more, explain and prioritise or ask to proceed in batches.
- Describe planned actions as proposals that still require user approval; never claim the changes are already applied.
- Do not wrap the JSON in markdown code fences or add commentary outside the JSON object.
- Never include additional keys outside the schema.`

function summarizePreferences(context: AssistantContext): string {
  const prefs = context.user.preferences
  if (!prefs) return 'No explicit user preferences captured.'

  const segments: string[] = []
  if (prefs.budgetRange) {
    segments.push(
      `Budget range: ${[
        prefs.budgetRange.min ? `$${prefs.budgetRange.min}` : 'unspecified minimum',
        prefs.budgetRange.max ? `$${prefs.budgetRange.max}` : 'no upper limit',
      ].join(' to ')}.`
    )
  }
  if (prefs.travelStyle?.length) {
    segments.push(`Travel style: ${prefs.travelStyle.join(', ')}.`)
  }
  if (prefs.interests?.length) {
    segments.push(`Interests: ${prefs.interests.join(', ')}.`)
  }
  if (prefs.dietary?.length) {
    segments.push(`Dietary: ${prefs.dietary.join(', ')}.`)
  }
  if (prefs.accessibility?.length) {
    segments.push(`Accessibility: ${prefs.accessibility.join(', ')}.`)
  }

  return segments.length ? segments.join(' ') : 'No explicit user preferences captured.'
}

function summarizeTrip(context: AssistantContext): string {
  const trip = context.trip
  if (!trip) return 'User has no active trip selected.'

  const lines: string[] = []
  lines.push(
    `Trip "${trip.name}" (${trip.window.start} → ${trip.window.end})${trip.country ? ` in ${trip.country}` : ''}.`
  )

  trip.days.forEach((day) => {
    const humanDay = day.dayOrder + 1
    const header = `Day ${humanDay} (${day.date}) [id: ${day.id}]`
    const base = day.baseLocations
      ?.map((loc) => `${loc.name}${loc.context ? ` — ${loc.context}` : ''}`)
      .join('; ')
    const basePart = base ? ` | Base: ${base}` : ''
    const destinations = day.destinations
      .map((dest, index) => {
        const label = String.fromCharCode(97 + index)
        const details: string[] = [`${label}) ${dest.name} [id: ${dest.id}]`]
        if (dest.category) details.push(`[${dest.category}]`)
        if (dest.notes) details.push(`Notes: ${dest.notes}`)
        if (dest.durationHours) details.push(`Duration: ${dest.durationHours}h`)
        if (dest.cost) details.push(`Cost: $${dest.cost}`)
        return details.join(' ')
      })
      .join('; ')
    const destinationsPart = destinations ? ` | Destinations: ${destinations}` : ' | Destinations: none scheduled.'
    const openSlots = day.openSlots?.length ? ` | Open slots: ${day.openSlots.join(', ')}` : ''
    lines.push(`${header}${basePart}${destinationsPart}${openSlots}`)
  })

  return lines.join('\n')
}

function summarizeExploreMarkers(context: AssistantContext): string {
  if (!context.exploreMarkers.length) {
    return 'No explore markers saved.'
  }

  return context.exploreMarkers
    .map((marker) => {
      const tags = [marker.category, marker.context].filter(Boolean).join(' — ')
      return `• ${marker.name} @ (${marker.coordinates[1].toFixed(4)}, ${marker.coordinates[0].toFixed(4)})${tags ? ` | ${tags}` : ''}`
    })
    .join('\n')
}

function summarizeKnowledge(context: AssistantContext): string {
  const knowledge = context.knowledge
  if (!knowledge) return 'No supplemental knowledge retrieved.'

  const lines: string[] = []

  if (knowledge.curated?.length) {
    lines.push('Curated content:')
    knowledge.curated.forEach((item) => {
      const highlights = item.highlights?.length ? ` Highlights: ${item.highlights.join('; ')}` : ''
      const tags = item.tags?.length ? ` [${item.tags.join(', ')}]` : ''
      lines.push(`• ${item.name}${tags}: ${item.summary}${highlights}`)
    })
  }

  if (knowledge.semantic?.length) {
    lines.push('Semantic matches:')
    knowledge.semantic.forEach((match) => {
      const tags = match.tags?.length ? ` [${match.tags.join(', ')}]` : ''
      lines.push(`• (${match.similarity.toFixed(2)}) ${match.title}${tags}: ${match.snippet}`)
    })
  }

  return lines.length ? lines.join('\n') : 'No supplemental knowledge retrieved.'
}

function summarizeUiState(context: AssistantContext): string {
  if (!context.ui) return 'UI view unknown (fingerprint not supplied).'
  const { view, selectedTripId, selectedDayOrder, highlightedDestinationId } = context.ui
  return [
    `UI view: ${view ?? 'unknown'}`,
    selectedTripId ? `Selected trip: ${selectedTripId}` : null,
    typeof selectedDayOrder === 'number' ? `Focused day: ${selectedDayOrder}` : null,
    highlightedDestinationId ? `Highlighted destination: ${highlightedDestinationId}` : null,
  ]
    .filter(Boolean)
    .join(' | ')
}

function buildContextSummary(context: AssistantContext): string {
  return [
    '--- USER PREFERENCES ---',
    summarizePreferences(context),
    '--- TRIP ITINERARY ---',
    summarizeTrip(context),
    '--- EXPLORE MARKERS ---',
    summarizeExploreMarkers(context),
    '--- KNOWLEDGE ---',
    summarizeKnowledge(context),
    '--- UI FINGERPRINT ---',
    summarizeUiState(context),
  ].join('\n')
}

function buildMessages(input: OrchestratorInput) {
  const { payload, context } = input
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: [
        'Context timestamp:',
        context.generatedAt,
        '',
        buildContextSummary(context),
        '',
        'Respond using the latest user message below.',
      ].join('\n'),
    },
    { role: 'system', content: ACTION_OUTPUT_INSTRUCTIONS },
  ]

  ;(payload.history ?? []).forEach((message) => {
    messages.push({
      role: message.role,
      content: message.content,
    })
  })

  messages.push({
    role: 'user',
    content: payload.message.content,
  })

  return messages
}

function estimateCostUsd(model: string, promptTokens?: number, completionTokens?: number) {
  if (!promptTokens && !completionTokens) return undefined
  const prompt = promptTokens ?? 0
  const completion = completionTokens ?? 0

  if (model.includes('gpt-4o-mini')) {
    const cost = (prompt * 0.0000006 + completion * 0.0000024)
    return Number(cost.toFixed(6))
  }

  if (model.includes('gpt-4o')) {
    const cost = (prompt * 0.000005 + completion * 0.000015)
    return Number(cost.toFixed(6))
  }

  return undefined
}

function buildFollowUps(context: AssistantContext): string[] {
  const followUps: string[] = []

  if (context.trip?.days?.length) {
    const missingDays = context.trip.days.filter((day) => day.destinations.length === 0)
    if (missingDays.length) {
      followUps.push(
        `Need ideas for Day ${missingDays[0].dayOrder + 1}? I can suggest activities or dining options.`
      )
    }

    const openSlots = context.trip.days.find((day) => (day.openSlots?.length ?? 0) > 0)
    if (openSlots) {
      followUps.push(
        `Want to fill the ${openSlots.openSlots?.join(', ') ?? 'open time'} on Day ${openSlots.dayOrder + 1}?`
      )
    }
  }

  if (!followUps.length && context.exploreMarkers.length) {
    followUps.push('Should I shortlist anything from your Explore pins for the itinerary?')
  }

  return followUps.slice(0, 3)
}

async function callModel(
  model: string,
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      reply:
        "I'm unable to reach the language model right now. Please check the OpenAI API configuration.",
      metadata: { model: 'unconfigured' },
      followUps: buildFollowUps(input.context),
    }
  }

  const messages = buildMessages(input)

  const modelId = model.toLowerCase()
  const supportsStructuredOutput = !modelId.includes('mini')

  let response
  try {
    response = await openAiClient.chat.completions.create({
      model,
      messages,
      temperature: 0.6,
      top_p: 0.9,
      presence_penalty: 0,
      frequency_penalty: 0,
      ...(supportsStructuredOutput
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: MODEL_RESPONSE_JSON_SCHEMA,
            },
          }
        : {}),
    })
  } catch (error) {
    const openAiError = error as {
      message?: string
      response?: { status?: number; data?: unknown }
      code?: string
      type?: string
    }
    const message = typeof openAiError?.message === 'string' ? openAiError.message : ''
    const responseStatus = openAiError?.response?.status
    const responseData = openAiError?.response?.data
    const responseError =
      responseData && typeof responseData === 'object'
        ? (responseData as { error?: unknown }).error ?? responseData
        : responseData
    console.warn('[assistant] model call failed', {
      model,
      supportsStructuredOutput,
      code: openAiError?.code,
      type: openAiError?.type,
      status: responseStatus,
      message,
      responseError,
    })
    const isStructuredFailure =
      message.toLowerCase().includes('response_format') || message.toLowerCase().includes('json_schema')

    if (supportsStructuredOutput && isStructuredFailure) {
      console.warn('[assistant] structured output unsupported, falling back to plain text', {
        model,
        message,
        status: responseStatus,
      })
      response = await openAiClient.chat.completions.create({
        model,
        messages,
        temperature: 0.6,
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0,
      })
    } else {
      throw error
    }
  }

  const parsePlanSteps = (rawSteps?: unknown[]) => {
    if (!rawSteps || !Array.isArray(rawSteps) || rawSteps.length === 0) {
      return { steps: [] as AssistantActionIntent[], errors: [] as Array<{ index: number; error: unknown }> }
    }

    const steps: AssistantActionIntent[] = []
    const errors: Array<{ index: number; error: unknown }> = []

    rawSteps.forEach((rawStep, index) => {
      const parsed = assistantActionIntentSchema.safeParse(rawStep)
      if (parsed.success) {
        steps.push(parsed.data)
      } else {
        errors.push({ index, error: parsed.error })
      }
    })

    return { steps, errors }
  }

  const choice = response.choices[0]
  const rawContent = choice?.message?.content?.trim()
  let modelResponse: AssistantModelResponse | null = null
  let structuredParseError: unknown
  let reply = 'Sorry, I could not generate a response.'
  let structuredPlan: AssistantStructuredPlan | null = null
  let planRationale: string | null = null

  if (rawContent) {
    try {
      const parsedJson = JSON.parse(rawContent) as unknown
      const validated = assistantModelResponseSchema.safeParse(parsedJson)
      if (validated.success) {
        modelResponse = validated.data
        reply = modelResponse.reply.trim()
        planRationale = modelResponse.rationale ?? null

        if (modelResponse.structuredPlan) {
          const rawPlan = modelResponse.structuredPlan as unknown as { steps?: unknown; rationale?: unknown }
          if (!planRationale && typeof rawPlan?.rationale === 'string') {
            planRationale = rawPlan.rationale
          }
          const { steps, errors } = parsePlanSteps(rawPlan.steps && Array.isArray(rawPlan.steps) ? rawPlan.steps : undefined)
          if (errors.length) {
            structuredParseError = {
              type: 'plan_step_validation',
              errors,
            }
            console.warn('[assistant] structured plan step validation failed', errors)
          }
          if (steps.length) {
            structuredPlan = { steps }
          }
        }
      } else {
        let fallbackReply = rawContent
        if (parsedJson && typeof parsedJson === 'object' && 'reply' in parsedJson) {
          const replyValue = (parsedJson as { reply?: unknown }).reply
          if (typeof replyValue === 'string' && replyValue.trim().length) {
            fallbackReply = replyValue.trim()
          }
        }
        reply = fallbackReply.length ? fallbackReply : 'Sorry, I could not generate a response.'

        let planErrors: Array<{ index: number; error: unknown }> = []

        if (parsedJson && typeof parsedJson === 'object' && 'structuredPlan' in parsedJson) {
          const rawPlan = (parsedJson as { structuredPlan?: unknown }).structuredPlan
          if (!planRationale && rawPlan && typeof rawPlan === 'object' && 'rationale' in rawPlan && typeof (rawPlan as { rationale?: unknown }).rationale === 'string') {
            planRationale = (rawPlan as { rationale: string }).rationale
          }
          const rawSteps = rawPlan && typeof rawPlan === 'object' ? (rawPlan as { steps?: unknown }).steps : undefined
          const { steps, errors } = parsePlanSteps(Array.isArray(rawSteps) ? rawSteps : undefined)
          if (steps.length) {
            structuredPlan = { steps }
          }
          if (errors.length) {
            planErrors = errors
            console.warn('[assistant] structured plan step validation failed (fallback parse)', errors)
          }
        }

        if (parsedJson && typeof parsedJson === 'object' && 'rationale' in parsedJson) {
          const rationale = (parsedJson as { rationale?: unknown }).rationale
          planRationale = typeof rationale === 'string' ? rationale : null
        }

        structuredParseError = planErrors.length
          ? {
              schemaError: validated.error,
              planStepValidation: planErrors,
            }
          : validated.error
      }
    } catch (error) {
      console.warn('[assistant] failed to parse model JSON response', error, rawContent)
      reply = rawContent
      structuredParseError = error
    }
  }

  const usage = response.usage ?? undefined
  const metadata = {
    model: response.model,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    totalTokens: usage?.prompt_tokens && usage?.completion_tokens
      ? usage.prompt_tokens + usage.completion_tokens
      : undefined,
    costEstimateUsd: estimateCostUsd(
      response.model,
      usage?.prompt_tokens,
      usage?.completion_tokens
    ),
  }

  return {
    reply,
    metadata,
    followUps: buildFollowUps(input.context),
    structuredPlan: structuredPlan
      ? {
          steps: structuredPlan.steps,
          ...(planRationale ? { rationale: planRationale } : {}),
        }
      : null,
    planRationale,
    structuredOutputAttempted: supportsStructuredOutput,
    structuredParseError,
    rawModelResponse: rawContent ?? null,
  }
}

export async function orchestrateAssistantResponse(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const env = loadAssistantEnv()
 
  const handleFailure = (error: unknown): OrchestratorResult => {
    console.error('[assistant] all model attempts failed', error)
    return {
      reply:
        "I'm having trouble reaching the assistant brain right now. Please try again in a moment.",
      metadata: {
        model: 'unavailable',
      },
      followUps: buildFollowUps(input.context),
      structuredPlan: null,
      planRationale: null,
      structuredOutputAttempted: false,
      structuredParseError: undefined,
      rawModelResponse: null,
    }
  }

  try {
    const primaryResult = await callModel(env.ASSISTANT_MODEL_PRIMARY, input)

    const fallbackModel = env.ASSISTANT_MODEL_FALLBACK
    const fallbackSupportsStructured = !!fallbackModel && !fallbackModel.toLowerCase().includes('mini')
    const shouldRetryWithFallback =
      primaryResult.structuredOutputAttempted &&
      Boolean(primaryResult.structuredParseError) &&
      fallbackSupportsStructured &&
      fallbackModel !== env.ASSISTANT_MODEL_PRIMARY

    if (!shouldRetryWithFallback) {
      return primaryResult
    }

    console.warn('[assistant] structured response parse failed, retrying with fallback model', {
      primaryModel: env.ASSISTANT_MODEL_PRIMARY,
      fallbackModel,
      parseError: primaryResult.structuredParseError,
    })

    try {
      return await callModel(fallbackModel!, input)
    } catch (fallbackError) {
      console.warn('[assistant] fallback model after parse failure also failed', fallbackError)
      return primaryResult
    }
  } catch (primaryError) {
    console.warn('[assistant] primary model failed, attempting fallback', primaryError)

    if (!env.ASSISTANT_MODEL_FALLBACK) {
      return handleFailure(primaryError)
    }

    try {
      return await callModel(env.ASSISTANT_MODEL_FALLBACK, input)
    } catch (fallbackError) {
      return handleFailure(fallbackError)
    }
  }
}
