'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  destinationCategoryOptions,
  predefinedDestinationCategories,
} from './destination-category-options'

interface DestinationCategoryModalProps {
  placeName: string
  city?: string
  initialCategory?: string
  onCancel: () => void
  onConfirm: (category: string) => void
}

export function DestinationCategoryModal({
  placeName,
  initialCategory,
  onCancel,
  onConfirm,
}: DestinationCategoryModalProps) {
  const rawInitialCategory = useMemo(() => {
    if (!initialCategory) {
      return 'attraction'
    }
    const trimmed = initialCategory.trim()
    return trimmed.length > 0 ? trimmed : 'attraction'
  }, [initialCategory])

  const normalizedInitialCategory = useMemo(
    () => rawInitialCategory.toLowerCase(),
    [rawInitialCategory],
  )

  const isInitialCustom = useMemo(() => {
    return !predefinedDestinationCategories.includes(normalizedInitialCategory)
  }, [normalizedInitialCategory])

  const [selectedCategory, setSelectedCategory] = useState<string>(() =>
    isInitialCustom ? 'other' : normalizedInitialCategory,
  )
  const [customCategory, setCustomCategory] = useState<string>(() =>
    isInitialCustom ? rawInitialCategory : '',
  )
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (selectedCategory === 'other') {
      const trimmed = customCategory.trim()
      if (!trimmed) {
        setError('Enter a category name to continue.')
        return
      }
      onConfirm(trimmed)
      return
    }

    onConfirm(selectedCategory)
  }

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category)
    setError(null)
    if (category !== 'other') {
      setCustomCategory('')
    }
  }

  const handleCustomCategoryChange = (value: string) => {
    setCustomCategory(value)
    if (value.trim().length > 0) {
      setError(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Choose category</h3>
            <p className="mt-1 text-sm text-white/60">{placeName}</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Cancel category selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {destinationCategoryOptions.map((option) => {
            const isSelected = selectedCategory === option.value
            return (
              <button
                key={option.value}
                onClick={() => handleSelectCategory(option.value)}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-blue-500/40 hover:bg-blue-500/15 hover:text-white'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && option.value !== 'other' && (
                  <span className="text-xs text-blue-300">Selected</span>
                )}
              </button>
            )
          })}
        </div>

        {selectedCategory === 'other' && (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-white/40">Custom category</label>
            <input
              value={customCategory}
              onChange={(event) => handleCustomCategoryChange(event.target.value)}
              placeholder="e.g. Museum, Nightlife, Scenic View"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-blue-400/40 focus:outline-none"
            />
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
