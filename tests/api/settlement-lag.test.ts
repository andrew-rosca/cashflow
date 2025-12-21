import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'

const prisma = new PrismaClient()
const adapter = new PrismaDataAdapter()
const TEST_USER_ID = 'test-user-settlement'

describe('F014: Settlement Lag Tests', () => {
  let checkingAccountId: string
  let savingsAccountId: string

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: 'settlement@test.com',
        name: 'Settlement Test User',
      },
    })

    // Create two accounts for transfers
    const checking = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Checking',
      initialBalance: 5000,
      balanceAsOf: new Date(),
    })
    const savings = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Savings',
      initialBalance: 10000,
      balanceAsOf: new Date(),
    })

    checkingAccountId = checking.id
    savingsAccountId = savings.id
  })

  it('should create transaction with settlementDays > 0', async () => {
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: checkingAccountId,
      toAccountId: savingsAccountId,
      amount: 1000,
      date: new Date('2025-12-20'),
      settlementDays: 3,
      description: 'ACH transfer with 3-day settlement',
    })

    expect(transaction).toBeDefined()
    expect(transaction.id).toBeDefined()
    expect(transaction.settlementDays).toBe(3)
    expect(transaction.fromAccountId).toBe(checkingAccountId)
    expect(transaction.toAccountId).toBe(savingsAccountId)
    expect(transaction.amount).toBe(1000)
  })

  it('should retrieve transaction with settlement lag', async () => {
    const created = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: savingsAccountId,
      toAccountId: checkingAccountId,
      amount: 500,
      date: new Date('2025-12-25'),
      settlementDays: 5,
      description: 'Check deposit with 5-day hold',
    })

    const retrieved = await adapter.getTransaction(TEST_USER_ID, created.id)

    expect(retrieved).toBeDefined()
    expect(retrieved?.settlementDays).toBe(5)
    expect(retrieved?.description).toBe('Check deposit with 5-day hold')
  })

  it('should update settlementDays on existing transaction', async () => {
    const created = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: checkingAccountId,
      toAccountId: savingsAccountId,
      amount: 750,
      date: new Date('2025-12-28'),
      settlementDays: 2,
    })

    const updated = await adapter.updateTransaction(TEST_USER_ID, created.id, {
      settlementDays: 4,
    })

    expect(updated.settlementDays).toBe(4)
  })

  it('should create transaction with no settlement lag (undefined)', async () => {
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: checkingAccountId,
      toAccountId: savingsAccountId,
      amount: 200,
      date: new Date('2025-12-22'),
      description: 'Instant transfer',
    })

    expect(transaction).toBeDefined()
    expect(transaction.settlementDays).toBeUndefined()
  })

  it('should handle zero settlementDays (instant settlement)', async () => {
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: savingsAccountId,
      toAccountId: checkingAccountId,
      amount: 150,
      date: new Date('2025-12-23'),
      settlementDays: 0,
      description: 'Same-day transfer',
    })

    expect(transaction).toBeDefined()
    expect(transaction.settlementDays).toBe(0)
  })
})
