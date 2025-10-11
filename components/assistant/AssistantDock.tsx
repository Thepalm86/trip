'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Send, Sparkles, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import clsx from 'clsx'

import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { getAuthHeaders } from '@/lib/auth/get-auth-headers'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

interface AssistantResponseBody {
  reply: string
  metadata?: {
    model: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    costEstimateUsd?: number
  }
  followUps?: string[]
  blocked?: boolean
  reason?: string
}

type DockState = 'closed' | 'compact' | 'expanded'

export function AssistantDock() {
  const [dockState, setDockState] = useState<DockState>('closed')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationIdRef = useRef<string>(crypto.randomUUID())

  const currentTrip = useSupabaseTripStore((state) => state.currentTrip)
  const selectedDayId = useSupabaseTripStore((state) => state.selectedDayId)
  const selectedDestination = useSupabaseTripStore((state) => state.selectedDestination)

  const uiFingerprint = useMemo(() => {
    if (!currentTrip) {
      return undefined
    }

    const selectedDayIndex = selectedDayId
      ? currentTrip.days.findIndex((day) => day.id === selectedDayId)
      : -1
    const selectedDayOrder = selectedDayIndex >= 0 ? selectedDayIndex + 1 : undefined

    return {
      view: selectedDestination ? 'details' : 'timeline',
      selectedTripId: currentTrip.id,
      selectedDayOrder,
      highlightedDestinationId: selectedDestination?.id,
    } as const
  }, [currentTrip, selectedDayId, selectedDestination])

  const selectedDayOrder = uiFingerprint?.selectedDayOrder ?? null

  const isOpen = dockState !== 'closed'

  const handleOpen = useCallback((state: DockState = 'compact') => {
    setDockState(state === 'closed' ? 'compact' : state)
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    setDockState('closed')
    setError(null)
  }, [])

  const toggleDockSize = useCallback(() => {
    setDockState((prev) => (prev === 'expanded' ? 'compact' : 'expanded'))
  }, [])

  const panelWidthClass = dockState === 'expanded' ? 'w-[460px]' : 'w-[380px] sm:w-[400px]'
  const composerRows = dockState === 'expanded' ? 3 : 2
  const tripTitle = currentTrip?.name ?? 'Trip3 Concierge'
  const dayCount = currentTrip?.days?.length ?? 0
  const subtitle = currentTrip
    ? [
        dayCount ? `${dayCount} day${dayCount > 1 ? 's' : ''} planned` : null,
        selectedDayOrder ? `Focused on Day ${selectedDayOrder}` : null,
      ]
        .filter(Boolean)
        .join(' • ') || 'Your itinerary companion'
    : 'Load a trip to unlock tailored guidance.'

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleExternalOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: DockState }>).detail
      handleOpen(detail?.state ?? 'compact')
    }

    const handleExternalClose = () => {
      handleClose()
    }

    const handleExternalToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: DockState }>).detail
      if (detail?.state) {
        setDockState(detail.state)
        setError(null)
        return
      }

      setDockState((prev) => {
        if (prev === 'closed') {
          return 'compact'
        }
        if (prev === 'compact') {
          return 'expanded'
        }
        return 'compact'
      })
      setError(null)
    }

    window.addEventListener('assistant-dock:open', handleExternalOpen)
    window.addEventListener('assistant-dock:close', handleExternalClose)
    window.addEventListener('assistant-dock:toggle', handleExternalToggle)

    return () => {
      window.removeEventListener('assistant-dock:open', handleExternalOpen)
      window.removeEventListener('assistant-dock:close', handleExternalClose)
      window.removeEventListener('assistant-dock:toggle', handleExternalToggle)
    }
  }, [handleOpen, handleClose])

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || !currentTrip) {
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      createdAt: new Date().toISOString(),
    }

    appendMessage(userMessage)
    setInput('')
    setIsSending(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const body = {
        conversationId: conversationIdRef.current,
        message: {
          id: userMessage.id,
          role: 'user' as const,
          content: userMessage.content,
        },
        history: messages.slice(-10).map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
        })),
        uiFingerprint,
      }

      const response = await fetch('/api/assistant/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`Assistant request failed with status ${response.status}`)
      }

      const data = (await response.json()) as AssistantResponseBody
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? 'I was unable to generate a response.',
        createdAt: new Date().toISOString(),
      }

      appendMessage(assistantMessage)
      setFollowUps(data.followUps ?? [])

      if (data.blocked) {
        setError('The assistant could not respond to that request.')
      }
    } catch (err) {
      console.error('[assistant] send message failed', err)
      setError('Unable to reach the assistant. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void sendMessage(input)
  }

  const handleFollowUp = (suggestion: string) => {
    setInput(suggestion)
    void sendMessage(suggestion)
  }

  const renderMessages = () => {
    if (!messages.length) {
      return (
        <div className="assistant-section px-5 py-6 text-sm text-slate-100/90">
          <div className="flex items-center gap-2 text-emerald-200">
            <Sparkles className="h-4 w-4" />
            <span>Welcome to your Trip3 concierge.</span>
          </div>
          <p className="mt-3 text-slate-300">
            Ask about day plans, find signature experiences, or let me suggest refinements. I already understand your
            current trip details and selections.
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          const timestamp = (() => {
            try {
              return new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            } catch {
              return ''
            }
          })()

          return (
            <div key={message.id} className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
              <div
                className={clsx(
                  'max-w-[85%] rounded-2xl border px-4 py-3 shadow-lg backdrop-blur',
                  isUser ? 'assistant-message-user' : 'assistant-message-assistant'
                )}
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
                  {isUser ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  )}
                  <span>{isUser ? 'You' : 'Trip3 Assistant'}</span>
                  {timestamp ? (
                    <>
                      <span className="text-slate-500">•</span>
                      <span className="tracking-normal text-slate-400">{timestamp}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-slate-100/95">
                  {message.content}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-3 sm:inset-y-6 sm:right-6 sm:bottom-auto">
      {isOpen ? (
        <div
          className={clsx(
            'assistant-panel relative flex max-h-[720px] w-full max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden text-slate-100 transition-all duration-200 sm:max-w-none',
            panelWidthClass
          )}
        >
          {isSending ? (
            <div className="absolute inset-x-0 top-0 h-1 overflow-hidden">
              <div className="assistant-progress h-full bg-gradient-to-r from-emerald-300 via-sky-300 to-indigo-400" />
            </div>
          ) : null}

          <header className="relative bg-gradient-to-br from-white/5 via-white/[0.04] to-white/[0.02] px-6 pb-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-inner ring-1 ring-white/15">
                  <Sparkles className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.32em] text-slate-300/70">Trip3 Concierge</p>
                  <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {tripTitle}
                  </h2>
                  <p className="text-sm text-slate-300">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleDockSize}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-slate-200/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                  aria-label={dockState === 'expanded' ? 'Collapse assistant dock' : 'Expand assistant dock'}
                >
                  {dockState === 'expanded' ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-red-300/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/60"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {currentTrip ? (
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-200/80">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-300/90" />
                  <span>{selectedDestination ? 'Detail view active' : 'Timeline overview'}</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-emerald-200/80">Days in trip</span>
                  <span className="font-medium text-slate-100">{dayCount || '—'}</span>
                </div>
              </div>
            ) : null}
          </header>

          <section className="assistant-scroll flex-1 overflow-y-auto px-6 pb-4 pt-5">
            {!currentTrip ? (
              <div className="assistant-section px-5 py-6 text-sm text-slate-100/85">
                Load or create a trip to start collaborating with the Trip3 concierge. I will adapt responses to the
                itinerary you select.
              </div>
            ) : (
              renderMessages()
            )}
          </section>

          {followUps.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-6 pb-4">
              {followUps.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleFollowUp(suggestion)}
                  className="assistant-chip px-3 py-1.5 text-xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <div
              className="mx-6 mb-3 rounded-xl px-4 py-3 text-sm text-rose-200"
              style={{
                background: 'var(--assistant-error)',
                border: '1px solid var(--assistant-error-border)',
              }}
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="border-t border-white/5 bg-black/10 px-6 pb-6 pt-4">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  currentTrip ? 'Ask about your itinerary, open slots, or get a curated idea...' : 'Load a trip to begin.'
                }
                disabled={!currentTrip || isSending}
                rows={composerRows}
                className="assistant-glass-input flex-1 resize-none bg-transparent px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!currentTrip || isSending || !input.trim()}
                className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 text-slate-900 shadow-lg transition hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-300/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {dockState === 'closed' ? (
        <button
          type="button"
          onClick={() => handleOpen('compact')}
          className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgba(10,18,33,0.88)] px-4 py-2 text-sm text-slate-100 shadow-2xl backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 sm:hidden"
          aria-label="Open Trip3 assistant"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 text-slate-900 shadow-md">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[11px] uppercase tracking-[0.28em] text-slate-300/80">Trip3</span>
            <span className="text-sm font-medium text-slate-100">Concierge</span>
          </div>
        </button>
      ) : null}
    </div>
  )
}
