'use client'

import { createClient } from '@/lib/supabase/client'
import { ExplorePlace } from '@/types'

export interface ExplorePlaceRecord {
  id: string
  user_id: string
  name: string
  full_name: string
  longitude: number
  latitude: number
  category?: string
  context?: string
  notes?: string | null
  links_json?: unknown
  metadata?: unknown
  is_favorite?: boolean | null
  created_at: string
  updated_at: string
}

export class ExploreApiService {
  private supabase = createClient()

  /**
   * Convert ExplorePlace to database record format
   */
  private toRecord(place: ExplorePlace, userId: string): Omit<ExplorePlaceRecord, 'created_at' | 'updated_at'> {
    const id = this.normalizeRecordId(
      (place.metadata?.sourceId as string | undefined) ?? place.id
    )
    const hasNotes = place.notes ? place.notes.trim().length > 0 : false
    const links = Array.isArray(place.links) ? place.links : []
    const metadata = place.metadata && Object.keys(place.metadata).length > 0 ? place.metadata : null

    return {
      id,
      user_id: userId,
      name: place.name,
      full_name: place.fullName,
      longitude: place.coordinates[0],
      latitude: place.coordinates[1],
      category: place.category,
      context: place.context,
      notes: hasNotes ? place.notes : null,
      links_json: links,
      metadata,
      is_favorite: place.isFavorite ?? false,
    }
  }

  /**
   * Convert database record to ExplorePlace format
   */
  private fromRecord(record: ExplorePlaceRecord): ExplorePlace {
    return {
      id: record.id,
      name: record.name,
      fullName: record.full_name,
      coordinates: [record.longitude, record.latitude] as [number, number],
      category: record.category,
      context: record.context,
      notes: (record.notes ?? undefined) as string | undefined,
      links: Array.isArray(record.links_json) ? record.links_json as ExplorePlace['links'] : undefined,
      metadata: (record.metadata && typeof record.metadata === 'object' ? record.metadata : undefined) as ExplorePlace['metadata'],
      isFavorite: record.is_favorite ?? false,
      source: 'cache',
    }
  }

  /**
   * Get all explore places for the current user
   */
  async getExplorePlaces(): Promise<ExplorePlace[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await this.supabase
        .from('explore_places')
        .select('id,user_id,name,full_name,longitude,latitude,category,context,notes,links_json,metadata,is_favorite,created_at,updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data.map(record => this.fromRecord(record))
    } catch (error) {
      console.error('ExploreApiService: Error fetching explore places', error)
      throw error
    }
  }

  /**
   * Add a new explore place
   */
  async addExplorePlace(place: ExplorePlace): Promise<ExplorePlace> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const record = this.toRecord(place, user.id)

      const { data, error } = await this.supabase
        .from('explore_places')
        .upsert(record, { onConflict: 'id' })
        .select('id,user_id,name,full_name,longitude,latitude,category,context,notes,links_json,metadata,is_favorite,created_at,updated_at')
        .single()

      if (error) {
        if (this.isDuplicateError(error)) {
          console.warn('ExploreApiService: Duplicate detected during upsert, fetching existing record', {
            placeId: record.id,
            userId: user.id,
            error,
          })

      const { data: existing, error: fetchError } = await this.supabase
            .from('explore_places')
            .select('id,user_id,name,full_name,longitude,latitude,category,context,notes,links_json,metadata,is_favorite,created_at,updated_at')
            .eq('id', record.id)
            .eq('user_id', user.id)
            .single()

          if (fetchError) {
            throw fetchError
          }

          return this.fromRecord(existing)
        }

        throw error
      }

      return this.fromRecord(data)
    } catch (error) {
      console.error('ExploreApiService: Error adding explore place', {
        error,
        message: error instanceof Error ? error.message : undefined,
        errorDetails: (error as any)?.details,
        errorHint: (error as any)?.hint,
        errorCode: (error as any)?.code,
      })
      throw error
    }
  }

  /**
   * Remove an explore place
   */
  async removeExplorePlace(placeId: string): Promise<void> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { error } = await this.supabase
        .from('explore_places')
        .delete()
        .eq('id', placeId)
        .eq('user_id', user.id)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('ExploreApiService: Error removing explore place', error)
      throw error
    }
  }

  /**
   * Update an explore place
   */
  async updateExplorePlace(place: ExplorePlace): Promise<ExplorePlace> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const record = this.toRecord(place, user.id)

      const { data, error } = await this.supabase
        .from('explore_places')
        .update(record)
        .eq('id', place.id)
        .eq('user_id', user.id)
        .select('id,user_id,name,full_name,longitude,latitude,category,context,notes,links_json,metadata,is_favorite,created_at,updated_at')
        .single()

      if (error) {
        throw error
      }

      return this.fromRecord(data)
    } catch (error) {
      console.error('ExploreApiService: Error updating explore place', error)
      throw error
    }
  }

  /**
   * Sync explore places with the database
   */
  async syncExplorePlaces(places: ExplorePlace[]): Promise<ExplorePlace[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Get existing places from database
      const existingPlaces = await this.getExplorePlaces()
      const existingIds = new Set(existingPlaces.map(p => p.id))

      // Add new places
      const newPlaces = places.filter(p => !existingIds.has(p.id))
      const addedPlaces: ExplorePlace[] = []

      for (const place of newPlaces) {
        try {
          const addedPlace = await this.addExplorePlace(place)
          addedPlaces.push(addedPlace)
        } catch {
          // Skip if place already exists (unique constraint)
          console.warn('ExploreApiService: Place already exists, skipping', place.name)
        }
      }

      return [...existingPlaces, ...addedPlaces]
    } catch (error) {
      console.error('ExploreApiService: Error syncing explore places', error)
      throw error
    }
  }

  private isDuplicateError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false
    }

    const normalised = error as { code?: string; message?: string }
    const message = normalised.message?.toLowerCase() ?? ''

    return (
      normalised.code === '23505' ||
      normalised.code === '409' ||
      message.includes('duplicate key') ||
      message.includes('already exists')
    )
  }

  private isValidUuid(value?: string | null): boolean {
    if (!value) {
      return false
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(value)
  }

  private normalizeRecordId(candidate?: string): string {
    if (this.isValidUuid(candidate)) {
      return candidate as string
    }

    return crypto.randomUUID()
  }
}

export const exploreApiService = new ExploreApiService()
