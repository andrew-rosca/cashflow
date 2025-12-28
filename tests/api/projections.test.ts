import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-projections'

describe('Projection Engine Tests', () => {
  let checkingAccountId: string
  let savingsAccountId: string
  let salaryAccountId: string
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
        email: 'projections@test.com',
        name: 'Projection Test User',
      },
    })

    // Create test accounts with balanceAsOf set to start of test period
    const testBalanceDate = LogicalDate.fromString('2025-12-01')

    const checking = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Checking',
      initialBalance: 1000,
      balanceAsOf: testBalanceDate,
    })
    const savings = await adapter.createAccount(TEST_USER_ID, {
      name: 'Test Savings',
      initialBalance: 5000,
      balanceAsOf: testBalanceDate,
    })
    const salary = await adapter.createAccount(TEST_USER_ID, {
      name: 'Salary',
      initialBalance: 0,
      balanceAsOf: testBalanceDate,
    })
    const expense = await adapter.createAccount(TEST_USER_ID, {
      name: 'Groceries',
      initialBalance: 0,
      balanceAsOf: testBalanceDate,
    })

    checkingAccountId = checking.id
    savingsAccountId = savings.id
    salaryAccountId = salary.id
    expenseAccountId = expense.id
  })

  // Clean up transactions before each test to ensure isolation
  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID } })
  })

  describe('F015: Projection engine calculates daily balances', () => {
    it('should calculate balances with initial balance only', async () => {
      const startDate = LogicalDate.fromString('2025-12-01')
      const endDate = LogicalDate.fromString('2025-12-05')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: checkingAccountId,
        startDate,
        endDate,
      })

      expect(projections.length).toBe(5) // 5 days
      expect(projections.every(p => p.balance === 1000)).toBe(true) // No transactions, balance stays at 1000
      expect(projections.every(p => p.accountId === checkingAccountId)).toBe(true)
    })

    it('should calculate balances with one-time income', async () => {
      // Add income on Dec 3
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: salaryAccountId,
        toAccountId: checkingAccountId,
        amount: 500,
        date: LogicalDate.fromString('2025-12-03'),
        description: 'Bonus',
      })

      const startDate = LogicalDate.fromString('2025-12-01')
      const endDate = LogicalDate.fromString('2025-12-05')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: checkingAccountId,
        startDate,
        endDate,
      })

      const balances = projections.map(p => p.balance)
      expect(balances).toEqual([1000, 1000, 1500, 1500, 1500]) // Balance increases on Dec 3
    })

    it('should calculate balances with one-time expense', async () => {
      // Add expense on Dec 2
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: checkingAccountId,
        toAccountId: expenseAccountId,
        amount: 200,
        date: LogicalDate.fromString('2025-12-02'),
        description: 'Shopping',
      })

      // Add income on Dec 3
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: salaryAccountId,
        toAccountId: checkingAccountId,
        amount: 500,
        date: LogicalDate.fromString('2025-12-03'),
        description: 'Bonus',
      })

      const startDate = LogicalDate.fromString('2025-12-01')
      const endDate = LogicalDate.fromString('2025-12-05')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: checkingAccountId,
        startDate,
        endDate,
      })

      const balances = projections.map(p => p.balance)
      expect(balances).toEqual([1000, 800, 1300, 1300, 1300]) // -200 on Dec 2, +500 on Dec 3
    })

    it('should match e2e test scenario: account with $100, expense of -$15 on Jan 20', async () => {
      // Create account matching e2e test: $100 balance as of Jan 15, 2025
      const testAccount = await adapter.createAccount(TEST_USER_ID, {
        name: 'Test Account',
        initialBalance: 100,
        balanceAsOf: LogicalDate.fromString('2025-01-15'),
      })

      // Create expense transaction: -$15 on Jan 20 (same account to same account = self-transfer/expense)
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id,
        amount: -15,
        date: LogicalDate.fromString('2025-01-20'),
        description: 'Test Expense',
      })

      const startDate = LogicalDate.fromString('2025-01-15')
      const endDate = LogicalDate.fromString('2025-01-25')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: testAccount.id,
        startDate,
        endDate,
      })

      // Should have projections for each day
      expect(projections.length).toBeGreaterThan(0)
      
      // Find projection for Jan 20 (transaction date) and Jan 21 (day after)
      const jan20 = projections.find(p => p.date.toString() === '2025-01-20')
      const jan21 = projections.find(p => p.date.toString() === '2025-01-21')

      expect(jan20).toBeDefined()
      expect(jan21).toBeDefined()
      
      // Balance on Jan 20 should be 100 - 15 = 85
      expect(jan20!.balance).toBe(85)
      // Balance on Jan 21 should still be 85 (no more transactions)
      expect(jan21!.balance).toBe(85)
    })
  })

  describe('F016: Projection engine materializes recurring transactions', () => {
    it('should materialize weekly recurring transactions', async () => {
      // Weekly payment every Monday (dayOfWeek: 1) starting Dec 2, 2025
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: salaryAccountId,
        toAccountId: savingsAccountId,
        amount: 100,
        date: LogicalDate.fromString('2025-12-01'), // Monday Dec 1
        description: 'Weekly income',
        recurrence: {
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
        },
      })

      const startDate = LogicalDate.fromString('2025-12-01')
      const endDate = LogicalDate.fromString('2025-12-23') // Extended to ensure Dec 22 is included

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: savingsAccountId,
        startDate,
        endDate,
      })

      // Should have income on Dec 1, 8, 15, 22 (Mondays)
      const balance1 = projections.find(p => p.date.day === 1)?.balance
      const balance8 = projections.find(p => p.date.day === 8)?.balance
      const balance15 = projections.find(p => p.date.day === 15)?.balance
      const balance22 = projections.find(p => p.date.day === 22)?.balance

      expect(balance1).toBe(5100) // Initial 5000 + 100
      expect(balance8).toBe(5200) // +100
      expect(balance15).toBe(5300) // +100
      expect(balance22).toBe(5400) // +100
    })

    it('should materialize monthly recurring transactions', async () => {
      // Monthly payment on 15th of each month
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: savingsAccountId,
        toAccountId: expenseAccountId,
        amount: 50,
        date: LogicalDate.fromString('2025-12-15'),
        description: 'Monthly subscription',
        recurrence: {
          frequency: 'monthly',
          dayOfMonth: 15,
        },
      })

      const startDate = LogicalDate.fromString('2025-12-01')
      const endDate = LogicalDate.fromString('2026-02-28')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: savingsAccountId,
        startDate,
        endDate,
      })

      // Check balances on the 16th (after subscription payment)
      const dec16 = projections.find(p => p.date.month === 12 && p.date.day === 16)
      const jan16 = projections.find(p => p.date.month === 1 && p.date.day === 16)
      const feb16 = projections.find(p => p.date.month === 2 && p.date.day === 16)

      // Each month should show a -50 payment
      expect(dec16!.balance).toBeLessThan(projections[0].balance)
      expect(jan16!.balance).toBeLessThan(dec16!.balance)
      expect(feb16!.balance).toBeLessThan(jan16!.balance)
    })

    it('should materialize bi-weekly recurring transactions', async () => {
      // Bi-weekly payment (every 2 weeks) starting Jan 1
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: expenseAccountId,
        toAccountId: checkingAccountId,
        amount: 1000,
        date: LogicalDate.fromString('2026-01-01'),
        description: 'Bi-weekly paycheck',
        recurrence: {
          frequency: 'weekly',
          interval: 2,
        },
      })

      const startDate = LogicalDate.fromString('2026-01-01')
      const endDate = LogicalDate.fromString('2026-02-15')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: checkingAccountId,
        startDate,
        endDate,
      })

      // Should have income on Jan 1, Jan 15, Jan 29, Feb 12
      const jan1 = projections.find(p => p.date.month === 1 && p.date.day === 1)?.balance
      const jan15 = projections.find(p => p.date.month === 1 && p.date.day === 15)?.balance
      const jan29 = projections.find(p => p.date.month === 1 && p.date.day === 29)?.balance
      const feb12 = projections.find(p => p.date.month === 2 && p.date.day === 12)?.balance

      // Each should be 1000 more than the previous (every 14 days)
      expect(jan15).toBeGreaterThan(jan1!)
      expect(jan29).toBeGreaterThan(jan15!)
      expect(feb12).toBeGreaterThan(jan29!)
    })
  })

  describe('F017: Projection engine handles recurring with end date', () => {
    it('should stop recurring after end date', async () => {
      // Weekly recurring that ends on Dec 15
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: checkingAccountId,
        toAccountId: expenseAccountId,
        amount: 25,
        date: LogicalDate.fromString('2026-03-01'),
        description: 'Weekly expense ending mid-month',
        recurrence: {
          frequency: 'weekly',
          endDate: LogicalDate.fromString('2026-03-15'),
        },
      })

      const startDate = LogicalDate.fromString('2026-03-01')
      const endDate = LogicalDate.fromString('2026-04-01') // Extended to ensure Mar 31 is included

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: checkingAccountId,
        startDate,
        endDate,
      })

      // Check that balance stops decreasing after Mar 15
      const mar1 = projections[0].balance
      const mar16 = projections.find(p => p.date.day === 16)?.balance
      const mar23 = projections.find(p => p.date.day === 23)?.balance
      const mar31 = projections.find(p => p.date.day === 31)?.balance

      expect(mar16).toBeLessThan(mar1)
      expect(mar23).toBe(mar16) // No more payments after end date
      expect(mar31).toBe(mar16) // Balance stays the same
    })

    it('should stop recurring after occurrences limit', async () => {
      // Weekly recurring limited to 3 occurrences
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: expenseAccountId,
        toAccountId: savingsAccountId,
        amount: 200,
        date: LogicalDate.fromString('2026-04-01'),
        description: 'Limited to 3 payments',
        recurrence: {
          frequency: 'weekly',
          occurrences: 3,
        },
      })

      const startDate = LogicalDate.fromString('2026-04-01')
      const endDate = LogicalDate.fromString('2026-05-01') // Extended to ensure Apr 30 is included

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: savingsAccountId,
        startDate,
        endDate,
      })

      const apr1 = projections[0].balance
      const apr8 = projections.find(p => p.date.day === 8)?.balance
      const apr15 = projections.find(p => p.date.day === 15)?.balance
      const apr22 = projections.find(p => p.date.day === 22)?.balance
      const apr30 = projections.find(p => p.date.day === 30)?.balance

      // Should only see 3 increases (Apr 1, 8, 15)
      expect(apr8).toBeGreaterThan(apr1)
      expect(apr15).toBeGreaterThan(apr8!)
      expect(apr22).toBe(apr15) // No 4th payment
      expect(apr30).toBe(apr15) // Balance stays the same
    })
  })

  describe('F018: Projection engine identifies dates where balance <= 0', () => {
    it('should identify when balance drops to zero', async () => {
      // Create new account with low balance
      const lowBalanceAccount = await adapter.createAccount(TEST_USER_ID, {
        name: 'Low Balance Account',
        initialBalance: 100,
        balanceAsOf: LogicalDate.fromString('2026-05-01'),
      })

      // Large expense that will cause negative balance
      const expenseDate = LogicalDate.fromString('2026-05-05')
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: lowBalanceAccount.id,
        toAccountId: expenseAccountId,
        amount: 150,
        date: expenseDate,
        description: 'Overdraft expense',
      })

      const startDate = LogicalDate.fromString('2026-05-01')
      const endDate = LogicalDate.fromString('2026-05-10')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: lowBalanceAccount.id,
        startDate,
        endDate,
      })

      // Find dates with balance <= 0
      const dangerDates = projections.filter(p => p.balance <= 0)
      expect(dangerDates.length).toBeGreaterThan(0)

      // Verify the balance goes negative
      const may4 = projections.find(p => p.date.day === 4)?.balance
      const may5 = projections.find(p => p.date.day === 5)?.balance

      expect(may4).toBe(100) // Still positive before transaction
      expect(may5).toBe(-50) // Negative after $150 expense
    })

    it('should identify multiple danger periods', async () => {
      // Create account with medium balance
      const volatileAccount = await adapter.createAccount(TEST_USER_ID, {
        name: 'Volatile Account',
        initialBalance: 500,
        balanceAsOf: LogicalDate.fromString('2026-06-01'),
      })

      // Multiple transactions causing ups and downs
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: volatileAccount.id,
        toAccountId: expenseAccountId,
        amount: 600,
        date: LogicalDate.fromString('2026-06-05'),
      })
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: salaryAccountId,
        toAccountId: volatileAccount.id,
        amount: 400,
        date: LogicalDate.fromString('2026-06-10'),
      })
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: volatileAccount.id,
        toAccountId: expenseAccountId,
        amount: 500,
        date: LogicalDate.fromString('2026-06-15'),
      })

      const startDate = LogicalDate.fromString('2026-06-01')
      const endDate = LogicalDate.fromString('2026-06-20')

      const projections = await adapter.getProjections(TEST_USER_ID, {
        accountId: volatileAccount.id,
        startDate,
        endDate,
      })

      // Balance should drop below 0 on Jun 5 (-100), recover on Jun 10 (+300), drop again on Jun 15 (-200)
      const jun4 = projections.find(p => p.date.day === 4)?.balance
      const jun5 = projections.find(p => p.date.day === 5)?.balance
      const jun10 = projections.find(p => p.date.day === 10)?.balance
      const jun15 = projections.find(p => p.date.day === 15)?.balance

      expect(jun4).toBe(500)
      expect(jun5).toBe(-100) // Danger!
      expect(jun10).toBe(300) // Recovered
      expect(jun15).toBe(-200) // Danger again!
    })
  })

  describe('Settlement lag integration', () => {
    it('should handle settlement lag in projections', async () => {
      const account1 = await adapter.createAccount(TEST_USER_ID, {
        name: 'Settlement Test 1',
        initialBalance: 1000,
        balanceAsOf: LogicalDate.fromString('2026-07-01'),
      })
      const account2 = await adapter.createAccount(TEST_USER_ID, {
        name: 'Settlement Test 2',
        initialBalance: 0,
        balanceAsOf: LogicalDate.fromString('2026-07-01'),
      })

      // Transfer with 3-day settlement
      await adapter.createTransaction(TEST_USER_ID, {
        fromAccountId: account1.id,
        toAccountId: account2.id,
        amount: 500,
        date: LogicalDate.fromString('2026-07-01'),
        settlementDays: 3,
        description: 'ACH transfer',
      })

      const startDate = LogicalDate.fromString('2026-07-01')
      const endDate = LogicalDate.fromString('2026-07-05')

      const proj1 = await adapter.getProjections(TEST_USER_ID, {
        accountId: account1.id,
        startDate,
        endDate,
      })

      const proj2 = await adapter.getProjections(TEST_USER_ID, {
        accountId: account2.id,
        startDate,
        endDate,
      })

      // Account 1 should be debited immediately on Jul 1
      expect(proj1[0].balance).toBe(500) // 1000 - 500

      // Account 2 should be credited 3 days later on Jul 4
      const jul1_acc2 = proj2[0].balance
      const jul4_acc2 = proj2.find(p => p.date.day === 4)?.balance

      expect(jul1_acc2).toBe(0) // Not credited yet
      expect(jul4_acc2).toBe(500) // Credited after 3 days
    })
  })
})
