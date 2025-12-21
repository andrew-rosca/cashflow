import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-negative-api'

describe('Transaction API - Negative Amount Bug', () => {
  let accountId: string

  beforeAll(async () => {
    // Create PrismaClient after DATABASE_URL is set by vitest.setup.ts
    prisma = new PrismaClient()
    adapter = new PrismaDataAdapter(prisma)
    // Create test user
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: 'negative-api@test.com',
        name: 'Negative API Test User',
      },
    })

    // Create test account using adapter (not API) to avoid hitting real server
    const account = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Checking',
      initialBalance: 1000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    accountId = account.id
  })

  beforeEach(async () => {
    // Clean up transactions before each test
    await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID } })
  })

  it('should save negative amount as negative when creating transaction', async () => {
    const negativeAmount = -100.50

    // Test using adapter directly (not API) to use ephemeral database
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: accountId,
      toAccountId: accountId,
      amount: negativeAmount,
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Test expense',
    })

    // The amount should be negative
    expect(transaction.amount).toBe(negativeAmount)
    expect(transaction.amount).toBeLessThan(0)
  })

  it('should preserve negative amount when amount is parsed from string', async () => {
    // Simulate what happens when amount comes as string from form
    const amountString = '-100.50'
    const parsedAmount = parseFloat(amountString)

    // Create transaction with parsed amount
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: accountId,
      toAccountId: accountId,
      amount: parsedAmount, // This is what the API route does: parseFloat(string)
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Test expense',
    })

    // The amount should be negative even when parsed from string
    expect(transaction.amount).toBe(-100.50)
    expect(transaction.amount).toBeLessThan(0)
  })

  it('should preserve negative amount when updating transaction', async () => {
    // First create a transaction
    const created = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: accountId,
      toAccountId: accountId,
      amount: 50,
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Initial transaction',
    })

    // Update with negative amount (simulating string parsing)
    const amountString = '-75.25'
    const parsedAmount = parseFloat(amountString)

    const updated = await adapter.updateTransaction(TEST_USER_ID, created.id, {
      amount: parsedAmount,
    })

    // The amount should be negative
    expect(updated.amount).toBe(-75.25)
    expect(updated.amount).toBeLessThan(0)
  })
})

