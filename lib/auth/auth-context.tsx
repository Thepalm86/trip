'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  needsReauthentication: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  clearReauthenticationFlag: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsReauthentication, setNeedsReauthentication] = useState(false)
  const hadSessionRef = useRef(false)
  const expectedSignOutRef = useRef(false)

  useEffect(() => {
    let active = true

    const applySession = (nextSession: Session | null, reason?: 'SIGNED_OUT' | 'ERROR') => {
      if (!active) return

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession) {
        hadSessionRef.current = true
        setNeedsReauthentication(false)
      } else if (
        hadSessionRef.current &&
        !expectedSignOutRef.current &&
        (reason === 'SIGNED_OUT' || reason === 'ERROR')
      ) {
        setNeedsReauthentication(true)
      }

      setLoading(false)
    }

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('AuthProvider: failed to fetch session', error)
          applySession(null, 'ERROR')
          return
        }

        applySession(data.session ?? null)
      })
      .catch(error => {
        console.error('AuthProvider: getSession threw', error)
        applySession(null, 'ERROR')
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' && !nextSession) {
        applySession(null, 'SIGNED_OUT')
        return
      }

      applySession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    expectedSignOutRef.current = true
    try {
      await supabase.auth.signOut()
    } finally {
      expectedSignOutRef.current = false
      setNeedsReauthentication(false)
    }
  }

  const clearReauthenticationFlag = () => setNeedsReauthentication(false)

  const value = {
    user,
    session,
    loading,
    needsReauthentication,
    signUp,
    signIn,
    signOut,
    clearReauthenticationFlag,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
