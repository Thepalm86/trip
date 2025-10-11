import { z } from 'zod'

const coordinatesSchema = z.tuple([z.number(), z.number()])

const destinationLinkSchema = z.object({
  label: z.string().min(1).max(48),
  url: z.string().url(),
})

const isoDateTimeStringSchema = z
  .string()
  .min(1)
  .refine((value) => {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed)
  }, 'Must be a valid ISO 8601 date-time string')

const destinationCoreSchema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(48).nullish(),
  city: z.string().min(1).max(120).nullish(),
  notes: z.string().min(1).max(2000).nullish(),
  coordinates: coordinatesSchema.nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().max(24 * 60).nullish(),
  startTimeIso: isoDateTimeStringSchema.nullish(),
  endTimeIso: isoDateTimeStringSchema.nullish(),
  links: z.array(destinationLinkSchema).max(6).nullable().optional(),
})

export const addDestinationActionSchema = z.object({
  type: z.literal('add_destination'),
  dayId: z.string().min(1),
  insertIndex: z.number().int().nonnegative().optional(),
  destination: destinationCoreSchema.extend({
    notes: z.string().min(1).max(2000).optional(),
  }),
})

export const updateDestinationActionSchema = z.object({
  type: z.literal('update_destination'),
  dayId: z.string().min(1),
  destinationId: z.string().min(1),
  changes: destinationCoreSchema.partial().refine(
    (changes) =>
      Object.keys(changes).length > 0,
    'At least one field must be provided to update.'
  ),
})

const baseLocationSchema = z.object({
  name: z.string().min(1).max(160),
  coordinates: coordinatesSchema.nullable().optional(),
  context: z.string().min(1).max(2000).nullish(),
  notes: z.string().min(1).max(2000).nullish(),
  links: z.array(destinationLinkSchema).max(6).nullable().optional(),
})

export const setBaseLocationActionSchema = z.object({
  type: z.literal('set_base_location'),
  dayId: z.string().min(1),
  location: baseLocationSchema,
  replaceExisting: z.boolean().default(true),
  locationIndex: z.number().int().nonnegative().optional(),
})

export const moveDestinationActionSchema = z.object({
  type: z.literal('move_destination'),
  destinationId: z.string().min(1),
  fromDayId: z.string().min(1),
  toDayId: z.string().min(1),
  insertIndex: z.number().int().nonnegative().optional(),
})

export const toggleMapOverlayActionSchema = z.object({
  type: z.literal('toggle_map_overlay'),
  overlay: z.enum(['all_destinations', 'explore_markers', 'day_routes']),
  enabled: z.boolean().optional(),
  payload: z
    .object({
      visibleCategories: z.array(z.string()).optional(),
      filter: z.enum(['all', 'favorites']).optional(),
    })
    .optional(),
})

export const actionMetadataSchema = z.object({
  actionId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).optional(),
  summary: z.string().min(1).max(320).optional(),
  source: z.enum(['assistant', 'user']).default('assistant'),
})

export const assistantActionIntentSchema = z
  .discriminatedUnion('type', [
    addDestinationActionSchema,
    updateDestinationActionSchema,
    setBaseLocationActionSchema,
    moveDestinationActionSchema,
    toggleMapOverlayActionSchema,
  ])
  .and(
    z.object({
      metadata: actionMetadataSchema.optional(),
    })
  )

export const assistantActionEnvelopeSchema = z.object({
  suggestedAction: assistantActionIntentSchema,
  rationale: z.string().min(1).max(2000).optional(),
})

export type AssistantActionIntent = z.infer<typeof assistantActionIntentSchema>
export type AddDestinationAction = z.infer<typeof addDestinationActionSchema>
export type UpdateDestinationAction = z.infer<typeof updateDestinationActionSchema>
export type SetBaseLocationAction = z.infer<typeof setBaseLocationActionSchema>
export type MoveDestinationAction = z.infer<typeof moveDestinationActionSchema>
export type ToggleMapOverlayAction = z.infer<typeof toggleMapOverlayActionSchema>
export type AssistantActionEnvelope = z.infer<typeof assistantActionEnvelopeSchema>

export const assistantStructuredPlanSchema = z.object({
  steps: z.array(assistantActionIntentSchema).min(1).max(6),
  rationale: z.string().optional(),
})

export type AssistantStructuredPlan = z.infer<typeof assistantStructuredPlanSchema>
