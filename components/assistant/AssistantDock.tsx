'use client'

import { useMemo, useState, useRef } from 'react'
import { MessageSquare, X, Send, Sparkles, Loader2 } from 'lucide-react'
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

export function AssistantDock() {
  const [isOpen, setIsOpen] = useState(false)
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

  const handleOpen = () => {
    setIsOpen(true)
    setError(null)
  }

  const handleClose = () => {
    setIsOpen(false)
    setError(null)
  }

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
        <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 px-4 py-6 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-slate-100">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span>Welcome to your Trip3 assistant!</span>
          </div>
          <p className="mt-3 text-slate-300">
            Ask anything about your itinerary, find ideas to fill open slots, or get quick answers about
            destinations on your map. I already know your current trip context.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-4 text-sm">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              'rounded-lg border px-4 py-3 shadow-sm',
              message.role === 'user'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-100'
                : 'border-slate-700/60 bg-slate-800/60 text-slate-100'
            )}
          >
            <div className="text-xs uppercase tracking-wide opacity-70">
              {message.role === 'user' ? 'You' : 'Trip3 Assistant'}
            </div>
            <div className="mt-2 whitespace-pre-wrap leading-relaxed">{message.content}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        aria-label="Open assistant chat"
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="relative m-4 flex w-full max-w-2xl flex-col rounded-2xl border border-slate-700/50 bg-slate-900/95 p-6 shadow-2xl">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-700/60 hover:text-slate-100"
              aria-label="Close assistant"
            >
              <X className="h-5 w-5" />
            </button>

            <header className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Trip3 Assistant</h2>
                <p className="text-sm text-slate-300">
                  {currentTrip
                    ? `Planning "${currentTrip.name}" is easier together.`
                    : 'Load a trip to start getting tailored guidance.'}
                </p>
              </div>
            </header>

            <section className="mb-4 flex-1 overflow-y-auto pr-2">
              {!currentTrip ? (
                <div className="rounded-lg bg-slate-800/60 px-4 py-6 text-sm text-slate-200">
                  Please load or create a trip to chat with the assistant.
                </div>
              ) : (
                renderMessages()
              )}
            </section>

            {followUps.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {followUps.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleFollowUp(suggestion)}
                    className="rounded-full border border-emerald-500/50 px-3 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  currentTrip ? 'Ask about your itinerary, schedule, or get inspiration...' : 'Load a trip to begin.'
                }
                disabled={!currentTrip || isSending}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!currentTrip || isSending || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
