'use client'

import { PropsWithChildren } from 'react'
import { AppOnboarding } from '@/components/onboarding/AppOnboarding'

export function AppClientShell({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <AppOnboarding />
    </>
  )
}
