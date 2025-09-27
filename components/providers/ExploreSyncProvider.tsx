'use client'

import { useEffect } from 'react'
import { useExploreStore } from '@/lib/store/explore-store'
import { useAuth } from '@/lib/auth/auth-context'

export function ExploreSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { loadFromSupabase, syncWithSupabase, reset } = useExploreStore()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      reset()
      return
    }

    let cancelled = false

    const initializeExplorePlaces = async () => {
      try {
        await loadFromSupabase()
        if (cancelled) return
        await syncWithSupabase()
      } catch (error) {
        console.error('ExploreSyncProvider: Error initializing explore places', error)
      }
    }

    initializeExplorePlaces()

    return () => {
      cancelled = true
    }
  }, [user?.id, loading, loadFromSupabase, syncWithSupabase, reset])

  return <>{children}</>
}
