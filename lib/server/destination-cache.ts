import { supabaseAdmin } from '@/lib/server/supabase-admin'

// Types for existing Supabase tables
interface DestinationModalContent {
  id: string
  destination_name: string
  destination_coordinates: { x: number; y: number } | null
  destination_category: string | null
  summary: string | null
  why_visit: string[] | null
  key_facts: Record<string, any> | null
  content_version: number | null
  ai_model: string | null
  tokens_used: number | null
  quality_score: number | null
  created_at: string | null
  updated_at: string | null
  expires_at: string | null
  general_information: string | null
  activities_attractions: Record<string, any>[] | null
  selected_tips: Record<string, any>[] | null
  similar_places: Record<string, any>[] | null
  metadata: Record<string, any> | null
}

interface DestinationImage {
  id: string
  destination_name: string
  destination_coordinates: { x: number; y: number } | null
  image_url: string
  thumbnail_url: string
  alt_text: string | null
  photographer: string | null
  source: string
  width: number | null
  height: number | null
  color: string | null
  likes: number | null
  query_used: string | null
  created_at: string | null
  updated_at: string | null
  display_order: number | null
  downloads: number | null
  tags: string[] | null
  expires_at: string | null
  cached_at: string | null
}

/**
 * Cache and retrieve destination overviews using existing Supabase tables
 */
export class DestinationCacheService {
  private static readonly CACHE_TTL_HOURS = 720 // 30 days (30 * 24 hours)
  private static readonly IMAGE_CACHE_TTL_DAYS = 45
  private static readonly QUALITY_THRESHOLD = 0.6

  /**
   * Get cached destination overview if it exists and hasn't expired
   */
  static async getCachedOverview(
    destinationName: string,
    city?: string,
    category?: string
  ): Promise<{ overview: string; source: 'cache' | 'api' } | null> {
    try {
      const supabase = supabaseAdmin

      // Create a unique key for the destination
      const destinationKey = `${destinationName}${city ? `_${city}` : ''}${category ? `_${category}` : ''}`

      // Query existing cache
      const { data, error } = await supabase
        .from('destination_modal_content')
        .select('*')
        .eq('destination_name', destinationKey)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      // Use general_information as the overview text
      const overview = data.general_information || data.summary || ''
      if (!overview) {
        return null
      }

      return {
        overview,
        source: 'cache'
      }
    } catch (error) {
      console.warn('Error fetching cached overview:', error)
      return null
    }
  }

  /**
   * Cache a new destination overview with enhanced metadata
   */
  static async setCachedOverview(
    destinationName: string,
    city: string | undefined,
    category: string | undefined,
    overview: string,
    metadata: {
      coordinates?: [number, number]
      activities?: Record<string, any>[]
      tips?: Record<string, any>[]
      similarPlaces?: Record<string, any>[]
      destinationType?: string
      region?: string
      qualityScore?: number
      wordCount?: number
      generatedAt?: string
    } = {}
  ): Promise<void> {
    try {
      const supabase = supabaseAdmin

      const destinationKey = `${destinationName}${city ? `_${city}` : ''}${category ? `_${category}` : ''}`
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + this.CACHE_TTL_HOURS)

      // Prepare the data for insertion with enhanced metadata
      const cacheData: Partial<DestinationModalContent> & { destination_name: string } = {
        destination_name: destinationKey,
        destination_coordinates: metadata.coordinates ? {
          x: metadata.coordinates[0],
          y: metadata.coordinates[1]
        } : null,
        destination_category: category || null,
        summary: overview,
        general_information: overview,
        activities_attractions: metadata.activities || null,
        selected_tips: metadata.tips || null,
        similar_places: metadata.similarPlaces || null,
        metadata: {
          ...metadata,
          destinationType: metadata.destinationType,
          region: metadata.region,
          qualityScore: metadata.qualityScore,
          wordCount: metadata.wordCount,
          generatedAt: metadata.generatedAt || new Date().toISOString()
        },
        content_version: 1,
        quality_score: metadata.qualityScore || 0.8,
        expires_at: expiresAt.toISOString()
      }

      // Insert or update the cache
      const { error } = await supabase
        .from('destination_modal_content')
        .upsert(cacheData, {
          onConflict: 'destination_name'
        })

      if (error) {
        console.error('Error caching overview:', error)
      }
    } catch (error) {
      console.error('Error setting cached overview:', error)
    }
  }

  /**
   * Get cached destination images with enhanced filtering
   */
  static async getCachedImages(
    destinationName: string,
    city?: string
  ): Promise<{ images: any[]; source: 'cache' | 'api' } | null> {
    try {
      const supabase = supabaseAdmin

      const destinationKey = `${destinationName}${city ? `_${city}` : ''}`

      const { data, error } = await supabase
        .from('destination_images')
        .select('*')
        .eq('destination_name', destinationKey)
        .gte('expires_at', new Date().toISOString())
        .order('display_order', { ascending: true })

      if (error || !data || data.length === 0) {
        return null
      }

      // Filter images by quality threshold if quality_score exists
      const filteredImages = data.filter((img) => 
        !img.quality_score || img.quality_score >= this.QUALITY_THRESHOLD
      )

      if (filteredImages.length === 0) {
        return null
      }

      const images = filteredImages.map((img) => ({
        id: img.id,
        url: img.image_url,
        thumbnail: img.thumbnail_url,
        alt: img.alt_text || `${destinationName} - Travel destination`,
        photographer: img.photographer || 'Unknown',
        photographerUrl: img.source === 'unsplash' ? `https://unsplash.com/@${img.photographer}` : '#',
        source: img.source,
        width: img.width || 1200,
        height: img.height || 800,
        qualityScore: img.quality_score || 0.5,
        likes: img.likes || 0,
        downloads: img.downloads || 0,
        tags: img.tags || []
      }))

      return {
        images,
        source: 'cache'
      }
    } catch (error) {
      console.warn('Error fetching cached images:', error)
      return null
    }
  }

  /**
   * Cache destination images with enhanced metadata
   */
  static async setCachedImages(
    destinationName: string,
    city: string | undefined,
    images: any[]
  ): Promise<void> {
    try {
      const supabase = supabaseAdmin

      const destinationKey = `${destinationName}${city ? `_${city}` : ''}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + this.IMAGE_CACHE_TTL_DAYS)

      // Clear existing images for this destination first
      await supabase
        .from('destination_images')
        .delete()
        .eq('destination_name', destinationKey)

      // Prepare image data for insertion with enhanced metadata
      const imageData: Array<Partial<DestinationImage> & { destination_name: string; image_url: string; thumbnail_url: string; source: string }> = images.map((img, index) => ({
        destination_name: destinationKey,
        image_url: img.url,
        thumbnail_url: img.thumbnail,
        alt_text: img.alt,
        photographer: img.photographer,
        source: img.source,
        width: img.width,
        height: img.height,
        display_order: index + 1,
        expires_at: expiresAt.toISOString(),
        cached_at: new Date().toISOString(),
        downloads: img.downloads || 0,
        likes: img.likes || 0,
        quality_score: img.qualityScore || 0.5,
        tags: img.tags || []
      }))

      // Insert images
      const { error } = await supabase
        .from('destination_images')
        .insert(imageData)

      if (error) {
        console.error('Error caching images:', error)
      }
    } catch (error) {
      console.error('Error setting cached images:', error)
    }
  }

  /**
   * Log API call performance
   */
  static async logApiCall(
    endpoint: string,
    queryParams: Record<string, any>,
    responseTimeMs: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      const supabase = supabaseAdmin

      const { error } = await supabase
        .from('export_history') // Using existing table for logging
        .insert({
          destination_id: `api_${endpoint}_${Date.now()}`,
          destination_name: `${endpoint} call`,
          export_data: {
            queryParams,
            responseTimeMs,
            success,
            errorMessage
          },
          status: success ? 'completed' : 'failed',
          export_type: 'api_log'
        })

      if (error) {
        console.warn('Failed to log API call:', error)
      }
    } catch (error) {
      console.warn('Error logging API call:', error)
    }
  }

  /**
   * Increment view count for destination content
   */
  static async incrementViewCount(destinationName: string): Promise<void> {
    try {
      const supabase = supabaseAdmin

      const { error } = await supabase.rpc('increment_destination_view_count', {
        destination_name_param: destinationName
      })

      if (error) {
        console.warn('Failed to increment view count:', error)
      }
    } catch (error) {
      console.warn('Error incrementing view count:', error)
    }
  }

  /**
   * Get content quality statistics
   */
  static async getContentQualityStats(): Promise<{
    totalContent: number
    avgQualityScore: number
    highQualityCount: number
    lowQualityCount: number
    cacheHitRate: number
  } | null> {
    try {
      const supabase = supabaseAdmin

      const { data, error } = await supabase.rpc('get_content_quality_stats')

      if (error || !data || data.length === 0) {
        return null
      }

      const stats = data[0]
      return {
        totalContent: stats.total_content,
        avgQualityScore: parseFloat(stats.avg_quality_score),
        highQualityCount: stats.high_quality_count,
        lowQualityCount: stats.low_quality_count,
        cacheHitRate: parseFloat(stats.cache_hit_rate)
      }
    } catch (error) {
      console.warn('Error getting content quality stats:', error)
      return null
    }
  }

  /**
   * Clean up expired content
   */
  static async cleanupExpiredContent(): Promise<number> {
    try {
      const supabase = supabaseAdmin

      const { data, error } = await supabase.rpc('cleanup_expired_destination_content')

      if (error) {
        console.warn('Failed to cleanup expired content:', error)
        return 0
      }

      return data || 0
    } catch (error) {
      console.warn('Error cleaning up expired content:', error)
      return 0
    }
  }
}
