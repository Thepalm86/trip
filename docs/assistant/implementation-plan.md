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
- **Tasks**:
  - Integrate explore-anywhere markers (`explore_places`) into context payload.
  - Wire embeddings search against `content_embeddings` for “what to do nearby” queries.
  - Add curated content pull (destination summaries, seasonal tips) with provenance metadata (production content).
  - Improve summarization of long itineraries (chunking, highlights).
  - Expand tests to cover edge cases (multi-trip users, missing days, empty itineraries).
- **Exit Criteria**:
  - Assistant can answer “What’s open on Day 3 afternoon?” and reference explore markers when relevant.
  - Context payload size stays within practical model limits (~6k tokens).
  - Semantic search & curated content both exercised in integration tests with live data (no mock fixtures beyond tests).

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

## Phase 4 — Tooling Preview (Future)
- **Goals**: Prepare deterministic action execution once we allow itinerary edits via assistant.
- **Tasks**:
  - Design intent schema and validation flow for UI actions (e.g., `ReorderDestination`).
  - Prototype tool router with confirmation UX but keep write path disabled until ready.
  - Map intents to Supabase RPCs/Mutations with RBAC and audit logging.
- **Exit Criteria**:
  - Documented RFC for tool-use rollout.
  - Test harness demonstrating simulated command generation and rejection paths.

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
