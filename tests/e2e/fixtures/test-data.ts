import { PrismaClient } from '@prisma/client'

// Helper to convert dayOfMonth to database format
function dayOfMonthToDbValue(dayOfMonth: number | number[] | undefined): any {
  if (dayOfMonth === undefined) return null
  const array = Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth]
  
  const dbUrl = process.env.DATABASE_URL || ''
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
  
  if (isPostgres) {
    // PostgreSQL: return as JSON array
    return array
  } else {
    // SQLite: return as JSON string
    return JSON.stringify(array)
  }
}

// Helper to convert dayOfWeek to database format
function dayOfWeekToDbValue(dayOfWeek: number | number[] | undefined): any {
  if (dayOfWeek === undefined) return null
  const array = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek]
  
  const dbUrl = process.env.DATABASE_URL || ''
  const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
  
  if (isPostgres) {
    // PostgreSQL: return as JSON array
    return array
  } else {
    // SQLite: return as JSON string
    return JSON.stringify(array)
  }
}
import { today } from '@/lib/logical-date'

/**
 * Test Data Helpers
 * 
 * Utilities for creating test data in E2E tests.
 * These helpers use Prisma directly to set up test scenarios.
 */

const TEST_USER_ID = 'e2e-test-user'

/**
 * Get or create the test user
 */
export async function getTestUser(prisma: PrismaClient) {
  return await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: 'e2e-test@example.com',
      name: 'E2E Test User',
    },
  })
}

/**
 * Create a test tracked account
 */
export async function createTestAccount(
  prisma: PrismaClient,
  options: {
    name?: string
    initialBalance?: number
    balanceAsOf?: string
  } = {}
) {
  const user = await getTestUser(prisma)
  
  return await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: options.name || 'Test Checking',
      initialBalance: options.initialBalance ?? 1000,
      balanceAsOf: options.balanceAsOf || today().toString(),
    },
  })
}

/**
 * Create a test external account
 */
export async function createTestExternalAccount(
  prisma: PrismaClient,
  options: {
    name?: string
    category?: string
  } = {}
) {
  const user = await getTestUser(prisma)
  
  return await prisma.cashFlowAccount.create({
    data: {
      userId: user.id,
      name: options.name || 'Test Expense',
      initialBalance: 0,
      balanceAsOf: today().toString(),
    },
  })
}

/**
 * Create a test transaction
 */
export async function createTestTransaction(
  prisma: PrismaClient,
  options: {
    fromAccountId: string
    toAccountId: string
    amount?: number
    date?: string
    description?: string
    settlementDays?: number
  }
) {
  const user = await getTestUser(prisma)
  
  return await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: options.fromAccountId,
      toAccountId: options.toAccountId,
      amount: options.amount ?? 100,
      date: options.date || today().toString(),
      description: options.description,
      settlementDays: options.settlementDays,
    },
  })
}

/**
 * Create a test recurring transaction
 */
export async function createTestRecurringTransaction(
  prisma: PrismaClient,
  options: {
    fromAccountId: string
    toAccountId: string
    amount?: number
    date?: string
    description?: string
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    dayOfWeek?: number | number[]
    dayOfMonth?: number | number[]
    interval?: number
    endDate?: string
    occurrences?: number
  }
) {
  const user = await getTestUser(prisma)
  
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      fromAccountId: options.fromAccountId,
      toAccountId: options.toAccountId,
      amount: options.amount ?? 100,
      date: options.date || today().toString(),
      description: options.description,
    },
  })

  await prisma.recurrence.create({
    data: {
      transactionId: transaction.id,
      frequency: options.frequency,
      dayOfWeek: dayOfWeekToDbValue(options.dayOfWeek),
      dayOfMonth: dayOfMonthToDbValue(options.dayOfMonth),
      interval: options.interval,
      endDate: options.endDate,
      occurrences: options.occurrences,
    },
  })

  return transaction
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(prisma: PrismaClient) {
  await prisma.recurrence.deleteMany({
    where: {
      transaction: {
        userId: TEST_USER_ID,
      },
    },
  })
  
  await prisma.transaction.deleteMany({
    where: {
      userId: TEST_USER_ID,
    },
  })
  
  await prisma.cashFlowAccount.deleteMany({
    where: {
      userId: TEST_USER_ID,
    },
  })
  
  await prisma.user.deleteMany({
    where: {
      id: TEST_USER_ID,
    },
  })
}

