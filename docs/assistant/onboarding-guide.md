# Trip3 Planner Onboarding Guide (Spring 2025)

> Use this guide to get productive with the current Trip3 experience and supporting AI assistant. Everything below reflects the live app as of the recent left-panel and assistant updates.

## 1. Quick Start Checklist
- Install dependencies with `pnpm install`, then run the app via `pnpm dev`.
- Create `.env.local` (see the committed sample for required keys) and populate Supabase, Mapbox, OpenAI, and partner API keys listed in `docs/supabase/TRIP3_SUPABASE_SETUP.md`.
- Bring up Supabase with the CLI (`supabase start`) and apply migrations with `supabase db reset --use-migra` following the setup guide above.
- Sign in → the app auto-creates a default trip via `TripLoader`. Open the timeline and confirm days/base locations render.
- Switch to the Assistant tab (left-panel Day Details) and send a prompt to verify the `/api/assistant/respond` pipeline.

## 2. Core Layout Overview
- **Resizable Planner Rail**: Trip summary header, country/date controls, share/onboarding actions, and the timeline list live together on the left.
- **Day Details Tabs**: The lower half of the rail hosts `Plan` and `Assistant` tabs; both stay in sync with the selected day.
- **Map Surface**: The right pane remains a full Mapbox scene that reflects the current day selection and can mirror the assistant via the mini-map toggle.
- **Explore Dock**: From the map corner, open the “Explore anywhere” search to add Supabase-backed markers directly to the itinerary.

### Key UX Changes Worth Noticing
- Left-panel width is draggable (30–80%), so leave a note if your design tweak relies on a fixed grid.
- Selecting a timeline day persists even when you switch to the Assistant tab and back; the detail tabs store preferences per day in `localStorage`.
- Timeline capsules adopt the midnight gradient treatment and expose hover summaries for base locations and destination chips.
- The empty-day state is suggestion-free; the assistant now generates contextual follow-ups instead of the old static copy.

## 3. Managing the Timeline
1. **Add or reorder days**  
   - Use the `+` button atop the timeline or duplicate an existing day from the `…` menu.  
   - Drag destinations or base stays between days; DnD Kit is wired for pointer + keyboard sensors.
2. **Inspect and expand**  
   - Click a day to load its details; use the “expand all” list toggle to preview every day’s summary without changing selection.  
   - Hover reveals destination badges and base-location hints before opening the detail card.
3. **Route overlay & map sync**  
   - The Day Card header exposes a `Day routes` button that toggles inter/intra-day segments and broadcasts the selection via `selectedRouteSegmentId`.  
   - “Show all destinations” on the map control panel will re-fit bounds across the entire trip.
4. **Base locations & duplication helpers**  
   - `Add Accommodation` opens the base-location picker; drag handles reorder stays and the duplicate modal lets you copy a stay across multiple days.  
   - Destination cards offer quick actions for overview, duplicate-to-day, and removal.
5. **Notes & modals**  
   - `Add Notes`, `AddDestinationModal`, and `BaseLocationPicker` remain scoped to the active day and reset on close; duplicated destinations/bases call into Supabase via the store helpers.

**Tip:** If you ever need to clear selection programmatically, call `useSupabaseTripStore.setState({ selectedDayId: null })`. We now keep the selected day intact when switching detail tabs, so only modify it intentionally.

## 4. Plan vs Assistant Tabs
- The Day Details surface is a two-tab system:
  - **Plan Tab** – renders the `DayCard` for the currently selected day. Behaviors include drag-and-drop destination management and modal launches.
  - **Assistant Tab** – renders the dock in “rail” mode for in-context coaching.
- Tab state is persisted per day in `localStorage` (`trip3:itinerary:detail-tabs`). Switching a tab updates the preference for that specific day, so you can keep different days pinned to different views.
- When the Assistant tab is active we clear only the `selectedRouteSegmentId`—the day selection remains, ensuring you land back on the same content when returning to Plan.

## 5. Assistant Experience
- Requests flow through `app/api/assistant/respond` → prompt guard → context service → knowledge assembly → orchestrator.  
  - Context includes the active trip, selected day, destinations, base locations, explore markers, user preferences, and any retrieved curated/semantic knowledge.
- Follow-up suggestions now pull from itinerary gaps and explore markers; they render as tappable chips beneath the composer.
- The rail header exposes a mini-map toggle (`Globe` button). When enabled, it mirrors the main Mapbox view for reference while chatting.
- Errors from the guard/orchestrator return descriptive copy (`prompt_guard`, `AssistantResponseError`), and the UI surfaces them inline above the composer.
- The assistant remains read-only—users enact suggestions via the Plan tab or map controls.

### Suggested Prompts to Test
- “Summarize the plan for Day 2” – validates timeline awareness.
- “What’s open on Wednesday afternoon?” – triggers open slot detection.
- “Suggest food options near our base location in Florence” – exercises semantic lookup + knowledge layer.

## 6. Map & Explore Integration
- Destination pins, explore markers, and cached routes react instantly to selected days; the route manager caches Mapbox responses and honors the `Day routes` toggle.
- The bottom-left control stack exposes Legend, Explore Markers, All Destinations, and Route Mode toggles—keep titles/ARIA attributes aligned with `components/map/MapControls.tsx`.
- “Explore anywhere” launches the search dock (Google Places via `/api/explore/search`) and persists picked results to Supabase `explore_places`.
- Assistant context includes these markers and highlights; consider the knowledge surface before adding new categories or metadata.

## 7. Developer Onboarding Tasks
| Task | Why it matters |
| --- | --- |
| Run assistant tests `pnpm exec node --test tests/assistant` | Validates context builders, orchestrator summaries, and schema guards. |
| Read `docs/assistant/architecture.md` | Understands the request funnel and data contracts. |
| Skim `lib/store/supabase-trip-store.ts` | Selection state, duplication helpers, and route overlays all originate here. |
| Dive into `lib/assistant/orchestrator.ts` & `lib/assistant/knowledge.ts` | Captures prompt composition, model fallbacks, and knowledge aggregation. |
| Review Supabase migrations under `supabase/migrations` | Ensures your local database matches the latest schema (days/base locations/destinations). |

## 8. Troubleshooting & Support Tips
- **Assistant reports `AssistantResponseError`** – check OpenAI credentials and Supabase admin access; the context service must resolve trips before knowledge assembly can proceed.
- **Day selection resets unexpectedly** – ensure nothing outside `ItineraryTab` calls `setSelectedDay(null)`; tab switching preserves the selection on purpose.
- **Drag-and-drop feels laggy** – look for expensive rerenders in `DayCard` or collision detection warnings from DnD Kit; virtualised sections should remain memoised.
- **Map markers missing** – confirm Mapbox token validity and that the Supabase service role grants `destination_modal_content` / `destination_images` access (see `destination-cache.ts`).

## 9. What’s Next
- Attach citation metadata to assistant answers.
- Expand assistant tooling for deterministic itinerary edits (Phase 4 preview).
- Continue polishing timeline visuals (hover states, base location chips).

## 10. Productivity Shortcuts
- **Research Command Palette** – Press ⌘K / Ctrl+K anywhere to open the saved-sources drawer, filter by tag, and deep link to the active source.
- **User Menu** – The avatar menu exposes `Share trip` (share modal), `Show guided tour` (resets onboarding storage), and research access; keep these wired when adjusting the header.

Keep this guide updated whenever we change core UX flows (timeline tabs, assistant behavior, map controls) or adjust environment requirements. A quick diff through the checklist and troubleshooting sections usually catches drift early.
