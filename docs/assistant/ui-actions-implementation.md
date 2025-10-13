# Assistant UI Actions — Phase 1 Implementation Blueprint

## Objectives
- Deliver deterministic assistant-triggered itinerary and map updates for three high-impact actions: `AddPlaceToItinerary`, `RescheduleItineraryItem`, and `RemoveOrReplaceItem`.
- Keep the existing conversational experience intact while layering actions into the same orchestration, validation, and streaming pipeline.
- Provide a repeatable framework (schema + dispatcher + observability) that scales to future UI actions without rework.

## Status Snapshot (Apr 2025)
- Shared action schemas, orchestrator JSON enforcement, and API response plumbing are complete.
- Frontend dispatcher now applies add/reschedule/remove flows via `useAssistantActionBridge`, with optimistic selection updates.
- Start-time aware ordering, schedule-note updates, and map focus via destination selection are wired for the three core actions (Phase 1 complete).

## Scope
- ✅ Server-side tools, prompt scaffolding, and response parsing for the three actions.
- ✅ Frontend action dispatcher and handlers for itinerary store + map focus.
- ✅ Telemetry, audit logging, and basic undo UX for destructive mutations.
- 🚫 Out-of-scope: route previews, multi-stop bundle actions, or Supabase write APIs beyond what exists today.

## Action Catalog (v1)
| Action | Description | Required Payload | Optional Payload | Notes |
| --- | --- | --- | --- | --- |
| `AddPlaceToItinerary` | Insert a recommended POI into a specified day/time slot. | `place_id`, `fallback_query`, `trip_id`, `day_id`, `start_time`, `duration_minutes`, `source` (`assistant`), `confidence` | `notes`, `tags`, `from_map_selection`, `lat`, `lng` | Use default duration (90 min) if model omits; must reference an existing day. |
| `AddExploreMarker` | Pin a discovery candidate to Explore Anywhere so the user can review it later. | `query`, `source` (`assistant`) | `city`, `region`, `country`, `category`, `tags`, `notes`, `confidence` (0–100), `lat`, `lng` | Model should supply a rich query string and only include coordinates when explicitly provided (we backfill via search). Cap at three markers per turn. |
| `RescheduleItineraryItem` | Move or stretch an existing itinerary stop to another slot. | `trip_id`, `day_id`, `item_id`, `new_day_id`, `new_start_time`, `new_duration_minutes` | `locked_dependencies` (array), `user_confirmed` (bool) | If `locked_dependencies` present, assistant must acknowledge and request confirmation before executing. |
| `RemoveOrReplaceItem` | Remove a stop or swap it with an alternative. | `trip_id`, `day_id`, `item_id`, `mode` (`remove` \| `replace`), `user_confirmed` | `replacement` (schema identical to `AddPlaceToItinerary`), `reason` | Always emit `user_confirmed=true` once user explicitly approves; otherwise return guidance-only. |

## Architecture Overview
- **Prompt Builder (`lib/assistant/workflow.ts`)**  
  - Augment the state snapshot with canonical IDs (trip, day, item) and include a `ui_actions` contract block rendered from shared constants.
  - Ensure the LLM sees the latest itinerary mutations by fetching context after optimistic frontend changes settle.
- **Orchestrator (`lib/assistant/orchestrator.ts`)**  
  - Parse model JSON envelope (`analysis`, `reply`, `actions`).  
  - Validate `actions` array with shared Zod schema (`assistantUiActionSchema`).  
  - Forward valid actions through the streaming channel (`ui_actions` chunk) while emitting the natural-language reply as usual.
  - On validation failure, send corrective feedback to the LLM and retry once; otherwise fallback to text-only reply with error toast.
- **Server→Client Transport**  
  - Extend SSE/WebSocket payload (`AssistantResponseMessage`) with `ui_actions: AssistantUIAction[]`.  
  - Tag each action with `request_id` and `timestamp` for replay/audit.
- **Frontend Dispatcher (`lib/ai-assistant/ui/action-bridge.ts`)**  
  - Subscribe to SSE updates, validate payload via shared schema (bundled with `zod`).  
  - Route to domain handlers:
    - `trip-store` mutations (`addItem`, `moveItem`, `removeItem`, `replaceItem`).  
    - `explore-store` mutations (`addActivePlace`, `addRecent`) for Explore markers.  
    - `InteractiveMap` ref methods (`focusPlace`, `highlightRoute`).  
  - Emit undo notifications via toasts or inline banners.
- **State Stores**  
  - Trip store gains deterministic reducers with optimistic rollback hooks.  
  - Explore store handles persistence/dedupe for assistant-suggested markers.  
  - Map component exposes imperative API using React context or event emitter.
- **Telemetry & Audit**  
  - Server logs include action payload, validation status, and downstream success/failure.  
  - Client posts action outcomes back to `/api/assistant/actions/log` for aggregated analytics.

### Sequence (Textual)
1. User asks assistant to add/move/remove an item or save new places to Explore.  
2. Prompt builder assembles conversation history + context + action contract.  
3. LLM responds with JSON envelope containing action(s).  
4. Orchestrator validates; returns SSE stream with `reply` and `ui_actions`.  
5. Client dispatcher consumes actions, updates trip/explore stores and map focus, shows confirmation toast.  
6. Client reports outcome (success/error/undo) for logging; orchestrator stores conversation turn with action metadata.

## Shared Tech Stack & Libraries
- **LLM**: OpenAI GPT-4o (primary) with GPT-4o-mini fallback.  
- **Validation**: `zod` shared between server (`lib/assistant/types.ts`) and client (`lib/ai-assistant/ui/action-bridge.ts`).  
- **Transport**: Existing SSE via `/api/assistant/respond`; no protocol change required.  
- **State Management**: Current `trip-store` (likely Zustand); wrap mutations to support undo queue.  
- **Maps**: Mapbox GL in `InteractiveMap.tsx`, exposing helpers for focus/highlight.  
- **Testing**: Vitest/Jest for unit, Playwright for end-to-end action confirmation.  
- **Telemetry**: Supabase `assistant_action_events` table (new), with row-level security mirroring conversation logs.

## Implementation Phases & Tasks

### Phase 0 — Foundations (3 days)
- Audit current itinerary/map APIs, ensuring required IDs are exposed to the assistant context.  
- Draft action schemas in `lib/assistant/types.ts` with matching Zod exports for client.  
- Update `docs/assistant/tools-specification.md` to include the new action catalog and confirm with product/design.  
- Create `tests/assistant/actions-schema.spec.ts` fixture for baseline validation.

### Phase 1 — `AddPlaceToItinerary` (1 week) — ✅ Completed
- **Prompt & Orchestration**  
  - Inject action contract block into system prompt.  
  - Enforce JSON envelope parsing with retry logic in `lib/assistant/orchestrator.ts`.  
  - Implement `assistantUiActionSchema` validation and error instrumentation.
- **Server → Client Channel**  
  - Extend `AssistantResponseMessage` DTO and SSE serializer.  
  - Append action metadata to conversation log (Supabase) for audit.
- **Frontend**  
  - Build `action-bridge` dispatcher with Zod validation and TypeScript types.  
  - Implement `trip-store.addItemFromAssistant` with optimistic update, duration fallback, and undo toast.  
  - Hook into `InteractiveMap` to focus on the added place if coordinates available.
- **Testing**  
  - Unit tests: orchestrator parsing, dispatcher validation, trip-store mutation.  
  - Integration: record prompt fixture where assistant adds a POI; verify SSE payload + UI update.
- **Exit Criteria**  
  - Assistant adds POI to correct day/time in staging, shows confirmation toast, and logs action.

### Phase 1.5 — `AddExploreMarker` (4 days) — ✅ Completed
- **Schema & Prompt**  
  - Added `AddExploreMarker` discriminant to the shared Zod schema/JSON contract and refreshed the system guidance to limit markers per turn.  
  - Kept payload slim by leaning on the Explore search endpoint for lat/lng enrichment instead of hallucinated coordinates.
- **Frontend**  
  - Extended `action-bridge` with a handler that calls `/api/explore/search`, enriches results with assistant-provided hints, and stores them via `explore-store` (including recent pins).  
  - Added fallback path to create markers when coordinates are supplied directly in the payload.
- **Testing**  
  - Widened schema unit tests to include Explore marker success cases and coordinate fallback.
- **Exit Criteria**  
  - Assistant can pin up to three high-confidence Explore suggestions per turn with dedupe and Supabase persistence.

### Phase 2 — `RescheduleItineraryItem` (1 week)
- Extend schema with `RescheduleItineraryItem` specifics, including constraint checks (e.g., locked bookings).  
- Add orchestrator guard to request confirmation when dependencies present.  
- Implement trip-store `moveItem` supporting cross-day/time adjustments with conflict detection, plus rollback on failure.  
- Map: auto-focus new slot and optionally animate item reorder.  
- Tests: conflict scenarios, undo flow, LLM prompt example requiring clarification.  
- Exit: End-to-end reschedule succeeds, and assistant gracefully declines when confirmation missing.

### Phase 3 — `RemoveOrReplaceItem` (1 week)
- Handle destructive action gating: prompt requires explicit user confirmation before `user_confirmed=true`.  
- Trip store `removeItem` and `replaceItem` share undo pipeline; replacement triggers `AddPlace` plus removal atomically.  
- Frontend shows inline banner with undo countdown (e.g., 10 seconds).  
- Server logs include `reason` for removal and replacement details.  
- Add Playwright regression: assistant removes item upon confirmation; undo restores.  
- Exit: Production-ready removal/replace with audit trail, undo, and safe prompt behaviour.

### Phase 4 — Hardening & Beta (3–5 days)
- Load testing with recorded transcripts to ensure action parsing handles token limits.  
- Add anomaly detection (e.g., repeated invalid actions) to telemetry dashboard.  
- Security review for action payload spoofing, ensuring schema validation on both ends.  
- Beta release behind feature flag for selected users; monitor metrics.

## Prompt & LLM Strategy
- **Contract Block**: Render `### UI Actions` with JSON schema snippet and examples. Example snippet:
  ```
  When you have high confidence, respond with:
  {
    "analysis": "...",
    "reply": "...",
    "actions": [
      { "type": "AddPlaceToItinerary", "payload": { ... } }
    ]
  }
  ```
- **State Snapshot**: Provide canonical IDs, time zones, day summaries, and pending confirmations.  
- **Self-Correction Loop**: If server validation fails, respond with structured error (`action_rejected`) so model can adjust payload next retry.  
- **Disambiguation Guidance**: Prompt instructs model to decline or ask clarifying questions when multiple targets found; no action should fire without `user_confirmed=true` for destructive intents.

## Data & API Contracts
- Update `lib/assistant/types.ts` with:
  ```ts
  export const assistantUiActionSchema = z.object({
    type: z.enum(["AddPlaceToItinerary", "AddExploreMarker", "RescheduleItineraryItem", "RemoveOrReplaceItem"]),
    payload: z.union([
      addPlacePayloadSchema,
      addExploreMarkerPayloadSchema,
      reschedulePayloadSchema,
      removeOrReplacePayloadSchema,
    ]),
    meta: z.object({
      requestId: z.string().uuid(),
      issuedAt: z.string(),
    }).optional(),
  });
  ```
- Share same schema via barrel export for frontend consumption (`@trip3/assistant-actions`).  
- Ensure trip/explore stores expose mutation signatures aligning with payload: `addPlaceFromAssistant(payload: AddPlacePayload, meta: ActionMeta)` and `addExploreMarkerFromAssistant(payload: AddExploreMarkerPayload, meta: ActionMeta)`.

## Validation & Testing
- **Unit Tests**  
  - Schema validation for happy/sad paths.  
  - Orchestrator envelope parsing, retry logic, and error message emission.  
  - Trip-store reducers for add/move/remove with undo stack.
- **Integration Tests**  
  - Mock LLM responses to assert SSE payload includes actions.  
  - API route tests verifying invalid payload rejection + fallback messaging.  
  - Map component test to ensure focus method invoked on add/reschedule.
- **End-to-End (Playwright)**  
  - Scripted conversation: user requests addition → assistant acts → UI reflects change → undo works.  
  - Reschedule acceptance test with locked dependency requiring confirmation.
- **Staging Beta**  
  - Capture logs for first 100 assistant actions; manually verify 20 samples.  
  - Add alerts for validation error rate >5%.

## Observability & Rollback
- Supabase table `assistant_action_events` capturing: `id`, `request_id`, `conversation_id`, `action_type`, `payload_hash`, `status`, `error_code`, `response_time_ms`.  
- Client posts outcomes to `/api/assistant/actions/log`; server correlates with conversation turn.  
- Feature flag (`assistant-ui-actions`) toggleable at runtime; maintain kill switch to skip action emission and revert to text-only replies.  
- Undo telemetry records success/failure to gauge UX friction.

## Risks & Mitigations
- **Hallucinated IDs**: Schema + prompt enforce referencing only IDs present in state snapshot; validation rejects unknown IDs.  
- **Race Conditions**: Use optimistic updates with server confirmation; queue actions client-side to prevent overlap on same item.  
- **User Trust**: Always pair action with natural-language explanation and undo option; require confirmation for destructive changes.  
- **Latency**: Keep payload lean; prefer single action per turn to avoid large SSE messages.  
- **Maintenance Drift**: Generate schema + prompt contract from single source file (future automation task).

## Dependencies
- Accurate itinerary/day/item IDs exposed in assistant context payload.  
- Up-to-date trip-store APIs and map refs; may require minor refactors.  
- Agreement from product/design on confirmation UX and undo behaviour.  
- Supabase permissions for new logging table.

## Rollout Checklist
- [ ] Schema merged and published to shared package.  
- [ ] Prompt updated and validated against regression fixtures.  
- [ ] Dispatcher + store handlers integrated behind feature flag.  
- [ ] Telemetry dashboards prepared (Grafana/Supabase).  
- [ ] Beta cohort identified; run smoke tests in staging.  
- [ ] Rollout comms & support playbook ready.  
- [ ] Post-launch review scheduled (T+1 week) to evaluate metrics and expand action set.

## Future Extensions
- Add `FocusMapOnSelection` and `BuildRoutePreview` once core pipeline proves stable.  
- Hook actions into Supabase write APIs for persistent storage (currently client-only optimistic).  
- Explore summarised “Action History” feed in assistant dock for transparency.  
- Consider fine-tuning or structured output models if JSON adherence issues persist.
