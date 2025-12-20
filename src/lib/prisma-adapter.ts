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

  // Projections (stub - to be implemented)
  async getProjections(userId: string, options: {
    accountId?: string
    startDate: Date
    endDate: Date
  }): Promise<ProjectionData[]> {
    // TODO: Implement projection calculation logic
    // This will materialize recurring transactions and calculate daily balances
    return []
  }
}

export const dataAdapter = new PrismaDataAdapter()
