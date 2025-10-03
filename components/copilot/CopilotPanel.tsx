'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, X, Loader2, Compass, NotebookPen, MapPin, Wand2 } from 'lucide-react'
import { evaluateCopilotTurn } from '@/lib/copilot/harness/conversation-harness'
import { copilotActionBus } from '@/lib/copilot/action-bus'
import {
  CopilotAction,
  CopilotActionEvent,
  CopilotActionEventType,
  CopilotSuggestion,
  CopilotSuggestionAction,
} from '@/lib/copilot/types'
import { snapshotCopilotRuntimeContext } from '@/lib/copilot/runtime-context'
import { generateSmartSuggestions } from '@/lib/copilot/suggestions'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { useTripStore } from '@/lib/store/trip-store'
import { useExploreStore } from '@/lib/store/explore-store'

interface CopilotPanelProps {
  onClose?: () => void
  className?: string
}

type MessageRole = 'user' | 'copilot'

type CopilotMessage = {
  id: string
  role: MessageRole
  text: string
  actions?: CopilotAction[]
  suggestions?: CopilotSuggestion[]
  variant?: 'default' | 'nudge' | 'suggestion'
}

type ToastTone = 'success' | 'info' | 'error'

type CopilotToast = {
  id: string
  message: string
  tone: ToastTone
}

const QUICK_START_SUGGESTIONS = [
  'Summarize my trip',
  'Show the map for today',
  'Add note "Book restaurant" to Day 2',
]

const STATUS_COLORS: Record<'ready' | 'thinking', string> = {
  ready: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.35)]',
  thinking: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]',
}

const formatActionLabel = (action: CopilotAction): string => {
  switch (action.type) {
    case 'selectDay':
      return 'Focus day'
    case 'focusDestination':
      return 'Focus destination'
    case 'highlightMapArea':
      return 'Show on map'
    case 'openModal':
      return action.payload.modalId === 'destinationOverview'
        ? 'View details'
        : 'Open modal'
    case 'mutateTrip': {
      const mutation = action.payload.mutation ?? ''
      if (mutation === 'addDay') return 'Add a day'
      if (mutation === 'removeDestination') return 'Remove destination'
      if (mutation === 'moveMaybeToDay') return 'Schedule destination'
      if (mutation === 'updateDayNotes') return 'Update notes'
      return 'Apply change'
    }
    default:
      return 'Do it'
  }
}

const toneFromEvent = (type: CopilotActionEventType): ToastTone => {
  if (type === 'actionFailed') return 'error'
  if (type === 'actionRejected') return 'info'
  return 'success'
}

const messageFromEvent = (event: CopilotActionEvent): string => {
  const base = event.result?.message
  if (base) return base
  switch (event.type) {
    case 'actionCompleted':
      return 'Done.'
    case 'actionRejected':
      return 'Could not complete that.'
    case 'actionFailed':
      return 'Something went wrong.'
    default:
      return 'Action dispatched.'
  }
}

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

export function CopilotPanel({ onClose, className }: CopilotPanelProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([{
    id: generateId(),
    role: 'copilot',
    text: "Hi! I'm your Trip Copilot. Ask me to summarize your itinerary, fill empty days, or tidy up notes—I'll keep everything in sync.",
  }])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<'ready' | 'thinking'>('ready')
  const [toasts, setToasts] = useState<CopilotToast[]>([])
  const [pendingSuggestionKey, setPendingSuggestionKey] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const supabaseLastUpdate = useSupabaseTripStore((state) => state.lastUpdate)
  const supabaseMaybeLocations = useSupabaseTripStore((state) => state.maybeLocations)
  const supabaseSelectedDayId = useSupabaseTripStore((state) => state.selectedDayId)
  const localTrip = useTripStore((state) => state.currentTrip)
  const localSelectedDayId = useTripStore((state) => state.selectedDayId)
  const exploreActivePlaces = useExploreStore((state) => state.activePlaces)
  const exploreSelectedPlace = useExploreStore((state) => state.selectedPlace)
  const exploreRouteSelection = useExploreStore((state) => state.routeSelection)

  const liveSuggestions = useMemo(() => {
    return generateSmartSuggestions(snapshotCopilotRuntimeContext())
  }, [
    supabaseLastUpdate,
    supabaseMaybeLocations,
    supabaseSelectedDayId,
    localTrip,
    localSelectedDayId,
    exploreActivePlaces,
    exploreSelectedPlace,
    exploreRouteSelection,
  ])

  useEffect(() => {
    const unsubscribe = copilotActionBus.subscribe((event) => {
      if (event.type === 'actionDispatched') {
        setStatus('thinking')
        return
      }
      const toast: CopilotToast = {
        id: generateId(),
        message: messageFromEvent(event),
        tone: toneFromEvent(event.type),
      }
      setToasts((prev) => [...prev, toast])
      setStatus('ready')
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((toast) => (
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id))
      }, 4000)
    ))
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isProcessing])

  const handleSubmit = async (value?: string) => {
    const trimmed = (value ?? inputValue).trim()
    if (!trimmed) return

    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: 'user', text: trimmed },
    ])
    setInputValue('')
    setIsProcessing(true)
    setStatus('thinking')

    try {
      const output = await evaluateCopilotTurn(trimmed, { dispatchActions: true })
      const messageVariant: CopilotMessage['variant'] = output.suggestions?.length
        ? 'suggestion'
        : output.actions.length
          ? 'default'
          : undefined
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'copilot',
          text: output.response,
          actions: output.actions,
          suggestions: output.suggestions,
          variant: messageVariant,
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'copilot',
          text: 'I ran into an issue running that. Try again in a moment.',
        },
      ])
      setToasts((prev) => [
        ...prev,
        { id: generateId(), message: 'Copilot request failed.', tone: 'error' },
      ])
    } finally {
      setIsProcessing(false)
      setStatus('ready')
    }
  }

  const handleAction = async (action: CopilotAction) => {
    await copilotActionBus.dispatch(action)
  }

  const handleSuggestionActions = async (
    suggestionId: string,
    actionSet: CopilotSuggestionAction,
  ) => {
    if (!actionSet.actions.length) return
    const key = `${suggestionId}-${actionSet.label}`
    setPendingSuggestionKey(key)
    try {
      for (const action of actionSet.actions) {
        await copilotActionBus.dispatch(action)
      }
    } finally {
      setPendingSuggestionKey((current) => (current === key ? null : current))
    }
  }

  const handleSuggestion = (suggestion: string) => {
    handleSubmit(suggestion)
  }

  const statusLabel = useMemo(() => (status === 'thinking' ? 'Thinking' : 'Ready'), [status])

  return (
    <div
      className={`group relative flex h-full w-full max-w-[360px] flex-col rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_25px_55px_rgba(15,23,42,0.55)] backdrop-blur-lg transition hover:shadow-[0_35px_75px_rgba(15,23,42,0.65)] ${className ?? ''}`}
    >
      <div className="flex items-center justify-between rounded-t-3xl border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-900/40">
            <Sparkles className="h-5 w-5" />
            <span className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Trip Copilot</p>
            <p className="text-xs text-white/60">{statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-xs text-white/50 transition group-hover:text-white/70 sm:block">Ctrl + / for tips</div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label="Close copilot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {liveSuggestions.length > 0 && (
          <SuggestionShelf
            suggestions={liveSuggestions}
            onTrigger={handleSuggestionActions}
            pendingKey={pendingSuggestionKey}
          />
        )}
        {messages.map((message) => (
          <CopilotBubble
            key={message.id}
            role={message.role}
            text={message.text}
            variant={message.variant}
            actions={message.actions}
            onAction={handleAction}
            suggestions={message.suggestions}
            onSuggestionAction={handleSuggestionActions}
            pendingSuggestionKey={pendingSuggestionKey}
          />
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_START_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestion(suggestion)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
          className="flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/50 px-3 py-2 shadow-inner shadow-slate-900/40"
        >
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask anything about your trip…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30"
          >
            Send
          </button>
        </form>
      </div>

      {toasts.length > 0 && (
        <div className="pointer-events-none absolute -right-4 -top-4 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2 text-sm shadow-xl backdrop-blur ${toast.tone === 'success' ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-50' : ''} ${toast.tone === 'error' ? 'border-rose-400/30 bg-rose-500/20 text-rose-50' : ''} ${toast.tone === 'info' ? 'border-sky-400/30 bg-sky-500/20 text-sky-50' : ''}`}
            >
              {toast.tone === 'success' && <Compass className="h-4 w-4" />}
              {toast.tone === 'info' && <MapPin className="h-4 w-4" />}
              {toast.tone === 'error' && <NotebookPen className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface CopilotBubbleProps {
  role: MessageRole
  text: string
  variant?: 'default' | 'nudge' | 'suggestion'
  actions?: CopilotAction[]
  onAction?: (action: CopilotAction) => void
  suggestions?: CopilotSuggestion[]
  onSuggestionAction?: (suggestionId: string, actionSet: CopilotSuggestionAction) => void
  pendingSuggestionKey?: string | null
}

function CopilotBubble({
  role,
  text,
  actions,
  suggestions,
  variant = 'default',
  onAction,
  onSuggestionAction,
  pendingSuggestionKey,
}: CopilotBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
          isUser
            ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
            : variant === 'nudge'
              ? 'bg-amber-100/10 border border-amber-300/20 text-amber-50'
              : variant === 'suggestion'
                ? 'bg-indigo-500/10 border border-indigo-300/20 text-indigo-50'
                : 'bg-white/7 border border-white/10 text-white/90'
        }`}
      >
        <p className="whitespace-pre-line">{text}</p>
        {!isUser && actions && actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.type + JSON.stringify(action.payload ?? {})}
                onClick={() => onAction?.(action)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                {formatActionLabel(action)}
              </button>
            ))}
          </div>
        )}
        {!isUser && suggestions && suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-2xl border border-white/12 bg-white/5 p-3 text-sm shadow-inner shadow-slate-900/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{suggestion.title}</p>
                    <p className="mt-1 text-xs text-white/70">{suggestion.description}</p>
                    {suggestion.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggestion.actions.map((actionSet) => {
                          const actionKey = `${suggestion.id}-${actionSet.label}`
                          const isPending = pendingSuggestionKey === actionKey
                          const variantClasses = actionSet.variant === 'primary'
                            ? 'bg-white/90 text-slate-900 hover:bg-white'
                            : 'border border-white/15 bg-white/10 text-white/85 hover:border-white/25 hover:bg-white/15'
                          return (
                            <button
                              key={actionKey}
                              onClick={() => onSuggestionAction?.(suggestion.id, actionSet)}
                              disabled={isPending}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${variantClasses} ${isPending ? 'opacity-60 cursor-wait' : ''}`}
                            >
                              {isPending ? 'Working…' : actionSet.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface CopilotToggleButtonProps {
  onClick: () => void
}

export function CopilotToggleButton({ onClick }: CopilotToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-white/40"
    >
      <Sparkles className="h-4 w-4" />
      Copilot
    </button>
  )
}

interface SuggestionShelfProps {
  suggestions: CopilotSuggestion[]
  onTrigger: (suggestionId: string, actionSet: CopilotSuggestionAction) => void
  pendingKey: string | null
}

function SuggestionShelf({ suggestions, onTrigger, pendingKey }: SuggestionShelfProps) {
  const topSuggestions = suggestions.slice(0, 3)

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
        <Sparkles className="h-4 w-4" />
        Smart suggestions
      </div>
      <div className="mt-3 space-y-3">
        {topSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="rounded-2xl border border-white/12 bg-slate-900/40 p-3 shadow-lg shadow-slate-900/25"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-900/40">
                <Wand2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{suggestion.title}</p>
                <p className="mt-1 text-xs text-white/70">{suggestion.description}</p>
                {suggestion.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestion.actions.map((actionSet) => {
                      const actionKey = `${suggestion.id}-${actionSet.label}`
                      const isPending = pendingKey === actionKey
                      const variantClasses = actionSet.variant === 'primary'
                        ? 'bg-white/90 text-slate-900 hover:bg-white'
                        : 'border border-white/15 bg-white/10 text-white/85 hover:border-white/25 hover:bg-white/15'
                      return (
                        <button
                          key={actionKey}
                          onClick={() => onTrigger(suggestion.id, actionSet)}
                          disabled={isPending}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${variantClasses} ${isPending ? 'opacity-60 cursor-wait' : ''}`}
                        >
                          {isPending ? 'Working…' : actionSet.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
