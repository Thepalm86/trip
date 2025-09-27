# Trip3 Codebase Audit – February 2025

## High-Level Summary
- Critical secrets (including Supabase service role and AI keys) sit in the repo and power unauthenticated API routes, creating an immediate data-exfiltration risk.
- Map UI code injects unsanitised HTML from external/user data into the DOM, enabling XSS and undermining trust in the embedded map experience.
- Trip data models drifted during recent refactors (base locations vs. legacy `location` fields), so persisted itineraries silently lose accommodation data and UI edits become brittle.
- Map orchestration modules still carry heavy debug logging, repetitive imperative logic, and sequential network calls that inflate load times and complicate maintenance.
- Architectural boundaries between persistence, UI state, and side-effects are blurred, increasing the cost of safely extending the product.

## Scorecard

| Domain | Score (1-10) | Justification |
| :--- | :---: | :--- |
| **1. Security Audit** 🔒 | **2** | Service role key and third-party secrets are checked into `.env.local`, and multiple unauthenticated routes (`app/api/destination/*`, `app/api/admin/performance/route.ts`) run Supabase admin operations with that key; DOM injection issues add a second attack vector. |
| **2. Code Quality & Maintainability** ✨ | **4** | Refactors left the Trip model inconsistent (`baseLocations` vs. `location`), UI state isn’t synchronised with store updates, and console-heavy map modules obscure intent, slowing debugging and onboarding. |
| **3. Performance & Efficiency** 🚀 | **4** | Route calculation awaits Mapbox segments sequentially, map effects thrash sources on every render, and verbose logging adds measurable overhead in production builds. |
| **4. Architecture & Structure** 🏗️ | **4** | Server-side caching/logging, privileged Supabase access, and client stores are intertwined; concerns aren’t well encapsulated, making targeted changes risky without broad regression testing. |
| **OVERALL CODEBASE SCORE** | **3** | Security exposure dominates the risk profile; once secrets and auth are fixed, structural clean-up and performance tuning are achievable but still non-trivial. |

---

## Security Audit 🔒
- **Critical – Service role key exposed in server handlers** (`lib/server/destination-cache.ts:66-128`, `app/api/destination/overview/route.ts:248-333`, `app/api/destination/photos/route.ts:1-210`): Unauthenticated users can trigger Supabase admin queries and writes via public endpoints, granting full database access. Suggested fix: move cache/logging writes behind authenticated server-only utilities (e.g. Next.js server actions or Supabase Edge Functions) that validate the caller and rely on row-level security with the anon key for user-triggered requests.
- **Critical – Production secrets committed to repo** (`.env.local:18-76`): Supabase, OpenAI, Anthropic, Gemini, AssemblyAI, and other long-lived keys are in-source; compromise is already assumed. Suggested fix: purge real secrets from git history, replace with placeholders in an `.env.example`, and load actual credentials from deployment secrets managers.
- **High – DOM injection in map markers and popups** (`components/map/ExplorePreviewMarker.tsx:61-78`, `components/map/MapEventHandler.tsx:68-124`): Place names and descriptions flow from external APIs/user storage straight into `innerHTML`/`setHTML`, enabling XSS if data contains markup. Suggested fix: build DOM nodes programmatically (set `textContent`) or leverage safe templating/React portals for popups.
- **High – Admin maintenance route lacks auth** (`app/api/admin/performance/route.ts:4-44`): Any caller can delete cached records or retrieve metrics by POSTing `action=cleanup`. Suggested fix: enforce Supabase session checks or scope the handler to authenticated roles before touching privileged tables.
- **Medium – Generated IDs rely on `Math.random`** (`lib/utils.ts:21-28`): Non-cryptographic IDs risk collisions and predictability when used for persisted records. Suggested fix: adopt `crypto.randomUUID()` (available in modern runtimes) for server/client-safe uniqueness.

## Code Quality & Maintainability ✨
- **High – Trip model mismatch for base locations** (`components/trip/TripLoader.tsx:25-55`, `lib/supabase/trip-api.ts:320-360`, `types/index.ts:19-48`): UI/store still write `day.location` while types and downstream code expect `baseLocations[]`, so accommodations never persist. Suggested fix: consolidate on the array-based model—introduce migration mapping in stores and update `TripLoader`, `tripApi`, and components to read/write `baseLocations`.
- **Medium – Editing state desynchronised from store** (`components/left-panel/LeftPanel.tsx:10-75`): `tripName` is initialised from the store once and never updated when `currentTrip` changes, leaving stale values after remote updates. Suggested fix: derive `tripName` via `useEffect` keyed on `currentTrip?.name` or remove local state in favour of directly using store data.
- **Medium – Map modules littered with production logs** (`components/map/MarkerManager.tsx:32-123`, `components/map/MapCleanup.tsx:34-180`, `components/map/MapInitializer.tsx:18-120`): Console spam obscures real issues and can leak itinerary details. Suggested fix: gate logs behind a debug flag or remove them, keeping reusable instrumentation in one helper.
- **Medium – Trip store mixing persistence with UI state** (`lib/store/supabase-trip-store.ts:8-160`): The zustand store performs API calls, selection state, maybe-lists, and optimistic UI updates in one closure, hindering reuse/testing. Suggested fix: split persistence actions (CRUD) from presentation state or extract service helpers to isolate side-effects.
- **Low – Minimal automated coverage** (no tests across `/components` or `/app/api`): Hard to verify map/store regressions. Suggested fix: outline critical path tests (route handlers, Trip store actions) before major refactors.

## Performance & Efficiency 🚀
- **High – Sequential Mapbox route fetching** (`components/map/RouteManager.tsx:306-324`): Each segment fetch waits for the previous, so n segments multiply latency. Suggested fix: batch with `Promise.all` and reuse cached responses per coordinate pair.
- **Medium – Marker updates rerun wholesale** (`components/map/MarkerManager.tsx:32-120`): Effects rebuild GeoJSON sources on every render with no diffing; large itineraries cause repeated `setData` churn. Suggested fix: memoise derived feature collections and guard against needless updates via shallow equality checks.
- **Medium – MapCleanup bounds recalculation verbose** (`components/map/MapCleanup.tsx:34-180`): Extensive logging and repeated filter/reduce passes run on every selection change. Suggested fix: drop verbose logs and collapse redundant passes while keeping behaviour identical.
- **Low – Photo API always fetches maximum results** (`app/api/destination/photos/route.ts:126-187`): Unsplash and Pixabay calls double requested count even when cache hits; acceptable now but worth tightening. Suggested fix: adapt requested page size to remaining slots after cache/primary API results.

## Architecture & Structure 🏗️
- **High – DestinationCacheService conflates caching, logging, and admin writes** (`lib/server/destination-cache.ts:60-400`): A single class performs CRUD across multiple tables with the service role, used directly in request handlers. Suggested fix: extract separate repositories (cache, logging, stats) and ensure public HTTP entry points only touch anon-scoped methods.
- **Medium – Client stores orchestrate network side-effects** (`lib/store/supabase-trip-store.ts:80-158`, `lib/store/explore-store.ts:45-120`): UI components dispatch async Supabase mutations directly, duplicating error handling. Suggested fix: introduce dedicated data services/hooks to encapsulate persistence, leaving stores to manage state.
- **Medium – Map orchestration relies on imperative DOM manipulation** (`components/map/ExplorePreviewMarker.tsx:61-105`, `components/map/MapEventHandler.tsx:68-181`): Direct DOM string building works but makes cross-cutting concerns (e.g. localisation, theming) hard. Suggested fix: move toward declarative overlays (React portals or Mapbox custom layers) while keeping UI identical.
- **Low – Lack of configuration abstraction for third-party APIs** (scattered `process.env` reads): Hard to toggle providers or enforce fallbacks. Suggested fix: centralise config via `lib/config` helper that validates required envs once at boot.

---
