import { NextResponse } from 'next/server'
import {
  AddressComponent,
  extractCityFromComponents,
  fallbackCityFromFullName,
} from '@/lib/location/city'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('placeId')?.trim()

  if (!placeId) {
    return NextResponse.json({ error: 'placeId is required' }, { status: 400 })
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY

  if (!googleKey) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  try {
    const googleEndpoint = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    googleEndpoint.searchParams.set('place_id', placeId)
    googleEndpoint.searchParams.set('key', googleKey)
    googleEndpoint.searchParams.set('language', 'en')
    googleEndpoint.searchParams.set('fields', 'address_component,formatted_address')

    const response = await fetch(googleEndpoint.toString())
    if (!response.ok) {
      console.error('Place details request failed', { placeId, status: response.status })
      return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 502 })
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('Google Places details returned error', { placeId, status: data.status, errorMessage: data.error_message })
      return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 502 })
    }

    const components: AddressComponent[] = data.result?.address_components ?? []
    const derivedCity = extractCityFromComponents(components)
    const formattedAddress: string | null = data.result?.formatted_address ?? null
    const fallbackCity = fallbackCityFromFullName(formattedAddress)

    return NextResponse.json({
      city: derivedCity ?? (fallbackCity === 'Unknown' ? null : fallbackCity),
      formattedAddress,
    })
  } catch (error) {
    console.error('Unhandled error fetching place details', { placeId, error })
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 })
  }
}
