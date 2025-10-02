# Frontend–Backend Alignment Update

**Last reviewed:** December 2024  
**Application:** Traveal (Trip3)  
**Reviewer:** Codex (GPT-5)

---

## Executive Summary

Core trip planning and explore features are now fully backed by Supabase. Trip data flows through `useSupabaseTripStore`, itinerary destinations serialize JSON payloads correctly, and explore cards persist notes/links/favourites. Remaining gaps are operational rather than critical: retiring legacy columns, activating analytics tables, and clearing unused historical schema. No blocking misalignments remain between the shipped UI and the Supabase project.

---

## Alignment Highlights

- **Trip persistence:** All user-facing trip components use `useSupabaseTripStore` (`components/map/MapIntegration.tsx`, `components/trip/TripLoader.tsx`). CRUD logic flows through `lib/supabase/trip-api.ts`, ensuring Supabase remains the source of truth.
- **Destination metadata:** `trip_destinations.links_json` is serialized/deserialized via `tripApi` helpers, keeping `LocationLink[]` in sync between UI and database.
- **Base locations:** `base_locations_json` is updated alongside legacy single-location columns, so multi-base editing works while we phase out old fields.
- **Itinerary day notes:** Day notes persist through `trip_days.notes` via the updated `DayNotesModal` and `tripApi.setDayNotes`.
- **Explore cards:** Explore Anywhere markers now write notes, resource links, metadata and favourite state to Supabase (`explore_places`). Refreshing the page or switching devices keeps the card data intact.
- **AI caching:** Destination overview/photo endpoints read and write Supabase cache tables (`destination_modal_content`, `destination_images`), so the documented TTL/quality logic reflects production behaviour.

---

## Open Items (by priority)

### High priority
- **None.** Core persistence paths are aligned.

### Medium priority
1. **Retire legacy base-location columns** (`trip_days.base_location_*`). The UI already relies on `base_locations_json`; schedule a backfill & drop once historical data is migrated.
2. **Activate analytics tables** (`trip_analytics`, `user_interactions`, `map_views`). Schema is ready but no events are emitted yet.

### Low priority
1. **User preferences UI:** Supabase tables (`user_preferences`, `user_trip_preferences`) exist but the app still uses in-memory defaults.
2. **Schema hygiene:** 20+ historical tables (journeys, POI, via conversations) remain in the project. Archive or drop to simplify migrations and backups.
3. **Documentation drift:** Generated Supabase docs previously listed missing columns and unused caches; keep them in sync with the updated schema (see recommendations).

---

## Recommendations & Next Steps

1. **Plan legacy clean-up.** Draft a migration to drop `base_location_name/base_location_coordinates/base_location_context` after verifying no external tooling depends on them.
2. **Instrument analytics.** Add lightweight action logging (e.g., route toggles, explore saves) using the existing Supabase RPC/functions. Ship with opt-in telemetry and dashboards later.
3. **Preferences integration.** Build a small settings surface that reads/writes `user_preferences` so map style, default country, etc. persist across sessions.
4. **Prune unused tables.** Coordinate with data stakeholders, export anything worth archiving, then remove unused schemas to shrink future dumps and reduce confusion.
5. **Keep docs authoritative.** The updated `SUPABASE_TABLE_SCHEMAS.md` now lists the new explore columns; continue regenerating or curating these docs whenever schema changes land.

---

## Conclusion

Frontend and backend are now in lockstep for daily trip planning workflows. The remaining tasks are operational polish aimed at removing legacy baggage and lighting up analytics/preferences. No additional engineering blockers were identified.
