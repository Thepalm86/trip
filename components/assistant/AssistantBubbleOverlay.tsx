'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { MessageSquareText, Send, Sparkles } from 'lucide-react'

import { useAuth } from '@/lib/auth/auth-context'
import { getAuthHeaders } from '@/lib/auth/get-auth-headers'
import { useAssistantActionBridge } from '@/lib/ai-assistant/ui/action-bridge'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import type { AssistantUiAction } from '@/lib/assistant/actions'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  metadata?: {
    actions?: AssistantUiAction[]
    followUps?: string[]
  }
}

interface AssistantResponseBody {
  reply: string
  actions?: AssistantUiAction[]
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

const WELCOME_MESSAGE = `Hey there! I'm your Traveal assistant.
Ask me to fill gaps in your itinerary, surface hidden gems, or plot ideas on the map.`

export function AssistantBubbleOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conversationIdRef = useRef<string>(crypto.randomUUID())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const dispatchAssistantActions = useAssistantActionBridge()
  const { needsReauthentication } = useAuth()

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

  useEffect(() => {
    if (needsReauthentication) {
      setError('Please sign in again to chat with the Journey Curator.')
    }
  }, [needsReauthentication])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (messages.length === 0) {
      // Delay welcome bubble slightly for a subtle reveal
      const timeout = window.setTimeout(() => {
        setMessages([
          {
            id: 'assistant-welcome',
            role: 'assistant',
            content: WELCOME_MESSAGE,
            createdAt: new Date().toISOString(),
          },
        ])
      }, 120)

      return () => window.clearTimeout(timeout)
    }
  }, [isOpen, messages.length])

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    const scrollToBottom = () => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }

    scrollToBottom()
  }, [messages, isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !currentTrip) {
        return
      }

      try {
        setIsSending(true)
        setError(null)

        const headers = await getAuthHeaders()
        if (!headers) {
          setError('Please sign in again to chat with the Journey Curator.')
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

        const history = [...messages.filter((msg) => msg.id !== 'assistant-welcome'), userMessage].map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
        }))

        const response = await fetch('/api/assistant/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            message: {
              id: userMessage.id,
              role: 'user' as const,
              content: userMessage.content,
            },
            history,
            uiFingerprint,
          }),
        })

        if (!response.ok) {
          if (response.status === 401) {
            setError('Your session expired. Please sign in again to continue the conversation.')
            return
          }
          throw new Error(`Assistant request failed with status ${response.status}`)
        }

        const data = (await response.json()) as AssistantResponseBody
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply ?? 'I was unable to generate a response.',
          createdAt: new Date().toISOString(),
          metadata: {
            actions: data.actions,
            followUps: data.followUps,
          },
        }

        appendMessage(assistantMessage)
        await dispatchAssistantActions(data.actions ?? [], {
          conversationId: conversationIdRef.current,
          responseMessageId: assistantMessage.id,
        })

        if (data.blocked) {
          setError('The assistant could not respond to that request.')
        }
      } catch (error_) {
        console.error('[assistant] send message failed', error_)
        const message =
          error_ instanceof Error ? error_.message : typeof error_ === 'string' ? error_ : 'Unknown error occurred'

        if (message.toLowerCase().includes('authenticate')) {
          setError('Please sign in again to chat with the Journey Curator.')
        } else {
          setError('Unable to reach the assistant. Please try again.')
        }
      } finally {
        setIsSending(false)
      }
    },
    [appendMessage, currentTrip, dispatchAssistantActions, messages, uiFingerprint]
  )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendMessage(input)
  }

  const handleFollowUp = (suggestion: string) => {
    setInput(suggestion)
    void sendMessage(suggestion)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(input)
    }
  }

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev
      if (!next) {
        setInput('')
        setError(null)
      } else {
        window.setTimeout(() => composerRef.current?.focus(), 180)
      }
      return next
    })
  }

  return (
    <div className="pointer-events-none fixed inset-y-5 right-4 z-[60] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-4 sm:right-6 sm:w-[min(420px,calc(100vw-3rem))]">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleToggle}
          className={clsx(
            'pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition backdrop-blur',
            isOpen
              ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100 hover:border-emerald-200/80'
              : 'border-white/15 bg-slate-900/60 text-slate-200 hover:border-white/30 hover:text-white'
          )}
          aria-expanded={isOpen}
          aria-controls="assistant-bubble-stack"
        >
          <Sparkles className="h-4 w-4" />
          {isOpen ? 'Hide Assistant' : 'Open Assistant'}
        </button>
      </div>

      {isOpen ? (
        <div className="pointer-events-auto flex h-full min-h-0 flex-col gap-4">
          <div
            id="assistant-bubble-stack"
            ref={scrollContainerRef}
            className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1"
          >
            {messages.length ? (
              messages.map((message) => {
                const isUser = message.role === 'user'
                const followUpChips = isUser ? [] : message.metadata?.followUps ?? []
                return (
                  <div
                    key={message.id}
                    className={clsx(
                      'flex w-full',
                      isUser ? 'justify-start pr-6' : 'justify-end pl-4'
                    )}
                  >
                    <div
                      className={clsx(
                        'group relative max-w-[85%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-lg shadow-black/40 transition',
                        isUser
                          ? 'border-white/15 bg-slate-900/80 text-slate-100'
                          : 'border-emerald-300/50 bg-emerald-500/15 text-emerald-50 backdrop-blur-md'
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
                        {isUser ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                            <span>You</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                            <span>Assistant</span>
                          </>
                        )}
                      </div>
                      <div className="whitespace-pre-line text-[0.95rem]">{message.content}</div>
                      {followUpChips.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {followUpChips.map((chip, index) => (
                            <button
                              key={chip ?? index}
                              type="button"
                              onClick={() => handleFollowUp(chip)}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:border-white/30 hover:text-white"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex w-full justify-end pr-4">
                <div className="max-w-[80%] rounded-3xl border border-emerald-300/50 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-50 shadow-lg shadow-black/30">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Assistant</span>
                  </div>
                  <div className="whitespace-pre-line text-[0.95rem]">{WELCOME_MESSAGE}</div>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="pointer-events-auto rounded-3xl border border-white/10 bg-slate-900/70 p-3 shadow-xl shadow-black/50 backdrop-blur"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="assistant-composer" className="sr-only">
                  Message the assistant
                </label>
                <textarea
                  ref={composerRef}
                  id="assistant-composer"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask for ideas or help with your itinerary..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-300/60"
                  disabled={isSending}
                />
              </div>
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className={clsx(
                  'inline-flex h-10 w-10 items-center justify-center rounded-full border transition',
                  isSending || !input.trim()
                    ? 'border-white/10 bg-white/5 text-slate-400'
                    : 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100 hover:border-emerald-200 hover:text-white'
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {error ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-rose-300">
                <MessageSquareText className="h-4 w-4" />
                {error}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  )
}
