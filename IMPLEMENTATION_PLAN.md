# Trip3 Remediation Plan (Feature-Parity Safe)

1. **Lock Down Supabase Service Role Usage**
   - **Files Affected:** `lib/server/destination-cache.ts`, `app/api/destination/overview/route.ts`, `app/api/destination/photos/route.ts`, `app/api/destination/view-count/route.ts`, `app/api/admin/performance/route.ts`.
   - **Specific Code Change (Conceptual):** Move service-role operations into server-only utilities that verify a Supabase session (e.g. `createRouteHandlerClient` + RLS) or proxy through Supabase Edge Functions; expose HTTP handlers that require authenticated users and fall back to anon-key reads where possible.
   - **Justification:** Eliminates the current “god-mode” API surface while preserving caching/reporting behaviour.
   - **Verification Step:** Call each endpoint as an unauthenticated client—expect 401; repeat with an authenticated user to confirm identical responses.

2. **Purge Hard-Coded Secrets and Introduce Environment Templates**
   - **Files Affected:** `.env.local`, add new `.env.example`, update setup docs (`README.md`, `SUPABASE_SETUP.md`).
   - **Specific Code Change (Conceptual):** Replace real secrets with placeholders, document required keys, and load actual values via deployment secrets (e.g. Vercel/Netlify project settings); ensure git history is cleaned if necessary.
   - **Justification:** Prevents accidental key disclosure and simplifies rotation for compliant deployments.
   - **Verification Step:** Boot the app using `.env.example` + locally supplied secrets; ensure `pnpm run dev` still starts once env vars are provided.

3. **Sanitise Map Marker and Popup Rendering**
   - **Files Affected:** `components/map/ExplorePreviewMarker.tsx`, `components/map/MapEventHandler.tsx`.
   - **Specific Code Change (Conceptual):** Replace `innerHTML`/`setHTML` string templates with DOM construction using `textContent` (or use `setDOMContent` with sanitized elements) so that external values cannot inject HTML.
   - **Justification:** Closes current XSS vectors without altering the visual output.
   - **Verification Step:** Store a place named `<img onerror=alert(1)>` and confirm the UI shows literal text, no script execution.

4. **Realign Trip Base Location Data Model**
   - **Files Affected:** `components/trip/TripLoader.tsx`, `lib/supabase/trip-api.ts`, `lib/store/supabase-trip-store.ts`, any components reading `day.location`.
   - **Specific Code Change (Conceptual):** Standardise on `baseLocations[]` everywhere—update default trip creation, persistence helpers, and UI reads/writes; map legacy `location` fields to the array shape for backwards compatibility.
   - **Justification:** Ensures accommodations persist correctly and removes a class of runtime `undefined` checks.
   - **Verification Step:** Create a trip, set base locations, reload the page, and confirm they remain visible in both timeline and map.

5. **Trim Map Logging and Guard Expensive Effects**
   - **Files Affected:** `components/map/MarkerManager.tsx`, `components/map/MapCleanup.tsx`, `components/map/MapInitializer.tsx`.
   - **Specific Code Change (Conceptual):** Remove or wrap console logs with a `process.env.NEXT_PUBLIC_DEBUG_MAP` flag, memoise derived feature collections, and bail out early when input arrays haven’t changed.
   - **Justification:** Reduces noise, improves runtime performance, and keeps parity with existing visuals.
   - **Verification Step:** Exercise the map (toggle days, add/remove destinations) and confirm console output stays minimal while markers/routes still update.

6. **Parallelise Route Segment Fetching and Tighten Caching**
   - **Files Affected:** `components/map/RouteManager.tsx`.
   - **Specific Code Change (Conceptual):** Replace sequential `for await` loops with `Promise.all` batches keyed by cache IDs, and reuse previously fetched segments instead of re-requesting unchanged legs.
   - **Justification:** Cuts route calculation latency and avoids hammering Mapbox quotas.
   - **Verification Step:** Inspect browser devtools—multiple segment requests should fire in parallel, and repeated day selections should hit the in-memory cache (no new network calls).

7. **Add Auth Checks for Admin Maintenance Endpoint**
   - **Files Affected:** `app/api/admin/performance/route.ts`.
   - **Specific Code Change (Conceptual):** Require an authenticated user with an admin claim (e.g. Supabase RLS role) before executing cleanup RPCs; otherwise return 403.
   - **Justification:** Prevents anonymous deletion of cached content while keeping existing admin tooling intact.
   - **Verification Step:** Attempt POST `/api/admin/performance` as an unauthenticated client (expect 403), then as a whitelisted admin user (expect existing success response).
