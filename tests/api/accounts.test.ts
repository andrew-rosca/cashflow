import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-accounts'

describe('Account API Tests', () => {
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
        email: 'accounts@test.com',
        name: 'Account Test User',
      },
    })
  })

  describe('F002: Create account', () => {
    it('should create an account with initial balance and balanceAsOf', async () => {
      const balanceAsOf = LogicalDate.fromString('2025-12-01')
      const account = await adapter.createAccount(TEST_USER_ID, {
        name: 'Test Checking',
        initialBalance: 1000,
        balanceAsOf,
      })

      expect(account).toBeDefined()
      expect(account.id).toBeDefined()
      expect(account.userId).toBe(TEST_USER_ID)
      expect(account.name).toBe('Test Checking')
      expect(account.initialBalance).toBe(1000)
      expect(account.balanceAsOf).toBeDefined()
    })
  })

  describe('F003: Create account with default balanceAsOf', () => {
    it('should create an account with balanceAsOf defaulting to today', async () => {
      // Use a fixed date for testing instead of "today"
      const balanceAsOf = LogicalDate.fromString('2025-12-15')
      const account = await adapter.createAccount(TEST_USER_ID, {
        name: 'Savings Account',
        initialBalance: 500,
        balanceAsOf,
      })

      expect(account).toBeDefined()
      expect(account.id).toBeDefined()
      expect(account.userId).toBe(TEST_USER_ID)
      expect(account.name).toBe('Savings Account')
      expect(account.balanceAsOf).toBeDefined()
    })
  })

  describe('F004: List accounts', () => {
    it('should list all accounts', async () => {
      const accounts = await adapter.getAccounts(TEST_USER_ID)
      expect(accounts).toBeDefined()
      expect(Array.isArray(accounts)).toBe(true)
      expect(accounts.length).toBeGreaterThan(0)
    })
  })

  describe('F005: Get single account', () => {
    it('should get account by ID', async () => {
      // Create an account first
      const created = await adapter.createAccount(TEST_USER_ID, {
        name: 'Get Test',
        initialBalance: 500,
        balanceAsOf: LogicalDate.fromString('2025-12-15'),
      })

      const account = await adapter.getAccount(TEST_USER_ID, created.id)
      expect(account).toBeDefined()
      expect(account?.id).toBe(created.id)
      expect(account?.name).toBe('Get Test')
      expect(account?.balanceAsOf).toBeDefined()
    })

    it('should return null for non-existent account', async () => {
      const account = await adapter.getAccount(TEST_USER_ID, 'nonexistent123')
      expect(account).toBeNull()
    })
  })

  describe('F006: Update account', () => {
    it('should update account fields', async () => {
      const created = await adapter.createAccount(TEST_USER_ID, {
        name: 'Update Test',
        initialBalance: 1000,
        balanceAsOf: LogicalDate.fromString('2025-12-01'),
      })

      const newBalanceAsOf = LogicalDate.fromString('2025-12-15')
      const updated = await adapter.updateAccount(TEST_USER_ID, created.id, {
        name: 'Updated Name',
        initialBalance: 2000,
        balanceAsOf: newBalanceAsOf,
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.initialBalance).toBe(2000)
    })
  })

  describe('F007: Delete account', () => {
    it('should delete account', async () => {
      const created = await adapter.createAccount(TEST_USER_ID, {
        name: 'Delete Test',
        initialBalance: 0,
        balanceAsOf: LogicalDate.fromString('2025-12-15'),
      })

      await adapter.deleteAccount(TEST_USER_ID, created.id)

      const account = await adapter.getAccount(TEST_USER_ID, created.id)
      expect(account).toBeNull()
    })
  })
})
