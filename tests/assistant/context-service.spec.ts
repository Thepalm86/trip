import test from 'node:test'
import assert from 'node:assert/strict'

import { __testables } from '@/lib/assistant/context/service'

const {
  parsePoint,
  mapDestination,
  mapTripDay,
  mapTrip,
  mapExploreMarkers,
  mapUserPreferences,
} = __testables

test('parsePoint handles Supabase POINT strings', () => {
  assert.deepEqual(parsePoint('(12.34,56.78)'), [12.34, 56.78])
  assert.equal(parsePoint('invalid'), undefined)
  assert.equal(parsePoint(null), undefined)
})

test('mapDestination normalizes fields and coordinates', () => {
  const destination = mapDestination({
    id: 'dest-1',
    day_id: 'day-1',
    name: 'Colosseum Tour',
    description: 'Guided experience',
    coordinates: '(12.4924,41.8902)',
    city: 'Rome',
    category: 'attraction',
    rating: 4.8,
    image_url: null,
    estimated_duration_hours: 2,
    opening_hours: '09:00-17:00',
    cost: 65,
    order_index: 1,
    notes: 'Skip-the-line tickets confirmed',
    links_json: JSON.stringify([{ label: 'Vendor', url: 'https://example.com' }]),
  } as any)

  assert.equal(destination.id, 'dest-1')
  assert.deepEqual(destination.coordinates, [12.4924, 41.8902])
  assert.equal(destination.durationHours, 2)
  assert.equal(destination.notes, 'Skip-the-line tickets confirmed')
  assert.deepEqual(destination.links, [{ label: 'Vendor', url: 'https://example.com' }])
})

test('mapTrip assembles day ordering and itinerary summary', () => {
  const tripRow = {
    id: 'trip-1',
    name: 'Italy Discovery',
    start_date: '2025-04-10',
    end_date: '2025-04-18',
    country_code: 'IT',
    status: 'planning',
    notes: null,
    trip_days: [
      {
        id: 'day-2',
        date: '2025-04-11',
        day_order: 2,
        base_location_name: 'Florence Base',
        base_location_coordinates: '(11.255,43.7696)',
        base_location_context: 'Boutique hotel',
        base_locations_json: null,
        notes: null,
        trip_destinations: [],
      },
      {
        id: 'day-1',
        date: '2025-04-10',
        day_order: 1,
        base_location_name: 'Rome Stay',
        base_location_coordinates: '(12.4964,41.9028)',
        base_location_context: 'Hotel Artemide',
        base_locations_json: null,
        notes: 'Arrive by noon',
        trip_destinations: [
          {
            id: 'dest-1',
            day_id: 'day-1',
            name: 'Colosseum Tour',
            description: 'Guided experience',
            coordinates: '(12.4924,41.8902)',
            city: 'Rome',
            category: 'attraction',
            rating: 4.8,
            image_url: null,
            estimated_duration_hours: 2,
            opening_hours: '09:00-17:00',
            cost: 65,
            order_index: 1,
            notes: 'Skip-the-line tickets confirmed',
            links_json: null,
          },
        ],
      },
    ],
  }

  const trip = mapTrip(tripRow as any)
  assert.equal(trip.id, 'trip-1')
  assert.equal(trip.days[0].dayOrder, 1)
  assert.equal(trip.days[0].destinations.length, 1)
  assert.deepEqual(trip.days[0].baseLocations?.[0].coordinates, [12.4964, 41.9028])
})

test('mapExploreMarkers normalizes metadata and coordinates', () => {
  const markers = mapExploreMarkers([
    {
      id: 'marker-1',
      name: 'Trastevere Food Crawl',
      longitude: 12.467,
      latitude: 41.889,
      category: 'food',
      context: 'Saved from explore',
      notes: null,
      links_json: null,
      metadata: { source: 'assistant', confidence: 0.8 },
      is_favorite: true,
    },
  ] as any)

  assert.equal(markers.length, 1)
  assert.equal(markers[0].source, 'assistant')
  assert.deepEqual(markers[0].coordinates, [12.467, 41.889])
})

test('mapUserPreferences gracefully handles empty rows', () => {
  assert.equal(mapUserPreferences(null), undefined)
  const prefs = mapUserPreferences({
    user_id: 'user-1',
    default_country: 'IT',
    preferred_categories: ['food'],
    budget_range_min: 1000,
    budget_range_max: 3000,
    travel_style: ['slow travel'],
    interests: ['wine', 'art'],
    accessibility: ['step-free'],
    dietary: ['vegetarian'],
  } as any)

  assert.ok(prefs)
  assert.equal(prefs?.budgetRange?.min, 1000)
  assert.deepEqual(prefs?.travelStyle, ['slow travel'])
})
