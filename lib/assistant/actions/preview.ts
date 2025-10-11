import type { AssistantActionIntent } from './types'

export interface ActionPreviewContext {
  dayLabel?: string
  destinationName?: string
  fromDayLabel?: string
  toDayLabel?: string
}

export interface AssistantActionPreview {
  summary: string
  requiresConfirmation: boolean
  action: AssistantActionIntent
  details?: Record<string, unknown>
}

type SummaryBuilder = (action: AssistantActionIntent, context: ActionPreviewContext) => AssistantActionPreview

const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  category: 'category',
  city: 'city',
  notes: 'notes',
  coordinates: 'location',
  estimatedDurationMinutes: 'duration',
  startTimeIso: 'start time',
  endTimeIso: 'end time',
  links: 'links',
}

function formatFieldList(fields: string[]): string {
  if (fields.length === 0) {
    return 'details'
  }
  const mapped = fields.map((field) => FIELD_LABELS[field] ?? field)
  if (mapped.length === 1) {
    return mapped[0]
  }
  const head = mapped.slice(0, -1)
  const tail = mapped[mapped.length - 1]
  return `${head.join(', ')} and ${tail}`
}

const SUMMARY_BUILDERS: Record<AssistantActionIntent['type'], SummaryBuilder> = {
  add_destination: (action, context) => {
    const name = action.destination.name
    const dayLabel = context.dayLabel ?? `day ${action.dayId}`
    return {
      summary: `Add “${name}” to ${dayLabel}`,
      requiresConfirmation: true,
      action,
      details: {
        dayId: action.dayId,
        insertIndex: action.insertIndex ?? null,
      },
    }
  },
  update_destination: (action, context) => {
    const fields = Object.keys(action.changes)
    const fieldList = formatFieldList(fields)
    const destinationName = context.destinationName ?? action.destinationId
    const daySuffix = context.dayLabel ? ` (${context.dayLabel})` : ''
    return {
      summary: `Update ${fieldList} for “${destinationName}”${daySuffix}`,
      requiresConfirmation: true,
      action,
      details: {
        dayId: action.dayId,
        destinationId: action.destinationId,
        fields,
      },
    }
  },
  set_base_location: (action, context) => {
    const name = action.location.name
    const dayLabel = context.dayLabel ?? `day ${action.dayId}`
    return {
      summary: `Set base location for ${dayLabel} to “${name}”`,
      requiresConfirmation: true,
      action,
      details: {
        dayId: action.dayId,
        replaceExisting: action.replaceExisting ?? true,
        locationIndex: action.locationIndex ?? null,
      },
    }
  },
  move_destination: (action, context) => {
    const name = context.destinationName ?? action.destinationId
    const fromLabel = context.fromDayLabel ?? `day ${action.fromDayId}`
    const toLabel = context.toDayLabel ?? `day ${action.toDayId}`
    if (action.fromDayId === action.toDayId) {
      return {
        summary: `Reorder “${name}” within ${fromLabel}`,
        requiresConfirmation: true,
        action,
        details: {
          destinationId: action.destinationId,
          dayId: action.fromDayId,
          insertIndex: action.insertIndex ?? null,
        },
      }
    }
    return {
      summary: `Move “${name}” from ${fromLabel} to ${toLabel}`,
      requiresConfirmation: true,
      action,
      details: {
        destinationId: action.destinationId,
        fromDayId: action.fromDayId,
        toDayId: action.toDayId,
        insertIndex: action.insertIndex ?? null,
      },
    }
  },
  toggle_map_overlay: (action) => {
    const state = action.enabled === false ? 'Hide' : 'Show'
    return {
      summary: `${state} map overlay: ${action.overlay}`,
      requiresConfirmation: true,
      action,
      details: {
        overlay: action.overlay,
        enabled: action.enabled ?? true,
        payload: action.payload ?? null,
      },
    }
  },
}

export function buildActionPreview(
  action: AssistantActionIntent,
  context: ActionPreviewContext = {}
): AssistantActionPreview {
  const builder = SUMMARY_BUILDERS[action.type]
  if (builder) {
    return builder(action, context)
  }

  return {
    summary: 'Review assistant action',
    requiresConfirmation: true,
    action,
  }
}
