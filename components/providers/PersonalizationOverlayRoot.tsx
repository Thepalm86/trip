'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { usePersonalizationStore } from '@/lib/store/personalization-store'
import { PersonalizationModal } from '@/components/assistant/PersonalizationModal'

export function PersonalizationOverlayRoot() {
  const overlay = usePersonalizationStore((state) => state.overlay)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const container = document.createElement('div')
    container.id = 'personalization-overlay-root'
    document.body.appendChild(container)
    setPortalContainer(container)

    return () => {
      document.body.removeChild(container)
      setPortalContainer(null)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    if (overlay.isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }

    return
  }, [overlay.isOpen])

  const handleClose = useMemo(() => overlay.onClose ?? (() => {}), [overlay.onClose])

  if (!portalContainer) {
    return null
  }

  return createPortal(
    <PersonalizationModal isOpen={overlay.isOpen} onClose={handleClose} />,
    portalContainer
  )
}
