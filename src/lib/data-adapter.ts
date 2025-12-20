/**
 * Data Adapter Interface
 * 
 * This interface defines the contract for all data storage implementations.
 * The default implementation uses Prisma + PostgreSQL, but this can be
 * replaced with any other storage mechanism (e.g., MongoDB, SQLite, in-memory).
 */

export interface Account {
  id: string
  userId: string
  name: string
  type: 'tracked' | 'external'
  category?: string
  initialBalance?: number
  externalId?: string
}

export interface Transaction {
  id: string
  userId: string
  amount: number
  fromAccountId: string
  toAccountId: string
  date: Date
  settlementDays?: number
  description?: string
  recurrence?: RecurrencePattern
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  interval?: number
  dayOfWeek?: number
  dayOfMonth?: number
  endDate?: Date
  occurrences?: number
}

export interface ProjectionData {
  accountId: string
  date: Date
  balance: number
}

export interface DataAdapter {
  // Accounts
  getAccounts(userId: string, type?: 'tracked' | 'external'): Promise<Account[]>
  getAccount(userId: string, accountId: string): Promise<Account | null>
  createAccount(userId: string, account: Omit<Account, 'id' | 'userId'>): Promise<Account>
  updateAccount(userId: string, accountId: string, account: Partial<Account>): Promise<Account>
  deleteAccount(userId: string, accountId: string): Promise<void>

  // Transactions
  getTransactions(userId: string, filters?: {
    accountId?: string
    startDate?: Date
    endDate?: Date
    recurring?: boolean
  }): Promise<Transaction[]>
  getTransaction(userId: string, transactionId: string): Promise<Transaction | null>
  createTransaction(userId: string, transaction: Omit<Transaction, 'id' | 'userId'>): Promise<Transaction>
  updateTransaction(userId: string, transactionId: string, transaction: Partial<Transaction>): Promise<Transaction>
  deleteTransaction(userId: string, transactionId: string): Promise<void>

  // Projections (computed)
  getProjections(userId: string, options: {
    accountId?: string
    startDate: Date
    endDate: Date
  }): Promise<ProjectionData[]>
}
