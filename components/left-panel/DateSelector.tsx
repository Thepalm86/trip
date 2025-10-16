'use client'

import { useEffect, useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { useSupabaseTripStore } from '@/lib/store/supabase-trip-store'
import { cn } from '@/lib/utils'

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DatePickerFieldProps {
  value: Date
  onSelect: (date: Date) => void
  minDate?: Date
  today: Date
  rangeStart?: Date
  rangeEnd?: Date
  isInvalid?: boolean
  ariaLabel?: string
}

function DatePickerField({
  value,
  onSelect,
  minDate,
  today,
  rangeStart,
  rangeEnd,
  isInvalid,
  ariaLabel
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)

  const normalizedValue = useMemo(() => startOfDay(value), [value])
  const minSelectableDate = useMemo(
    () => (minDate ? startOfDay(minDate) : undefined),
    [minDate]
  )
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(normalizedValue))

  useEffect(() => {
    setVisibleMonth(startOfMonth(normalizedValue))
  }, [normalizedValue])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(visibleMonth, { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [visibleMonth])

  const rangeStartDate = rangeStart ? startOfDay(rangeStart) : undefined
  const rangeEndDate = rangeEnd ? startOfDay(rangeEnd) : undefined
  const hasRange =
    rangeStartDate && rangeEndDate && !isBefore(rangeEndDate, rangeStartDate)

  const prevMonth = () => setVisibleMonth(current => addMonths(current, -1))
  const nextMonth = () => setVisibleMonth(current => addMonths(current, 1))

  const isPrevDisabled = useMemo(() => {
    if (!minSelectableDate) {
      return false
    }
    const previousMonthEnd = endOfMonth(addMonths(visibleMonth, -1))
    return isBefore(previousMonthEnd, minSelectableDate)
  }, [minSelectableDate, visibleMonth])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'w-full px-4 py-3 rounded-lg border text-left transition-all duration-200 flex items-center justify-between gap-3 bg-white/5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0',
            isInvalid
              ? 'border-red-500/70 bg-red-500/10 text-red-100'
              : 'border-white/10 hover:border-blue-400/50 hover:bg-white/10'
          )}
        >
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-white/40">
              Selected
            </span>
            <span className="text-base font-semibold text-white">
              {format(normalizedValue, 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>{format(normalizedValue, 'EEE')}</span>
            <Calendar className="h-4 w-4" />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          side="bottom"
          sideOffset={14}
          collisionPadding={16}
          avoidCollisions={false}
          className="z-[60] w-[320px] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-[0_28px_64px_rgba(4,9,20,0.55)] backdrop-blur-xl focus:outline-none"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              disabled={isPrevDisabled}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-all duration-200 hover:border-blue-400/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                isPrevDisabled && 'pointer-events-none opacity-30'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold text-white">
                {format(visibleMonth, 'MMMM yyyy')}
              </div>
              <div className="text-xs text-white/50">
                {format(visibleMonth, 'yyyy')}
              </div>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-all duration-200 hover:border-blue-400/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-white/40">
            {weekdayLabels.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isDisabled =
                (minSelectableDate && isBefore(day, minSelectableDate)) || false
              const isOutside = !isSameMonth(day, visibleMonth)
              const isSelected = isSameDay(day, normalizedValue)
              const isToday = isSameDay(day, today)
              const isRangeBoundary =
                (!!rangeStartDate && isSameDay(day, rangeStartDate)) ||
                (!!rangeEndDate && isSameDay(day, rangeEndDate))
              const isInRange =
                hasRange &&
                !isRangeBoundary &&
                isAfter(day, rangeStartDate!) &&
                isBefore(day, rangeEndDate!)

              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => {
                    if (isDisabled) {
                      return
                    }
                    onSelect(startOfDay(day))
                    setOpen(false)
                  }}
                  disabled={isDisabled}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-sm font-medium text-white/80 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0',
                    !isDisabled &&
                      !isSelected &&
                      !isRangeBoundary &&
                      'hover:bg-white/10 hover:text-white',
                    isOutside && 'text-white/35',
                    isDisabled && 'cursor-not-allowed text-white/20 opacity-40',
                    isToday && !isSelected && !isRangeBoundary && 'border border-blue-400/40 text-white',
                    isInRange && 'bg-blue-500/10 text-white border border-blue-400/30',
                    (isSelected || isRangeBoundary) &&
                      'bg-blue-500 text-white shadow-[0_14px_36px_rgba(79,140,255,0.35)]'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface DateSelectorProps {
  onClose: () => void
}

export function DateSelector({ onClose }: DateSelectorProps) {
  const { currentTrip, updateTripDates } = useSupabaseTripStore()
  const today = useMemo(() => startOfDay(new Date()), [])

  const initialStartDate = useMemo(() => {
    if (!currentTrip?.startDate) {
      return today
    }
    const rawStart = startOfDay(new Date(currentTrip.startDate))
    return isBefore(rawStart, today) ? today : rawStart
  }, [currentTrip?.startDate, today])

  const initialEndDate = useMemo(() => {
    if (!currentTrip?.endDate) {
      return initialStartDate
    }
    const rawEnd = startOfDay(new Date(currentTrip.endDate))
    return isBefore(rawEnd, initialStartDate) ? initialStartDate : rawEnd
  }, [currentTrip?.endDate, initialStartDate])

  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!currentTrip) {
      return
    }

    const rawStart = currentTrip.startDate
      ? startOfDay(new Date(currentTrip.startDate))
      : today
    const sanitizedStart = isBefore(rawStart, today) ? today : rawStart

    const rawEnd = currentTrip.endDate
      ? startOfDay(new Date(currentTrip.endDate))
      : sanitizedStart
    const sanitizedEnd = isBefore(rawEnd, sanitizedStart) ? sanitizedStart : rawEnd

    setStartDate(sanitizedStart)
    setEndDate(sanitizedEnd)
  }, [currentTrip, today])

  if (!currentTrip) {
    return null
  }

  const handleStartSelect = (selectedDate: Date) => {
    const sanitized = isBefore(selectedDate, today) ? today : selectedDate
    setStartDate(sanitized)

    if (isBefore(endDate, sanitized)) {
      setEndDate(sanitized)
    }
  }

  const handleEndSelect = (selectedDate: Date) => {
    const sanitized = isBefore(selectedDate, startDate) ? startDate : selectedDate
    setEndDate(sanitized)
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await updateTripDates(startDate, endDate)
      await new Promise(resolve => setTimeout(resolve, 300)) // Small delay for UX
    } catch (error) {
      console.error('Error updating trip dates:', error)
    } finally {
      setIsLoading(false)
      onClose()
    }
  }

  const calculateDays = () => {
    const diff = endDate.getTime() - startDate.getTime()
    return diff >= 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) + 1 : 1
  }

  const formatDateDisplay = (date: Date) => format(date, 'EEE, MMM d, yyyy')

  const isEndDateValid = !isBefore(endDate, startDate)
  const durationDays = calculateDays()

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Trip Dates</h3>
              <p className="text-sm text-white/60">Select your travel dates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6">
          {/* Start Date */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-white/80">
              Start Date
            </label>
            <DatePickerField
              value={startDate}
              onSelect={handleStartSelect}
              minDate={today}
              today={today}
              rangeStart={startDate}
              rangeEnd={endDate}
              ariaLabel="Select trip start date"
            />
          </div>

          {/* End Date */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-white/80">
              End Date
            </label>
            <DatePickerField
              value={endDate}
              onSelect={handleEndSelect}
              minDate={startDate}
              today={today}
              rangeStart={startDate}
              rangeEnd={endDate}
              isInvalid={!isEndDateValid}
              ariaLabel="Select trip end date"
            />
            {!isEndDateValid && (
              <div className="text-sm text-red-400">
                End date must be after start date
              </div>
            )}
          </div>

          {/* Trip Summary */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-white/80 mb-3">Trip Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Duration</span>
                <span className="text-white font-medium">
                  {durationDays} {durationDays === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Start</span>
                <span className="text-white font-medium">{formatDateDisplay(startDate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">End</span>
                <span className="text-white font-medium">{formatDateDisplay(endDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isEndDateValid || isLoading}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </div>
            ) : (
              'Save Dates'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
