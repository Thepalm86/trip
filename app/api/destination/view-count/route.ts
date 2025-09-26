import { NextRequest, NextResponse } from 'next/server'
import { DestinationCacheService } from '@/lib/server/destination-cache'

export async function POST(request: NextRequest) {
  try {
    const { destination } = await request.json()

    if (!destination) {
      return NextResponse.json({ error: 'Destination name is required' }, { status: 400 })
    }

    // Increment view count using the database function
    await DestinationCacheService.incrementViewCount(destination)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error incrementing view count:', error)
    return NextResponse.json(
      { error: 'Failed to increment view count' },
      { status: 500 }
    )
  }
}
