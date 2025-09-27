# Trip3 Codebase Audit

_Date: 2025-09-27_

## Scorecard

| Domain | Score (1-10) | Rationale |
| --- | --- | --- |
| Security | 4 | Auth guards tightened, but several high-risk vectors remain (unauthenticated API key proxy, DOM XSS, service-role exposure). |
| Performance & Reliability | 6 | Core flows perform adequately, yet expensive external APIs lack rate limits/timeouts and caches can be spammed. |
| Maintainability & Readability | 6 | Architecture is modular, though verbose logging and duplicated logic increase noise; limited defensive coding around map integrations. |
| Architecture & Design | 7 | Clear separation of map subsystems and Supabase services; still relies on service-role key in mixed-trust contexts. |
| Testing & Quality Assurance | 3 | No automated test coverage; critical APIs and UI logic remain unverified. |

## Key Findings

| Severity | Area | File | Description | Recommendation |
| --- | --- | --- | --- | --- |
| High | Security | app/api/places/search/route.ts:51 | Endpoint is publicly accessible and proxies queries with the server Google Places key, enabling untrusted users to exhaust quota or incur costs. | Require authenticated sessions and/or per-user rate limiting; consider proxying via an internal secret or moving to client-side key usage with throttling. |
| High | Security | components/map/ExplorePreviewMarker.tsx:52 | Places names are interpolated into `innerHTML` without escaping, allowing XSS if upstream data contains HTML. | Sanitize text (e.g., using `textContent`) or render markers via React elements instead of raw `innerHTML`. |
| High | Security | components/map/MaybeLocationMarkers.tsx:47 | Same unescaped `innerHTML` construction for user-sourced destination names, leading to DOM XSS vectors. | Replace raw HTML injection with DOM-safe text rendering or use libraries that escape content. |
| Medium | Security | lib/server/destination-cache.ts:245 | Supabase service-role key remains callable from any authenticated user; compromised accounts can overwrite cache/log tables. | Move cache operations behind an internal secret/role or add server-side authorization filters before invoking service-role operations. |
| Medium | Performance | app/api/destination/photos/route.ts:123 | External image APIs are called sequentially with no rate limiting or timeout guards, exposing the app to latency spikes and quota burn. | Add fetch timeouts, per-user throttling, and exponential backoff; consider caching by query with expiry. |
| Medium | Maintainability | components/map/MapEventHandler.tsx:100 | Map event handlers rely on dynamic feature properties with minimal guards; console noise and duplicated logic hinder debugging. | Extract utility helpers to validate feature payloads, trim production logs, and centralize feature-state handling. |
| Medium | Testing | (general) | No automated tests cover API routes, stores, or map orchestration. | Establish unit tests for API handlers (e.g., using Vitest) and integration smoke tests for critical map workflows. |

## Notable Strengths

- Authenticated gateways and internal-secret guardrails now wrap sensitive routes.
- Map subsystem remains well-modularized (Initializer, RouteManager, MarkerManager, etc.), easing targeted improvements.
- Destination caching includes quality metadata and logging for observability.

## Recommended Next Steps

1. Secure the Google proxy endpoint and remove direct HTML interpolations to eliminate XSS vectors.
2. Introduce authorization layering (or internal-only access) before invoking Supabase service-role operations.
3. Implement defensive HTTP client wrappers with timeouts/rate limits for external APIs.
4. Bootstrap automated testing to cover API contracts and key client interactions.

