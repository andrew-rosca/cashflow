import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-balance-bug'

/**
 * Balance After Transaction Bug - API Integration Test
 * 
 * This test reproduces a bug where the projection shows incorrect balance
 * after a transaction. The scenario:
 * 1. Account has $100 balance on Dec 1
 * 2. Transaction of -$15 on Dec 15
 * 3. Balance on Dec 28 should be 85, not 100
 * 
 * This test will help determine if the bug is in the server-side projection
 * logic or just in the UI.
 */
describe('Balance After Transaction Bug - API Test', () => {
  let trackedAccountId: string
  let expenseAccountId: string

  beforeAll(async () => {
    // Create PrismaClient after DATABASE_URL is set by vitest.setup.ts
    prisma = new PrismaClient()
    adapter = new PrismaDataAdapter(prisma)
    
    // Clean up any existing test data
    await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID } })
    await prisma.cashFlowAccount.deleteMany({ where: { userId: TEST_USER_ID } })
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })

    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'balance-bug@test.com',
        name: 'Balance Bug Test User',
      },
    })

    // Create test accounts
    const testBalanceDate = LogicalDate.fromString('2025-12-01')

    // Create tracked account with $100 balance on Dec 1
    const tracked = await adapter.createAccount(TEST_USER_ID, {
      name: 'New Account',
      initialBalance: 100,
      balanceAsOf: testBalanceDate,
    })

    // Create expense account (external account for expenses)
    const expense = await adapter.createAccount(TEST_USER_ID, {
      name: 'Expense',
      initialBalance: 0,
      balanceAsOf: testBalanceDate,
    })

    trackedAccountId = tracked.id
    expenseAccountId = expense.id
  })

  // Clean up transactions before each test to ensure isolation
  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID } })
  })

  it('should show correct balance on Dec 28 after transaction of -$15 on Dec 15', async () => {
    // Create transaction of -$15 on Dec 15
    // This is an expense: money leaves the tracked account
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: trackedAccountId,
      toAccountId: expenseAccountId,
      amount: -15,
      date: LogicalDate.fromString('2025-12-15'),
      description: 'Test Expense',
    })

    expect(transaction).toBeDefined()
    expect(transaction.amount).toBe(-15)
    expect(transaction.date.toString()).toBe('2025-12-15')

    // Get projections from Dec 1 to Dec 31
    const startDate = LogicalDate.fromString('2025-12-01')
    const endDate = LogicalDate.fromString('2025-12-31')

    const projections = await adapter.getProjections(TEST_USER_ID, {
      accountId: trackedAccountId,
      startDate,
      endDate,
    })

    expect(projections.length).toBeGreaterThan(0)

    // Find the projection for Dec 28
    const dec28Projection = projections.find((p) => p.date.toString() === '2025-12-28')

    expect(dec28Projection).toBeDefined()

    // THIS IS THE KEY ASSERTION - This should be 85, but the bug might make it 100 or 115
    // Expected: 85 (100 - 15)
    // Bug might show: 100 (transaction not applied) or 115 (transaction added instead of subtracted)
    console.log('Dec 28 projection:', dec28Projection)
    expect(dec28Projection!.balance).toBe(85) // Expected: 85, but bug shows: 100 or 115

    // Additional verification: Check balance on Dec 15 (transaction date)
    const dec15Projection = projections.find((p) => p.date.toString() === '2025-12-15')
    expect(dec15Projection).toBeDefined()
    console.log('Dec 15 projection:', dec15Projection)
    expect(dec15Projection!.balance).toBe(85) // Should be 85 on the transaction date

    // Verify balance before transaction is still 100
    const dec14Projection = projections.find((p) => p.date.toString() === '2025-12-14')
    expect(dec14Projection).toBeDefined()
    console.log('Dec 14 projection:', dec14Projection)
    expect(dec14Projection!.balance).toBe(100) // Should still be 100 before transaction

    // Verify balance on Dec 1 is 100
    const dec1Projection = projections.find((p) => p.date.toString() === '2025-12-01')
    expect(dec1Projection).toBeDefined()
    expect(dec1Projection!.balance).toBe(100) // Initial balance
  })
})

