import { NextRequest, NextResponse } from 'next/server'

// Define search priority order
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY
  
  if (!googleKey) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  try {
    const googleEndpoint = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    googleEndpoint.searchParams.set('query', query)
    googleEndpoint.searchParams.set('key', googleKey)
    googleEndpoint.searchParams.set('language', 'en')
    googleEndpoint.searchParams.set('region', 'it')
    // Remove type restriction to get all types, we'll sort them ourselves
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
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Google Places API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch places data' }, 
      { status: 500 }
    )
  }
}
