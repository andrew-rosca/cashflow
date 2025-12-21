import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-tx-filter'

describe('F034: Transaction list filters by selected account', () => {
  let checkingAccountId: string
  let savingsAccountId: string
  let incomeAccountId: string
  let expensesAccountId: string

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
        email: 'filter-test@test.com',
        name: 'Filter Test User',
      },
    })
  })

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.transaction.deleteMany({
      where: { userId: TEST_USER_ID },
    })
    await prisma.cashFlowAccount.deleteMany({
      where: { userId: TEST_USER_ID },
    })

    // Create test accounts
    const checking = await adapter.createAccount(TEST_USER_ID, {
      name: 'Checking',
      initialBalance: 1000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    checkingAccountId = checking.id

    const savings = await adapter.createAccount(TEST_USER_ID, {
      name: 'Savings',
      initialBalance: 5000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    savingsAccountId = savings.id

    const income = await adapter.createAccount(TEST_USER_ID, {
      name: 'Income',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    incomeAccountId = income.id

    const expenses = await adapter.createAccount(TEST_USER_ID, {
      name: 'Expenses',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    expensesAccountId = expenses.id

    // Create test transactions involving different accounts
    // Transaction 1: Income -> Checking (paycheck)
    await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: incomeAccountId,
      toAccountId: checkingAccountId,
      amount: 2000,
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Paycheck',
    })

    // Transaction 2: Checking -> Expenses (rent)
    await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: checkingAccountId,
      toAccountId: expensesAccountId,
      amount: 1200,
      date: LogicalDate.fromString('2025-01-20'),
      description: 'Rent',
    })

    // Transaction 3: Checking -> Savings (transfer)
    await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: checkingAccountId,
      toAccountId: savingsAccountId,
      amount: 500,
      date: LogicalDate.fromString('2025-01-25'),
      description: 'Transfer to savings',
    })

    // Transaction 4: Checking -> Expenses (groceries)
    await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: checkingAccountId,
      toAccountId: expensesAccountId,
      amount: 150,
      date: LogicalDate.fromString('2025-01-28'),
      description: 'Groceries',
    })

    // Transaction 5: Savings -> Checking (emergency withdrawal)
    await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: savingsAccountId,
      toAccountId: checkingAccountId,
      amount: 300,
      date: LogicalDate.fromString('2025-01-30'),
      description: 'Emergency withdrawal',
    })
  })

  it('should show all transactions when no filter is selected', async () => {
    const allTransactions = await adapter.getTransactions(TEST_USER_ID)
    expect(allTransactions.length).toBe(5)
  })

  it('should filter transactions by checking account (both from and to)', async () => {
    const allTransactions = await adapter.getTransactions(TEST_USER_ID)

    // Filter for checking account - should include transactions where checking is either from or to
    const checkingTransactions = allTransactions.filter(
      t => t.fromAccountId === checkingAccountId || t.toAccountId === checkingAccountId
    )

    // Checking account is involved in all 5 transactions
    expect(checkingTransactions.length).toBe(5)

    // Verify all expected transactions are included
    const descriptions = checkingTransactions.map(t => t.description)
    expect(descriptions).toContain('Paycheck') // Income -> Checking
    expect(descriptions).toContain('Rent') // Checking -> Expenses
    expect(descriptions).toContain('Transfer to savings') // Checking -> Savings
    expect(descriptions).toContain('Groceries') // Checking -> Expenses
    expect(descriptions).toContain('Emergency withdrawal') // Savings -> Checking
  })

  it('should filter transactions by savings account (both from and to)', async () => {
    const allTransactions = await adapter.getTransactions(TEST_USER_ID)

    // Filter for savings account
    const savingsTransactions = allTransactions.filter(
      t => t.fromAccountId === savingsAccountId || t.toAccountId === savingsAccountId
    )

    // Savings account is involved in 2 transactions
    expect(savingsTransactions.length).toBe(2)

    const descriptions = savingsTransactions.map(t => t.description)
    expect(descriptions).toContain('Transfer to savings') // Checking -> Savings
    expect(descriptions).toContain('Emergency withdrawal') // Savings -> Checking
  })

  it('should filter transactions by income account (only as from account)', async () => {
    const allTransactions = await adapter.getTransactions(TEST_USER_ID)

    // Filter for income account
    const incomeTransactions = allTransactions.filter(
      t => t.fromAccountId === incomeAccountId || t.toAccountId === incomeAccountId
    )

    // Income account is involved in 1 transaction
    expect(incomeTransactions.length).toBe(1)
    expect(incomeTransactions[0].description).toBe('Paycheck')
    expect(incomeTransactions[0].fromAccountId).toBe(incomeAccountId)
    expect(incomeTransactions[0].toAccountId).toBe(checkingAccountId)
  })

  it('should filter transactions by expenses account (only as to account)', async () => {
    const allTransactions = await adapter.getTransactions(TEST_USER_ID)

    // Filter for expenses account
    const expenseTransactions = allTransactions.filter(
      t => t.fromAccountId === expensesAccountId || t.toAccountId === expensesAccountId
    )

    // Expenses account is involved in 2 transactions
    expect(expenseTransactions.length).toBe(2)

    const descriptions = expenseTransactions.map(t => t.description).sort()
    expect(descriptions).toEqual(['Groceries', 'Rent'])

    // Both should have expenses as the 'to' account
    expenseTransactions.forEach(t => {
      expect(t.toAccountId).toBe(expensesAccountId)
    })
  })

  it('should return empty array when filtering by account with no transactions', async () => {
    // Create a new account with no transactions
    const isolated = await adapter.createAccount(TEST_USER_ID, {
      name: 'Isolated Account',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })

    const allTransactions = await adapter.getTransactions(TEST_USER_ID)

    // Filter for the isolated account
    const isolatedTransactions = allTransactions.filter(
      t => t.fromAccountId === isolated.id || t.toAccountId === isolated.id
    )

    expect(isolatedTransactions.length).toBe(0)
  })
})
