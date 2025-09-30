'use client'

import { useMemo, useState } from 'react'
import { Copy, Check, X } from 'lucide-react'
import type { Trip } from '@/types'

interface ShareTripModalProps {
  isOpen: boolean
  onClose: () => void
  trip: Trip
}

export function ShareTripModal({ isOpen, onClose, trip }: ShareTripModalProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.location.href
    }
    return process.env.NEXT_PUBLIC_SITE_URL ?? ''
  }, [])

  if (!isOpen) {
    return null
  }

  const handleCopy = async () => {
    if (!shareUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('ShareTripModal: failed to copy link', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Share this trip</h3>
            <p className="text-sm text-white/60">Invite your travel partners to view the plan.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            type="button"
            aria-label="Close share modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div>
            <p className="text-sm text-white/70 mb-1">Trip name</p>
            <p className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white/90 text-sm">
              {trip.name || 'Untitled trip'}
            </p>
          </div>

          <div>
            <p className="text-sm text-white/70 mb-2">Share link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/80">
                <span className="block truncate">{shareUrl || 'Set NEXT_PUBLIC_SITE_URL to generate a share link.'}</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-blue-500/30"
                disabled={!shareUrl}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>

          <p className="text-xs text-white/40">
            Sharing allows collaborators to view this itinerary. Edit permissions and advanced sharing controls are coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
