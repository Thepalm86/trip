import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Export the createClient function for use in other services
export const createClient = () => createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Export a default client instance for backward compatibility
export const supabase = createClient()

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
