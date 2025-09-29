interface CountryMeta {
  name?: string
  bbox?: [number, number, number, number]
  center?: [number, number]
}

const STORAGE_KEY = 'traveal:countryMeta:v1'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function loadAll(): Record<string, CountryMeta> {
  if (!isBrowser()) return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, CountryMeta>
    }
  } catch (error) {
    console.warn('country-cache: failed to parse storage', error)
  }
  return {}
}

function saveAll(map: Record<string, CountryMeta>) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (error) {
    console.warn('country-cache: failed to persist storage', error)
  }
}

function normalise(code: string): string {
  return code.trim().toUpperCase()
}

export function getCountryMeta(code: string): CountryMeta | null {
  if (!code) return null
  const map = loadAll()
  const found = map[normalise(code)]
  return found ?? null
}

export function setCountryMeta(code: string, meta: CountryMeta) {
  if (!code) return
  const normalised = normalise(code)
  const map = loadAll()
  const existing = map[normalised] ?? {}
  map[normalised] = {
    ...existing,
    ...meta,
  }
  saveAll(map)
}

export function clearCountryMetaCache() {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export type { CountryMeta }

