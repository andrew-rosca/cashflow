import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { startTestServer, stopTestServer, TestServer } from '../e2e/fixtures/test-server'
import { LogicalDate, today } from '@/lib/logical-date'

const TEST_USER_ID = 'user-1'

describe('Dashboard Features (F030-F033)', () => {
  let testServer: TestServer
  let API_BASE: string
  let testAccount: any
  let testTransaction: any

  beforeAll(
    async () => {
      // Start test server with ephemeral database
      // Note: Server startup can take 30-60 seconds in CI
      testServer = await startTestServer(3000)
      API_BASE = testServer.baseUrl
    },
    60000
  ) // 60 second timeout for server startup (CI can be slow)

  afterAll(async () => {
    // Stop test server and clean up database
    await stopTestServer()
  })

  beforeEach(async () => {
    // Clean up: Delete all transactions and accounts
    const accountsRes = await fetch(`${API_BASE}/api/accounts`)
    const accounts = await accountsRes.json()

    for (const account of accounts) {
      await fetch(`${API_BASE}/api/accounts/${account.id}`, {
        method: 'DELETE'
      })
    }
  })

  it('F030: should fetch projections for a tracked account', async () => {
    // Create an account
    const todayDate = today()
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Checking Account',
        initialBalance: 1000,
        balanceAsOf: todayDate.toString()
      })
    })
    expect(accountRes.ok).toBe(true)
    testAccount = await accountRes.json()

    // Create a one-time transaction
    const transactionDate = todayDate.addDays(7) // 7 days from now
    const txRes = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id,
        amount: 100,
        description: 'Test expense',
        date: transactionDate.toString()
      })
    })
    expect(txRes.ok).toBe(true)

    // Fetch projections
    const startDate = todayDate
    const endDate = todayDate.addDays(60)

    const projRes = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${startDate.toString()}&endDate=${endDate.toString()}`
    )
    expect(projRes.ok).toBe(true)

    const projData = await projRes.json()
    expect(Array.isArray(projData)).toBe(true)
    expect(projData.length).toBeGreaterThan(0)

    // Verify projection data structure
    const firstPoint = projData[0]
    expect(firstPoint).toHaveProperty('date')
    expect(firstPoint).toHaveProperty('balance')
    expect(typeof firstPoint.balance).toBe('number')
  })

  it('F031: should identify danger zones (balance <= 0)', async () => {
    // Create an account with low initial balance
    const todayDate = today()
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Low Balance Account',
        initialBalance: 100,
        balanceAsOf: todayDate.toString()
      })
    })
    expect(accountRes.ok).toBe(true)
    testAccount = await accountRes.json()

    // Create expense account
    const externalRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bills',
        initialBalance: 0,
        balanceAsOf: todayDate.toString()
      })
    })
    expect(externalRes.ok).toBe(true)
    const externalAccount = await externalRes.json()

    // Create a large expense that will cause negative balance
    const transactionDate = todayDate.addDays(5) // 5 days from now
    const txRes = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: externalAccount.id,
        amount: 150,
        description: 'Large expense',
        date: transactionDate.toString()
      })
    })
    expect(txRes.ok).toBe(true)

    // Fetch projections
    const startDate = todayDate
    const endDate = todayDate.addDays(30)

    const projRes = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${startDate.toString()}&endDate=${endDate.toString()}`
    )
    expect(projRes.ok).toBe(true)

    const projData = await projRes.json()

    // Find danger zones (balance <= 0)
    const dangerZones = projData.filter((p: any) => p.balance <= 0)
    expect(dangerZones.length).toBeGreaterThan(0)

    // Verify the balance becomes negative after the expense
    const negativeBalancePoint = dangerZones[0]
    expect(negativeBalancePoint.balance).toBeLessThanOrEqual(0)
  })

  it('F032: should provide projection data for upcoming 30-60 days', async () => {
    // Create an account
    const todayDate = today()
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Savings Account',
        initialBalance: 5000,
        balanceAsOf: todayDate.toString()
      })
    })
    expect(accountRes.ok).toBe(true)
    testAccount = await accountRes.json()

    // Test 30-day projection
    const startDate = todayDate
    const in30Days = todayDate.addDays(30)

    const proj30Res = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${startDate.toString()}&endDate=${in30Days.toString()}`
    )
    expect(proj30Res.ok).toBe(true)
    const proj30Data = await proj30Res.json()
    expect(proj30Data.length).toBeGreaterThan(0)
    expect(proj30Data.length).toBeLessThanOrEqual(31)

    // Test 60-day projection
    const in60Days = todayDate.addDays(60)
    const proj60Res = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${startDate.toString()}&endDate=${in60Days.toString()}`
    )
    expect(proj60Res.ok).toBe(true)
    const proj60Data = await proj60Res.json()
    expect(proj60Data.length).toBeGreaterThan(proj30Data.length)
    expect(proj60Data.length).toBeLessThanOrEqual(61)
  })

  it('F033: should filter projections by selected account', async () => {
    // Create two accounts
    const todayDate = today()
    const account1Res = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Account 1',
        initialBalance: 1000,
        balanceAsOf: todayDate.toString()
      })
    })
    expect(account1Res.ok).toBe(true)
    const account1 = await account1Res.json()

    const account2Res = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Account 2',
        initialBalance: 2000,
        balanceAsOf: todayDate.toString()
      })
    })
    expect(account2Res.ok).toBe(true)
    const account2 = await account2Res.json()

    // Fetch projections for each account separately
    const startDate = todayDate
    const endDate = todayDate.addDays(30)

    const proj1Res = await fetch(
      `${API_BASE}/api/projections?accountId=${account1.id}&startDate=${startDate.toString()}&endDate=${endDate.toString()}`
    )
    expect(proj1Res.ok).toBe(true)
    const proj1Data = await proj1Res.json()

    const proj2Res = await fetch(
      `${API_BASE}/api/projections?accountId=${account2.id}&startDate=${startDate.toString()}&endDate=${endDate.toString()}`
    )
    expect(proj2Res.ok).toBe(true)
    const proj2Data = await proj2Res.json()

    // Verify different initial balances
    expect(proj1Data[0].balance).toBe(1000)
    expect(proj2Data[0].balance).toBe(2000)

    // Projections should be independent
    expect(proj1Data).not.toEqual(proj2Data)
  })
})
