import { z } from 'zod'

const ISO_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/
const HH_MM_TIME_REGEX = /^\d{2}:\d{2}(?::\d{2})?$/

const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine(
    (value) => ISO_DATE_TIME_REGEX.test(value) || HH_MM_TIME_REGEX.test(value),
    'Expected ISO8601 datetime string or HH:MM time'
  )

const uuidSchema = z
  .string()
  .uuid()
  .or(z.string().regex(/^temp_[a-zA-Z0-9_-]+$/, 'Expected uuid or temp_* identifier'))

const ensureLatLngPair = <T extends { lat?: number; lng?: number }>(value: T) =>
  value.lat === undefined && value.lng === undefined
    ? true
    : value.lat !== undefined && value.lng !== undefined

export const assistantUiActionTypeSchema = z.enum([
  'AddPlaceToItinerary',
  'RescheduleItineraryItem',
  'RemoveOrReplaceItem',
])

export const assistantAddPlacePayloadSchema = z
  .object({
    placeId: z.string().min(1),
    fallbackQuery: z.string().min(1),
    tripId: z.string().min(1),
    dayId: z.string().min(1),
    startTime: isoDateTimeSchema,
    durationMinutes: z.number().int().positive(),
    source: z.literal('assistant').default('assistant'),
    confidence: z.number().min(0).max(1),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    fromMapSelection: z.boolean().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .refine(ensureLatLngPair, {
    message: 'lat and lng must either both be provided or omitted',
    path: ['lat'],
  })

export const assistantReschedulePayloadSchema = z.object({
  tripId: z.string().min(1),
  dayId: z.string().min(1),
  itemId: uuidSchema,
  newDayId: z.string().min(1),
  newStartTime: isoDateTimeSchema,
  newDurationMinutes: z.number().int().positive(),
  lockedDependencies: z.array(z.string()).optional(),
  userConfirmed: z.boolean().optional(),
})

const assistantReplacePayloadSchema = z
  .object({
    placeId: z.string().min(1),
    fallbackQuery: z.string().min(1),
    startTime: isoDateTimeSchema.optional(),
    durationMinutes: z.number().int().positive().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .refine(ensureLatLngPair, {
    message: 'lat and lng must either both be provided or omitted',
    path: ['lat'],
})

export const assistantRemoveOrReplacePayloadSchema = z
  .object({
    tripId: z.string().min(1),
    dayId: z.string().min(1),
    itemId: uuidSchema,
    mode: z.enum(['remove', 'replace']),
    userConfirmed: z.boolean(),
    reason: z.string().optional(),
    replacement: assistantReplacePayloadSchema.optional(),
  })
  .refine(
    (payload) => (payload.mode === 'replace' ? !!payload.replacement : true),
    {
      message: 'replacement payload required when mode is "replace"',
      path: ['replacement'],
    }
  )

export const assistantUiActionMetaSchema = z
  .object({
    requestId: z.string().min(1),
    issuedAt: z.string().datetime(),
    confidence: z.number().min(0).max(1).optional(),
    rationale: z.string().optional(),
  })
  .partial({
    confidence: true,
    rationale: true,
  })

export const assistantUiActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('AddPlaceToItinerary'),
    payload: assistantAddPlacePayloadSchema,
    meta: assistantUiActionMetaSchema.optional(),
  }),
  z.object({
    type: z.literal('RescheduleItineraryItem'),
    payload: assistantReschedulePayloadSchema,
    meta: assistantUiActionMetaSchema.optional(),
  }),
  z.object({
    type: z.literal('RemoveOrReplaceItem'),
    payload: assistantRemoveOrReplacePayloadSchema,
    meta: assistantUiActionMetaSchema.optional(),
  }),
])

export const assistantUiActionCollectionSchema = z.array(assistantUiActionSchema)

const metaJsonSchema = {
  type: 'object',
  properties: {
    requestId: { type: 'string', minLength: 1 },
    issuedAt: { type: 'string', format: 'date-time' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string' },
  },
  required: ['requestId', 'issuedAt'],
  additionalProperties: false,
}

const addPlacePayloadJsonSchema = {
  type: 'object',
  properties: {
    placeId: { type: 'string', minLength: 1 },
    fallbackQuery: { type: 'string', minLength: 1 },
    tripId: { type: 'string', minLength: 1 },
    dayId: { type: 'string', minLength: 1 },
    startTime: { type: 'string', format: 'date-time' },
    durationMinutes: { type: 'integer', minimum: 1 },
    source: { const: 'assistant' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    notes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    fromMapSelection: { type: 'boolean' },
    lat: { type: 'number' },
    lng: { type: 'number' },
  },
  required: ['placeId', 'fallbackQuery', 'tripId', 'dayId', 'startTime', 'durationMinutes', 'source', 'confidence'],
  additionalProperties: false,
}

const reschedulePayloadJsonSchema = {
  type: 'object',
  properties: {
    tripId: { type: 'string', minLength: 1 },
    dayId: { type: 'string', minLength: 1 },
    itemId: { type: 'string', minLength: 1 },
    newDayId: { type: 'string', minLength: 1 },
    newStartTime: { type: 'string', format: 'date-time' },
    newDurationMinutes: { type: 'integer', minimum: 1 },
    lockedDependencies: { type: 'array', items: { type: 'string' } },
    userConfirmed: { type: 'boolean' },
  },
  required: [
    'tripId',
    'dayId',
    'itemId',
    'newDayId',
    'newStartTime',
    'newDurationMinutes',
  ],
  additionalProperties: false,
}

const replaceDetailsJsonSchema = {
  type: 'object',
  properties: {
    placeId: { type: 'string', minLength: 1 },
    fallbackQuery: { type: 'string', minLength: 1 },
    startTime: { type: 'string', format: 'date-time' },
    durationMinutes: { type: 'integer', minimum: 1 },
    notes: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    lat: { type: 'number' },
    lng: { type: 'number' },
  },
  required: ['placeId', 'fallbackQuery'],
  additionalProperties: false,
}

const removeOrReplacePayloadJsonSchema = {
  type: 'object',
  properties: {
    tripId: { type: 'string', minLength: 1 },
    dayId: { type: 'string', minLength: 1 },
    itemId: { type: 'string', minLength: 1 },
    mode: { enum: ['remove', 'replace'] },
    userConfirmed: { type: 'boolean' },
    reason: { type: 'string' },
    replacement: replaceDetailsJsonSchema,
  },
  required: ['tripId', 'dayId', 'itemId', 'mode', 'userConfirmed'],
  additionalProperties: false,
  allOf: [
    {
      if: {
        properties: { mode: { const: 'replace' } },
      },
      then: {
        required: ['replacement'],
      },
    },
  ],
}

export const assistantUiActionJsonSchema = {
  oneOf: [
    {
      type: 'object',
      properties: {
        type: { const: 'AddPlaceToItinerary' },
        payload: addPlacePayloadJsonSchema,
        meta: metaJsonSchema,
      },
      required: ['type', 'payload'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'RescheduleItineraryItem' },
        payload: reschedulePayloadJsonSchema,
        meta: metaJsonSchema,
      },
      required: ['type', 'payload'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'RemoveOrReplaceItem' },
        payload: removeOrReplacePayloadJsonSchema,
        meta: metaJsonSchema,
      },
      required: ['type', 'payload'],
      additionalProperties: false,
    },
  ],
} as const

export const assistantUiActionCollectionJsonSchema = {
  type: 'array',
  items: assistantUiActionJsonSchema,
  default: [],
} as const

export type AssistantAddPlacePayload = z.infer<typeof assistantAddPlacePayloadSchema>
export type AssistantReschedulePayload = z.infer<typeof assistantReschedulePayloadSchema>
export type AssistantRemoveOrReplacePayload = z.infer<
  typeof assistantRemoveOrReplacePayloadSchema
>
export type AssistantUiAction = z.infer<typeof assistantUiActionSchema>
export type AssistantUiActionCollection = z.infer<typeof assistantUiActionCollectionSchema>
