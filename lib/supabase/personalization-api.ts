'use client'

import { createClient, type Database } from '@/lib/supabase/client'

const supabase = createClient()

type ProfileRow = Database['public']['Tables']['user_personalization_profiles']['Row']
type ProfileInsert = Database['public']['Tables']['user_personalization_profiles']['Insert']

export type PersonalizationProfile = {
  id: string
  userId: string
  pace: ProfileRow['pace']
  mobility: ProfileRow['mobility']
  interests: string[]
  budgetLevel: ProfileRow['budget_level']
  dietary: string[] | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type PersonalizationProfileInput = {
  pace: ProfileRow['pace']
  mobility: ProfileRow['mobility']
  interests: string[]
  budgetLevel?: ProfileRow['budget_level'] | null
  dietary?: string[] | null
  notes?: string | null
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw error
  }
  const userId = data.user?.id
  if (!userId) {
    throw new Error('User is not authenticated')
  }
  return userId
}

function mapRow(row: ProfileRow): PersonalizationProfile {
  return {
    id: row.id,
    userId: row.user_id,
    pace: row.pace,
    mobility: row.mobility,
    interests: Array.isArray(row.interests) ? row.interests : [],
    budgetLevel: row.budget_level,
    dietary: row.dietary ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getPersonalizationProfile(): Promise<PersonalizationProfile | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('user_personalization_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapRow(data) : null
}

export async function upsertPersonalizationProfile(
  input: PersonalizationProfileInput
): Promise<PersonalizationProfile> {
  const userId = await requireUserId()
  const payload: ProfileInsert = {
    user_id: userId,
    pace: input.pace,
    mobility: input.mobility,
    interests: input.interests ?? [],
    budget_level: input.budgetLevel ?? null,
    dietary: input.dietary ?? null,
    notes: input.notes ?? null,
  }

  const { data, error } = await supabase
    .from('user_personalization_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Failed to persist personalization profile')
  }

  return mapRow(data)
}

export async function deletePersonalizationProfile(): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('user_personalization_profiles')
    .delete()
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}
