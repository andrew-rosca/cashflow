import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TEST_USER_ID = 'test-user-negative-api'
const API_BASE = 'http://localhost:3000'

describe('Transaction API - Negative Amount Bug', () => {
  let accountId: string

  beforeAll(async () => {
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

    // Create test account
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Checking',
        initialBalance: 1000,
        balanceAsOf: new Date('2025-01-01').toISOString(),
      }),
    })
    const account = await accountRes.json()
    accountId = account.id
  })

  beforeEach(async () => {
    // Clean up transactions before each test
    await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID } })
  })

  it('should save negative amount as negative when POSTing to API', async () => {
    const negativeAmount = -100.50

    const response = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: accountId,
        toAccountId: accountId,
        amount: negativeAmount,
        date: new Date('2025-01-15').toISOString(),
        description: 'Test expense',
      }),
    })

    expect(response.ok).toBe(true)
    const transaction = await response.json()

    // BUG: This test should pass but currently fails
    // The amount should be negative
    expect(transaction.amount).toBe(negativeAmount)
    expect(transaction.amount).toBeLessThan(0)
  })

  it('should preserve negative amount when sent as string', async () => {
    // Simulate what the frontend sends (amount as string from form)
    const response = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: accountId,
        toAccountId: accountId,
        amount: '-100.50', // String representation (as it might come from form)
        date: new Date('2025-01-15').toISOString(),
        description: 'Test expense',
      }),
    })

    expect(response.ok).toBe(true)
    const transaction = await response.json()

    // The amount should be negative even when sent as string
    expect(transaction.amount).toBe(-100.50)
    expect(transaction.amount).toBeLessThan(0)
  })

  it('should preserve negative amount when updating transaction', async () => {
    // First create a transaction
    const createResponse = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: accountId,
        toAccountId: accountId,
        amount: 50,
        date: new Date('2025-01-15').toISOString(),
        description: 'Initial transaction',
      }),
    })
    const created = await createResponse.json()

    // Update with negative amount
    const updateResponse = await fetch(`${API_BASE}/api/transactions/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: '-75.25', // String representation
      }),
    })

    expect(updateResponse.ok).toBe(true)
    const updated = await updateResponse.json()

    // The amount should be negative
    expect(updated.amount).toBe(-75.25)
    expect(updated.amount).toBeLessThan(0)
  })
})

