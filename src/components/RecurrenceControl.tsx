'use client'

import { useState, useEffect, useRef } from 'react'
import DateInput from './DateInput'
import { LogicalDate, today } from '@/lib/logical-date'

interface RecurrenceControlProps {
  value: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number
    dayOfWeek?: number | number[] | null
    dayOfMonth?: number | number[] | null
    month?: string | string[] | null
    endDate?: string | null
  }
  onChange: (recurrence: any) => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function RecurrenceControl({ value, onChange }: RecurrenceControlProps) {
  const [frequency, setFrequency] = useState(value.frequency || 'monthly')
  const [interval, setInterval] = useState(value.interval || 1)
  // Convert single values to arrays for multi-select
  const [dayOfWeek, setDayOfWeek] = useState<number[]>(() => {
    if (!value.dayOfWeek) return [1] // Default to Monday
    return Array.isArray(value.dayOfWeek) ? value.dayOfWeek : [value.dayOfWeek]
  })
  const [dayOfMonth, setDayOfMonth] = useState<number[]>(() => {
    if (!value.dayOfMonth) return []
    return Array.isArray(value.dayOfMonth) ? value.dayOfMonth : [value.dayOfMonth]
  })
  const [month, setMonth] = useState<string[]>(() => {
    if (!value.month) return []
    return Array.isArray(value.month) ? value.month : [value.month]
  })
  const [endDate, setEndDate] = useState<string | null>(
    value.endDate ? (typeof value.endDate === 'string' ? value.endDate : LogicalDate.fromString(value.endDate).toString()) : null
  )

  // Track if we're updating from internal changes to avoid loops
  const isInternalUpdate = useRef(false)

  // Update parent when local state changes
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }

    const newRecurrence: any = {
      frequency,
      interval: interval || 1,
    }

    if (frequency === 'weekly' && dayOfWeek.length > 0) {
      newRecurrence.dayOfWeek = dayOfWeek.length === 1 ? dayOfWeek[0] : dayOfWeek
    }

    if (frequency === 'monthly' && dayOfMonth.length > 0) {
      newRecurrence.dayOfMonth = dayOfMonth.length === 1 ? dayOfMonth[0] : dayOfMonth
    }

    if (frequency === 'yearly') {
      if (month.length > 0) {
        newRecurrence.month = month.length === 1 ? month[0] : month
      }
      if (dayOfMonth.length > 0) {
        newRecurrence.dayOfMonth = dayOfMonth.length === 1 ? dayOfMonth[0] : dayOfMonth
      }
    }

    if (endDate) {
      newRecurrence.endDate = endDate
    }

    onChange(newRecurrence)
  }, [frequency, interval, dayOfWeek, dayOfMonth, month, endDate])

  // Sync with prop changes (only if different from current state)
  useEffect(() => {
    const propFrequency = value.frequency || 'monthly'
    const propInterval = value.interval || 1
    const propDayOfWeek = value.dayOfWeek 
      ? (Array.isArray(value.dayOfWeek) ? value.dayOfWeek : [value.dayOfWeek])
      : [1] // Default to Monday
    const propDayOfMonth = value.dayOfMonth
      ? (Array.isArray(value.dayOfMonth) ? value.dayOfMonth : [value.dayOfMonth])
      : []
    const propMonth = value.month
      ? (Array.isArray(value.month) ? value.month : [value.month])
      : []
    const propEndDate = value.endDate ? (typeof value.endDate === 'string' ? value.endDate : LogicalDate.fromString(value.endDate).toString()) : null

    // Compare arrays
    const arraysEqual = (a: any[], b: any[]) => {
      if (a.length !== b.length) return false
      return a.every((val, idx) => val === b[idx])
    }

    // Only update if values actually changed
    if (
      propFrequency !== frequency ||
      propInterval !== interval ||
      !arraysEqual(propDayOfWeek, dayOfWeek) ||
      !arraysEqual(propDayOfMonth, dayOfMonth) ||
      !arraysEqual(propMonth, month) ||
      propEndDate !== endDate
    ) {
      isInternalUpdate.current = true
      setFrequency(propFrequency)
      setInterval(propInterval)
      setDayOfWeek(propDayOfWeek)
      setDayOfMonth(propDayOfMonth)
      setMonth(propMonth)
      setEndDate(propEndDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleDayOfWeekSelect = (dayValue: number) => {
    setDayOfWeek(prev => {
      if (prev.includes(dayValue)) {
        // Remove if already selected
        const newSelection = prev.filter(d => d !== dayValue)
        return newSelection.length > 0 ? newSelection : [1] // Keep at least Monday
      } else {
        // Add to selection
        return [...prev, dayValue].sort()
      }
    })
  }

  const handleDayOfMonthSelect = (day: number) => {
    setDayOfMonth(prev => {
      if (prev.includes(day)) {
        // Remove if already selected
        return prev.filter(d => d !== day)
      } else {
        // Add to selection
        return [...prev, day].sort((a, b) => a - b)
      }
    })
  }

  const handleMonthSelect = (monthName: string) => {
    setMonth(prev => {
      if (prev.includes(monthName)) {
        // Remove if already selected
        return prev.filter(m => m !== monthName)
      } else {
        // Add to selection
        return [...prev, monthName].sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b))
      }
    })
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Frequency
        </label>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => setFrequency(freq)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors capitalize ${
                frequency === freq
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
      </div>

      {/* Interval (Every X) */}
      {(frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Every
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {frequency === 'daily' ? 'day(s)' : frequency === 'weekly' ? 'week(s)' : 'month(s)'}
            </span>
          </div>
        </div>
      )}

      {/* Day of Week (for Weekly) */}
      {frequency === 'weekly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Day of Week (select multiple)
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => handleDayOfWeekSelect(day.value)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  dayOfWeek.includes(day.value)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day of Month (for Monthly) */}
      {frequency === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Day of Month (1-31, select multiple)
          </label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => handleDayOfMonthSelect(day)}
                className={`px-2 py-1 text-sm rounded-md border transition-colors ${
                  dayOfMonth.includes(day)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month and Day of Month (for Yearly) */}
      {frequency === 'yearly' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Month (select multiple)
            </label>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((monthName) => (
                <button
                  key={monthName}
                  type="button"
                  onClick={() => handleMonthSelect(monthName)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    month.includes(monthName)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {monthName}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Day of Month (1-31, select multiple)
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayOfMonthSelect(day)}
                  className={`px-2 py-1 text-sm rounded-md border transition-colors ${
                    dayOfMonth.includes(day)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {day}
              </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* End Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          End Date (optional)
        </label>
        {endDate ? (
          <>
            <DateInput
              value={endDate}
              onChange={(date) => setEndDate(date.toString())}
              className="w-full"
            />
            <button
              type="button"
              onClick={() => setEndDate(null)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear end date
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEndDate(today().toString())
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
          >
            Set end date
          </button>
        )}
      </div>
    </div>
  )
}

