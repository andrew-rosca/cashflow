import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'

const prisma = new PrismaClient()
const adapter = new PrismaDataAdapter()
const TEST_USER_ID = 'test-user-transactions'

describe('Transaction API Tests', () => {
  let trackedAccountId: string
  let externalAccountId: string

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: 'transactions@test.com',
        name: 'Transaction Test User',
      },
    })

    // Create test accounts
    const tracked = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Checking',
      initialBalance: 1000,
      balanceAsOf: new Date(),
    })
    const external = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Salary',
      initialBalance: 0,
      balanceAsOf: new Date(),
    })

    trackedAccountId = tracked.id
    externalAccountId = external.id
  })

  describe('F008: Create one-time transaction', () => {
    it('should create a one-time transaction', async () => {
      const transaction = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: externalAccountId,
        toAccountId: trackedAccountId,
        amount: 500,
        date: new Date('2025-12-15'),
        description: 'Test paycheck',
      })

      expect(transaction).toBeDefined()
      expect(transaction.id).toBeDefined()
      expect(transaction.userId).toBe(TEST_USER_ID)
      expect(transaction.amount).toBe(500)
      expect(transaction.fromAccountId).toBe(externalAccountId)
      expect(transaction.toAccountId).toBe(trackedAccountId)
      expect(transaction.description).toBe('Test paycheck')
      expect(transaction.recurrence).toBeUndefined()
    })
  })

  describe('F009: Create recurring transaction', () => {
    it('should create a recurring transaction', async () => {
      const transaction = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: externalAccountId,
        toAccountId: trackedAccountId,
        amount: 200,
        date: new Date('2025-12-01'),
        description: 'Weekly income',
        recurrence: {
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
        },
      })

      expect(transaction).toBeDefined()
      expect(transaction.recurrence).toBeDefined()
      expect(transaction.recurrence?.frequency).toBe('weekly')
      expect(transaction.recurrence?.dayOfWeek).toBe(1)
    })
  })

  describe('F010: List transactions', () => {
    it('should list all transactions', async () => {
      const transactions = await adapter.getTransactions(TEST_USER_ID)
      expect(transactions).toBeDefined()
      expect(Array.isArray(transactions)).toBe(true)
      expect(transactions.length).toBeGreaterThan(0)
    })

    it('should filter by accountId', async () => {
      const transactions = await adapter.getTransactions(TEST_USER_ID, {
        accountId: trackedAccountId,
      })
      expect(transactions).toBeDefined()
      expect(transactions.every(
        t => t.fromAccountId === trackedAccountId || t.toAccountId === trackedAccountId
      )).toBe(true)
    })
  })

  describe('F011: Get single transaction', () => {
    it('should get transaction by ID', async () => {
      const created = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: externalAccountId,
        toAccountId: trackedAccountId,
        amount: 100,
        date: new Date('2025-12-20'),
      })

      const transaction = await adapter.getTransaction(TEST_USER_ID, created.id)
      expect(transaction).toBeDefined()
      expect(transaction?.id).toBe(created.id)
      expect(transaction?.amount).toBe(100)
    })

    it('should return null for non-existent transaction', async () => {
      const transaction = await adapter.getTransaction(TEST_USER_ID, 'nonexistent123')
      expect(transaction).toBeNull()
    })
  })

  describe('F012: Update transaction', () => {
    it('should update transaction fields', async () => {
      const created = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: externalAccountId,
        toAccountId: trackedAccountId,
        amount: 300,
        date: new Date('2025-12-10'),
      })

      const updated = await adapter.updateTransaction(TEST_USER_ID, created.id, {
        amount: 350,
        description: 'Updated description',
      })

      expect(updated.amount).toBe(350)
      expect(updated.description).toBe('Updated description')
    })
  })

  describe('F013: Delete transaction', () => {
    it('should delete transaction', async () => {
      const created = await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: externalAccountId,
        toAccountId: trackedAccountId,
        amount: 50,
        date: new Date('2025-12-05'),
      })

      await adapter.deleteTransaction(TEST_USER_ID, created.id)

      const transaction = await adapter.getTransaction(TEST_USER_ID, created.id)
      expect(transaction).toBeNull()
    })
  })
})
