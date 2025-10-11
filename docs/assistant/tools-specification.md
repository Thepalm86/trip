# Assistant Action Tool Specification

## Overview

Phase 5 evolves the assistant from single-action suggestions to multi-step plans. The model now returns a lightweight `structuredPlan`—a list of atomic action intents—while the application continues to validate each step with the existing Zod discriminated union before previewing or executing it. This document captures the contract, action catalog, and validation rules that govern the feature.

## Structured Plan Envelope

```ts
type AssistantStructuredPlan = {
  steps: AssistantActionIntent[]
  rationale?: string
}

type AssistantActionIntent = {
  type: 'add_destination' | 'update_destination' | 'set_base_location' | 'move_destination' | 'toggle_map_overlay'
  // see per-action fields below
  metadata?: ActionMetadata
}

type ActionMetadata = {
  actionId?: string // uuid
  confidence?: number // 0–1
  summary?: string // <= 320 chars
  source?: 'assistant' | 'user' // default: assistant
}
```

- Responses may also include a free-form `rationale` string explaining why the plan helps.
- The OpenAI schema remains minimal: `reply` is required; `structuredPlan` is optional and, when present, must provide `steps[]`.
- Each step is validated server-side using the existing Zod union (`assistantActionIntentSchema`). Invalid steps are rejected before preview or execution.

## Action Catalog

| Action | Discriminator | Required fields | Optional fields | Notes |
| --- | --- | --- | --- | --- |
| Add destination | `add_destination` | `dayId`, `destination.name` | `insertIndex`, `destination.(category, city, notes, coordinates, estimatedDurationMinutes, startTimeIso, endTimeIso, links)` | Creates a new `trip_destinations` row. `insertIndex` defaults to append. |
| Update destination | `update_destination` | `dayId`, `destinationId`, `changes` (non-empty) | Same fields as `destination` but all optional | Partial update: only send fields that change. |
| Set base location | `set_base_location` | `dayId`, `location.name` | `location.(coordinates, context, notes, links)`, `replaceExisting` (default `true`), `locationIndex` | When `replaceExisting` is true we overwrite the primary base stay; otherwise we insert at `locationIndex`. |
| Move destination | `move_destination` | `destinationId`, `fromDayId`, `toDayId` | `insertIndex` | Moves an existing destination between days (or reorders within the same day). |
| Toggle map overlay | `toggle_map_overlay` | `overlay` (`all_destinations` \| `explore_markers` \| `day_routes`) | `enabled`, `payload.visibleCategories`, `payload.filter` (`all`\|`favorites`) | Non-destructive UI control; runs client-side only after confirmation. |

## Validation Rules

- IDs are opaque strings; we do not enforce UUID for legacy compatibility (except optional `metadata.actionId`).
- Coordinates are `[lng, lat]` tuples.
- Durations are capped at 24 hours (`1440` minutes).
- ISO date-times must parse successfully with `Date.parse`.
- Destination/Base links are capped at six entries per action to protect prompt/telemetry budgets.
- Plans may contain up to **6** steps. The assistant is instructed to prioritise or ask the user to batch requests if more are needed.

## Expected Workflow

1. Orchestrator requests structured output with the simplified schema (`reply`, optional `structuredPlan.steps[]`).
2. Server parses the plan, validates each step with `assistantActionIntentSchema`, and drops invalid steps (logging details for observability). If no steps survive validation, no confirmation card is shown.
3. Frontend renders a review card that lists the proposed steps using `buildActionPreview`, surfaces the model rationale, and lets the user approve or dismiss the batch.
4. On approval the client POSTs the array to `/api/assistant/actions/execute`, which re-validates the payload, applies each step sequentially, and records an audit entry per step.
5. After execution the itinerary is refreshed and the assistant posts a combined success message (or an error if execution failed).

## Testing Checklist

- Unit tests assert each schema rejects malformed payloads (`tests/assistant/actions-schema.spec.ts`).
- Integration tests cover preview → execute flow for multi-step plans, including mixed success/failure and user dismissal.
- Prompt regression tests ensure the model emits one of the approved discriminators, respects the step limit, uses `[lng, lat]` arrays, and avoids extra properties.
