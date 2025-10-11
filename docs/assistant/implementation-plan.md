# Context-Aware Assistant Implementation Plan

## Phase 0 — Alignment & Foundations (1 week)
- **Goals**: Finalize scope, environment access, data contracts, and rollout expectations.
- **Tasks**:
  - [x] Confirm Supabase schema coverage for trips, explore markers, preferences.  
    _2025-03-02: Queried Traveal Supabase GraphQL schema (`user_trips`, `trip_days`, `trip_destinations`, `explore_places`, preferences tables) and noted structures for context assembly._
  - [x] Define the `AssistantContext` schema and message payload contract with frontend.  
    _Added `docs/assistant/context-schema.md` and Zod-backed types in `lib/assistant/context/types.ts` covering context payload + request envelope._
  - [x] Audit cost projections and define monitoring thresholds.  
    _Documented model mix and telemetry expectations in `docs/assistant/cost-projections.md`; outlined alerting without enforcing hard limits._
  - [x] Stand up feature flags + env configuration stubs.  
    _Created `lib/assistant/config/env.ts` for typed env loading and appended local defaults to `.env.local` for assistant-specific configuration._
- **Exit Criteria**:
  - Signed-off architecture/tech stack docs.
  - Context contract JSON schema checked into repo.
  - QA checklist drafted (happy path + failure modes).

## Phase 1 — Conversational Foundation (2 weeks)
- **Goals**: Ship the production-ready conversational assistant with accurate trip awareness, live prompts, and safety guardrails.
- **Tasks**:
  - [x] Implement `/api/assistant/respond` route handler (prompt guard → context service → orchestrator).  
    _Added authenticated POST route integrating prompt guard, context hydration, and orchestrator pipeline (`app/api/assistant/respond/route.ts`)._
  - [x] Build `lib/assistant/context-service.ts` using Supabase service role; add unit tests with fixtures.  
    _Created context builders that aggregate trips, destinations, explore markers, and preferences with supporting unit tests in `tests/assistant/context-service.spec.ts`._
  - [x] Create production prompt templates and orchestrator logic with OpenAI GPT-4o mini (no mock placeholders).  
    _Implemented `lib/assistant/orchestrator.ts` to assemble prompts, call OpenAI models with fallback, and surface cost metadata + follow-up suggestions._
  - [x] Extend frontend AssistantDock/modal to send context fingerprints and render responses.  
    _Implemented floating assistant dock with authenticated chat requests, UI fingerprint injection, and follow-up suggestions (`components/assistant/AssistantDock.tsx`, wired via `AppClientShell`)._
  - [x] Add logging, safety checks, and cost telemetry (no enforced usage caps).  
    _Prompt guard blocks unsafe requests; route records Supabase telemetry (`lib/assistant/telemetry.ts`) capturing tokens/cost metadata._
- **Exit Criteria**:
  - End-to-end happy path: user asks about a day’s plan → assistant references itinerary accurately.
  - No unhandled LLM failures; graceful fallback messaging in place.
  - Prompt templates reviewed for production tone (no placeholders or mock content).
  - Logging dashboard or Supabase table capturing conversations.

## Phase 2 — Context Depth & Knowledge Retrieval (2–3 weeks)
- **Goals**: Deliver the full knowledge experience with live content, explore markers, and semantic search (no mock data).
- **Status**: ✅ Completed — knowledge retrieval, summarisation, and testing guardrails now live in production code.
- **Tasks**:
  - [x] Integrate explore-anywhere markers (`explore_places`) into context payload.  
    _2025-03-17: `lib/assistant/context/service.ts` now batches `explore_places`, normalises metadata via `mapExploreMarkers()`, and attaches the results to the parsed assistant context._
  - [x] Wire embeddings search against `content_embeddings` for “what to do nearby” queries.  
    _Semantics routed through `fetchSemanticMatches` → Supabase RPC and OpenAI embeddings in `lib/assistant/knowledge.ts`, with graceful degradation when quotas or RPCs fail._
  - [x] Add curated content pull (destination summaries, seasonal tips) with provenance metadata (production content).  
    _Curated destination insights assembled through `fetchCuratedKnowledge` and validated against `assistantKnowledgeSchema` before inclusion in responses._
  - [x] Improve summarization of long itineraries (chunking, highlights).  
    _`lib/assistant/orchestrator.ts` condenses preferences, trip days, explore markers, and knowledge into structured prompt sections, ensuring long itineraries remain within token limits._
  - [x] Expand tests to cover edge cases (multi-trip users, missing days, empty itineraries).  
    _Added node test coverage in `tests/assistant/context-service.spec.ts` for destination parsing, day ordering, explore marker normalisation, and preference fallbacks._
- **Exit Criteria**:
  - ✅ Assistant can answer “What’s open on Day 3 afternoon?” and reference explore markers when relevant.  
    _End-to-end orchestration stitches trip context + explore markers and exposes them through follow-ups._
  - ✅ Context payload size stays within practical model limits (~6k tokens).  
    _Summaries chunk the context, trimming optional sections when absent and keeping payload deterministic._
  - ✅ Semantic search & curated content both exercised in integration paths (no mock fixtures beyond tests).  
    _Knowledge assembly uses live Supabase sources with defensive fallbacks; only unit tests rely on fixtures._

## Phase 3 — Quality, Observability & Pilot Launch (1–2 weeks)
- **Goals**: Harden reliability, monitor usage, and ship to a controlled cohort.
- **Tasks**:
  - Implement analytics dashboards (token cost per user/day, response latency).
  - Set up alerting for elevated error rates or budget overruns.
  - Run usability tests; iterate on prompt tone and answer structure.
  - Document operations runbook and privacy considerations.
  - Launch to internal team or beta group via feature flag.
- **Exit Criteria**:
  - P0 bugs resolved; SLO: 99% responses under 4s, 0 hallucinated itinerary edits in acceptance tests.
  - Stakeholder sign-off to expand to wider audience.

## Phase 4 — Action Tooling MVP (4–6 weeks)
- **Goals**: Let the assistant suggest itinerary edits safely, gated behind user confirmation, using a minimal deterministic tool layer.
- **Guardrails**: Narrow action catalog (add/edit destination, set base stay, duplicate/move destination, toggle map overlays); all mutations require confirmation; every tool call validated server-side and logged for audit.
- **Tasks**:
  1. **Intent schema & validation (Week 1)** ✅  
     _Delivered in `/lib/assistant/actions/types.ts` with accompanying docs/tests on 2025‑02‑XX._  
     - Draft typed Zod schemas for `AddDestination`, `UpdateDestination`, `SetBaseLocation`, `MoveDestination`, `ToggleMapOverlay`.  
     - Extend `lib/assistant/types.ts` with discriminated unions, include confidence + natural-language summary fields.  
     - Update `docs/assistant/tools-specification.md` with schema examples and prompting guardrails.
  2. **Server tool layer (Week 2)** ✅  
     _Preview endpoint with Supabase ownership checks + audit logging delivered via `/app/api/assistant/actions/preview` on 2025‑10‑11._  
     - Implement `/api/assistant/actions/preview` that accepts validated intents and returns idempotent previews; wrap existing `tripApi`/`exploreApiService` mutations in dedicated handlers with RBAC checks.  
     - Add structured audit logging (Supabase table + Sentry breadcrumb) capturing user id, payload, result, latency.  
     - Write unit tests covering schema validation, failure paths, and mutation plumbing.
  3. **Orchestrator integration (Week 3)** ✅  
     _`lib/assistant/orchestrator.ts` now enforces JSON schema outputs (reply + optional suggestedAction) on 2025‑10‑11. (Superseded by the structured plan work in Phase 5.)_  
     - Update `lib/assistant/orchestrator.ts` to request structured tool outputs (OpenAI function calling JSON mode).  
     - Introduce an action suggestion pipeline that returns `{ narrative, suggestedAction }`, with fallbacks when confidence < threshold.  
     - Extend prompt guard to reject unsupported verbs and flag ambiguous intents.
  4. **Confirmation UX (Week 4)** ✅  
     _Assistant dock now renders actionable cards with confirmation + `/api/assistant/actions/execute` hooked up on 2025‑10‑11._  
     - Surface suggested actions as cards in `components/assistant/AssistantDock.tsx` with “Apply / Dismiss” controls.  
     - On approval, POST to `/api/assistant/actions/execute`, block UI during mutation, and update Zustand stores with successful results.  
     - Add optimistic toast messaging + error recovery patterns (retry, show validation errors).
  5. **Observability & pilot (Week 5–6)**  
     - Instrument OpenTelemetry spans around preview/execute calls; dashboard success rate, latency, and rejection reasons.  
     - Run UAT with internal users, gather friction points, and tune confirmation copy.  
     - Document SOP for support (how to trace a failed action, rollback guidance) in `docs/assistant/operations.md`.
- **Exit Criteria**:
- Assistant suggestions appear with structured payloads and can be applied end-to-end for the supported action catalog.  
- 100% of executed actions validated against schema, logged, and confirmed by the user.  
- Integration tests cover preview + execute flows and rejection scenarios.  
- Pilot sign-off with measured success metrics (≥80% acceptance rate, zero unhandled errors in telemetry).

## Phase 5 — Structured Plans & Multi-Step Execution (3 weeks)
- **Goals**: Let the assistant propose several itinerary adjustments in a single reply while keeping the OpenAI contract simple and validation airtight.
- **Tasks**:
  1. **Schema & contract update (Week 1)**  
     - Replace the current `suggestedAction` field with an optional `structuredPlan` object holding a `steps` array.  
     - Define each step as `{ type: ActionType, ...optional fields }` with `additionalProperties: false`; keep the top-level schema within OpenAI’s supported keywords (no `oneOf`).  
     - Document the new contract in `docs/assistant/context-schema.md` and update typed defs in `lib/assistant/actions/types.ts`.
  2. **Prompt & orchestration guardrails (Week 1)**  
     - Rewrite system instructions to explain how to emit multi-step plans, when to omit them, and to cap the batch unless the user explicitly asks for multiple edits.  
     - Update `lib/assistant/orchestrator.ts` parsing logic to read `structuredPlan.steps`, run each step through the Zod discriminated union, and surface parse errors cleanly.  
     - Add telemetry fields capturing step count and validation failures.
  3. **Review & approval UX (Week 2)**  
     - Extend the assistant dock to render multi-step review cards (show each proposed change with diff snippets and allow approve/dismiss).  
     - Add per-step status to the chat transcript (“Queued”, “Applied”, “Failed”) and clarify when some steps are dropped due to validation issues.  
     - Update copywriters/PMs on new messaging patterns and add screenshots to the UI blueprint.
  4. **Execution pipeline (Week 2–3)**  
     - Adjust the action executor to process a queue of validated steps, wrapping related Supabase mutations in a transaction when possible.  
     - Emit structured logs and telemetry for each step (success/failure reason, latency, Supabase error code).  
     - Handle partial failures gracefully: stop executing further steps, inform the user which ones succeeded, and surface retry guidance.
  5. **QA, analytics, and rollout (Week 3)**  
     - Add integration tests that cover multi-step happy paths, mixed-success batches, and invalid payloads.  
     - Ship feature flag + metrics (acceptance rate, average steps per plan, validation failure types).  
     - Run a pilot with internal users, iterate on instruction tuning, and update the support SOP with troubleshooting steps for multi-step execution.
- **Exit Criteria**:
  - Assistant can propose and successfully execute multiple actions in one turn with clear user confirmation.  
  - Invalid steps are rejected before reaching Supabase and surfaced to the user with actionable messaging.  
  - Telemetry shows ≥90% success rate on validated steps, and rollback/compensation handling is in place for partial failures.  
  - Feature flag enabled for general users after pilot sign-off.

## Dependencies & Risks
- Access to production-similar Supabase dataset for realistic context testing.
- OpenAI API quota and budget approvals.
- Coordination with map/interactions teams to surface explore markers consistently.
- Need for fallbacks if Supabase latency spikes (consider request timeouts + retriable cache).

## Recommended Deliverables
- Documentation (`architecture.md`, `tech-stack.md`, prompt guidelines, context schema).
- Automated tests: unit (context builders), integration (assistant route), smoke (end-to-end chat via Playwright).
- Rollout plan: staging checklist, beta timeline, support playbook.

## Assistant UI Redesign — Style & Experience Blueprint
- **North Star**: Premium travel concierge aesthetic with deep midnight palette, glassmorphic layering, and polished motion to signal trust and sophistication.
- **Palette**: Primary gradient `#031926 → #0F2745`; secondary accents `#31D3A4`, `#4F8CFF`, `#F2BE5C`; neutrals anchored by `#0A101C` background, `#1B2538` surface, `#E7EEF8` text. Use 8%–18% white overlays for glass panels and 1 px misty borders (`rgba(255,255,255,0.16)`).
- **Typography**: Pair `Inter` (UI body, 14–16 px) with luxury serif accent (`Playfair Display` or `Cormorant`) for headers (24 px, semi-bold). Enforce optical hierarchy: headers → section titles → helper text at 12 px with 68% opacity.
- **Iconography**: Thin-stroke line icons with subtle inner glow. Assistant avatar evolves into circular badge with animated compass glyph to reinforce exploration theme.
- **Dock Structure**: Right-aligned concierge dock (min 420 px) with three states (collapsed pill, compact overlay, expanded push). Maintain sticky trip-summary rail at top (trip name, countdown, weather chip) for orientation.
- **Surface Styling**: Cards and chat bubbles use layered glass (backdrop-blur 18 px, surface opacity 0.75) and soft shadow (`0 18px 48px rgba(3,20,40,0.45)`). User bubbles right-aligned with gradient border; assistant replies left-aligned with icon header, optional section toggles.
- **Interactive Elements**: Primary buttons adopt gradient fill + subtle glow; secondary chips use outlined pills with hover lift (translateY(-2 px) + shadow). Composer bar floats with inset shadow; quick prompts row uses horizontally scrollable chips.
- **Motion & Feedback**: 180–220 ms ease-out transitions when the dock expands/collapses. Assistant “thinking” indicator = top-edge progress shimmer + pulsing badge. Map pin highlights animate in sync with response payloads (coordinated via shared easing curves).
- **Context Panels**: Tabbed subpanes (“Chat”, “Insights”, “Shortcuts”) with sliding indicator. Responses can spawn inline action cards (e.g., “Add to Day 2”) that cascade from bottom with staggered delays for readability.
- **Accessibility**: Maintain 4.5:1 contrast minimum; provide keyboard focus outlines (2 px accent glow). Voice input button includes aria-live feedback. All state changes announced via polite screen reader alerts.
- **Implementation Starter Tasks**: Define design tokens in `globals.css` (CSS variables for palette, radii, shadows). Refactor `AssistantDock.tsx` layout to support multi-state width + sticky header. Introduce reusable `GlassPanel`, `ActionChip`, `ResponseCard` components in `components/assistant/`. Update illustration, icon assets, and motion primitives in a shared `ui-tokens.ts`.
