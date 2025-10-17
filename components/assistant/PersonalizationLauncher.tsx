'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles, Loader2, Check } from 'lucide-react'
import clsx from 'clsx'

import { usePersonalizationStore } from '@/lib/store/personalization-store'

function GlobalPersonalizationModalTrigger({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const setOverlayState = usePersonalizationStore((state) => state.setOverlayState)

  useEffect(() => {
    setOverlayState({ isOpen, onClose })
    return () => {
      setOverlayState({ isOpen: false, onClose: undefined })
    }
  }, [isOpen, onClose, setOverlayState])

  return null
}

interface PersonalizationLauncherProps {
  variant?: 'header' | 'inline'
  className?: string
}

export function PersonalizationLauncher({ variant = 'header', className }: PersonalizationLauncherProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const profile = usePersonalizationStore((state) => state.profile)
  const status = usePersonalizationStore((state) => state.status)
  const isSaving = usePersonalizationStore((state) => state.isSaving)
  const hasDismissedPrompt = usePersonalizationStore((state) => state.hasDismissedPrompt)
  const loadProfile = usePersonalizationStore((state) => state.loadProfile)

  useEffect(() => {
    if (status === 'idle') {
      void loadProfile()
    }
  }, [status, loadProfile])

  const isLoading = status === 'loading'
  const isPersonalized = Boolean(profile)
  const isInline = variant === 'inline'

  const ariaLabel = isPersonalized ? 'Edit personalization profile' : 'Open personalization setup'

  const promptBadge = useMemo(() => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing
        </span>
      )
    }

    if (isPersonalized) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-200">
          <Check className="h-3 w-3" />
          Active
        </span>
      )
    }

    if (hasDismissedPrompt) {
      return null
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-200">
        New
      </span>
    )
  }, [isLoading, isPersonalized, hasDismissedPrompt])

  const handleOpen = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={ariaLabel}
        className={clsx(
          'group flex items-center gap-2 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70',
          isInline
            ? 'border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white'
            : 'border-white/10 bg-white/[0.04] px-3 py-2 hover:border-white/20 hover:bg-white/[0.07]',
          className
        )}
      >
        <span
          className={clsx(
            'flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 text-slate-900 shadow-md transition group-hover:shadow-emerald-500/40',
            isInline ? 'h-7 w-7 text-[11px]' : 'h-8 w-8'
          )}
        >
          {isSaving ? (
            <Loader2 className={clsx('animate-spin', isInline ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          ) : (
            <Sparkles className={clsx(isInline ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          )}
        </span>
        <div className={clsx('flex flex-col items-start leading-tight', isInline ? 'gap-0.5' : 'gap-0')}>
          <span
            className={clsx('uppercase tracking-[0.32em] text-white/50', isInline ? 'text-[9px]' : 'text-[10px]')}
          >
            {isPersonalized ? 'Personalized' : 'Personalize'}
          </span>
          <span className={clsx('font-medium text-white', isInline ? 'text-[11px]' : 'text-xs')}>
            {isPersonalized ? 'Profile in use' : 'Tune recommendations'}
          </span>
        </div>
        {promptBadge ? <span className={clsx(isInline ? 'ml-2' : '', 'shrink-0')}>{promptBadge}</span> : null}
      </button>

      {/* The modal is rendered via portal in AppClientShell */}
      <GlobalPersonalizationModalTrigger isOpen={isModalOpen} onClose={handleClose} />
    </>
  )
}
