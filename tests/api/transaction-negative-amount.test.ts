import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaDataAdapter } from '@/lib/prisma-adapter'
import { LogicalDate } from '@/lib/logical-date'

let prisma: PrismaClient
let adapter: PrismaDataAdapter
const TEST_USER_ID = 'test-user-negative-amount'

describe('Transaction with negative amount', () => {
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
        email: 'negative-amount@test.com',
        name: 'Negative Amount Test User',
      },
    })

    // Create test account
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

    const transaction = await adapter.createTransaction(TEST_USER_ID, {
      fromAccountId: accountId,
      toAccountId: accountId,
      amount: negativeAmount,
      date: LogicalDate.fromString('2025-01-15'),
      description: 'Test expense',
    })

    expect(transaction).toBeDefined()
    expect(transaction.amount).toBe(negativeAmount)
    expect(transaction.amount).toBeLessThan(0)
  })

  it('should preserve negative amount when parsing from form data', () => {
    // Simulate what happens in handleTransactionSubmit
    const formData = new FormData()
    formData.set('amount', '-100.50')
    
    const parsedAmount = parseFloat(formData.get('amount') as string)
    
    expect(parsedAmount).toBe(-100.50)
    expect(parsedAmount).toBeLessThan(0)
  })
})

