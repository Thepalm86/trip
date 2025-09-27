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
  created_at: string
  updated_at: string
}

export class ExploreApiService {
  private supabase = createClient()

  /**
   * Convert ExplorePlace to database record format
   */
  private toRecord(place: ExplorePlace, userId: string): Omit<ExplorePlaceRecord, 'created_at' | 'updated_at'> {
    const id = place.id ?? crypto.randomUUID()
    return {
      id,
      user_id: userId,
      name: place.name,
      full_name: place.fullName,
      longitude: place.coordinates[0],
      latitude: place.coordinates[1],
      category: place.category,
      context: place.context,
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
        .select('*')
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
        .insert(record)
        .select()
        .single()

      if (error) {
        throw error
      }

      return this.fromRecord(data)
    } catch (error) {
      console.error('ExploreApiService: Error adding explore place', error)
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
        .select()
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
        } catch (error) {
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
}

export const exploreApiService = new ExploreApiService()
