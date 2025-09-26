'use client'

import { useEffect } from 'react'
import { useExploreStore } from '@/lib/store/explore-store'

export function ExploreSyncProvider({ children }: { children: React.ReactNode }) {
  const { loadFromSupabase, syncWithSupabase } = useExploreStore()

  useEffect(() => {
    // Load explore places from Supabase when the app starts
    const initializeExplorePlaces = async () => {
      try {
        await loadFromSupabase()
        // Also sync any local changes to Supabase
        await syncWithSupabase()
      } catch (error) {
        console.error('ExploreSyncProvider: Error initializing explore places', error)
      }
    }

    initializeExplorePlaces()
  }, [loadFromSupabase, syncWithSupabase])

  return <>{children}</>
}
