'use client'

import { supabase } from '@/lib/supabase/client'

export async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) {
    throw new Error('Unable to authenticate assistant request')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  }
}
