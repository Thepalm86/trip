'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ExternalLink, Tag, Clock, Globe, X, Sparkles } from 'lucide-react'
import { useResearchStore } from '@/lib/store/research-store'

const PLATFORM_LABEL: Record<string, string> = {
  social: 'Social',
  blog: 'Blog',
  forum: 'Forum',
  official: 'Official',
  video: 'Video',
  other: 'Other'
}

export function ResearchCommandPalette() {
  const {
    isOpen,
    query,
    sources,
    selectedSourceId,
    close,
    setQuery,
    selectSource,
    open
  } = useResearchStore()

  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSources = useMemo(() => {
    if (!query.trim()) {
      return sources
    }

    const lower = query.trim().toLowerCase()
    return sources.filter((source) => {
      const haystack = [
        source.title,
        source.summary,
        source.snippet,
        source.author,
        source.tags.join(' ')
      ]
        .filter(Boolean)
        .join(' ') 
        .toLowerCase()

      return haystack.includes(lower)
    })
  }, [sources, query])

  const activeSource = useMemo(() => {
    if (!selectedSourceId) return filteredSources[0] ?? null
    return filteredSources.find((source) => source.id === selectedSourceId) ?? filteredSources[0] ?? null
  }, [filteredSources, selectedSourceId])

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommandPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'

      if (isCommandPaletteShortcut) {
        event.preventDefault()
        if (isOpen) {
          close()
        } else {
          open()
        }
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close, open])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
    }
  }, [isOpen, setQuery])

  useEffect(() => {
    if (isOpen && activeSource && activeSource.id !== selectedSourceId) {
      selectSource(activeSource.id)
    }
  }, [isOpen, activeSource, selectedSourceId, selectSource])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={close} />

      <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900/95 text-white shadow-2xl">
        <div className="flex flex-col h-full max-h-[80vh]">
          <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saved research (⌘K / Ctrl+K to toggle)"
                className="w-full bg-transparent text-lg font-medium text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <button
              onClick={close}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <section className="w-72 shrink-0 border-r border-white/10 bg-white/5 overflow-y-auto">
              {filteredSources.length === 0 ? (
                <div className="px-5 py-12 text-sm text-white/50">
                  No sources match “{query}”.
                </div>
              ) : (
                <ul className="py-3">
                  {filteredSources.map((source) => {
                    const isActive = activeSource?.id === source.id
                    return (
                      <li key={source.id}>
                        <button
                          onClick={() => selectSource(source.id)}
                          className={`w-full px-5 py-3 text-left transition-colors ${
                            isActive
                              ? 'bg-blue-500/20 border-l-2 border-blue-400 text-white'
                              : 'text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-sm font-semibold leading-tight line-clamp-2">
                            {source.title}
                          </div>
                          <div className="mt-1 text-xs text-white/40 flex items-center gap-2">
                            <span>{PLATFORM_LABEL[source.platform] ?? 'Source'}</span>
                            <span>•</span>
                            <time suppressHydrationWarning>
                              {new Date(source.savedAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </time>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="flex-1 overflow-y-auto">
              {activeSource ? (
                <div className="flex h-full flex-col">
                  <div className="px-6 py-6 border-b border-white/5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm uppercase tracking-widest text-white/40">
                          {PLATFORM_LABEL[activeSource.platform] ?? 'Source'}
                        </div>
                        <h2 className="mt-2 text-2xl font-semibold text-white">
                          {activeSource.title}
                        </h2>
                        {activeSource.author && (
                          <p className="mt-1 text-sm text-white/50">Shared by {activeSource.author}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                          <Clock className="h-3 w-3" />
                          <span suppressHydrationWarning>
                            Saved {new Date(activeSource.savedAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <a
                          href={activeSource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                        >
                          Open Source
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    {activeSource.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {activeSource.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {activeSource.summary && (
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40">Summary</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/80">
                          {activeSource.summary}
                        </p>
                      </div>
                    )}

                    {activeSource.snippet && (
                      <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-200">
                          <Globe className="h-3 w-3" />
                          Captured snippet
                        </div>
                        <p className="mt-2 text-sm text-blue-50/90">
                          {activeSource.snippet}
                        </p>
                      </div>
                    )}

                    {activeSource.highlights && activeSource.highlights.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40">Highlights</h3>
                        <ul className="mt-2 space-y-2 text-sm text-white/80">
                          {activeSource.highlights.map((highlight, index) => (
                            <li
                              key={`${activeSource.id}-highlight-${index}`}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                            >
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/50">
                  <Sparkles className="h-8 w-8" />
                  <p className="text-sm">
                    Add research sources to see them here. Use the capture button or browser extension.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
