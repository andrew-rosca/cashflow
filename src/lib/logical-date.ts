/**
 * LogicalDate - A library for working with calendar dates (no time components)
 * 
 * This library wraps Temporal.PlainDate to provide a clean API for working with
 * logical calendar dates throughout the application. It intentionally does NOT
 * expose any time-related functionality.
 * 
 * All dates are represented as calendar dates (YYYY-MM-DD) with no timezone or
 * time component. This is the correct model for financial transactions, account
 * balances, and projections.
 */

import { Temporal } from '@js-temporal/polyfill'

/**
 * LogicalDate represents a calendar date with no time component
 * 
 * This is the primary type for all date operations in the application.
 * It wraps Temporal.PlainDate and provides a clean API.
 */
export class LogicalDate {
  private readonly _plainDate: Temporal.PlainDate

  private constructor(plainDate: Temporal.PlainDate) {
    this._plainDate = plainDate
  }

  /**
   * Create a LogicalDate from a string (YYYY-MM-DD)
   */
  static fromString(dateString: string): LogicalDate {
    // Handle various date string formats
    // Extract just the date part if it includes time
    let dateOnly = dateString.split('T')[0].split(' ')[0] // Handle both ISO and space-separated formats
    // If it's not in YYYY-MM-DD format, try to parse it
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      // If it looks like a Date.toString() output, reject it
      if (dateString.includes('GMT') || dateString.includes('Mon ') || dateString.includes('Tue ') || 
          dateString.includes('Wed ') || dateString.includes('Thu ') || dateString.includes('Fri ') ||
          dateString.includes('Sat ') || dateString.includes('Sun ')) {
        throw new Error(`Invalid date string format: "${dateString}". Expected YYYY-MM-DD format.`)
      }
      // Try to extract date components from other formats
      const dateMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (dateMatch) {
        dateOnly = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      } else {
        throw new Error(`Invalid date string format: "${dateString}". Expected YYYY-MM-DD format.`)
      }
    }
    return new LogicalDate(Temporal.PlainDate.from(dateOnly))
  }

  /**
   * Create a LogicalDate from year, month, day
   */
  static from(year: number, month: number, day: number): LogicalDate {
    return new LogicalDate(Temporal.PlainDate.from({ year, month, day }))
  }

  /**
   * Parse a date input (string or LogicalDate) and return LogicalDate
   * Does NOT accept Date objects - forces proper refactoring
   */
  static parse(input: string | LogicalDate | undefined): LogicalDate | undefined {
    if (!input) return undefined
    if (input instanceof LogicalDate) return input
    if (typeof input === 'string') return LogicalDate.fromString(input)
    throw new Error('LogicalDate.parse does not accept Date objects. Use fromString() or from() instead.')
  }

  /**
   * Get the year
   */
  get year(): number {
    return this._plainDate.year
  }

  /**
   * Get the month (1-12)
   */
  get month(): number {
    return this._plainDate.month
  }

  /**
   * Get the day of month (1-31)
   */
  get day(): number {
    return this._plainDate.day
  }

  /**
   * Get the day of week (1 = Monday, 7 = Sunday)
   */
  get dayOfWeek(): number {
    return this._plainDate.dayOfWeek
  }

  /**
   * Get number of days in the month
   */
  get daysInMonth(): number {
    return this._plainDate.daysInMonth
  }

  /**
   * Convert to ISO string (YYYY-MM-DD)
   */
  toString(): string {
    return this._plainDate.toString()
  }

  /**
   * Convert to ISO string (alias for toString)
   */
  toISOString(): string {
    return this.toString()
  }

  /**
   * Add days to this date
   */
  addDays(days: number): LogicalDate {
    return new LogicalDate(this._plainDate.add({ days }))
  }

  /**
   * Add months to this date
   */
  addMonths(months: number): LogicalDate {
    return new LogicalDate(this._plainDate.add({ months }))
  }

  /**
   * Add years to this date
   */
  addYears(years: number): LogicalDate {
    return new LogicalDate(this._plainDate.add({ years }))
  }

  /**
   * Subtract days from this date
   */
  subtractDays(days: number): LogicalDate {
    return this.addDays(-days)
  }

  /**
   * Subtract months from this date
   */
  subtractMonths(months: number): LogicalDate {
    return this.addMonths(-months)
  }

  /**
   * Subtract years from this date
   */
  subtractYears(years: number): LogicalDate {
    return this.addYears(-years)
  }

  /**
   * Compare this date with another
   * Returns: -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: LogicalDate): number {
    return Temporal.PlainDate.compare(this._plainDate, other._plainDate)
  }

  /**
   * Check if this date equals another
   */
  equals(other: LogicalDate): boolean {
    return this.compare(other) === 0
  }

  /**
   * Check if this date is before another
   */
  isBefore(other: LogicalDate): boolean {
    return this.compare(other) < 0
  }

  /**
   * Check if this date is after another
   */
  isAfter(other: LogicalDate): boolean {
    return this.compare(other) > 0
  }

  /**
   * Check if this date is on or before another
   */
  isOnOrBefore(other: LogicalDate): boolean {
    return this.compare(other) <= 0
  }

  /**
   * Check if this date is on or after another
   */
  isOnOrAfter(other: LogicalDate): boolean {
    return this.compare(other) >= 0
  }

  /**
   * Get the difference in days between this date and another
   */
  differenceInDays(other: LogicalDate): number {
    return this._plainDate.until(other._plainDate).total({ unit: 'day' })
  }

  /**
   * Get the underlying Temporal.PlainDate (for advanced operations)
   * WARNING: This exposes Temporal internals - use sparingly
   */
  get plainDate(): Temporal.PlainDate {
    return this._plainDate
  }
}

/**
 * Helper function to create a LogicalDate from string input
 * Does NOT accept Date objects - use LogicalDate.from() for year/month/day
 */
export function logicalDate(input: string | LogicalDate | undefined): LogicalDate | undefined {
  return LogicalDate.parse(input)
}

/**
 * Helper function to ensure a LogicalDate (throws if undefined)
 * Does NOT accept Date objects
 */
export function requireLogicalDate(input: string | LogicalDate | undefined): LogicalDate {
  const result = LogicalDate.parse(input)
  if (!result) {
    throw new Error('Expected a valid date but got undefined')
  }
  return result
}

