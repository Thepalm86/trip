import { NextRequest, NextResponse } from 'next/server'
import { DestinationCacheService } from '@/lib/server/destination-cache'
import { requireAuthenticatedUser, UnauthorizedError } from '@/lib/server/auth'

// Enhanced photo quality scoring system
interface PhotoQualityMetrics {
  aspectRatio: number
  resolution: number
  likes: number
  downloads: number
  tags: string[]
  source: string
  qualityScore: number
}

function calculatePhotoQuality(photo: any, source: string): PhotoQualityMetrics {
  const aspectRatio = photo.width / photo.height
  const resolution = photo.width * photo.height
  const likes = photo.likes || photo.downloads || 0
  const downloads = photo.downloads || photo.views || 0
  
  // Calculate quality score (0-1)
  let qualityScore = 0.5 // Base score
  
  // Aspect ratio scoring (prefer landscape, 16:9 ideal)
  if (aspectRatio >= 1.5 && aspectRatio <= 2.0) {
    qualityScore += 0.2
  } else if (aspectRatio >= 1.2 && aspectRatio <= 2.5) {
    qualityScore += 0.1
  }
  
  // Resolution scoring (prefer higher resolution)
  if (resolution >= 2000000) { // 2MP+
    qualityScore += 0.2
  } else if (resolution >= 1000000) { // 1MP+
    qualityScore += 0.1
  }
  
  // Engagement scoring
  if (likes > 100) {
    qualityScore += 0.1
  } else if (likes > 50) {
    qualityScore += 0.05
  }
  
  // Source preference (Unsplash generally higher quality)
  if (source === 'unsplash') {
    qualityScore += 0.1
  }
  
  // Cap at 1.0
  qualityScore = Math.min(qualityScore, 1.0)
  
  return {
    aspectRatio,
    resolution,
    likes,
    downloads,
    tags: photo.tags || [],
    source,
    qualityScore
  }
}

function enhancePhotoWithQuality(photo: any, source: string) {
  const quality = calculatePhotoQuality(photo, source)
  
  return {
    id: photo.id,
    url: photo.urls?.regular || photo.largeImageURL,
    thumbnail: photo.urls?.thumb || photo.previewURL,
    alt: photo.alt_description || photo.description || photo.tags || 'Travel destination',
    photographer: photo.user?.name || photo.user || 'Unknown',
    photographerUrl: photo.user?.links?.html || `https://pixabay.com/users/${photo.user}-${photo.user_id}/` || '#',
    source,
    width: photo.width || photo.imageWidth,
    height: photo.height || photo.imageHeight,
    qualityScore: quality.qualityScore,
    likes: quality.likes,
    downloads: quality.downloads,
    tags: quality.tags
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let destinationName: string, city: string | undefined, query: string | null, count: number
  let apiCalls = 0
  let cacheHit = false

  try {
    await requireAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    query = searchParams.get('query')
    count = parseInt(searchParams.get('count') || '10')

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    // Extract destination and city from query for caching
    const queryParts = query.split(' ')
    destinationName = queryParts[0]
    city = queryParts.length > 1 ? queryParts.slice(1, -1).join(' ') : undefined

    // Check cache first
    const cached = await DestinationCacheService.getCachedImages(destinationName, city)
    if (cached && cached.images.length >= count) {
      cacheHit = true
      await DestinationCacheService.logApiCall(
        'destination/photos',
        { query, count, cacheHit: true, responseTimeMs: Date.now() - startTime },
        Date.now() - startTime,
        true
      )
      return NextResponse.json({ photos: cached.images.slice(0, count), source: cached.source })
    }

    // Enhanced photo fetching with quality scoring
    let photos = []

    try {
      // Unsplash API with enhanced parameters
      const unsplashStartTime = Date.now()
      const unsplashResponse = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(count * 2, 20)}&orientation=landscape&order_by=relevant&content_filter=high`,
        {
          headers: {
            'Authorization': `Client-ID ${process.env.NEXT_PUBLIC_UNSPLASH_KEY}`,
          },
        }
      )

      if (unsplashResponse.ok) {
        apiCalls++
        const unsplashData = await unsplashResponse.json()
        const unsplashPhotos = unsplashData.results.map((photo: any) => 
          enhancePhotoWithQuality(photo, 'unsplash')
        )
        
        // Sort by quality score and take the best ones
        photos = unsplashPhotos
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, count)
        
        console.log(`Unsplash API: ${photos.length} photos in ${Date.now() - unsplashStartTime}ms`)
      }
    } catch (unsplashError) {
      console.warn('Unsplash API failed, trying Pixabay:', unsplashError)
    }

    // If Unsplash didn't work or returned few results, try Pixabay
    if (photos.length < count) {
      try {
        const pixabayStartTime = Date.now()
        const pixabayResponse = await fetch(
          `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${Math.min(count * 2, 20)}&safesearch=true&order=popular`
        )

        if (pixabayResponse.ok) {
          apiCalls++
          const pixabayData = await pixabayResponse.json()
          const pixabayPhotos = pixabayData.hits.map((photo: any) => 
            enhancePhotoWithQuality(photo, 'pixabay')
          )

          // Combine with existing photos and sort by quality
          const allPhotos = [...photos, ...pixabayPhotos]
            .sort((a, b) => b.qualityScore - a.qualityScore)
            .slice(0, count)
          
          photos = allPhotos
          console.log(`Pixabay API: ${pixabayPhotos.length} photos in ${Date.now() - pixabayStartTime}ms`)
        }
      } catch (pixabayError) {
        console.warn('Pixabay API failed:', pixabayError)
      }
    }

    // If no photos found, return a fallback
    if (photos.length === 0) {
      photos = [{
        id: 'fallback',
        url: `https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=800&fit=crop&crop=center`,
        thumbnail: `https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=150&fit=crop&crop=center`,
        alt: `${query} - Travel destination`,
        photographer: 'Unsplash',
        photographerUrl: 'https://unsplash.com',
        source: 'fallback',
        width: 1200,
        height: 800,
        qualityScore: 0.5,
        likes: 0,
        downloads: 0,
        tags: ['travel', 'destination']
      }]
    }

    // Cache the results
    if (photos.length >= count) {
      await DestinationCacheService.setCachedImages(destinationName, city, photos)
    }

    // Log the API call with enhanced metrics
    const totalResponseTime = Date.now() - startTime
    const avgQualityScore = photos.length > 0 
      ? photos.reduce((sum, photo) => sum + (photo.qualityScore || 0.5), 0) / photos.length 
      : 0

    await DestinationCacheService.logApiCall(
      'destination/photos',
      { 
        query, 
        count, 
        cacheHit, 
        apiCalls, 
        photosReturned: photos.length,
        avgQualityScore: Math.round(avgQualityScore * 100) / 100,
        responseTimeMs: totalResponseTime 
      },
      totalResponseTime,
      true
    )

    console.log(`Photo API: ${photos.length} photos, ${apiCalls} API calls, ${totalResponseTime}ms, avg quality: ${avgQualityScore.toFixed(2)}`)

    return NextResponse.json({ photos: photos.slice(0, count), source: 'api' })

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Error fetching destination photos:', error)

    // Log the error
    await DestinationCacheService.logApiCall(
      'destination/photos',
      { query: query || '', count: 10 },
      Date.now() - startTime,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    )

    return NextResponse.json(
      { error: 'Failed to fetch destination photos' },
      { status: 500 }
    )
  }
}
