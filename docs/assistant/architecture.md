# Context-Aware AI Travel Assistant Architecture

## Purpose
- Deliver a natural-language entry point for the Trip3 planner without bypassing existing trip, explore, and map workflows.
- Maintain a live understanding of each traveller’s plan so guidance always reflects the latest Supabase state and UI context.
- Keep the initial release focused on conversational guidance while laying guardrails for future UI automation/tool-use.

## Experience Overview
- Assistant lives in the existing `AssistantDock` shell and expands into a modal chat surface.
- Frontend sends each user message plus a lightweight **UI context fingerprint** (active tab, selected trip/day, highlighted map markers).
- Backend returns the response text, optional follow-up suggestions, and structured hints the UI can render (e.g., “view day 3 timeline”).

## Architecture Summary
- **Client Hooks**: collect UI state and trip identifiers, debounce changes, and post them to `/api/assistant/respond`.
- **Prompt Guard**: fast rejection of unsafe/off-scope requests before any heavy work (reuse `lib/prompt-guard` patterns).
- **Context Service**: deterministic aggregator that hydrates the assistant with trip, day, destination, accommodation, and explore-marker data from Supabase plus cached content.
- **Conversation Orchestrator**: composes the LLM call (prompt template + context + message history), enforces cost/time limits, and selects optional follow-up actions.
- **Knowledge Layer**: combines real-time trip data with curated travel knowledge (destination content, embeddings-powered search) and outbound tools such as `search-places`.
- **Observability + Storage**: structured logging, conversation transcripts, metrics, and optional vector memory.
- **Future Tool Router**: dormant module that validates and executes structured UI commands once we enable write actions.

```
Client → Prompt Guard → Context Service → Conversation Orchestrator → LLM
                    ↘ metrics/logging ↙          ↘ knowledge + tools ↙
```

## Context Service
- **Responsibilities**:
  - Fetch the canonical trip snapshot (trip meta, trip_days ordered by `day_order`, `trip_destinations`, accommodations, and linked POIs).
  - Surface explore-anywhere pins from `explore_places` tied to the trip or session.
  - Resolve the user’s active UI scope to narrow intent (e.g., day 3 timeline vs. map free-roam).
  - Enforce access control by verifying Supabase auth context before querying data.
  - Normalize outputs into a strict `AssistantContext` contract delivered to the orchestrator.
- **Data Sources** (Supabase tables & RPCs):
  - `user_trips`, `trip_days`, `trip_destinations`, `trip_destination_pois`
  - `trip_accommodations` (if available) or `trip_destinations` filtered by `category='hotel'`
  - `explore_places` for saved map markers and ad-hoc discoveries
  - `destination_modal_content`, `destination_content`, `ai_content_cache` for curated guidance
  - `user_trip_preferences` for personalization (budget, style, accessibility)
- **Caching Strategy**:
  - Per-request caching in the API route (60–120s) to smooth repeated follow-ups.
  - Optional background warmers for trip summaries and embeddings.
- **Output Contract** (truncated example):
  ```json
  {
    "user": {"id": "uuid", "preferences": {...}},
    "trip": {
      "id": "uuid",
      "name": "Italy Discovery",
      "window": {"start": "2025-04-10", "end": "2025-04-18"},
      "days": [
        {
          "dayOrder": 3,
          "date": "2025-04-12",
          "baseLocations": [...],
          "destinations": [
            {
              "id": "dest-4",
              "name": "Rome Colosseum",
              "slot": "morning",
              "startTime": "10:00",
              "durationHours": 2,
              "notes": "Guided tour booked",
              "category": "attraction"
            }
          ],
          "openSlots": ["afternoon"],
          "notes": "Anniversary dinner"
        }
      ]
    },
    "exploreMarkers": [
      {"id": "map-12", "type": "anywhere", "name": "Trastevere food crawl", "coordinates": [12.467, 41.889]}
    ],
    "ui": {
      "view": "timeline",
      "selectedDay": 3,
      "selectedDestinationId": "dest-4",
      "mapBounds": {...}
    }
  }
  ```

## Conversation Orchestrator
- Composes the system prompt from invariant instructions, feature flags, and context payload summaries.
- Applies **prompt shaping rules**:
  - Always reference itinerary data chronologically.
  - When context lacks an answer, either run a knowledge search (tool call) or answer with transparent uncertainty.
  - Suggest next UI steps using friendly, short hints.
- Maintains rolling history (latest ~6 turns) to balance coherence and token usage.
- Monitors per-user/session spend via `rate-limit.ts` instrumentation and integrates the cost projections doc for real-time metrics (no automatic caps).
- Interfaces with:
  - **Prompt Guard** for classification and safe completions.
  - **Tool Executor** (initially only read/search tools such as `search-places.ts` or curated content fetchers).
  - **Memory Store** (future) for long-lived user preferences.

## Knowledge Layer & Tooling
- **Static Travel Knowledge**: curated Trip3 content (`destination_modal_content`, `global_content`) loaded via the context service.
- **Dynamic Discovery**: call `search-places` for Mapbox/Supabase-sourced points when itinerary gaps exist.
- **Embeddings Store**: Supabase `content_embeddings` table for semantic search (“find me a wine tour near Florence”).
- **Guarded Outputs**: ensure the orchestrator tags any external data with provenance so the UI can expose “source: Trip3 Explore”.

## Observability & Governance
- Central logging pipeline (e.g., Vercel Logging or Supabase `assistant_logs` table) capturing:
  - request id, user id (hashed), latency, token counts, model id, tool usage.
- Audit trail for decisions and errors; surface to admin UI if needed.
- Feature flags (Vercel env + Supabase config) to control rollout by user segment.
- Privacy: scrubs PII before storing transcripts, and allows opt-out on a per-trip basis.

## Real-Time Updates
- Client emits optimistic UI delta events (e.g., destination reordered) to a lightweight event bus.
- Context service invalidates the relevant cache entry and refetches fresh state before responding.
- For longer-running updates (e.g., accommodation booking), orchestrator includes “pending sync” messaging to keep the user informed.

## Future Tool-Use Enablement
- Tool router accepts validated intents (`ReorderDestination`, `AddActivity`, …) produced by the LLM.
- Each intent maps to existing Supabase RPCs or Next.js API handlers and requires explicit user confirmation in the UI.
- Logging and guard policies ensure we can roll back or replay state changes if the automation misfires.

## Security Considerations
- All Supabase reads go through the service role on the server route; never expose service keys to the client.
- Enforce per-user access checks in the context service even when using the service role.
- Monitor LLM usage for abuse patterns; surface alerts for operators instead of enforcing hard caps, and fall back gracefully on provider errors.

## Deliverables Recap
- `/api/assistant/respond` route with orchestrator pipeline and logging.
- `lib/assistant/context-service.ts` encapsulating Supabase + cache aggregation.
- Prompt bundle (system + retrieval templates) version-controlled in `lib/assistant/prompt-templates`.
- Documentation and runbooks for ops, privacy, and future tool routing.
