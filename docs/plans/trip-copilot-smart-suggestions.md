# Trip Copilot – Phase 3 Smart Suggestions

## Goals
- Recommend concrete destinations or activities based on existing trip and Explore context.
- Keep the assistant grounded in user-owned data (itinerary, Maybe list, Explore favorites) before reaching for external search.
- Make suggestions feel actionable with one-click previews or mutations routed through the action bus.

## Implementation Summary
- Introduced a scoring engine that:
  - Highlights empty or under-filled days and pairs them with high-signal Maybe destinations (favorites, city-matched, highly-rated).
  - Surfaces favorited Explore places that are not yet on the itinerary, nudging map previews instead of blind edits.
- Registered a `smartSuggestions` conversational intent that answers "suggest/recommend" prompts, filters by requested day numbers, and returns structured suggestion payloads.
- Updated proactive nudges to reuse the highest-value smart suggestion, so the assistant can lead when the user is idle.
- Extended the copilot UI with:
  - A real-time "Smart suggestions" shelf above the transcript.
  - Richer copilot bubbles that render suggestion cards with map previews and schedule buttons.
  - Sequential dispatch for suggestion actions (select day → schedule destination) via the action bus to keep UI state in sync.
- Added type support for suggestion structures (`CopilotSuggestion`, `CopilotSuggestionAction`) and broadened runtime context snapshots with Explore place metadata.
- Kept TypeScript strict by updating harness fixtures, validators, and nudges to understand the new context shape.

## Next Steps & Open Items
1. Add travel-time and adjacency checks so suggestions respect geography and pacing.
2. Support direct "Add to Maybe" mutations for Explore places from the suggestion cards (requires mutation + Supabase sync).
3. Fold acceptance telemetry into the action bus so we can measure which suggestions convert.
4. Explore lightweight LLM summaries that explain *why* a suggestion was ranked highly (transparency for power users).
5. Expand harness coverage with a Phase 3 script validating suggestion outputs and nudges end-to-end.
