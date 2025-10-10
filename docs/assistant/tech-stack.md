# Context-Aware Assistant Tech Stack

## Goals
- Keep integration lightweight, align with existing Next.js + Supabase stack, and avoid unnecessary new services.
- Support rapid iteration on prompts and tools while tracking cost per conversation.
- Ensure future tooling (write actions) can reuse the same infrastructure with minimal refactoring.

## Core Runtime
- **Frontend**: React/Next.js (already in Trip3). Extend `AssistantDock` with chat components (Radix UI + Tailwind).
- **API Layer**: Next.js Route Handler at `/api/assistant/respond`; runs on Vercel Edge or Node runtime (prefer Node for Supabase service role usage).
- **Model Provider**: OpenAI GPT-4o mini (primary) with fallback to GPT-4o for complex itineraries; configurable via env `ASSISTANT_MODEL_PRIMARY` and `ASSISTANT_MODEL_FALLBACK`.
- **LLM Client**: `openai` SDK or `@ai-sdk/openai` wrapper; keep adapter thin to ease future provider swaps.
- **Prompt Management**: Version-controlled prompt files in `lib/assistant/prompts/` with Zod schemas for template inputs.

## Context & Data
- **Supabase**: single source of truth for trips, days, destinations, explore markers, preferences.
  - Use service-role Supabase client on the server.
  - Implement context assembly in `lib/assistant/context-service.ts`.
- **Caching**:
  - In-memory LRU (per instance) for trip snapshots (Fastify MemoryCache or simple Map with TTL).
  - Optional Redis/Vercel KV if we see cold-start churn; flagged behind `ASSISTANT_CACHE_DRIVER`.
- **Embeddings & Search**:
  - Reuse Supabase `content_embeddings` (pgvector) for semantic lookups.
  - Use `@supabase/postgrest-js` queries or RPCs for efficient vector similarity search.
- **External APIs**:
  - Mapbox-based `search-places` tool (already under `lib/supabase/explore-api.ts`).
  - Future connectors (Rome2Rio, Amadeus) routed through the same tool executor interface.

## Observability
- **Logging**: Structured logs via `@logtail/next` or custom logger to Supabase `assistant_logs`.
- **Metrics**: Capture token counts, latency, tool invocations. Consider tiny worker that aggregates per-day cost totals into Supabase.
- **Tracing**: Lightweight span wrapper using `@vercel/otel` or OpenTelemetry SDK if we expand to multiple services.
- **Error Handling**: Sentry (already in app) with tagged context (`feature:assistant`).

## Configuration & Secrets
- `.env` keys: `ASSISTANT_MODEL_PRIMARY`, `ASSISTANT_MODEL_FALLBACK`, `OPENAI_API_KEY`, `ASSISTANT_FEATURE_FLAG_KEY`, optional `ASSISTANT_COST_BUDGET_WEEKLY`, and `ASSISTANT_CACHE_DRIVER` when external caching is enabled.
- Guard rails: Validate env variables at boot using `zod` schema (`lib/assistant/config/env.ts`).

## Development Workflow
- Feature flag gating via Supabase config table `feature_flags` or Next.js runtime config.
- Add Vitest suites for context-service, prompt guard, and orchestrator (use fixtures from `tests/assistant`).
- Use `run-context-service.js` (CLI helper) to simulate Supabase payloads and iterate quickly.

## Cost Monitoring
- No hard caps; rely on telemetry + alerts to flag anomalous spend.
- Implement dynamic model downgrade when the context payload exceeds practical size.
- Batch embeddings refresh jobs to off-peak hours; store results to avoid repeated calls.
