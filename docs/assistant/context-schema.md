# Assistant Context Schema

This document describes the structured payload shared between the frontend and the backend assistant pipeline. Keep this contract in sync with `lib/assistant/context/types.ts`.

## AssistantContext (server response contract)

```jsonc
{
  "user": {
    "id": "uuid",
    "name": "Jordan Smith",
    "preferences": {
      "budgetRange": { "min": 1500, "max": 3500 },
      "travelStyle": ["slow", "culture-forward"],
      "interests": ["cuisine", "art museums"],
      "accessibility": ["step-free"],
      "dietary": ["vegetarian"]
    }
  },
  "trip": {
    "id": "trip-123",
    "name": "Italy Discovery",
    "country": "IT",
    "window": { "start": "2025-04-10", "end": "2025-04-18" },
    "days": [
      {
        "dayOrder": 3,
        "date": "2025-04-12",
        "baseLocations": [
          {
            "name": "Hotel Artemide",
            "coordinates": [12.495, 41.9009],
            "context": "Booked accommodation"
          }
        ],
        "destinations": [
          {
            "id": "dest-4",
            "name": "Colosseum Guided Tour",
            "category": "attraction",
            "coordinates": [12.4924, 41.8902],
            "startTime": "10:00",
            "durationHours": 2,
            "notes": "Skip-the-line tickets",
            "bookingStatus": "booked",
            "links": [
              { "label": "Vendor", "url": "https://example.com/tour" }
            ]
          }
        ],
        "openSlots": ["afternoon"],
        "notes": "Anniversary dinner"
      }
    ]
  },
  "exploreMarkers": [
    {
      "id": "map-12",
      "name": "Trastevere Food Crawl",
      "coordinates": [12.467, 41.889],
      "category": "food",
      "context": "Explore anywhere pin",
      "source": "user"
    }
  ],
  "ui": {
    "view": "timeline",
    "selectedTripId": "trip-123",
    "selectedDayOrder": 3,
    "highlightedDestinationId": "dest-4",
    "filters": { "category": ["food"] },
    "mapBounds": {
      "northEast": [12.52, 41.92],
      "southWest": [12.45, 41.87]
    }
  },
  "generatedAt": "2025-03-02T19:12:45.000Z"
}
```

### Field Notes
- `coordinates` are `[longitude, latitude]`.
- `openSlots` is derived from itinerary gaps to help the LLM offer suggestions quickly.
- `bookingStatus` clarifies whether the assistant should suggest alternatives or respect existing reservations.
- `source` on `exploreMarkers` differentiates user-created entries (`user`), assistant suggestions awaiting confirmation (`assistant`), or imported discovery results (`explore`).
- `generatedAt` is added on the server to make debugging easier.

## AssistantMessagePayload (client request)

```jsonc
{
  "conversationId": "conv-42",
  "message": {
    "id": "msg-17",
    "role": "user",
    "content": "What's a great dinner spot near my hotel on day 3?",
    "locale": "en-US"
  },
  "history": [
    {
      "id": "msg-16",
      "role": "assistant",
      "content": "You have a free evening on day 3 in Rome."
    }
  ],
  "uiFingerprint": {
    "view": "timeline",
    "selectedTripId": "trip-123",
    "selectedDayOrder": 3
  },
  "contextVersion": "2025-03-01"
}
```

### Field Notes
- `history` is trimmed to the most recent turns before calling the LLM.
- `uiFingerprint` mirrors the client-side state and helps reconcile when the context cache needs to refresh.
- `contextVersion` allows the server to detect breaking changes in the payload and reject outdated clients.

## Validation

Both payloads are validated using Zod schemas in `lib/assistant/context/types.ts`. Any API handler importing these schemas should return a `400` response with a structured error body when validation fails.
