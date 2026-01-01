/**
 * Prisma Data Adapter
 * 
 * Reference implementation of the DataAdapter interface using Prisma + SQLite.
 * 
 * All dates are stored as strings (YYYY-MM-DD) in the database and converted
 * to/from LogicalDate objects for application use.
 */

import { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from './db'
import type { DataAdapter, Account, Transaction, ProjectionData } from './data-adapter'
import { LogicalDate } from './logical-date'
import { Temporal } from '@js-temporal/polyfill'

// Helper functions to convert between array and JSON/String for dayOfMonth
// PostgreSQL uses Json type, SQLite uses String type
function dayOfMonthToDbValue(dayOfMonth: number | number[] | undefined, dbUrl?: string): any {
  if (dayOfMonth === undefined || dayOfMonth === null) return null
  const array = Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth]
  
  // Check if we're using SQLite (String) or PostgreSQL (Json)
  const isPostgres = dbUrl ? (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) : 
    (process.env.DATABASE_URL?.startsWith('postgresql://') || process.env.DATABASE_URL?.startsWith('postgres://'))
  
  if (isPostgres) {
    // PostgreSQL: return as JSON array
    return array
  } else {
    // SQLite: return as JSON string
    return JSON.stringify(array)
  }
}

function dayOfMonthFromDbValue(dbValue: any): number | number[] | undefined {
  if (dbValue === null || dbValue === undefined) return undefined
  
  // Handle JSON array (PostgreSQL)
  if (Array.isArray(dbValue)) {
    return dbValue.length === 1 ? dbValue[0] : dbValue
  }
  
  // Handle JSON string (SQLite)
  if (typeof dbValue === 'string') {
    // Check if it's a JSON string (starts with '[')
    const trimmed = dbValue.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(dbValue)
        if (Array.isArray(parsed)) {
          return parsed.length === 1 ? parsed[0] : parsed
        }
        // If parsed to a single value, return it
        if (typeof parsed === 'number') {
          return parsed
        }
      } catch (e) {
        // If JSON parsing fails, return undefined (don't fall through to parseInt for JSON strings)
        return undefined
      }
    }
    // Try to parse as single number (legacy format or non-JSON string)
    // Only do this if it doesn't look like JSON
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      const num = parseInt(dbValue, 10)
      if (!isNaN(num)) return num
    }
  }
  
  // Handle legacy single integer values
  if (typeof dbValue === 'number') {
    return dbValue
  }
  
  return undefined
}

export class PrismaDataAdapter implements DataAdapter {
  private prisma: PrismaClient

  constructor(prismaInstance?: PrismaClient) {
    if (prismaInstance) {
      this.prisma = prismaInstance
    } else if (process.env.NODE_ENV === 'test') {
      // In test mode, always create a fresh Prisma client
      // This ensures each adapter instance uses the current DATABASE_URL
      // and avoids caching issues across test runs
      this.prisma = new PrismaClient()
    } else {
      // In production/development, use the singleton Proxy
      this.prisma = defaultPrisma
    }
  }
  // Accounts
  async getAccounts(userId: string): Promise<Account[]> {
    const accounts = await this.prisma.cashFlowAccount.findMany({
      where: {
        userId,
      },
    })
    return accounts.map(acc => ({
      ...acc,
      balanceAsOf: LogicalDate.fromString(acc.balanceAsOf),
    })) as Account[]
  }

  async getAccount(userId: string, accountId: string): Promise<Account | null> {
    const account = await this.prisma.cashFlowAccount.findFirst({
      where: { id: accountId, userId },
    })
    if (!account) return null
    return {
      ...account,
      balanceAsOf: LogicalDate.fromString(account.balanceAsOf),
    } as Account
  }

  async createAccount(userId: string, account: Omit<Account, 'id' | 'userId'>): Promise<Account> {
    const created = await this.prisma.cashFlowAccount.create({
      data: {
        userId,
        name: account.name,
        initialBalance: account.initialBalance,
        balanceAsOf: account.balanceAsOf.toString(), // Convert LogicalDate to string
        externalId: account.externalId,
      },
    })
    return {
      ...created,
      balanceAsOf: LogicalDate.fromString(created.balanceAsOf),
    } as Account
  }

  async updateAccount(userId: string, accountId: string, account: Partial<Account>): Promise<Account> {
    const updateData: any = {}
    if (account.name !== undefined) updateData.name = account.name
    if (account.initialBalance !== undefined) updateData.initialBalance = account.initialBalance
    if (account.balanceAsOf !== undefined) updateData.balanceAsOf = account.balanceAsOf.toString()
    if (account.externalId !== undefined) updateData.externalId = account.externalId

    const updated = await this.prisma.cashFlowAccount.update({
      where: { id: accountId },
      data: updateData,
    })
    return {
      ...updated,
      balanceAsOf: LogicalDate.fromString(updated.balanceAsOf),
    } as Account
  }

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    await this.prisma.cashFlowAccount.delete({
      where: { id: accountId, userId },
    })
  }

  // Transactions
  async getTransactions(userId: string, filters?: {
    accountId?: string
    startDate?: LogicalDate
    endDate?: LogicalDate
    recurring?: boolean
  }): Promise<Transaction[]> {
    const whereClause: any = { userId }
    
    // Build account filter
    const accountConditions: any[] = []
    if (filters?.accountId) {
      accountConditions.push({ fromAccountId: filters.accountId })
      accountConditions.push({ toAccountId: filters.accountId })
    }
    
    // Build date filter: include ALL recurring transactions (regardless of start date)
    // because they may have future occurrences even if they started in the past.
    // One-time transactions are filtered by their date field.
    const dateConditions: any[] = []
    if (filters?.startDate || filters?.endDate) {
      dateConditions.push(
        // One-time transactions within the date range
        {
          recurrence: null,
          date: {
            ...(filters.startDate && { gte: filters.startDate.toString() }),
            ...(filters.endDate && { lte: filters.endDate.toString() }),
          },
        },
        // All recurring transactions (they'll be materialized client-side to show next occurrence)
        {
          recurrence: { isNot: null },
        }
      )
    }
    
    // Combine filters: account filter AND (date filter OR all transactions if no date filter)
    if (accountConditions.length > 0 && dateConditions.length > 0) {
      whereClause.AND = [
        { OR: accountConditions },
        { OR: dateConditions },
      ]
    } else if (accountConditions.length > 0) {
      whereClause.OR = accountConditions
    } else if (dateConditions.length > 0) {
      whereClause.OR = dateConditions
    }

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        recurrence: true,
      },
    })

    return transactions.map(t => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      date: LogicalDate.fromString(t.date),
      settlementDays: t.settlementDays ?? undefined,
      description: t.description ?? undefined,
      recurrence: t.recurrence ? {
        frequency: t.recurrence.frequency as any,
        interval: t.recurrence.interval ?? undefined,
        dayOfWeek: t.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: dayOfMonthFromDbValue(t.recurrence.dayOfMonth as any),
        endDate: t.recurrence.endDate ? LogicalDate.fromString(t.recurrence.endDate) : undefined,
        occurrences: t.recurrence.occurrences ?? undefined,
      } : undefined,
    })) as Transaction[]
  }

  async getTransaction(userId: string, transactionId: string): Promise<Transaction | null> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      include: { recurrence: true },
    })

    if (!transaction) return null

    return {
      id: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
      date: LogicalDate.fromString(transaction.date),
      settlementDays: transaction.settlementDays ?? undefined,
      description: transaction.description ?? undefined,
      recurrence: transaction.recurrence ? {
        frequency: transaction.recurrence.frequency as any,
        interval: transaction.recurrence.interval ?? undefined,
        dayOfWeek: transaction.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: dayOfMonthFromDbValue(transaction.recurrence.dayOfMonth),
        endDate: transaction.recurrence.endDate ? LogicalDate.fromString(transaction.recurrence.endDate) : undefined,
        occurrences: transaction.recurrence.occurrences ?? undefined,
      } : undefined,
    } as Transaction
  }

  async createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'userId'>): Promise<Transaction> {
    const created = await this.prisma.transaction.create({
      data: {
        userId,
        amount: transaction.amount,
        fromAccountId: transaction.fromAccountId,
        toAccountId: transaction.toAccountId,
        date: transaction.date.toString(), // Convert LogicalDate to string
        settlementDays: transaction.settlementDays,
        description: transaction.description,
        recurrence: transaction.recurrence ? {
          create: {
            frequency: transaction.recurrence.frequency,
            interval: transaction.recurrence.interval,
            dayOfWeek: transaction.recurrence.dayOfWeek,
            dayOfMonth: dayOfMonthToDbValue(transaction.recurrence.dayOfMonth, this.dbUrl),
            endDate: transaction.recurrence.endDate?.toString(), // Convert LogicalDate to string
            occurrences: transaction.recurrence.occurrences,
          },
        } : undefined,
      },
      include: { recurrence: true },
    })

    return {
      id: created.id,
      userId: created.userId,
      amount: created.amount,
      fromAccountId: created.fromAccountId,
      toAccountId: created.toAccountId,
      date: LogicalDate.fromString(created.date),
      settlementDays: created.settlementDays ?? undefined,
      description: created.description ?? undefined,
      recurrence: created.recurrence ? {
        frequency: created.recurrence.frequency as any,
        interval: created.recurrence.interval ?? undefined,
        dayOfWeek: created.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: dayOfMonthFromDbValue(created.recurrence.dayOfMonth as any),
        endDate: created.recurrence.endDate ? LogicalDate.fromString(created.recurrence.endDate) : undefined,
        occurrences: created.recurrence.occurrences ?? undefined,
      } : undefined,
    } as Transaction
  }

  async updateTransaction(userId: string, transactionId: string, transaction: Partial<Transaction>): Promise<Transaction> {
    const updateData: any = {}
    if (transaction.amount !== undefined) updateData.amount = transaction.amount
    if (transaction.fromAccountId !== undefined) updateData.fromAccountId = transaction.fromAccountId
    if (transaction.toAccountId !== undefined) updateData.toAccountId = transaction.toAccountId
    if (transaction.date !== undefined) updateData.date = transaction.date.toString()
    if (transaction.settlementDays !== undefined) updateData.settlementDays = transaction.settlementDays
    if (transaction.description !== undefined) updateData.description = transaction.description

    // Handle recurrence updates
    if (transaction.recurrence !== undefined) {
      if (transaction.recurrence === null) {
        // Delete recurrence if set to null
        updateData.recurrence = { delete: true }
      } else {
        // Update or create recurrence
        updateData.recurrence = {
          upsert: {
            create: {
              frequency: transaction.recurrence.frequency,
              interval: transaction.recurrence.interval ?? null,
              dayOfWeek: transaction.recurrence.dayOfWeek ?? null,
              dayOfMonth: dayOfMonthToDbValue(transaction.recurrence.dayOfMonth, this.dbUrl),
              endDate: transaction.recurrence.endDate ? transaction.recurrence.endDate.toString() : null,
              occurrences: transaction.recurrence.occurrences ?? null,
            },
            update: {
              frequency: transaction.recurrence.frequency,
              interval: transaction.recurrence.interval ?? null,
              dayOfWeek: transaction.recurrence.dayOfWeek ?? null,
              dayOfMonth: dayOfMonthToDbValue(transaction.recurrence.dayOfMonth, this.dbUrl),
              endDate: transaction.recurrence.endDate ? transaction.recurrence.endDate.toString() : null,
              occurrences: transaction.recurrence.occurrences ?? null,
            },
          },
        }
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
      include: { recurrence: true },
    })

    return {
      id: updated.id,
      userId: updated.userId,
      amount: updated.amount,
      fromAccountId: updated.fromAccountId,
      toAccountId: updated.toAccountId,
      date: LogicalDate.fromString(updated.date),
      settlementDays: updated.settlementDays ?? undefined,
      description: updated.description ?? undefined,
      recurrence: updated.recurrence ? {
        frequency: updated.recurrence.frequency as any,
        interval: updated.recurrence.interval ?? undefined,
        dayOfWeek: updated.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: dayOfMonthFromDbValue(updated.recurrence.dayOfMonth as any),
        endDate: updated.recurrence.endDate ? LogicalDate.fromString(updated.recurrence.endDate) : undefined,
        occurrences: updated.recurrence.occurrences ?? undefined,
      } : undefined,
    } as Transaction
  }

  async deleteTransaction(userId: string, transactionId: string): Promise<void> {
    await this.prisma.transaction.delete({
      where: { id: transactionId, userId },
    })
  }

  // Projections
  async getProjections(userId: string, options: {
    accountId?: string
    startDate: LogicalDate
    endDate: LogicalDate
  }): Promise<ProjectionData[]> {
    const { accountId, startDate, endDate } = options

    // Get accounts to project
    const accountsToProject = accountId
      ? [await this.getAccount(userId, accountId)]
      : await this.getAccounts(userId)

    const accounts = accountsToProject.filter(a => a !== null) as Account[]
    if (accounts.length === 0) {
      return []
    }

    // Get all transactions (both one-time and recurring)
    // Don't filter by date here - we want all transactions and will filter in the projection loop
    const transactions = await this.getTransactions(userId, {
      accountId,
    })
    

    // Materialize all transactions into specific date events
    const events: Array<{
      date: LogicalDate
      accountId: string
      amount: number // positive = credit, negative = debit
    }> = []

    for (const tx of transactions) {
      if (tx.recurrence) {
        // Materialize recurring transactions
        const occurrences = this.materializeRecurringTransaction(tx, startDate, endDate)
        for (const occurrence of occurrences) {
          this.addTransactionEvents(events, occurrence, accounts)
        }
      } else {
        // For one-time transactions, include all of them
        // The projection loop will only process dates within the range,
        // so transactions outside the range won't affect the projection
        // but transactions within the range will be included
        this.addTransactionEvents(events, tx, accounts)
      }
    }

    // Sort events by date
    events.sort((a, b) => a.date.compare(b.date))

    // Calculate daily balances for each account
    const projections: ProjectionData[] = []

    for (const account of accounts) {
      let currentBalance = account.initialBalance
      const balanceDate = account.balanceAsOf

      // Start projecting from the later of balanceAsOf or startDate
      const startProjectionDate = balanceDate.compare(startDate) > 0 
        ? balanceDate 
        : startDate

      let currentDate = startProjectionDate
      let previousBalance: number | undefined = undefined

      while (currentDate.compare(endDate) <= 0) {
        // Store the balance at the start of this date (before applying events)
        // For the first date (balanceAsOf), this is the initialBalance
        // For subsequent dates, this is the balance at the end of the previous day
        const balanceAtStartOfDate = currentBalance

        // Apply all events for this account on this date
        const dateEvents = events.filter(e => {
          if (e.accountId !== account.id) return false
          return e.date.equals(currentDate)
        })

        for (const event of dateEvents) {
          currentBalance += event.amount
        }

        // For the first date (balanceAsOf), previousBalance should be the balance before events
        // For subsequent dates, previousBalance is the balance at the end of the previous day
        const effectivePreviousBalance = previousBalance !== undefined 
          ? previousBalance 
          : balanceAtStartOfDate // Use initial balance for first date

        // Record the balance for this date, including previous balance
        projections.push({
          accountId: account.id,
          date: currentDate,
          balance: currentBalance,
          previousBalance: effectivePreviousBalance,
        })

        // Update previousBalance for the next iteration
        // This is the balance at the END of currentDate (after applying events)
        previousBalance = currentBalance

        // Move to next day
        currentDate = currentDate.addDays(1)
      }
    }

    return projections
  }

  private materializeRecurringTransaction(
    tx: Transaction,
    startDate: LogicalDate,
    endDate: LogicalDate
  ): Transaction[] {
    if (!tx.recurrence) return []

    const occurrences: Transaction[] = []
    const { frequency, interval = 1, dayOfWeek, dayOfMonth, endDate: recEndDate, occurrences: maxOccurrences } = tx.recurrence

    let currentDate = tx.date
    
    // For weekly recurrences with dayOfWeek, adjust the start date to the correct day of week
    if (frequency === 'weekly' && dayOfWeek !== undefined && dayOfWeek !== null) {
      const startDayOfWeek = currentDate.dayOfWeek
      if (startDayOfWeek !== dayOfWeek) {
        // Find the next occurrence of the target day of week
        let daysToAdd = dayOfWeek - startDayOfWeek
        if (daysToAdd < 0) {
          daysToAdd += 7
        }
        currentDate = currentDate.addDays(daysToAdd)
      }
    }
    
    const recurrenceEnd = recEndDate ? recEndDate : endDate
    const effectiveEnd = recurrenceEnd.compare(endDate) <= 0 
      ? recurrenceEnd 
      : endDate

    let totalCount = 0 // Total occurrences generated (for occurrences limit)

    // Special handling for monthly with multiple days
    if (frequency === 'monthly' && dayOfMonth) {
      const daysArray = Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth]
      let monthDate = currentDate

      // For monthly with dayOfMonth, generate all days in each month
      while (monthDate.compare(effectiveEnd) <= 0 && (!maxOccurrences || totalCount < maxOccurrences)) {
        const currentMonth = monthDate.month
        const currentYear = monthDate.year
        const daysInMonth = LogicalDate.from(currentYear, currentMonth, 1).daysInMonth

        // Generate occurrences for all days in the array for this month
        for (const day of daysArray) {
          if (maxOccurrences && totalCount >= maxOccurrences) break

          const targetDay = Math.min(day, daysInMonth)
          const occurrenceDate = LogicalDate.from(currentYear, currentMonth, targetDay)

          // Only include if within the date range
          if (occurrenceDate.compare(startDate) >= 0 && occurrenceDate.compare(endDate) <= 0 && occurrenceDate.compare(effectiveEnd) <= 0) {
            occurrences.push({
              ...tx,
              date: occurrenceDate,
            })
            totalCount++
          }
        }

        // Move to next month
        monthDate = monthDate.addMonths(interval)

        // Safety check
        if (totalCount > 10000) break
      }
    } else {
      // Standard logic for other frequencies
      while (currentDate.compare(effectiveEnd) <= 0) {
        if (currentDate.compare(startDate) >= 0 && currentDate.compare(endDate) <= 0) {
          occurrences.push({
            ...tx,
            date: currentDate,
          })
        }

        totalCount++
        if (maxOccurrences && totalCount >= maxOccurrences) break

        // Calculate next occurrence
        switch (frequency) {
          case 'daily':
            currentDate = currentDate.addDays(interval)
            break
          case 'weekly':
            // Add the interval weeks
            currentDate = currentDate.addDays(7 * interval)
            // If dayOfWeek is specified, adjust to that day of week
            if (dayOfWeek !== undefined && dayOfWeek !== null) {
              const currentDayOfWeek = currentDate.dayOfWeek
              let daysToAdd = dayOfWeek - currentDayOfWeek
              // If the target day is earlier in the week, add 7 days to wrap around
              if (daysToAdd < 0) {
                daysToAdd += 7
              }
              // If daysToAdd is 0, we're already on the correct day
              if (daysToAdd > 0) {
                currentDate = currentDate.addDays(daysToAdd)
              }
            }
            break
          case 'monthly':
            currentDate = currentDate.addMonths(interval)
            if (dayOfMonth) {
              // Set to specific day of month, handling month-end edge cases
              const daysInMonth = currentDate.daysInMonth
              const targetDay = Array.isArray(dayOfMonth)
                ? Math.min(dayOfMonth[0], daysInMonth)
                : Math.min(dayOfMonth, daysInMonth)
              currentDate = LogicalDate.from(currentDate.year, currentDate.month, targetDay)
            }
            break
          case 'yearly':
            currentDate = currentDate.addYears(interval)
            break
        }

        // Safety check to prevent infinite loops
        if (totalCount > 10000) break
      }
    }

    return occurrences
  }

  private addTransactionEvents(
    events: Array<{ date: LogicalDate; accountId: string; amount: number }>,
    tx: Transaction,
    trackedAccounts: Account[]
  ) {
    const fromAccount = trackedAccounts.find(a => a.id === tx.fromAccountId)
    const toAccount = trackedAccounts.find(a => a.id === tx.toAccountId)
    const settlementDays = tx.settlementDays || 0


    // If both accounts are the same (self-transfer or expense/income), apply the amount directly
    // This represents a direct change to the account balance
    if (fromAccount && toAccount && tx.fromAccountId === tx.toAccountId) {
      // Same account: apply the transaction amount directly (preserve sign)
      // Negative amount = expense (outflow), positive amount = income (inflow)
      events.push({
        date: tx.date,
        accountId: fromAccount.id,
        amount: tx.amount, // Use amount directly, preserving sign
      })
    } else {
      // Different accounts: split into debit and credit
      // Handle both positive and negative amounts correctly
      // If amount is positive: money flows from fromAccount to toAccount
      // If amount is negative: money flows from fromAccount to toAccount (expense/outflow)
      
      // Debit event (money leaves fromAccount)
      if (fromAccount) {
        // For positive amounts: debit = -amount (money leaves)
        // For negative amounts: amount is already negative, use it directly
        const debitAmount = tx.amount < 0 ? tx.amount : -tx.amount
        events.push({
          date: tx.date,
          accountId: fromAccount.id,
          amount: debitAmount, // negative = debit
        })
      }

      // Credit event (money arrives at toAccount)
      if (toAccount) {
        // Calculate credit date (transaction date + settlement days)
        const creditDate = tx.date.addDays(settlementDays)
        // For positive amounts: credit = +amount (money arrives)
        // For negative amounts: credit should also be negative (reverse flow)
        // But typically negative amounts mean expense, so toAccount might not be tracked
        // Use absolute value for credit to maintain double-entry consistency
        const creditAmount = tx.amount < 0 ? -tx.amount : tx.amount
        events.push({
          date: creditDate,
          accountId: toAccount.id,
          amount: creditAmount, // positive = credit
        })
      }
    }
  }
}

// Create a function that returns the dataAdapter singleton
// This ensures the Prisma client is always current (via the Proxy)
let _dataAdapter: PrismaDataAdapter | null = null

function getDataAdapter(): PrismaDataAdapter {
  // In test mode, always create a fresh adapter to avoid caching issues
  // The adapter will still use the Proxy for prisma, which checks DATABASE_URL
  if (process.env.NODE_ENV === 'test') {
    return new PrismaDataAdapter()
  }
  
  // In production/development, use singleton for performance
  if (!_dataAdapter) {
    _dataAdapter = new PrismaDataAdapter()
  }
  return _dataAdapter
}

export const dataAdapter = getDataAdapter()
