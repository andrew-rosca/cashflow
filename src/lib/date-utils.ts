/**
 * Calendar Date Utilities using Temporal API
 * 
 * JavaScript's Date object always has a time component, but we work with
 * logical calendar dates (YYYY-MM-DD) throughout the application.
 * 
 * Temporal.PlainDate represents a calendar date without any time component,
 * which is exactly what we need for financial transactions and projections.
 */

import { Temporal } from '@js-temporal/polyfill'

/**
 * Convert a Date object or date string to a Temporal.PlainDate
 * Extracts just the calendar date (YYYY-MM-DD), ignoring time components
 */
export function toPlainDate(date: Date | string | Temporal.PlainDate): Temporal.PlainDate {
  if (date instanceof Temporal.PlainDate) {
    return date
  }
  
  if (typeof date === 'string') {
    // Extract just the date part (YYYY-MM-DD) if it includes time
    const dateOnly = date.split('T')[0]
    return Temporal.PlainDate.from(dateOnly)
  }
  
  // Date object - extract calendar date using UTC to avoid timezone issues
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  return Temporal.PlainDate.from({ year, month, day })
}

/**
 * Convert a Temporal.PlainDate to a Date object at UTC midnight
 * This is needed for database storage (Prisma requires Date objects)
 */
export function plainDateToDate(plainDate: Temporal.PlainDate): Date {
  return new Date(Date.UTC(
    plainDate.year,
    plainDate.month - 1,
    plainDate.day,
    0, 0, 0, 0
  ))
}

/**
 * Parse a date input and return as Temporal.PlainDate
 * Handles various input formats (string, Date, or already PlainDate)
 */
export function parsePlainDate(dateInput: string | Date | Temporal.PlainDate | undefined): Temporal.PlainDate | undefined {
  if (!dateInput) return undefined
  return toPlainDate(dateInput)
}

/**
 * Normalize a date to a Date object for database storage
 * Accepts calendar date strings (YYYY-MM-DD), Date objects, or Temporal.PlainDate
 * Always returns a Date object at UTC midnight representing the calendar date
 */
export function normalizeDateForStorage(date: string | Date | Temporal.PlainDate | undefined): Date | undefined {
  if (!date) return undefined
  const plainDate = toPlainDate(date)
  return plainDateToDate(plainDate)
}

/**
 * Get today's date as a Temporal.PlainDate
 */
export function today(): Temporal.PlainDate {
  const now = new Date()
  return toPlainDate(now)
}

