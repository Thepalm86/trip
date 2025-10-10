import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

if (serviceRoleKey.length < 40) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY appears to be a placeholder. Copy the full service role key from the Supabase dashboard.')
}

if (!/^[\x21-\x7E]+$/.test(serviceRoleKey)) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY contains invalid characters. Ensure smart quotes or ellipses are removed when copying the key.')
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
