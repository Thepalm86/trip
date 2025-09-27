'use client'

import { PropsWithChildren } from 'react'
import { usePathname } from 'next/navigation'
import { AppOnboarding } from '@/components/onboarding/AppOnboarding'

const ONBOARDING_BLOCKLIST = new Set(['/auth'])

export function AppClientShell({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const shouldShowOnboarding = pathname ? !ONBOARDING_BLOCKLIST.has(pathname) : true

  return (
    <>
      {children}
      {shouldShowOnboarding ? <AppOnboarding /> : null}
    </>
  )
}
