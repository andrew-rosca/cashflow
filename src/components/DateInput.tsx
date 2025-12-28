'use client'

import { useState, useRef, useEffect } from 'react'
import { LogicalDate } from '@/lib/logical-date'

interface DateInputProps {
  value: LogicalDate | string
  onChange: (date: LogicalDate) => void
  onBlur?: () => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function DateInput({ value, onChange, onBlur, className = '', placeholder, autoFocus = false }: DateInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [monthInput, setMonthInput] = useState('')
  const [monthSuggestions, setMonthSuggestions] = useState<string[]>([])
  const [activeField, setActiveField] = useState<'day' | 'month' | 'year' | null>(null)
  const [prevMonthInputLength, setPrevMonthInputLength] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const dayInputRef = useRef<HTMLInputElement>(null)
  const monthInputRef = useRef<HTMLInputElement>(null)
  const yearInputRef = useRef<HTMLInputElement>(null)

  // Parse initial value to LogicalDate
  useEffect(() => {
    try {
      const logicalDate = typeof value === 'string' 
        ? LogicalDate.fromString(value)
        : value
      
      if (logicalDate && logicalDate.month >= 1 && logicalDate.month <= 12) {
        const monthName = MONTHS[logicalDate.month - 1]
        if (monthName) {
          setDay(String(logicalDate.day).padStart(2, '0'))
          setMonth(monthName)
          setYear(String(logicalDate.year))
          setMonthInput(monthName)
          setPrevMonthInputLength(monthName.length)
        }
      }
    } catch (error) {
      // Invalid date value, leave fields empty
      console.warn('Invalid date value in DateInput:', value, error)
    }
  }, [value])

  // Auto-focus when component mounts or autoFocus prop changes
  useEffect(() => {
    if (autoFocus) {
      setIsOpen(true)
      setShowCalendar(true)
      setActiveField('day')
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        dayInputRef.current?.focus()
        dayInputRef.current?.select()
      }, 0)
    }
  }, [autoFocus])

  // Close calendar when clicking outside (handled by backdrop now, but keep for keyboard/other interactions)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is on the backdrop
      const target = event.target as HTMLElement
      if (target.classList.contains('backdrop-blur-sm')) {
        setShowCalendar(false)
        setActiveField(null)
        if (onBlur) onBlur()
        return
      }
      
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
        setActiveField(null)
        if (onBlur) onBlur()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onBlur])

  const handleFocus = () => {
    setIsOpen(true)
    setShowCalendar(true)
    setActiveField('day')
    // Select the day value for easy editing
    setTimeout(() => {
      dayInputRef.current?.select()
    }, 0)
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setDay(val)
    
    if (val.length === 2) {
      monthInputRef.current?.focus()
      monthInputRef.current?.select()
      setActiveField('month')
    }
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const isTyping = val.length > prevMonthInputLength
    setMonthInput(val)
    setPrevMonthInputLength(val.length)
    
    // Auto-complete month names
    if (val.length > 0) {
      const suggestions = MONTHS.filter(m => 
        m.toLowerCase().startsWith(val.toLowerCase())
      )
      setMonthSuggestions(suggestions)
      
      // If exact match, set it
      const exactMatch = MONTHS.find(m => m.toLowerCase() === val.toLowerCase())
      if (exactMatch) {
        setMonth(exactMatch)
        setMonthSuggestions([])
        if (year) {
          yearInputRef.current?.focus()
          yearInputRef.current?.select()
          setActiveField('year')
        }
      } else if (suggestions.length === 1 && isTyping) {
        // Auto-complete if only one suggestion, but only when typing (not deleting)
        setMonth(suggestions[0])
        setMonthInput(suggestions[0])
        setPrevMonthInputLength(suggestions[0].length)
        setMonthSuggestions([])
      } else {
        // Clear month if input doesn't match exactly
        setMonth('')
      }
    } else {
      setMonthSuggestions([])
      setMonth('')
    }
    
    // Handle numeric month input (1-12)
    const numVal = parseInt(val)
    if (!isNaN(numVal) && numVal >= 1 && numVal <= 12) {
      const monthName = MONTHS[numVal - 1]
      setMonth(monthName)
      setMonthInput(monthName)
      setPrevMonthInputLength(monthName.length)
      setMonthSuggestions([])
      if (year) {
        yearInputRef.current?.focus()
        yearInputRef.current?.select()
        setActiveField('year')
      }
    }
  }

  const handleMonthSelect = (monthName: string) => {
    setMonth(monthName)
    setMonthInput(monthName)
    setMonthSuggestions([])
    yearInputRef.current?.focus()
    yearInputRef.current?.select()
    setActiveField('year')
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setYear(val)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: 'day' | 'month' | 'year') => {
    if (e.key === 'Tab') {
      // Only prevent default if we're moving within the date input
      // Allow normal tab behavior to move to next field outside
      if (!e.shiftKey) {
        if (field === 'day') {
          e.preventDefault()
          monthInputRef.current?.focus()
          monthInputRef.current?.select()
          setActiveField('month')
        } else if (field === 'month') {
          e.preventDefault()
          yearInputRef.current?.focus()
          yearInputRef.current?.select()
          setActiveField('year')
        } else if (field === 'year') {
          // Let tab work normally to move to next element
          setShowCalendar(false)
          setActiveField(null)
          if (onBlur) onBlur()
        }
      } else {
        // Shift+Tab - allow normal behavior
        if (field === 'day') {
          setShowCalendar(false)
          setActiveField(null)
          if (onBlur) onBlur()
        } else if (field === 'month') {
          e.preventDefault()
          dayInputRef.current?.focus()
          dayInputRef.current?.select()
          setActiveField('day')
        } else if (field === 'year') {
          e.preventDefault()
          monthInputRef.current?.focus()
          monthInputRef.current?.select()
          setActiveField('month')
        }
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (field === 'day') {
        monthInputRef.current?.focus()
        monthInputRef.current?.select()
        setActiveField('month')
      } else if (field === 'month') {
        yearInputRef.current?.focus()
        yearInputRef.current?.select()
        setActiveField('year')
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (field === 'month') {
        dayInputRef.current?.focus()
        dayInputRef.current?.select()
        setActiveField('day')
      } else if (field === 'year') {
        monthInputRef.current?.focus()
        monthInputRef.current?.select()
        setActiveField('month')
      }
    } else if (e.key === 'Enter' || e.key === 'Escape') {
      if (e.key === 'Enter') {
        commitDate()
      }
      setShowCalendar(false)
      setActiveField(null)
      if (onBlur) onBlur()
    }
  }

  const commitDate = () => {
    if (day && month && year) {
      const monthIndex = MONTHS.indexOf(month)
      if (monthIndex !== -1) {
        const dayNum = parseInt(day)
        const yearNum = parseInt(year)
        const monthNum = monthIndex + 1 // LogicalDate months are 1-12
        
        // Use LogicalDate to handle month boundaries (e.g., Feb 30 -> Feb 28/29)
        try {
          const logicalDate = LogicalDate.from(yearNum, monthNum, dayNum)
          // If the day is invalid for the month, LogicalDate will adjust it
          // But we should validate and use the actual day from the LogicalDate
          const actualDay = logicalDate.day
          if (actualDay !== dayNum) {
            // Day was adjusted (e.g., Feb 30 -> Feb 28), update the input
            setDay(String(actualDay).padStart(2, '0'))
          }
          onChange(logicalDate)
        } catch (error) {
          // Invalid date - don't update
          console.error('Invalid date:', error)
        }
      }
    }
  }

  const handleDayBlur = (e: React.FocusEvent) => {
    // Don't commit if focus is moving to another field in the same component
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    if (day && month && year) {
      commitDate()
    }
    setIsOpen(false)
    setShowCalendar(false)
    setActiveField(null)
  }

  const handleMonthBlur = (e: React.FocusEvent) => {
    // Don't commit if focus is moving to another field in the same component
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    // If month input doesn't match a valid month, try to find closest match
    if (monthInput && !MONTHS.includes(monthInput)) {
      const match = MONTHS.find(m => m.toLowerCase().startsWith(monthInput.toLowerCase()))
      if (match) {
        setMonth(match)
        setMonthInput(match)
      }
    }
    if (day && month && year) {
      commitDate()
    }
    setIsOpen(false)
    setShowCalendar(false)
    setActiveField(null)
  }

  const handleYearBlur = (e: React.FocusEvent) => {
    // Don't commit if focus is moving to another field in the same component
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    if (day && month && year) {
      commitDate()
    }
    setIsOpen(false)
    setShowCalendar(false)
    setActiveField(null)
  }

  const handleCalendarDateClick = (selectedDay: number) => {
    const monthIndex = MONTHS.indexOf(month)
    if (monthIndex !== -1 && year) {
      const yearNum = parseInt(year)
      const monthNum = monthIndex + 1
      
      // Use LogicalDate to handle month boundaries
      try {
        const logicalDate = LogicalDate.from(yearNum, monthNum, selectedDay)
        const actualDay = logicalDate.day
        setDay(String(actualDay).padStart(2, '0'))
        onChange(logicalDate)
      } catch (error) {
        console.error('Invalid date:', error)
      }
    }
  }

  const handleCalendarMonthChange = (delta: number) => {
    const monthIndex = MONTHS.indexOf(month)
    if (monthIndex !== -1 && year) {
      let newMonthIndex = monthIndex + delta
      let newYear = parseInt(year)
      
      if (newMonthIndex < 0) {
        newMonthIndex = 11
        newYear--
      } else if (newMonthIndex > 11) {
        newMonthIndex = 0
        newYear++
      }
      
      setMonth(MONTHS[newMonthIndex])
      setMonthInput(MONTHS[newMonthIndex])
      setYear(String(newYear))
      
      // Adjust day if needed using LogicalDate
      try {
        const newMonthNum = newMonthIndex + 1
        const currentDay = parseInt(day) || 1
        const logicalDate = LogicalDate.from(newYear, newMonthNum, currentDay)
        const validDay = logicalDate.day
        setDay(String(validDay).padStart(2, '0'))
        onChange(logicalDate)
      } catch (error) {
        console.error('Invalid date:', error)
      }
    }
  }

  const handleCalendarYearChange = (delta: number) => {
    if (year) {
      const newYear = parseInt(year) + delta
      setYear(String(newYear))
      
      // Adjust day for leap years using LogicalDate
      const monthIndex = MONTHS.indexOf(month)
      if (monthIndex !== -1) {
        try {
          const newMonthNum = monthIndex + 1
          const currentDay = parseInt(day) || 1
          const logicalDate = LogicalDate.from(newYear, newMonthNum, currentDay)
          const validDay = logicalDate.day
          setDay(String(validDay).padStart(2, '0'))
          onChange(logicalDate)
        } catch (error) {
          console.error('Invalid date:', error)
        }
      }
    }
  }

  // Get calendar dates for current month using LogicalDate
  const getCalendarDates = () => {
    const monthIndex = MONTHS.indexOf(month)
    if (monthIndex === -1 || !year) return []
    
    const yearNum = parseInt(year)
    const monthNum = monthIndex + 1
    
    try {
      // Get first day of month
      const firstDay = LogicalDate.from(yearNum, monthNum, 1)
      const daysInMonth = firstDay.daysInMonth
      
      // Get day of week for first day (1 = Monday, 7 = Sunday)
      // Adjust to 0-based for calendar display (0 = Sunday, 6 = Saturday)
      const dayOfWeek = firstDay.dayOfWeek === 7 ? 0 : firstDay.dayOfWeek
      
      const dates: (number | null)[] = []
      
      // Add empty cells for days before month starts
      for (let i = 0; i < dayOfWeek; i++) {
        dates.push(null)
      }
      
      // Add days of the month
      for (let i = 1; i <= daysInMonth; i++) {
        dates.push(i)
      }
      
      return dates
    } catch (error) {
      return []
    }
  }

  const calendarDates = getCalendarDates()
  const currentDay = parseInt(day) || 1

  return (
    <>
      {/* Backdrop overlay - dims/blurs background when calendar is open */}
      {isOpen && showCalendar && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-[1px] z-40"
          onClick={(e) => {
            // Only close if clicking directly on the backdrop, not on the date input container
            if (e.target === e.currentTarget) {
              setShowCalendar(false)
              setActiveField(null)
              if (onBlur) onBlur()
            }
          }}
        />
      )}
      
      <div ref={containerRef} className="relative z-50">
        {/* Unified container for date input and calendar */}
        <div className={`${isOpen && showCalendar ? 'bg-white dark:bg-gray-800 rounded-lg shadow-xl p-3 border border-gray-200 dark:border-gray-700' : ''}`}>
          {/* Date Input Textbox */}
          <div
            className={`flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 px-2 py-1 ${className}`}
            onClick={(e) => {
              // Only handle focus if clicking on the container itself, not on inputs
              if (e.target === e.currentTarget) {
                handleFocus()
              }
            }}
          >
        <input
          ref={dayInputRef}
          type="text"
          value={day}
          onChange={handleDayChange}
          onKeyDown={(e) => handleKeyDown(e, 'day')}
          onBlur={(e) => handleDayBlur(e)}
          onMouseDown={(e) => {
            e.stopPropagation()
            // Prevent default to stop browser from setting cursor position
            e.preventDefault()
            setIsOpen(true)
            setShowCalendar(true)
            setActiveField('day')
            // Focus and select after preventing default
            dayInputRef.current?.focus()
            dayInputRef.current?.select()
          }}
          onFocus={() => {
            setIsOpen(true)
            setShowCalendar(true)
            setActiveField('day')
          }}
          placeholder="dd"
          className="w-9 text-center text-sm text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 cursor-text"
        />
        <span className="text-gray-400 dark:text-gray-500"> </span>
        <div className="relative">
          <input
            ref={monthInputRef}
            type="text"
            value={monthInput}
            onChange={handleMonthChange}
            onKeyDown={(e) => handleKeyDown(e, 'month')}
            onBlur={(e) => handleMonthBlur(e)}
            onMouseDown={(e) => {
              e.stopPropagation()
              // Prevent default to stop browser from setting cursor position
              e.preventDefault()
              setIsOpen(true)
              setShowCalendar(true)
              setActiveField('month')
              // Focus and select after preventing default
              monthInputRef.current?.focus()
              monthInputRef.current?.select()
            }}
            onFocus={() => {
              setIsOpen(true)
              setShowCalendar(true)
              setActiveField('month')
            }}
            placeholder="MMM"
            maxLength={3}
            className="w-12 text-center text-sm text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 cursor-text"
          />
          {monthSuggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 min-w-[80px]">
              {monthSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleMonthSelect(suggestion)}
                  className="w-full text-left px-2 py-1 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-gray-400 dark:text-gray-500"> </span>
        <input
          ref={yearInputRef}
          type="text"
          value={year}
          onChange={handleYearChange}
          onKeyDown={(e) => handleKeyDown(e, 'year')}
          onBlur={(e) => handleYearBlur(e)}
          onMouseDown={(e) => {
            e.stopPropagation()
            // Prevent default to stop browser from setting cursor position
            e.preventDefault()
            setIsOpen(true)
            setShowCalendar(true)
            setActiveField('year')
            // Focus and select after preventing default
            yearInputRef.current?.focus()
            yearInputRef.current?.select()
          }}
          onFocus={() => {
            setIsOpen(true)
            setShowCalendar(true)
            setActiveField('year')
          }}
          placeholder="YYYY"
          className="w-16 text-center text-sm text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0 cursor-text pr-2"
        />
          </div>

          {/* Calendar Popup */}
          {isOpen && showCalendar && (
            <div className="mt-3 w-64">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => handleCalendarMonthChange(-1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCalendarYearChange(-1)}
                className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[80px] text-center">
                {month} {year}
              </span>
              <button
                type="button"
                onClick={() => handleCalendarYearChange(1)}
                className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleCalendarMonthChange(1)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDates.map((date, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => date && handleCalendarDateClick(date)}
                disabled={!date}
                className={`
                  py-1 text-sm rounded
                  ${!date ? 'cursor-default' : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'}
                  ${date === currentDay ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-900 dark:text-white'}
                  ${!date ? 'text-transparent' : ''}
                `}
              >
                {date || ''}
              </button>
            ))}
          </div>

          {/* Close Calendar Button */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setShowCalendar(false)
                setActiveField(null)
              }}
              className="w-full px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Close Calendar
            </button>
          </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
