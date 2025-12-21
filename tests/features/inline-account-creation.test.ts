import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-inline-account'

describe('F027: Inline account creation during transaction entry', () => {
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
        email: 'inline-test@test.com',
        name: 'Inline Account Test User',
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
  })

  it('should create account and use it in transaction (from account)', async () => {
    // Step 1: Simulate user creating a new account inline during transaction entry
    const newAccount = await adapter.createAccount(TEST_USER_ID, {
      name: 'New Checking Account',
      initialBalance: 1000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    expect(newAccount.id).toBeDefined()
    expect(newAccount.name).toBe('New Checking Account')
    expect(newAccount.initialBalance).toBe(1000)

    // Step 2: Create another account for the "to" side
    const toAccount = await adapter.createAccount(TEST_USER_ID, {
      name: 'Expense Account',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })

    // Step 3: Now create transaction using the newly created account
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: newAccount.id, // Using the newly created account
      toAccountId: toAccount.id,
      amount: 50,
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Test transaction with new account',
    })
    expect(transaction.id).toBeDefined()
    expect(transaction.fromAccountId).toBe(newAccount.id)
    expect(transaction.toAccountId).toBe(toAccount.id)
    expect(transaction.amount).toBe(50)
  })

  it('should create account and use it in transaction (to account)', async () => {
    // Step 1: Create "from" account first
    const fromAccount = await adapter.createAccount(TEST_USER_ID, {
      name: 'Source Account',
      initialBalance: 1000,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })

    // Step 2: Simulate creating new account on the fly for "to" side
    const newAccount = await adapter.createAccount(TEST_USER_ID, {
      name: 'New Savings Account',
      initialBalance: 0,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    expect(newAccount.id).toBeDefined()
    expect(newAccount.name).toBe('New Savings Account')
    expect(newAccount.initialBalance).toBe(0)

    // Step 3: Create transaction using the newly created account
    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: fromAccount.id,
      toAccountId: newAccount.id, // Using the newly created account
      amount: 200,
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Transfer to new savings',
    })
    expect(transaction.id).toBeDefined()
    expect(transaction.fromAccountId).toBe(fromAccount.id)
    expect(transaction.toAccountId).toBe(newAccount.id)
    expect(transaction.amount).toBe(200)
  })

  it('should list newly created account immediately', async () => {
    // Create an account
    const newAccount = await adapter.createAccount(TEST_USER_ID, {
      name: 'Quick Create Account',
      initialBalance: 500,
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    expect(newAccount.id).toBeDefined()
    expect(newAccount.name).toBe('Quick Create Account')

    // Immediately fetch accounts list
    const accounts = await adapter.getAccounts(TEST_USER_ID)

    // Verify new account is in the list
    const foundAccount = accounts.find((a: any) => a.id === newAccount.id)
    expect(foundAccount).toBeDefined()
    expect(foundAccount!.name).toBe('Quick Create Account')
    expect(foundAccount!.initialBalance).toBe(500)
  })

  it('should create account with minimal information', async () => {
    // Create account with just name and default balance
    const newAccount = await adapter.createAccount(TEST_USER_ID, {
      name: 'Minimal Account',
      initialBalance: 0, // Default to 0
      balanceAsOf: LogicalDate.fromString('2025-01-01'),
    })
    expect(newAccount.id).toBeDefined()
    expect(newAccount.name).toBe('Minimal Account')
    expect(newAccount.initialBalance).toBe(0)
  })
})
