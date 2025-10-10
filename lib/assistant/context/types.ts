import { z } from 'zod'

/**
 * AssistantContext describes the deterministic state snapshot we attach to each LLM turn.
 * Keep this schema in sync with docs/assistant/context-schema.md.
 */
export const assistantDestinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z
    .enum(['city', 'attraction', 'restaurant', 'hotel', 'activity'])
    .or(z.string())
    .optional(),
  city: z.string().optional(),
  coordinates: z.tuple([z.number(), z.number()]),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationHours: z.number().optional(),
  notes: z.string().optional(),
  bookingStatus: z.enum(['booked', 'pending', 'tentative']).optional(),
  cost: z.number().optional(),
  links: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().url(),
      })
    )
    .optional(),
})

export const assistantDaySchema = z.object({
  dayOrder: z.number().int().nonnegative(),
  date: z.string(),
  baseLocations: z
    .array(
      z.object({
        name: z.string(),
        coordinates: z.tuple([z.number(), z.number()]),
        context: z.string().optional(),
      })
    )
    .optional(),
  destinations: z.array(assistantDestinationSchema),
  openSlots: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export const assistantTripSchema = z.object({
  id: z.string(),
  name: z.string(),
  window: z.object({
    start: z.string(),
    end: z.string(),
  }),
  country: z.string().optional(),
  days: z.array(assistantDaySchema),
})

export const exploreMarkerSchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinates: z.tuple([z.number(), z.number()]),
  category: z.string().optional(),
  context: z.string().optional(),
  source: z.enum(['user', 'assistant', 'explore']).default('user'),
  metadata: z.record(z.any()).optional(),
})

export const curatedKnowledgeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  coordinates: z.tuple([z.number(), z.number()]).optional(),
  source: z.literal('destination_modal_content').default('destination_modal_content'),
})

export const semanticMatchSchema = z.object({
  id: z.string(),
  title: z.string(),
  snippet: z.string(),
  similarity: z.number(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  coordinates: z.tuple([z.number(), z.number()]).optional(),
  source: z.literal('content_embeddings').default('content_embeddings'),
})

export const assistantKnowledgeSchema = z.object({
  curated: z.array(curatedKnowledgeItemSchema).default([]),
  semantic: z.array(semanticMatchSchema).default([]),
})

export const userPreferenceSchema = z.object({
  budgetRange: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  travelStyle: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  accessibility: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
})

export const assistantUserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  preferences: userPreferenceSchema.optional(),
})

export const uiContextSchema = z.object({
  view: z.enum(['timeline', 'map', 'explore', 'details']).optional(),
  selectedTripId: z.string().optional(),
  selectedDayOrder: z.number().optional(),
  highlightedDestinationId: z.string().optional(),
  filters: z
    .object({
      category: z.array(z.string()).optional(),
      budget: z
        .object({
          max: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  mapBounds: z
    .object({
      northEast: z.tuple([z.number(), z.number()]),
      southWest: z.tuple([z.number(), z.number()]),
    })
    .optional(),
})

export const assistantContextSchema = z.object({
  user: assistantUserSchema,
  trip: assistantTripSchema.optional(),
  exploreMarkers: z.array(exploreMarkerSchema).default([]),
  knowledge: assistantKnowledgeSchema.optional(),
  ui: uiContextSchema.optional(),
  generatedAt: z.string().default(() => new Date().toISOString()),
})

export type AssistantContext = z.infer<typeof assistantContextSchema>
export type AssistantTrip = z.infer<typeof assistantTripSchema>
export type AssistantDay = z.infer<typeof assistantDaySchema>
export type AssistantDestination = z.infer<typeof assistantDestinationSchema>
export type ExploreMarker = z.infer<typeof exploreMarkerSchema>
export type AssistantUser = z.infer<typeof assistantUserSchema>
export type AssistantUIContext = z.infer<typeof uiContextSchema>
export type AssistantKnowledge = z.infer<typeof assistantKnowledgeSchema>
export type CuratedKnowledgeItem = z.infer<typeof curatedKnowledgeItemSchema>
export type SemanticKnowledgeMatch = z.infer<typeof semanticMatchSchema>

/**
 * Payload sent from the frontend when requesting an assistant response.
 */
export const assistantMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.object({
    id: z.string(),
    role: z.literal('user'),
    content: z.string().min(1),
    locale: z.string().optional(),
  }),
  history: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        createdAt: z.string().optional(),
      })
    )
    .max(12)
    .optional(),
  uiFingerprint: uiContextSchema.optional(),
  contextVersion: z.string().default('2025-03-01'),
})

export type AssistantMessagePayload = z.infer<typeof assistantMessageSchema>
