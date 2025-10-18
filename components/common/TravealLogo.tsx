'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface TravealLogoProps {
  className?: string
  showWordmark?: boolean
}

export function TravealLogo({ className, showWordmark = true }: TravealLogoProps) {
  const gradientId = useId()
  const glowId = useId()

  return (
    <div className={cn('inline-flex items-center gap-3 text-white', className)}>
      <span
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-violet-500/25 ring-1 ring-white/10 shadow-[0_8px_24px_rgba(56,189,248,0.35)]"
        aria-hidden="true"
      >
        <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none" role="img">
          <defs>
            <linearGradient id={gradientId} x1="6" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60A5FA" />
              <stop offset="0.55" stopColor="#7C3AED" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
            <radialGradient id={glowId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(22 10) rotate(135) scale(13)">
              <stop stopColor="#C4B5FD" stopOpacity="0.9" />
              <stop offset="1" stopColor="#C4B5FD" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="12" fill={`url(#${gradientId})`} opacity="0.22" />
          <circle cx="16" cy="16" r="10.5" stroke={`url(#${gradientId})`} strokeWidth="1.5" opacity="0.9" />
          <path
            d="M16 8.5c.3 0 .58.12.79.33l6.38 6.38a1.12 1.12 0 0 1-.07 1.63l-6.44 5.24a1.06 1.06 0 0 1-1.33 0l-6.44-5.24a1.12 1.12 0 0 1-.07-1.63l6.38-6.38c.21-.21.49-.33.79-.33Z"
            fill="rgba(15,23,42,0.85)"
            stroke={`url(#${gradientId})`}
            strokeWidth="1.1"
          />
          <path
            d="m16.02 11.8 3.58 3.57-3.58 2.91-3.58-2.91 3.58-3.57Z"
            fill="white"
            fillOpacity="0.92"
          />
          <path d="m16.02 11.8 1.84 3.57-1.84 2.91-1.84-2.91 1.84-3.57Z" fill="#38BDF8" />
          <circle cx="22" cy="10" r="5" fill={`url(#${glowId})`} opacity="0.6" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="self-center text-lg font-semibold uppercase tracking-[0.22em] text-white leading-none">Traveal</span>
      ) : null}
    </div>
  )
}
