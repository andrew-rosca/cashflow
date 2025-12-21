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

export class PrismaDataAdapter implements DataAdapter {
  private prisma: PrismaClient

  constructor(prismaInstance?: PrismaClient) {
    this.prisma = prismaInstance ?? defaultPrisma
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
    
    if (filters?.accountId) {
      whereClause.OR = [
        { fromAccountId: filters.accountId },
        { toAccountId: filters.accountId },
      ]
    }

    if (filters?.startDate || filters?.endDate) {
      whereClause.date = {}
      if (filters.startDate) {
        whereClause.date.gte = filters.startDate.toString()
      }
      if (filters.endDate) {
        whereClause.date.lte = filters.endDate.toString()
      }
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
        dayOfMonth: t.recurrence.dayOfMonth ?? undefined,
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
        dayOfMonth: transaction.recurrence.dayOfMonth ?? undefined,
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
            dayOfMonth: transaction.recurrence.dayOfMonth,
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
        dayOfMonth: created.recurrence.dayOfMonth ?? undefined,
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
        dayOfMonth: updated.recurrence.dayOfMonth ?? undefined,
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
    if (accounts.length === 0) return []

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

      while (currentDate.compare(endDate) <= 0) {
        // Apply all events for this account on this date
        const dateEvents = events.filter(e => {
          if (e.accountId !== account.id) return false
          return e.date.equals(currentDate)
        })

        for (const event of dateEvents) {
          currentBalance += event.amount
        }

        // Record the balance for this date
        projections.push({
          accountId: account.id,
          date: currentDate,
          balance: currentBalance,
        })

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
    const recurrenceEnd = recEndDate ? recEndDate : endDate
    const effectiveEnd = recurrenceEnd.compare(endDate) <= 0 
      ? recurrenceEnd 
      : endDate

    let totalCount = 0 // Total occurrences generated (for occurrences limit)

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
          currentDate = currentDate.addDays(7 * interval)
          break
        case 'monthly':
          currentDate = currentDate.addMonths(interval)
          if (dayOfMonth) {
            // Set to specific day of month, handling month-end edge cases
            const daysInMonth = currentDate.daysInMonth
            const targetDay = Math.min(dayOfMonth, daysInMonth)
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
      // Debit event (money leaves fromAccount)
      if (fromAccount) {
        events.push({
          date: tx.date,
          accountId: fromAccount.id,
          amount: -tx.amount, // negative = debit
        })
      }

      // Credit event (money arrives at toAccount)
      if (toAccount) {
        // Calculate credit date (transaction date + settlement days)
        const creditDate = tx.date.addDays(settlementDays)
        events.push({
          date: creditDate,
          accountId: toAccount.id,
          amount: tx.amount, // positive = credit
        })
      }
    }
  }
}

export const dataAdapter = new PrismaDataAdapter()
