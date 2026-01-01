/**
 * Data Adapter Interface
 * 
 * This interface defines the contract for all data storage implementations.
 * The default implementation uses Prisma + SQLite, but this can be
 * replaced with any other storage mechanism (e.g., MongoDB, PostgreSQL, in-memory).
 * 
 * All dates use LogicalDate (calendar dates with no time component).
 */

import type { LogicalDate } from './logical-date'

export interface Account {
  id: string
  userId: string
  name: string
  initialBalance: number
  balanceAsOf: LogicalDate
  externalId?: string
}

export interface Transaction {
  id: string
  userId: string
  amount: number
  fromAccountId: string
  toAccountId: string
  date: LogicalDate
  settlementDays?: number
  description?: string
  recurrence?: RecurrencePattern
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  dayOfWeek?: number
  dayOfMonth?: number | number[]  // Single day or array of days (1-31)
  endDate?: LogicalDate
  occurrences?: number
}

export interface ProjectionData {
  accountId: string
  date: LogicalDate
  balance: number
  previousBalance?: number // Balance on the previous day (if available)
}

export interface DataAdapter {
  // Accounts
  getAccounts(userId: string): Promise<Account[]>
  getAccount(userId: string, accountId: string): Promise<Account | null>
  createAccount(userId: string, account: Omit<Account, 'id' | 'userId'>): Promise<Account>
  updateAccount(userId: string, accountId: string, account: Partial<Account>): Promise<Account>
  deleteAccount(userId: string, accountId: string): Promise<void>

  // Transactions
  getTransactions(userId: string, filters?: {
    accountId?: string
    startDate?: LogicalDate
    endDate?: LogicalDate
    recurring?: boolean
  }): Promise<Transaction[]>
  getTransaction(userId: string, transactionId: string): Promise<Transaction | null>
  createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'userId'>): Promise<Transaction>
  updateTransaction(userId: string, transactionId: string, transaction: Partial<Transaction>): Promise<Transaction>
  deleteTransaction(userId: string, transactionId: string): Promise<void>

  // Projections (computed)
  getProjections(userId: string, options: {
    accountId?: string
    startDate: LogicalDate
    endDate: LogicalDate
  }): Promise<ProjectionData[]>
}
