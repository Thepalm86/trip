'use client'

import { supabase } from '@/lib/supabase/client'

export async function getAuthHeaders(): Promise<{ Authorization: string } | null> {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error('[auth] getSession error', error)
    }

    let accessToken = data.session?.access_token

    if (!accessToken) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.error('[auth] refreshSession error', refreshError)
      }
      accessToken = refreshData.session?.access_token
    }

    if (!accessToken) {
      return null
    }

    return {
      Authorization: `Bearer ${accessToken}`,
    }
  } catch (error) {
    console.error('[auth] getAuthHeaders unexpected error', error)
    return null
  }
}
