'use client'

import { PropsWithChildren } from 'react'
import { usePathname } from 'next/navigation'
import { AppOnboarding } from '@/components/onboarding/AppOnboarding'
import { ExploreSyncProvider } from '@/components/providers/ExploreSyncProvider'

const ONBOARDING_BLOCKLIST = new Set(['/auth'])

export function AppClientShell({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const shouldShowOnboarding = pathname ? !ONBOARDING_BLOCKLIST.has(pathname) : true

  return (
    <ExploreSyncProvider>
      {children}
      {shouldShowOnboarding ? <AppOnboarding /> : null}
    </ExploreSyncProvider>
  )
}
