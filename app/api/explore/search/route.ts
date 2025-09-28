import { NextResponse } from 'next/server'
import { fallbackCityFromFullName } from '@/lib/location/city'

// Define search priority order (same as places/search)
const SEARCH_PRIORITY = {
  'country': 1,
  'administrative_area_level_1': 2, // States/Provinces
  'administrative_area_level_2': 3, // Counties/Regions
  'locality': 4, // Cities
  'sublocality': 5, // Towns/Neighborhoods
  'establishment': 6, // POIs/Businesses
  'tourist_attraction': 7,
  'restaurant': 8,
  'lodging': 9,
  'shopping_mall': 10,
  'museum': 11,
  'park': 12,
  'default': 99
}

function getSearchPriority(types: string[]): number {
  for (const type of types) {
    if (type in SEARCH_PRIORITY) {
      return SEARCH_PRIORITY[type as keyof typeof SEARCH_PRIORITY]
    }
  }
  return SEARCH_PRIORITY.default
}

function sortResultsByPriority(results: any[]): any[] {
  return results.sort((a, b) => {
    const priorityA = getSearchPriority(a.types || [])
    const priorityB = getSearchPriority(b.types || [])
    
    // If same priority, sort by rating (higher first)
    if (priorityA === priorityB) {
      const ratingA = a.rating || 0
      const ratingB = b.rating || 0
      return ratingB - ratingA
    }
    
    return priorityA - priorityB
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim()

  if (!query) {
    return NextResponse.json({ results: [] })
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY

  if (!googleKey) {
    return NextResponse.json({ error: 'Google Places API key not configured', results: [] }, { status: 500 })
  }

  try {
    const googleEndpoint = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    googleEndpoint.searchParams.set('query', query)
    googleEndpoint.searchParams.set('key', googleKey)
    googleEndpoint.searchParams.set('language', 'en')
    googleEndpoint.searchParams.set('region', 'it')
    googleEndpoint.searchParams.set('fields', 'place_id,name,formatted_address,geometry,types,rating')

    const response = await fetch(googleEndpoint.toString())

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Sort results by our hierarchical priority
    if (data.results && Array.isArray(data.results)) {
      data.results = sortResultsByPriority(data.results)
    }

    const results = (data.results || []).slice(0, 8).map((place: any) => {
      const city = fallbackCityFromFullName(place.formatted_address || place.name)
      return {
      id: `google-${place.place_id}`,
      name: place.name,
      fullName: place.formatted_address || place.name,
      coordinates: [place.geometry.location.lng, place.geometry.location.lat] as [number, number],
      category: place.types?.[0] || 'location',
      context: place.formatted_address ? place.formatted_address.split(',').slice(-2).join(', ').trim() : undefined,
      relevance: place.rating ? place.rating / 5 : 0.8, // Convert rating to 0-1 scale
      source: 'google' as const,
      metadata: {
        place_id: place.place_id,
        rating: place.rating,
        types: place.types
      },
      city: city === 'Unknown' ? undefined : city,
    }
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Explore search error:', error)
    return NextResponse.json({ error: 'Failed to search locations', results: [] }, { status: 500 })
  }
}
