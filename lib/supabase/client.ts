import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Retry short-lived network glitches so Supabase auth refresh doesn't die on idle tabs.
const fetchWithBackoff: typeof fetch = async (url, init) => {
  let attempt = 0

  while (attempt < 3) {
    try {
      return await fetch(url, init)
    } catch (error) {
      const isBrowser = typeof navigator !== 'undefined'
      const offline = isBrowser && !navigator.onLine
      if (offline || attempt === 2) {
        throw error
      }

      const delayMs = 500 * 2 ** attempt
      await new Promise(resolve => setTimeout(resolve, delayMs))
      attempt += 1
    }
  }

  // Should never reach here because we either returned or threw in the loop.
  throw new Error('fetchWithBackoff exhausted retries without throwing')
}

// Export the createClient function for use in other services
export const createClient = () =>
  createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: fetchWithBackoff,
    },
  })

// Export a default client instance for backward compatibility
export const supabase = createClient()

if (typeof window !== 'undefined') {
  const toggleAutoRefresh = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  }

  window.addEventListener('online', toggleAutoRefresh)
  window.addEventListener('offline', toggleAutoRefresh)
  document.addEventListener('visibilitychange', toggleAutoRefresh)

  toggleAutoRefresh()
}

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      explore_places: {
        Row: {
          id: string
          user_id: string
          name: string
          full_name: string
          longitude: number
          latitude: number
          category: string | null
          context: string | null
          notes: string | null
          links_json: any
          metadata: any
          is_favorite: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          full_name: string
          longitude: number
          latitude: number
          category?: string | null
          context?: string | null
          notes?: string | null
          links_json?: any
          metadata?: any
          is_favorite?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          full_name?: string
          longitude?: number
          latitude?: number
          category?: string | null
          context?: string | null
          notes?: string | null
          links_json?: any
          metadata?: any
          is_favorite?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      user_trips: {
        Row: {
          id: string
          user_id: string
          name: string
          start_date: string
          end_date: string
          country_code: string
          focus_countries: string[] | null
          total_budget: number | null
          status: 'planning' | 'active' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          start_date: string
          end_date: string
          country_code: string
          focus_countries?: string[] | null
          total_budget?: number | null
          status?: 'planning' | 'active' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          start_date?: string
          end_date?: string
          country_code?: string
          focus_countries?: string[] | null
          total_budget?: number | null
          status?: 'planning' | 'active' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_days: {
        Row: {
          id: string
          trip_id: string
          date: string
          day_order: number
          base_location_name: string | null
          base_location_coordinates: string | null
          base_location_context: string | null
          base_locations_json: any | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          date: string
          day_order: number
          base_location_name?: string | null
          base_location_coordinates?: string | null
          base_location_context?: string | null
          base_locations_json?: any | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          date?: string
          day_order?: number
          base_location_name?: string | null
          base_location_coordinates?: string | null
          base_location_context?: string | null
          base_locations_json?: any | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_destinations: {
        Row: {
          id: string
          day_id: string
          name: string
          description: string | null
          coordinates: string
          category: 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity' | null
          rating: number | null
          image_url: string | null
          estimated_duration_hours: number | null
          opening_hours: string | null
          cost: number | null
          order_index: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          day_id: string
          name: string
          description?: string | null
          coordinates: string
          category?: 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity' | null
          rating?: number | null
          image_url?: string | null
          estimated_duration_hours?: number | null
          opening_hours?: string | null
          cost?: number | null
          order_index?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          day_id?: string
          name?: string
          description?: string | null
          coordinates?: string
          category?: 'city' | 'attraction' | 'restaurant' | 'hotel' | 'activity' | null
          rating?: number | null
          image_url?: string | null
          estimated_duration_hours?: number | null
          opening_hours?: string | null
          cost?: number | null
          order_index?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_destination_pois: {
        Row: {
          trip_destination_id: string
          poi_id: string
        }
        Insert: {
          trip_destination_id: string
          poi_id: string
        }
        Update: {
          trip_destination_id?: string
          poi_id?: string
        }
      }
      trip_destination_destinations: {
        Row: {
          trip_destination_id: string
          destination_id: string
        }
        Insert: {
          trip_destination_id: string
          destination_id: string
        }
        Update: {
          trip_destination_id?: string
          destination_id?: string
        }
      }
      trip_analytics: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          event_type: string
          event_data: any
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          user_id: string
          event_type: string
          event_data?: any
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          user_id?: string
          event_type?: string
          event_data?: any
          created_at?: string
        }
      }
      user_trip_preferences: {
        Row: {
          user_id: string
          default_country: string | null
          preferred_categories: string[] | null
          budget_range_min: number | null
          budget_range_max: number | null
          travel_style: string[] | null
          interests: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          default_country?: string | null
          preferred_categories?: string[] | null
          budget_range_min?: number | null
          budget_range_max?: number | null
          travel_style?: string[] | null
          interests?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          default_country?: string | null
          preferred_categories?: string[] | null
          budget_range_min?: number | null
          budget_range_max?: number | null
          travel_style?: string[] | null
          interests?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      user_personalization_profiles: {
        Row: {
          id: string
          user_id: string
          pace: 'leisurely' | 'balanced' | 'packed'
          mobility: 'walking' | 'mixed' | 'rideshare'
          interests: string[]
          budget_level: 'lean' | 'mid' | 'premium' | null
          dietary: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pace: 'leisurely' | 'balanced' | 'packed'
          mobility: 'walking' | 'mixed' | 'rideshare'
          interests?: string[]
          budget_level?: 'lean' | 'mid' | 'premium' | null
          dietary?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          pace?: 'leisurely' | 'balanced' | 'packed'
          mobility?: 'walking' | 'mixed' | 'rideshare'
          interests?: string[]
          budget_level?: 'lean' | 'mid' | 'premium' | null
          dietary?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      get_trip_with_details: {
        Args: {
          trip_uuid: string
        }
        Returns: any
      }
      calculate_trip_stats: {
        Args: {
          trip_uuid: string
        }
        Returns: any
      }
      duplicate_trip: {
        Args: {
          original_trip_id: string
          new_name: string
        }
        Returns: string
      }
      reorder_destinations: {
        Args: {
          day_uuid: string
          destination_ids: string[]
        }
        Returns: boolean
      }
    }
  }
}
