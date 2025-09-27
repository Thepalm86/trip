import { NextRequest, NextResponse } from 'next/server'
import { DestinationCacheService } from '@/lib/server/destination-cache'
import { requireAuthenticatedUser, UnauthorizedError, isUserAdmin } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)
    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get content quality statistics
    const stats = await DestinationCacheService.getContentQualityStats()
    
    if (!stats) {
      return NextResponse.json({ error: 'Failed to get statistics' }, { status: 500 })
    }

    return NextResponse.json({
      contentQuality: stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Error getting performance statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get performance statistics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)
    if (!isUserAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action } = await request.json()

    if (action === 'cleanup') {
      // Clean up expired content
      const deletedCount = await DestinationCacheService.cleanupExpiredContent()
      
      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} expired records`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Error performing maintenance action:', error)
    return NextResponse.json(
      { error: 'Failed to perform maintenance action' },
      { status: 500 }
    )
  }
}
