import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'

const prisma = new PrismaClient()
const adapter = new PrismaDataAdapter()
const TEST_USER_ID = 'test-user-accounts'

describe('Account API Tests', () => {
  beforeAll(async () => {
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

  describe('F002: Create tracked account', () => {
    it('should create a tracked account with initial balance', async () => {
      const account = await adapter.createAccount(TEST_USER_ID, {
        name: 'Test Checking',
        type: 'tracked',
        initialBalance: 1000,
      })

      expect(account).toBeDefined()
      expect(account.id).toBeDefined()
      expect(account.userId).toBe(TEST_USER_ID)
      expect(account.name).toBe('Test Checking')
      expect(account.type).toBe('tracked')
      expect(account.initialBalance).toBe(1000)
    })
  })

  describe('F003: Create external account', () => {
    it('should create an external account with category', async () => {
      const account = await adapter.createAccount(TEST_USER_ID, {
        name: 'Salary',
        type: 'external',
        category: 'income',
      })

      expect(account).toBeDefined()
      expect(account.id).toBeDefined()
      expect(account.userId).toBe(TEST_USER_ID)
      expect(account.name).toBe('Salary')
      expect(account.type).toBe('external')
      expect(account.category).toBe('income')
    })
  })

  describe('F004: List accounts', () => {
    it('should list all accounts', async () => {
      const accounts = await adapter.getAccounts(TEST_USER_ID)
      expect(accounts).toBeDefined()
      expect(Array.isArray(accounts)).toBe(true)
      expect(accounts.length).toBeGreaterThan(0)
    })

    it('should filter by type=tracked', async () => {
      const accounts = await adapter.getAccounts(TEST_USER_ID, 'tracked')
      expect(accounts).toBeDefined()
      expect(accounts.every(a => a.type === 'tracked')).toBe(true)
    })

    it('should filter by type=external', async () => {
      const accounts = await adapter.getAccounts(TEST_USER_ID, 'external')
      expect(accounts).toBeDefined()
      expect(accounts.every(a => a.type === 'external')).toBe(true)
    })
  })

  describe('F005: Get single account', () => {
    it('should get account by ID', async () => {
      // Create an account first
      const created = await adapter.createAccount(TEST_USER_ID, {
        name: 'Get Test',
        type: 'tracked',
        initialBalance: 500,
      })

      const account = await adapter.getAccount(TEST_USER_ID, created.id)
      expect(account).toBeDefined()
      expect(account?.id).toBe(created.id)
      expect(account?.name).toBe('Get Test')
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
        type: 'tracked',
        initialBalance: 1000,
      })

      const updated = await adapter.updateAccount(TEST_USER_ID, created.id, {
        name: 'Updated Name',
        initialBalance: 2000,
      })

      expect(updated.name).toBe('Updated Name')
      expect(updated.initialBalance).toBe(2000)
    })
  })

  describe('F007: Delete account', () => {
    it('should delete account', async () => {
      const created = await adapter.createAccount(TEST_USER_ID, {
        name: 'Delete Test',
        type: 'external',
      })

      await adapter.deleteAccount(TEST_USER_ID, created.id)

      const account = await adapter.getAccount(TEST_USER_ID, created.id)
      expect(account).toBeNull()
    })
  })
})
