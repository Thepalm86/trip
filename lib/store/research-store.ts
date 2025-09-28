'use client'

import { create } from 'zustand'

export interface ResearchSource {
  id: string
  title: string
  url: string
  platform: 'social' | 'blog' | 'forum' | 'official' | 'video' | 'other'
  summary?: string
  snippet?: string
  tags: string[]
  savedAt: string
  author?: string
  highlights?: string[]
}

interface ResearchStoreState {
  isOpen: boolean
  query: string
  sources: ResearchSource[]
  selectedSourceId: string | null
  open: () => void
  close: () => void
  toggle: () => void
  setQuery: (query: string) => void
  setSources: (sources: ResearchSource[]) => void
  selectSource: (sourceId: string | null) => void
}

const seedSources: ResearchSource[] = [
  {
    id: 'source-1',
    title: 'Lisbon Nomads – Community tips',
    url: 'https://facebook.com/groups/lisbennomads/posts/123456',
    platform: 'social',
    summary: 'Thread about the best co-working spots and late-night cafes in Lisbon.',
    snippet: '“Look into Second Home and Village Underground. Both have day passes and are near the Time Out Market.”',
    tags: ['lisbon', 'work', 'nightlife'],
    savedAt: '2024-03-02T18:45:00.000Z',
    author: 'Inês Ferreira',
    highlights: [
      'Best months mentioned: April–June to avoid heat.',
      'Weekend tip: LX Factory Sunday market is worth a visit.'
    ]
  },
  {
    id: 'source-2',
    title: '48 Hours in Alfama – Food guide',
    url: 'https://slowtravel.blog/48-hours-in-alfama',
    platform: 'blog',
    summary: 'Curated list of eateries and viewpoints across Alfama with timing suggestions.',
    snippet: 'Day 1 dinner suggestion: Clube de Fado for live music, reservations recommended a week ahead.',
    tags: ['lisbon', 'food', 'culture'],
    savedAt: '2024-03-01T10:12:00.000Z',
    author: 'Marta Gomes',
    highlights: [
      'Morning pastel stop: Fabrica Lisboa opens at 8:00.',
      'Miradouro da Graça best at sunset for photos.'
    ]
  },
  {
    id: 'source-3',
    title: 'Rail forum – Rome to Florence timetable changes',
    url: 'https://railforums.example.com/t/rome-florence-october',
    platform: 'forum',
    summary: 'Community thread covering updated departure times during maintenance week.',
    snippet: 'Frecciarossa 9513 now departs at 09:05 instead of 08:50 between Oct 20–26.',
    tags: ['italy', 'transport'],
    savedAt: '2024-02-27T07:55:00.000Z',
    highlights: [
      'Book via Trenitalia app 30 days out for lower tier pricing.',
      'Station lounge at Roma Termini opens from 06:45.'
    ]
  }
]

export const useResearchStore = create<ResearchStoreState>((set) => ({
  isOpen: false,
  query: '',
  sources: seedSources,
  selectedSourceId: seedSources[0]?.id ?? null,
  open: () => set((state) => ({ isOpen: true, selectedSourceId: state.selectedSourceId ?? state.sources[0]?.id ?? null })),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setQuery: (query) => set({ query }),
  setSources: (sources) => set({ sources }),
  selectSource: (selectedSourceId) => set({ selectedSourceId })
}))
