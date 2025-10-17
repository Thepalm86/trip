import { randomUUID } from 'node:crypto'

import OpenAI from 'openai'
import { z } from 'zod'

import { loadAssistantEnv } from '@/lib/assistant/config/env'
import type {
  AssistantContext,
  AssistantMessagePayload,
} from '@/lib/assistant/context/types'
import {
  assistantUiActionCollectionJsonSchema,
  assistantUiActionCollectionSchema,
  type AssistantUiAction,
} from '@/lib/assistant/actions'

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
  actions: AssistantUiAction[]
  analysis?: string
  metadata: {
    model: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    costEstimateUsd?: number
  }
  followUps: string[]
}

const openAiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SYSTEM_PROMPT = `You are Trip3, an expert travel assistant embedded inside the Trip3 planning application.

Always answer as a collaborative planner who understands itineraries, destinations, accommodations, activities, and the user's stated preferences.

Guidelines:
- Reference the itinerary data exactly as provided in context (dates, day order, destinations, accommodations).
- Be concise but specific, favour bullet lists or short paragraphs.
- When the context lacks the required information, say so and propose concrete next steps (e.g., suggest researching, adding an item, or using Explore).
- Highlight time-sensitive constraints such as bookings or day/time gaps when relevant.
- Suggest at most 3 actionable next steps.
- Never invent reservations, tickets, or costs that are not present in the context.
- Respect the user’s preferences (budget, pace, mobility, interests, dietary needs, accessibility).
- Keep the tone optimistic, professional, and friendly.`

const UI_ACTION_PROMPT = `
### UI Actions
You may emit a UI action when the user explicitly requests a change and all required identifiers are present.
- AddPlaceToItinerary — Adds a new point of interest to a specific day/time. Include tripId, dayId, startTime, durationMinutes, confidence, placeId, and fallbackQuery. Only add when the user agrees or requested it; otherwise ask first.
- RescheduleItineraryItem — Moves an existing item to a new slot. Provide the current itemId/dayId and the new day/time. Request confirmation if lockedDependencies are present.
- RemoveOrReplaceItem — Removes or swaps an item. Emit only with userConfirmed=true. For replacements include the new place details inside replacement.
- AddExploreMarker — Pins a discovery suggestion to Explore Anywhere. Provide a descriptive query (include city/region/country when known), optional category/tags/notes, and confidence. Do not invent coordinates; omit lat/lng unless explicitly provided. Limit yourself to three markers per conversation turn.

Formatting requirements:
- Use full ISO 8601 timestamps with date for any startTime fields (e.g., 2025-10-23T10:00:00Z).
- If you include meta.requestId, supply a UUID string; otherwise omit meta entirely.
- Use the explicit identifiers shown in the context (dayId, destination id) for payload fields. Never invent new IDs or reuse dates as IDs.

Always explain what you did in natural language and mention any follow-up needed (e.g., “Let me know if you want a different time.”). If the user input is ambiguous, ask a clarifying question instead of taking action.`
  .concat(
    '\n\nReturn your answer as JSON matching {"analysis": string?, "reply": string, "actions": AssistantUIAction[]} where actions defaults to an empty array when no action is taken.'
  )

const ASSISTANT_RESPONSE_JSON_SCHEMA = {
  name: 'assistant_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      analysis: {
        type: 'string',
        description:
          'Brief chain-of-thought style reasoning or safety notes. This is not shown to the user.',
      },
      reply: {
        type: 'string',
        description: 'The message shown to the user in the assistant chat.',
      },
      actions: {
        ...assistantUiActionCollectionJsonSchema,
        description:
          'Array of UI actions for the Trip3 client to execute. Leave empty if no action is required.',
      },
    },
    required: ['reply', 'actions'],
  },
} as const

const assistantResponseEnvelopeSchema = z.object({
  analysis: z.string().optional(),
  reply: z.string().min(1),
  actions: assistantUiActionCollectionSchema.optional(),
})

type AssistantResponseEnvelope = z.infer<typeof assistantResponseEnvelopeSchema>

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeActions(actions: AssistantUiAction[]): AssistantUiAction[] {
  if (!actions.length) return actions

  return actions.map((action) => {
    const providedRequestId = action.meta?.requestId
    const requestId =
      providedRequestId && UUID_REGEX.test(providedRequestId) ? providedRequestId : randomUUID()
    const issuedAt = action.meta?.issuedAt ?? new Date().toISOString()
    let confidence = action.meta?.confidence

    if (confidence === undefined) {
      if (action.type === 'AddPlaceToItinerary') {
        confidence = action.payload.confidence
      } else if (action.type === 'AddExploreMarker') {
        confidence =
          typeof action.payload.confidence === 'number'
            ? action.payload.confidence / (action.payload.confidence > 1 ? 100 : 1)
            : undefined
      }
    } else if (action.type === 'AddExploreMarker' && confidence > 1) {
      confidence = confidence / 100
    }

    return {
      ...action,
      meta: {
        requestId,
        issuedAt,
        confidence,
        rationale: action.meta?.rationale,
      },
    }
  })
}

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
  if (prefs.pace) {
    segments.push(`Preferred pace: ${prefs.pace}.`)
  }
  if (prefs.mobility) {
    segments.push(`Mobility preference: ${prefs.mobility}.`)
  }
  if (prefs.dietary?.length) {
    segments.push(`Dietary: ${prefs.dietary.join(', ')}.`)
  }
  if (prefs.accessibility?.length) {
    segments.push(`Accessibility: ${prefs.accessibility.join(', ')}.`)
  }
  if (prefs.budgetLevel) {
    segments.push(`Budget comfort: ${prefs.budgetLevel}.`)
  }
  if (prefs.notes) {
    segments.push(`Additional notes: ${prefs.notes}`)
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
    const header = `Day ${humanDay} (${day.date}) [dayId: ${day.id}]`
    const base = day.baseLocations
      ?.map((loc) => `${loc.name}${loc.context ? ` — ${loc.context}` : ''}`)
      .join('; ')
    const basePart = base ? ` | Base: ${base}` : ''
    const destinations = day.destinations
      .map((dest, index) => {
        const label = String.fromCharCode(97 + index)
        const details: string[] = [`${label}) ${dest.name} (id: ${dest.id})`]
        if (dest.category) details.push(`[${dest.category}]`)
        if (dest.startTime) details.push(`Start: ${dest.startTime}`)
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
        UI_ACTION_PROMPT.trim(),
        '',
        'Context timestamp:',
        context.generatedAt,
        '',
        buildContextSummary(context),
        '',
        'Respond using the latest user message below.',
      ].join('\n'),
    },
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
      actions: [],
      followUps: buildFollowUps(input.context),
    }
  }

  const messages = buildMessages(input)

  const response = await openAiClient.chat.completions.create({
    model,
    messages,
    temperature: 0.6,
    top_p: 0.9,
    presence_penalty: 0,
    frequency_penalty: 0,
    response_format: {
      type: 'json_schema',
      json_schema: ASSISTANT_RESPONSE_JSON_SCHEMA,
    },
  })

  const choice = response.choices[0]
  const rawContent = choice?.message?.content?.trim()
  let envelope: AssistantResponseEnvelope | null = null

  if (rawContent) {
    try {
      envelope = assistantResponseEnvelopeSchema.parse(JSON.parse(rawContent))
    } catch (error) {
      console.warn('[assistant] failed to parse structured response, falling back to text', error)
    }
  }

  const reply = envelope?.reply ?? rawContent ?? 'Sorry, I could not generate a response.'
  const actions = normalizeActions(envelope?.actions ?? [])
  const analysis = envelope?.analysis
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
    actions,
    analysis,
    metadata,
    followUps: buildFollowUps(input.context),
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
      actions: [],
      metadata: {
        model: 'unavailable',
      },
      followUps: buildFollowUps(input.context),
    }
  }

  try {
    return await callModel(env.ASSISTANT_MODEL_PRIMARY, input)
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
