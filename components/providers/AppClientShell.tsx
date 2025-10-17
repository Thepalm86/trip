'use client'

import { PropsWithChildren } from 'react'
import { usePathname } from 'next/navigation'
import { AppOnboarding } from '@/components/onboarding/AppOnboarding'
import { ExploreSyncProvider } from '@/components/providers/ExploreSyncProvider'
import { PersonalizationOverlayRoot } from '@/components/providers/PersonalizationOverlayRoot'

const ONBOARDING_BLOCKLIST = new Set(['/auth'])

export function AppClientShell({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const shouldShowOnboarding = pathname ? !ONBOARDING_BLOCKLIST.has(pathname) : true

  return (
    <ExploreSyncProvider>
      {children}
      <PersonalizationOverlayRoot />
      {shouldShowOnboarding ? <AppOnboarding /> : null}
    </ExploreSyncProvider>
  )
}
