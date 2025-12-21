/**
 * Prisma Data Adapter
 * 
 * Reference implementation of the DataAdapter interface using Prisma + PostgreSQL.
 */

import { prisma } from './db'
import type { DataAdapter, Account, Transaction, ProjectionData } from './data-adapter'

export class PrismaDataAdapter implements DataAdapter {
  // Accounts
  async getAccounts(userId: string, type?: 'tracked' | 'external'): Promise<Account[]> {
    const accounts = await prisma.cashFlowAccount.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
    })
    return accounts as Account[]
  }

  async getAccount(userId: string, accountId: string): Promise<Account | null> {
    const account = await prisma.cashFlowAccount.findFirst({
      where: { id: accountId, userId },
    })
    return account as Account | null
  }

  async createAccount(userId: string, account: Omit<Account, 'id' | 'userId'>): Promise<Account> {
    const created = await prisma.cashFlowAccount.create({
      data: {
        userId,
        ...account,
      },
    })
    return created as Account
  }

  async updateAccount(userId: string, accountId: string, account: Partial<Account>): Promise<Account> {
    const updated = await prisma.cashFlowAccount.update({
      where: { id: accountId },
      data: account,
    })
    return updated as Account
  }

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    await prisma.cashFlowAccount.delete({
      where: { id: accountId, userId },
    })
  }

  // Transactions
  async getTransactions(userId: string, filters?: {
    accountId?: string
    startDate?: Date
    endDate?: Date
    recurring?: boolean
  }): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        ...(filters?.accountId ? {
          OR: [
            { fromAccountId: filters.accountId },
            { toAccountId: filters.accountId },
          ],
        } : {}),
        ...(filters?.startDate || filters?.endDate ? {
          date: {
            ...(filters.startDate ? { gte: filters.startDate } : {}),
            ...(filters.endDate ? { lte: filters.endDate } : {}),
          },
        } : {}),
      },
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
      date: t.date,
      settlementDays: t.settlementDays ?? undefined,
      description: t.description ?? undefined,
      recurrence: t.recurrence ? {
        frequency: t.recurrence.frequency as any,
        interval: t.recurrence.interval ?? undefined,
        dayOfWeek: t.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: t.recurrence.dayOfMonth ?? undefined,
        endDate: t.recurrence.endDate ?? undefined,
        occurrences: t.recurrence.occurrences ?? undefined,
      } : undefined,
    })) as Transaction[]
  }

  async getTransaction(userId: string, transactionId: string): Promise<Transaction | null> {
    const transaction = await prisma.transaction.findFirst({
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
      date: transaction.date,
      settlementDays: transaction.settlementDays ?? undefined,
      description: transaction.description ?? undefined,
      recurrence: transaction.recurrence ? {
        frequency: transaction.recurrence.frequency as any,
        interval: transaction.recurrence.interval ?? undefined,
        dayOfWeek: transaction.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: transaction.recurrence.dayOfMonth ?? undefined,
        endDate: transaction.recurrence.endDate ?? undefined,
        occurrences: transaction.recurrence.occurrences ?? undefined,
      } : undefined,
    } as Transaction
  }

  async createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'userId'>): Promise<Transaction> {
    const created = await prisma.transaction.create({
      data: {
        userId,
        amount: transaction.amount,
        fromAccountId: transaction.fromAccountId,
        toAccountId: transaction.toAccountId,
        date: transaction.date,
        settlementDays: transaction.settlementDays,
        description: transaction.description,
        recurrence: transaction.recurrence ? {
          create: transaction.recurrence,
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
      date: created.date,
      settlementDays: created.settlementDays ?? undefined,
      description: created.description ?? undefined,
      recurrence: created.recurrence ? {
        frequency: created.recurrence.frequency as any,
        interval: created.recurrence.interval ?? undefined,
        dayOfWeek: created.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: created.recurrence.dayOfMonth ?? undefined,
        endDate: created.recurrence.endDate ?? undefined,
        occurrences: created.recurrence.occurrences ?? undefined,
      } : undefined,
    } as Transaction
  }

  async updateTransaction(userId: string, transactionId: string, transaction: Partial<Transaction>): Promise<Transaction> {
    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...(transaction.amount !== undefined ? { amount: transaction.amount } : {}),
        ...(transaction.fromAccountId ? { fromAccountId: transaction.fromAccountId } : {}),
        ...(transaction.toAccountId ? { toAccountId: transaction.toAccountId } : {}),
        ...(transaction.date ? { date: transaction.date } : {}),
        ...(transaction.settlementDays !== undefined ? { settlementDays: transaction.settlementDays } : {}),
        ...(transaction.description !== undefined ? { description: transaction.description } : {}),
      },
      include: { recurrence: true },
    })

    return {
      id: updated.id,
      userId: updated.userId,
      amount: updated.amount,
      fromAccountId: updated.fromAccountId,
      toAccountId: updated.toAccountId,
      date: updated.date,
      settlementDays: updated.settlementDays ?? undefined,
      description: updated.description ?? undefined,
      recurrence: updated.recurrence ? {
        frequency: updated.recurrence.frequency as any,
        interval: updated.recurrence.interval ?? undefined,
        dayOfWeek: updated.recurrence.dayOfWeek ?? undefined,
        dayOfMonth: updated.recurrence.dayOfMonth ?? undefined,
        endDate: updated.recurrence.endDate ?? undefined,
        occurrences: updated.recurrence.occurrences ?? undefined,
      } : undefined,
    } as Transaction
  }

  async deleteTransaction(userId: string, transactionId: string): Promise<void> {
    await prisma.transaction.delete({
      where: { id: transactionId, userId },
    })
  }

  // Projections
  async getProjections(userId: string, options: {
    accountId?: string
    startDate: Date
    endDate: Date
  }): Promise<ProjectionData[]> {
    const { accountId, startDate, endDate } = options

    // Get tracked accounts
    const accountsToProject = accountId
      ? [await this.getAccount(userId, accountId)]
      : await this.getAccounts(userId, 'tracked')

    const trackedAccounts = accountsToProject.filter(a => a && a.type === 'tracked') as Account[]
    if (trackedAccounts.length === 0) return []

    // Get all transactions (both one-time and recurring)
    const transactions = await this.getTransactions(userId, {
      accountId,
    })

    // Materialize all transactions into specific date events
    const events: Array<{
      date: Date
      accountId: string
      amount: number // positive = credit, negative = debit
    }> = []

    for (const tx of transactions) {
      if (tx.recurrence) {
        // Materialize recurring transactions
        const occurrences = this.materializeRecurringTransaction(tx, startDate, endDate)
        for (const occurrence of occurrences) {
          this.addTransactionEvents(events, occurrence, trackedAccounts)
        }
      } else {
        // Add one-time transaction
        this.addTransactionEvents(events, tx, trackedAccounts)
      }
    }

    // Sort events by date
    events.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Calculate daily balances for each account
    const projections: ProjectionData[] = []

    for (const account of trackedAccounts) {
      let currentBalance = account.initialBalance || 0
      let currentDate = new Date(startDate)
      currentDate.setHours(0, 0, 0, 0)

      const endDateCopy = new Date(endDate)
      endDateCopy.setHours(23, 59, 59, 999)

      while (currentDate <= endDateCopy) {
        // Apply all events for this account on this date
        const dateEvents = events.filter(e =>
          e.accountId === account.id &&
          this.isSameDay(e.date, currentDate)
        )

        for (const event of dateEvents) {
          currentBalance += event.amount
        }

        // Record the balance for this date
        projections.push({
          accountId: account.id,
          date: new Date(currentDate),
          balance: currentBalance,
        })

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    return projections
  }

  private materializeRecurringTransaction(
    tx: Transaction,
    startDate: Date,
    endDate: Date
  ): Transaction[] {
    if (!tx.recurrence) return []

    const occurrences: Transaction[] = []
    const { frequency, interval = 1, dayOfWeek, dayOfMonth, endDate: recEndDate, occurrences: maxOccurrences } = tx.recurrence

    let currentDate = new Date(tx.date)
    currentDate.setHours(0, 0, 0, 0)

    const projectionStart = new Date(startDate)
    projectionStart.setHours(0, 0, 0, 0)

    const projectionEnd = new Date(endDate)
    projectionEnd.setHours(23, 59, 59, 999)

    const recurrenceEnd = recEndDate ? new Date(recEndDate) : projectionEnd
    const effectiveEnd = recurrenceEnd < projectionEnd ? recurrenceEnd : projectionEnd

    let totalCount = 0 // Total occurrences generated (for occurrences limit)

    while (currentDate <= effectiveEnd) {
      if (currentDate >= projectionStart && currentDate <= projectionEnd) {
        occurrences.push({
          ...tx,
          date: new Date(currentDate),
        })
      }

      totalCount++
      if (maxOccurrences && totalCount >= maxOccurrences) break

      // Calculate next occurrence
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + interval)
          break
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * interval))
          break
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + interval)
          if (dayOfMonth) {
            // Set to specific day of month, handling month-end edge cases
            const targetDay = Math.min(dayOfMonth, this.getDaysInMonth(currentDate))
            currentDate.setDate(targetDay)
          }
          break
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + interval)
          break
      }

      // Safety check to prevent infinite loops
      if (totalCount > 10000) break
    }

    return occurrences
  }

  private addTransactionEvents(
    events: Array<{ date: Date; accountId: string; amount: number }>,
    tx: Transaction,
    trackedAccounts: Account[]
  ) {
    const fromAccount = trackedAccounts.find(a => a.id === tx.fromAccountId)
    const toAccount = trackedAccounts.find(a => a.id === tx.toAccountId)
    const settlementDays = tx.settlementDays || 0

    // Debit event (money leaves fromAccount)
    if (fromAccount) {
      events.push({
        date: new Date(tx.date),
        accountId: fromAccount.id,
        amount: -tx.amount, // negative = debit
      })
    }

    // Credit event (money arrives at toAccount)
    if (toAccount) {
      const creditDate = new Date(tx.date)
      creditDate.setDate(creditDate.getDate() + settlementDays)

      events.push({
        date: creditDate,
        accountId: toAccount.id,
        amount: tx.amount, // positive = credit
      })
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }
}

export const dataAdapter = new PrismaDataAdapter()
