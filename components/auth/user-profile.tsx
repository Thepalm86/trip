'use client'

import { useAuth } from '@/lib/auth/auth-context'

export function UserProfile() {
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      <div className="text-white text-sm">
        {user.email}
      </div>
      <button
        onClick={signOut}
        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200"
      >
        Sign Out
      </button>
    </div>
  )
}
