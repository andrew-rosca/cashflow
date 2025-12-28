/**
 * TSV Transaction Format Utilities
 * 
 * Pure functions for serializing and parsing transactions in TSV format.
 * These functions are unit-testable and contain no I/O or database dependencies.
 */

import { LogicalDate } from './logical-date'
import type { Transaction, RecurrencePattern } from './data-adapter'

export const TSV_HEADER = 'ID\tType\tAccount ID\tAmount\tDate\tDescription\tFrequency\tInterval\tDay of Week\tDay of Month\tEnd Date\tOccurrences'

export interface TSVRow {
  id?: string // Transaction ID - if present, update existing; if not, create new
  type: 'one-time' | 'recurring'
  accountId: string // Account ID (not name)
  amount: number
  date: LogicalDate
  description?: string
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  dayOfWeek?: number
  dayOfMonth?: number
  endDate?: LogicalDate
  occurrences?: number
}

export interface ParseError {
  row: number
  message: string
}

/**
 * Serialize a transaction to a TSV row string
 */
export function serializeTransactionToTSV(
  transaction: Transaction
): string {
  const type = transaction.recurrence ? 'recurring' : 'one-time'
  
  // Always include all 12 fields to match the header
  const fields: string[] = [
    transaction.id || '', // Transaction ID (empty for new transactions)
    type,
    transaction.fromAccountId, // Use account ID (fromAccountId and toAccountId are the same in UI)
    transaction.amount.toString(),
    transaction.date.toString(),
    transaction.description || '',
  ]
  
  if (transaction.recurrence) {
    fields.push(
      transaction.recurrence.frequency,
      transaction.recurrence.interval?.toString() || '1',
      transaction.recurrence.dayOfWeek?.toString() || '',
      transaction.recurrence.dayOfMonth?.toString() || '',
      transaction.recurrence.endDate ? transaction.recurrence.endDate.toString() : (transaction.recurrence.occurrences ? '' : '-1'),
      transaction.recurrence.occurrences?.toString() || (transaction.recurrence.endDate ? '' : '-1')
    )
  } else {
    // For one-time transactions, add empty strings for all recurrence fields
    fields.push('', '', '', '', '', '')
  }
  
  // Ensure we always have exactly 12 fields
  while (fields.length < 12) {
    fields.push('')
  }
  
  return fields.join('\t')
}

/**
 * Serialize multiple transactions to a complete TSV string
 */
export function serializeTransactionsToTSV(
  transactions: Transaction[]
): string {
  const rows = transactions.map(tx => serializeTransactionToTSV(tx))
  return [TSV_HEADER, ...rows].join('\n')
}

/**
 * Parse a TSV row string into a TSVRow object
 * Returns null if parsing fails (validation errors are returned separately)
 */
export function parseTSVRow(row: string, rowNumber: number): { row: TSVRow | null; error: ParseError | null } {
  // Remove trailing newline/carriage return but preserve tabs
  const cleanRow = row.replace(/\r?\n$/, '')
  
  // Split by tab and ensure we have at least 12 fields (pad with empty strings if needed)
  const fields = cleanRow.split('\t')
  
  // Handle case where row might be missing the ID field (starts with type instead of ID)
  // If first field is 'one-time' or 'recurring', prepend empty ID field
  if (fields.length > 0 && (fields[0] === 'one-time' || fields[0] === 'recurring')) {
    fields.unshift('') // Add empty ID field at the beginning
  }
  
  // Pad fields to ensure we have at least 12 columns
  while (fields.length < 12) {
    fields.push('')
  }
  
  if (fields.length < 6) {
    return {
      row: null,
      error: {
        row: rowNumber,
        message: `Insufficient columns (expected at least 6, got ${fields.length})`,
      },
    }
  }
  
  const [
    idStr,
    type,
    accountId,
    amountStr,
    dateStr,
    description,
    frequency,
    intervalStr,
    dayOfWeekStr,
    dayOfMonthStr,
    endDateStr,
    occurrencesStr,
  ] = fields
  
  // Validate type
  if (type !== 'one-time' && type !== 'recurring') {
    return {
      row: null,
      error: {
        row: rowNumber,
        message: `Invalid type "${type}" (must be "one-time" or "recurring")`,
      },
    }
  }
  
  // Validate amount
  const amount = parseFloat(amountStr)
  if (isNaN(amount)) {
    return {
      row: null,
      error: {
        row: rowNumber,
        message: `Invalid amount "${amountStr}"`,
      },
    }
  }
  
  // Validate date
  let date: LogicalDate
  try {
    date = LogicalDate.fromString(dateStr)
  } catch (error) {
    return {
      row: null,
      error: {
        row: rowNumber,
        message: `Invalid date "${dateStr}" (expected YYYY-MM-DD)`,
      },
    }
  }
  
  const parsedRow: TSVRow = {
    id: idStr || undefined, // Transaction ID (optional)
    type: type as 'one-time' | 'recurring',
    accountId, // Account ID
    amount,
    date,
    description: description || undefined,
  }
  
  // Handle recurrence for recurring transactions
  if (type === 'recurring') {
    if (!frequency || !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return {
        row: null,
        error: {
          row: rowNumber,
          message: `Invalid frequency "${frequency}" (must be daily, weekly, monthly, or yearly)`,
        },
      }
    }
    
    const interval = intervalStr ? parseInt(intervalStr) : 1
    if (intervalStr && isNaN(interval)) {
      return {
        row: null,
        error: {
          row: rowNumber,
          message: `Invalid interval "${intervalStr}"`,
        },
      }
    }
    
    const dayOfWeek = dayOfWeekStr ? parseInt(dayOfWeekStr) : undefined
    if (dayOfWeekStr && (isNaN(dayOfWeek!) || dayOfWeek! < 1 || dayOfWeek! > 7)) {
      return {
        row: null,
        error: {
          row: rowNumber,
          message: `Invalid day of week "${dayOfWeekStr}" (must be 1-7)`,
        },
      }
    }
    
    const dayOfMonth = dayOfMonthStr ? parseInt(dayOfMonthStr) : undefined
    if (dayOfMonthStr && (isNaN(dayOfMonth!) || dayOfMonth! < 1 || dayOfMonth! > 31)) {
      return {
        row: null,
        error: {
          row: rowNumber,
          message: `Invalid day of month "${dayOfMonthStr}" (must be 1-31)`,
        },
      }
    }
    
    let endDate: LogicalDate | undefined
    if (endDateStr && endDateStr !== '-1' && endDateStr !== '') {
      try {
        endDate = LogicalDate.fromString(endDateStr)
      } catch (error) {
        return {
          row: null,
          error: {
            row: rowNumber,
            message: `Invalid end date "${endDateStr}" (expected YYYY-MM-DD or -1)`,
          },
        }
      }
    }
    
    const occurrences = occurrencesStr && occurrencesStr !== '-1' && occurrencesStr !== '' 
      ? parseInt(occurrencesStr) 
      : undefined
    if (occurrencesStr && occurrencesStr !== '-1' && occurrencesStr !== '' && isNaN(occurrences!)) {
      return {
        row: null,
        error: {
          row: rowNumber,
          message: `Invalid occurrences "${occurrencesStr}"`,
        },
      }
    }
    
    parsedRow.frequency = frequency as 'daily' | 'weekly' | 'monthly' | 'yearly'
    parsedRow.interval = interval || undefined
    parsedRow.dayOfWeek = dayOfWeek || undefined
    parsedRow.dayOfMonth = dayOfMonth || undefined
    parsedRow.endDate = endDate || undefined
    parsedRow.occurrences = occurrences || undefined
  }
  
  return { row: parsedRow, error: null }
}

/**
 * Convert a TSVRow to a Transaction object (requires account name to ID mapping)
 */
export function tsvRowToTransaction(
  tsvRow: TSVRow
): { transaction: Transaction | Omit<Transaction, 'id' | 'userId'> | null; error: ParseError | null } {
  // Account ID is already provided in the TSV row, no need to look it up
  const baseTransaction: any = {
    fromAccountId: tsvRow.accountId,
    toAccountId: tsvRow.accountId, // Use same account for both, matching UI pattern
    amount: tsvRow.amount,
    date: tsvRow.date,
    description: tsvRow.description,
  }
  
  // Add recurrence if present
  if (tsvRow.type === 'recurring' && tsvRow.frequency) {
    baseTransaction.recurrence = {
      frequency: tsvRow.frequency,
      interval: tsvRow.interval,
      dayOfWeek: tsvRow.dayOfWeek,
      dayOfMonth: tsvRow.dayOfMonth,
      endDate: tsvRow.endDate,
      occurrences: tsvRow.occurrences,
    } as RecurrencePattern
  }
  
  // Add ID if present (for updates), otherwise return without ID (for creates)
  const transaction = tsvRow.id 
    ? { ...baseTransaction, id: tsvRow.id } as Transaction
    : baseTransaction as Omit<Transaction, 'id' | 'userId'>
  
  return { transaction, error: null }
}

/**
 * Parse a complete TSV string into TSVRow objects
 */
export function parseTSV(tsv: string): { rows: TSVRow[]; errors: ParseError[] } {
  // Split by newline, but preserve trailing tabs by not trimming yet
  const rawLines = tsv.split('\n').filter(line => line.trim().length > 0)
  
  if (rawLines.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'No data rows in TSV' }] }
  }
  
  // Validate header (trim for comparison, but don't modify the actual line)
  const headerLine = rawLines[0].trim()
  if (headerLine !== TSV_HEADER) {
    return {
      rows: [],
      errors: [{ row: 1, message: `Invalid header. Expected: ${TSV_HEADER}` }],
    }
  }
  
  // Check if there are any data rows (after header)
  if (rawLines.length === 1) {
    return { rows: [], errors: [{ row: 0, message: 'No data rows in TSV' }] }
  }
  
  const rows: TSVRow[] = []
  const errors: ParseError[] = []
  
  // Process data rows (don't trim - we need to preserve trailing tabs for correct field count)
  for (let i = 1; i < rawLines.length; i++) {
    // Remove trailing newline/carriage return but preserve tabs
    const line = rawLines[i].replace(/\r$/, '')
    const result = parseTSVRow(line, i + 1)
    if (result.error) {
      errors.push(result.error)
    } else if (result.row) {
      rows.push(result.row)
    }
  }
  
  return { rows, errors }
}

