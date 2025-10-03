You are a an expeienced Conversational AI Architect and Trip Planning Specialist.

> Note: Mark each task and phase as completed when you finish them.

# Trip Planner Copilot – Implementation Blueprint

## 1. Purpose & Guiding Principles
- Deliver a conversational assistant that accelerates trip planning while keeping the app’s current workflows intact.
- Preserve elegant simplicity: reuse existing state, APIs, and UI actions; add the minimum new primitives needed for orchestration.
- Maintain trust: every answer or UI change must reflect the actual trip state and be auditable by the user.

## 2. Target Outcomes
- Users can ask, refine, and execute trip decisions conversationally.
- The copilot proactively spots gaps (empty days, missing travel legs, conflicting timings) and offers fixes.
- The assistant can “show” changes by manipulating the same left-panel/map surfaces the user already knows.
- Rollout starts with guided assistants for core planning loops, then expands to richer suggestions and automations.

## 3. System Overview
- **Conversational Shell**: handles NL understanding, dialog policy, response composition.
- **Trip State Graph**: normalized source of truth (trip metadata, days/stops, activities, logistics, preferences, constraints).
- **Intent Orchestrator**: maps conversational intents to state reads/writes and UI actions through an action bus.
- **Action Bus**: single gateway that dispatches UI commands (map focus, panel selection, modal toggles) and state mutations (store reducers, Supabase operations).
- **Feedback Layer**: event stream that confirms actions, feeds telemetry, and triggers follow-up prompts.

## 4. Core Capabilities

### 4.1 Context & State Awareness
- Ingest trip store snapshot and active selections each turn.
- Maintain lightweight user profile (travel style, budget band, companions).
- Track conversation history, pending questions, and unresolved tasks.
- Detect key state patterns: unplanned days, unscheduled transit, conflicts, preference mismatches.

### 4.2 Conversational Interaction
- **Answering**: natural-language queries resolved via structured queries against the trip graph (e.g., “What’s planned for Day 3?”).
- **Editing**: interpret commands like “Add a day trip to Kyoto” → new itinerary slot + suggested activities.
- **Proactive prompts**: rules/triggers (“Day 2 has no lodging”) and learned signals (low activity density) produce concise suggestions with accept/decline buttons.
- **Clarification loop**: fast disambiguation when user’s intent is underspecified (e.g., multiple destinations named “Springfield”).

### 4.3 UI / Action Control (“Showing”)
- Map each intent to atomic UI actions (select day card, focus marker, open modal) via the action bus.
- Support composite flows: e.g., “Show me museums near Day 4 hotel” → highlight map layer + open filter panel.
- Visual confirmations: short textual recap plus UI state changes so users see exactly what changed.

## 5. Architecture & Data Flows

### 5.1 Trip State Graph
- Backed by existing `trip-store`, `explore-store`, Supabase APIs.
- Extend schema if needed with derived views (timeline, logistics graph, preference matrix).
- Provide quick-selects (current day, selected marker) from UI context providers.

### 5.2 Conversational Engine
- **NLU**: leverage LLM-in-the-loop pattern that uses toolformer-style intents; fallback to rule templates for high-frequency commands.
- **Planner**: deterministic mapping of high-impact intents (add/remove activities, adjust days) to action plans; LLM proposes, validator checks against schema.
- **Response**: template + natural-language summary referencing actual state fields; include CTA buttons hooking into action bus.

### 5.3 Action Bus Integration
- Unified interface wrapping existing reducers and map commands in `dispatchCopilotAction(actionType, payload)`.
- Allow optimistic UI updates with rollbacks if backend call fails; expose success/failure events back to copilot.
- Define an explicit action catalog so conversational intents map to strongly typed payloads:
  | Action | Payload | Target |
  | --- | --- | --- |
  | `selectDay` | `{ dayId }` | `useTripStore().setSelectedDay`
  | `focusDestination` | `{ destinationId, origin }` | `useTripStore().setSelectedDestination`
  | `openModal` | `{ modalId, context }` | modal registry
  | `highlightMapArea` | `{ bounds, layer }` | map controller
  | `mutateTrip` | `{ mutation, args }` | Supabase trip store / API
- Gate every action through a validator that ensures the referenced ids exist in the current state snapshot before dispatching.
- Emit bus events (`actionDispatched`, `actionFailed`, `actionCompleted`) so the copilot loop can confirm outcomes or recover from failures.
- Provide a mock bus implementation for tests that records dispatched actions without touching the UI.

### 5.4 Data & Retrieval Utilities
- Structured query utilities to surface itineraries, unmatched segments, travel time estimates.
- Preference scorer for ranking suggestions (match budget, interests, travel style).
- Cost/time calculators using existing explore APIs plus derived caching for faster response.

## 6. Feature Roadmap

### Phase 0 – Foundations _(Status: Completed)_
- [x] Instrument trip state snapshot API for the copilot (read-only).
- [x] Build action bus wrapper and event telemetry hooks.
- [x] Create mock conversation sandbox for testing intents end-to-end.
- [x] Introduce a lightweight `CopilotRuntimeContext` module that exposes selectors for the conversational engine (trip summary, selection focus, unresolved issues).
- [x] Stub a `copilot/tools` directory with typed intent handlers and a minimal validator pipeline.
- [x] Establish Jest/testing-library harness that replays scripted conversations against mock state snapshots and asserts emitted bus actions.

#### Phase 0 – Completed Work
- Implemented `lib/copilot/runtime-context.ts` to snapshot trip, selection, explore, and unresolved state for each turn.
- Built `lib/copilot/action-bus.ts` with validator-driven dispatch and lifecycle events for `selectDay`/`focusDestination`.
- Added read-only intents in `lib/copilot/intents/read-only.ts` and a conversation harness in `lib/copilot/harness/conversation-harness.ts` for scripted evaluations.

### Phase 1 – Conversational Answers _(Status: Completed)_
- [x] Implement read-only intents (summaries, day breakdowns, map focus).
- [x] Enable “show” actions for highlight/focus/selection.
- [x] Add guardrails & fallback prompts when data incomplete.

#### Phase 1 – Completed Work
- Extended `lib/copilot/action-bus.ts` to route `highlightMapArea` through shared map events and emit modal hooks via `dispatchOpenModal`.
- Added `lib/copilot/ui-bridge.ts` to translate copilot map requests into the existing `centerMapOnDestinations` event contract.
- Expanded `lib/copilot/intents/read-only.ts` with `mapFocusIntent` and stronger fallbacks when no coordinates are available.
- Updated the conversation harness to accept injected contexts and bundled `lib/copilot/harness/scripts/phase1-read-only.ts` as a regression script for Phase 1 paths.

### Phase 2 – Guided Editing _(Status: Completed)_
- [x] Support add/remove/reorder day items, adjust durations. _(coverage: add day, remove/move destinations, update notes)_
- [x] Integrate Supabase mutations with optimistic updates.
- [x] Introduce proactive nudges for missing elements.

#### Phase 2 – Completed Work
- Added `lib/copilot/mutations.ts` registry so conversational mutations invoke either Supabase or local trip stores safely.
- Registered `addDay` and `removeDestination` handlers with shared error handling and selection cleanup.
- Introduced editing intents in `lib/copilot/intents/editing.ts` and unified intent aggregation via `lib/copilot/intents/index.ts`.
- Captured Phase 2 regression coverage in `lib/copilot/harness/scripts/phase2-editing.ts` and `lib/copilot/harness/scripts/phase2-nudge.ts`.
- Expanded modal control so `openModal` can surface Destination Overview via the existing preview flow.
- Added move-maybe and update-notes mutations/intents plus proactive empty-day nudge support in `lib/copilot/nudges.ts`.

### Phase 3 – Smart Suggestions _(Status: Not Started)_
- [ ] Recommend filler activities, transport options, lodging gaps using preference scorer.
- [ ] Provide comparative insights (“Paris vs. Lyon for Day 3 based on your interests”).
- [ ] Introduce small workflow automations (batch add curated plan, auto-balance days).

#### Phase 3 – Completed Work
- Not started yet.

### Phase 4 – Advanced Assist _(Status: Not Started)_
- [ ] Multi-step planning macros (“Plan a 5-day foodie trip in Japan”).
- [ ] Collaboration cues (share context with travel companions).
- [ ] Continuous learning from acceptance/decline feedback.

#### Phase 4 – Completed Work
- Not started yet.

## 7. UX & IA Considerations
- Copilot presented as a glassmorphism-inspired floating rail anchored top-right of the map; collapsed by default to a gradient toggle button and expands downward on demand.
- Conversation UI delivers short responses with inline quick-action chips, status glow, and toast confirmations mirroring map/timeline changes.
- “Show me” actions still animate the left panel/map while the copilot stays non-blocking; Mapbox controls moved to the lower-right to keep the entry point clear.
- Undo/redo affordances and breadcrumbs surfaced via the existing app UI; copilot toasts reference each action for transparency.

## 8. Observability & Safety
- Log every copilot intent, suggested change, user decision, and downstream effect.
- Monitor key KPIs: suggestion acceptance rate, correction rate, time-to-plan completion.
- Add guardrails for destructive actions (confirm before deleting days, warn on conflicts).
- Provide “Why?” explanations referencing data fields (e.g., travel time estimates).

## 9. Testing & QA Strategy
- Unit tests for intent parsers, validators, and action bus adapters.
- Conversation harness with scripted dialogues covering happy path, edge cases, conflict resolution.
- UI integration tests verifying map/left-panel updates triggered via copilot.
- Staged rollout: internal dogfooding → beta cohort → general availability with feature flag.
- Add contract tests that diff conversation transcripts to catch prompt regressions before release.

## 10. Operational Rollout
- Ship behind `copilotEnabled` feature flag tied to user role.
- Provide in-app onboarding walkthrough and help docs.
- Establish feedback loop (thumbs up/down, reason capture).
- Plan for iterative LLM prompt tuning with real-world transcripts.

## 11. Risks & Mitigations
- **State drift**: mitigate by re-fetching state before mutations and validating diffs.
- **Over-suggestion fatigue**: throttle proactive prompts; allow user to set frequency.
- **Performance**: cache heavy computations, prefetch trip slices during idle time.
- **Trust**: include change logs and easy revert options to reinforce transparency.

## 12. Future Extensions (Post-MVP)
- Multi-modal inputs (voice, image-based inspiration).
- Partner integrations (bookings, weather, local events).
- Offline-ready copilot snippets using on-device embeddings.

## Phase 3 – Smart Suggestions (In Progress)
- ✅ Bootstrapped smart suggestion engine that scores Maybe list destinations against under-filled days and highlights Explore favorites not yet scheduled.
- ✅ Added conversational intent for "suggest"/"recommend" prompts that returns ranked ideas with actionable buttons.
- ✅ Copilot panel now features a top-of-thread suggestion shelf plus richer bubbles with map previews and one-click scheduling.
- ⏳ Next: broaden heuristics with travel-time awareness, integrate direct add-to-maybe flow for Explore places, and surface acceptance telemetry to the action bus.
