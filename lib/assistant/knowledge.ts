import { randomUUID } from 'node:crypto'

import OpenAI from 'openai'

import { loadAssistantEnv } from '@/lib/assistant/config/env'
import { supabaseAdmin } from '@/lib/server/supabase-admin'
import { assistantKnowledgeSchema } from '@/lib/assistant/context/types'
import type {
  AssistantContext,
  AssistantKnowledge,
  AssistantDestination,
  CuratedKnowledgeItem,
  SemanticKnowledgeMatch,
} from '@/lib/assistant/context/types'

type CuratedContentRow =
  | {
      id?: string
      destination_name: string
      display_name?: string | null
      general_information?: string | null
      summary?: string | null
      why_visit?: string | null
      key_facts?: unknown
      selected_tips?: unknown
      activities_attractions?: unknown
      metadata?: Record<string, unknown> | null
      destination_coordinates?: { x: number; y: number } | string | null
      tags?: string[] | null
    }
  | Record<string, unknown>

type EmbeddingMatchRow = {
  id?: string
  title?: string | null
  name?: string | null
  summary?: string | null
  content?: string | null
  snippet?: string | null
  url?: string | null
  link?: string | null
  tags?: unknown
  metadata?: Record<string, unknown> | null
  similarity?: number | null
  score?: number | null
}

const assistantEnv = loadAssistantEnv()

const EMBEDDING_MODEL = assistantEnv.ASSISTANT_EMBEDDING_MODEL
const SEMANTIC_MATCH_FUNCTION = assistantEnv.ASSISTANT_SEMANTIC_MATCH_FUNCTION ?? ''

const openAiClient =
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

let semanticSearchAvailable = Boolean(SEMANTIC_MATCH_FUNCTION)

function buildDestinationKey(destination: AssistantDestination): string {
  const parts = [destination.name.trim()]
  if (destination.city) parts.push(destination.city.trim())
  if (destination.category) parts.push(String(destination.category).trim())
  return parts.join('_')
}

function parseHighlights(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text
        }
        if (item && typeof item === 'object' && 'tip' in item && typeof item.tip === 'string') {
          return item.tip
        }
        return null
      })
      .filter((item): item is string => Boolean(item && item.trim()))

    return mapped.length ? mapped : undefined
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return undefined
}

function parseTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'label' in item && typeof item.label === 'string') {
          return item.label
        }
        return null
      })
      .filter((item): item is string => Boolean(item && item.trim()))

    return mapped.length ? mapped : undefined
  }

  return undefined
}

function parseCoordinates(value: unknown): [number, number] | undefined {
  if (typeof value === 'string' && value.includes('(') && value.includes(')')) {
    const match = value.match(/^\s*\(?\s*([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)\s*\)?\s*$/)
    if (match) {
      const lng = Number.parseFloat(match[1])
      const lat = Number.parseFloat(match[2])
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        return [lng, lat]
      }
    }
  }

  if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
    const { x, y } = value as { x: unknown; y: unknown }
    const lng = typeof x === 'number' ? x : Number(x)
    const lat = typeof y === 'number' ? y : Number(y)
    if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
      return [lng, lat]
    }
  }

  if (
    value &&
    typeof value === 'object' &&
    'coordinates' in value &&
    Array.isArray((value as { coordinates: unknown }).coordinates)
  ) {
    const [lng, lat] = (value as { coordinates: unknown[] }).coordinates
    if (typeof lng === 'number' && typeof lat === 'number') {
      return [lng, lat]
    }
  }

  return undefined
}

function rowToCuratedItem(row: CuratedContentRow): CuratedKnowledgeItem | null {
  if (!row || typeof row !== 'object') return null
  const summary =
    (row as CuratedContentRow).general_information ??
    (row as CuratedContentRow).summary ??
    (row as CuratedContentRow).why_visit
  if (!summary) return null

  return {
    id: row.id ?? row.destination_name,
    name: row.display_name ?? row.destination_name,
    summary: summary.trim(),
    highlights: parseHighlights(row.selected_tips ?? row.metadata?.highlights),
    tags: parseTags(row.tags ?? row.metadata?.tags),
    coordinates: parseCoordinates(row.destination_coordinates ?? row.metadata?.coordinates),
    source: 'destination_modal_content',
  }
}

function rowToSemanticMatch(row: EmbeddingMatchRow): SemanticKnowledgeMatch | null {
  const snippet = row.snippet ?? row.summary ?? row.content
  if (!snippet) return null

  const similarity = row.similarity ?? row.score
  if (typeof similarity !== 'number') return null

  const tags = parseTags(row.tags ?? row.metadata?.tags)
  const coordinates = parseCoordinates(row.metadata?.coordinates)
  const label = row.title ?? row.name ?? 'Relevant content'

  return {
    id: row.id ?? `${label}-${randomUUID()}`,
    title: label,
    snippet: snippet.trim(),
    similarity,
    url: row.url ?? row.link ?? undefined,
    tags,
    coordinates,
    source: 'content_embeddings',
  }
}

export async function fetchCuratedKnowledge(
  destinations: AssistantDestination[],
  limit = 4
): Promise<CuratedKnowledgeItem[]> {
  if (!destinations.length) return []

  const uniqueKeys = new Map<string, AssistantDestination>()
  destinations.forEach((destination) => {
    uniqueKeys.set(destination.id ?? buildDestinationKey(destination), destination)
  })

  const destinationKeys = Array.from(uniqueKeys.values())
    .map((destination) => buildDestinationKey(destination))
    .filter((key, index, all) => all.indexOf(key) === index)
    .slice(0, limit * 2) // allow for fallback misses

  if (!destinationKeys.length) return []

  const { data, error } = await supabaseAdmin
    .from('destination_modal_content')
    .select(
      'id, destination_name, display_name, general_information, summary, why_visit, selected_tips, activities_attractions, metadata, destination_coordinates, tags'
    )
    .in('destination_name', destinationKeys)
    .limit(limit)

  if (error) {
    console.warn('[assistant] curated content fetch failed', error)
    return []
  }

  const items = (data as CuratedContentRow[]).map(rowToCuratedItem).filter(Boolean) as CuratedKnowledgeItem[]
  return items.slice(0, limit)
}

async function createQueryEmbedding(query: string): Promise<number[] | null> {
  if (!openAiClient) return null

  try {
    const trimmed = query.trim()
    if (!trimmed) return null

    const response = await openAiClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: trimmed,
    })

    const [embedding] = response.data
    if (!embedding || !embedding.embedding) return null
    return embedding.embedding
  } catch (error) {
    console.warn('[assistant] embedding generation failed', error)
    return null
  }
}

export async function fetchSemanticMatches(query: string, matchCount = 5): Promise<SemanticKnowledgeMatch[]> {
  if (!semanticSearchAvailable || !SEMANTIC_MATCH_FUNCTION) {
    return []
  }

  const queryEmbedding = await createQueryEmbedding(query)
  if (!queryEmbedding) return []

  try {
    const { data, error } = await supabaseAdmin.rpc(SEMANTIC_MATCH_FUNCTION, {
      query_embedding: queryEmbedding,
      match_threshold: 0.75,
      match_count: matchCount,
    })

    if (error) {
      console.warn('[assistant] semantic search RPC failed', error)
      if (error.code === 'PGRST202') {
        semanticSearchAvailable = false
      }
      return []
    }

    const rows = Array.isArray(data) ? (data as EmbeddingMatchRow[]) : []
    const matches = rows.map(rowToSemanticMatch).filter(Boolean) as SemanticKnowledgeMatch[]
    return matches.slice(0, matchCount)
  } catch (error) {
    console.warn('[assistant] semantic search failed', error)
    return []
  }
}

function pickDestinationsForCuratedContent(context: AssistantContext, limit: number): AssistantDestination[] {
  const trip = context.trip
  if (!trip) return []

  const highlightedId = context.ui?.highlightedDestinationId
  const selectedDayOrder = context.ui?.selectedDayOrder

  const prioritized: AssistantDestination[] = []

  if (highlightedId) {
    for (const day of trip.days) {
      const found = day.destinations.find((destination) => destination.id === highlightedId)
      if (found) {
        prioritized.push(found)
        break
      }
    }
  }

  if (selectedDayOrder !== undefined) {
    const selectedDay = trip.days.find((day) => day.dayOrder === selectedDayOrder)
    if (selectedDay) {
      prioritized.push(...selectedDay.destinations)
    }
  }

  if (!prioritized.length) {
    prioritized.push(...trip.days.flatMap((day) => day.destinations).slice(0, limit))
  }

  const uniqueById = new Map<string, AssistantDestination>()
  prioritized.forEach((destination) => {
    uniqueById.set(destination.id ?? buildDestinationKey(destination), destination)
  })

  return Array.from(uniqueById.values()).slice(0, limit)
}

export async function assembleAssistantKnowledge(
  context: AssistantContext,
  userQuery: string,
  options: {
    curatedLimit?: number
    semanticLimit?: number
  } = {}
): Promise<AssistantKnowledge | undefined> {
  const curatedLimit = options.curatedLimit ?? 3
  const semanticLimit = options.semanticLimit ?? 5

  const destinations = pickDestinationsForCuratedContent(context, curatedLimit)

  const [curated, semantic] = await Promise.all([
    fetchCuratedKnowledge(destinations, curatedLimit),
    fetchSemanticMatches(userQuery, semanticLimit),
  ])

  if (!curated.length && !semantic.length) {
    return undefined
  }

  const knowledge = assistantKnowledgeSchema.parse({
    curated,
    semantic,
  })

  return knowledge
}
