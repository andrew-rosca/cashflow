import { describe, it, expect, beforeEach } from 'vitest'

const API_BASE = 'http://localhost:3000'
const TEST_USER_ID = 'user-1'

describe('Dashboard Features (F030-F033)', () => {
  let testAccount: any
  let testTransaction: any

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
    // Create a tracked account
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Checking Account',
        type: 'tracked',
        initialBalance: 1000
      })
    })
    expect(accountRes.ok).toBe(true)
    testAccount = await accountRes.json()

    // Create a one-time transaction
    const txRes = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id,
        amount: 100,
        description: 'Test expense',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      })
    })
    expect(txRes.ok).toBe(true)

    // Fetch projections
    const today = new Date()
    const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    const projRes = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${formatDate(today)}&endDate=${formatDate(in60Days)}`
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
    // Create a tracked account with low initial balance
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Low Balance Account',
        type: 'tracked',
        initialBalance: 100
      })
    })
    expect(accountRes.ok).toBe(true)
    testAccount = await accountRes.json()

    // Create external expense account
    const externalRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Bills',
        type: 'external',
        category: 'expense'
      })
    })
    expect(externalRes.ok).toBe(true)
    const externalAccount = await externalRes.json()

    // Create a large expense that will cause negative balance
    const txRes = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        fromAccountId: testAccount.id,
        toAccountId: externalAccount.id,
        amount: 150,
        description: 'Large expense',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days from now
      })
    })
    expect(txRes.ok).toBe(true)

    // Fetch projections
    const today = new Date()
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    const projRes = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${formatDate(today)}&endDate=${formatDate(in30Days)}`
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
    // Create a tracked account
    const accountRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Savings Account',
        type: 'tracked',
        initialBalance: 5000
      })
    })
    expect(accountRes.ok).toBe(true)
    testAccount = await accountRes.json()

    // Test 30-day projection
    const today = new Date()
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    const proj30Res = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${formatDate(today)}&endDate=${formatDate(in30Days)}`
    )
    expect(proj30Res.ok).toBe(true)
    const proj30Data = await proj30Res.json()
    expect(proj30Data.length).toBeGreaterThan(0)
    expect(proj30Data.length).toBeLessThanOrEqual(31)

    // Test 60-day projection
    const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    const proj60Res = await fetch(
      `${API_BASE}/api/projections?accountId=${testAccount.id}&startDate=${formatDate(today)}&endDate=${formatDate(in60Days)}`
    )
    expect(proj60Res.ok).toBe(true)
    const proj60Data = await proj60Res.json()
    expect(proj60Data.length).toBeGreaterThan(proj30Data.length)
    expect(proj60Data.length).toBeLessThanOrEqual(61)
  })

  it('F033: should filter projections by selected account', async () => {
    // Create two tracked accounts
    const account1Res = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Account 1',
        type: 'tracked',
        initialBalance: 1000
      })
    })
    expect(account1Res.ok).toBe(true)
    const account1 = await account1Res.json()

    const account2Res = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        name: 'Account 2',
        type: 'tracked',
        initialBalance: 2000
      })
    })
    expect(account2Res.ok).toBe(true)
    const account2 = await account2Res.json()

    // Fetch projections for each account separately
    const today = new Date()
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    const proj1Res = await fetch(
      `${API_BASE}/api/projections?accountId=${account1.id}&startDate=${formatDate(today)}&endDate=${formatDate(in30Days)}`
    )
    expect(proj1Res.ok).toBe(true)
    const proj1Data = await proj1Res.json()

    const proj2Res = await fetch(
      `${API_BASE}/api/projections?accountId=${account2.id}&startDate=${formatDate(today)}&endDate=${formatDate(in30Days)}`
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
