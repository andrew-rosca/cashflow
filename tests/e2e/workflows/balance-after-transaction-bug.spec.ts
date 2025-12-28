import { test, expect } from '../fixtures/test-fixtures'
import { LogicalDate } from '@/lib/logical-date'

/**
 * Balance After Transaction Bug Test
 * 
 * This test reproduces a bug where the projection shows incorrect balance
 * after a transaction. The scenario:
 * 1. Account has $100 balance on Dec 1
 * 2. Transaction of -$15 on Dec 15
 * 3. Balance on Dec 28 should be 85, not 100
 * 
 * This test should FAIL initially, demonstrating the bug.
 */
test.describe('Balance After Transaction Bug', () => {
  test('should show correct balance on Dec 28 after transaction on Dec 15', async ({ page, testServer, prisma }) => {
    // Increase timeout for this test
    test.setTimeout(60000)
    
    // Mock the clock to use a fixed calendar date: Dec 1, 2025
    const calendarDate = '2025-12-01'
    const fixedTimestamp = Date.UTC(2025, 11, 1, 0, 0, 0, 0) // Dec 1, 2025 at UTC midnight
    await page.clock.install({ now: fixedTimestamp })
    
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Step 1: Create tracked account with $100 balance on Dec 1 via API
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Account',
        initialBalance: 100,
        balanceAsOf: '2025-12-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    
    const testAccount = await createAccountResponse.json()
    expect(testAccount.initialBalance).toBe(100)
    expect(testAccount.balanceAsOf).toBe('2025-12-01')
    
    // Step 2: Create an external account for expenses
    const createExpenseAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Expense',
        initialBalance: 0,
        balanceAsOf: '2025-12-01',
      }),
    })
    
    if (!createExpenseAccountResponse.ok) {
      const errorText = await createExpenseAccountResponse.text()
      throw new Error(`Failed to create expense account: ${createExpenseAccountResponse.status} - ${errorText}`)
    }
    
    const expenseAccount = await createExpenseAccountResponse.json()
    
    // Reload the page to show the new accounts
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Step 3: Create transaction of -$15 on Dec 15 via API
    const createTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: expenseAccount.id,
        amount: -15,
        date: '2025-12-15',
        description: 'Test Expense',
      }),
    })
    
    if (!createTransactionResponse.ok) {
      const errorText = await createTransactionResponse.text()
      throw new Error(`Failed to create transaction: ${createTransactionResponse.status} - ${errorText}`)
    }
    
    const transaction = await createTransactionResponse.json()
    expect(transaction.amount).toBe(-15)
    expect(transaction.date).toBe('2025-12-15')
    
    // Wait for projections to update
    await page.waitForTimeout(2000)
    
    // Step 4: Verify the projected balance on Dec 28 via API
    // The balance should be 85 (100 - 15), not 100
    const startDate = '2025-12-01'
    const endDate = '2025-12-31'
    
    const projectionsResponse = await fetch(
      `${testServer.baseUrl}/api/projections?accountId=${testAccount.id}&startDate=${startDate}&endDate=${endDate}`
    )
    
    if (!projectionsResponse.ok) {
      const errorText = await projectionsResponse.text()
      throw new Error(`Failed to fetch projections: ${projectionsResponse.status} ${projectionsResponse.statusText} - ${errorText}`)
    }
    
    const projections = await projectionsResponse.json()
    
    if (!Array.isArray(projections)) {
      throw new Error(`Expected array but got: ${typeof projections} - ${JSON.stringify(projections)}`)
    }
    
    expect(projections.length).toBeGreaterThan(0)
    
    // Debug: Log all projections to understand what's happening
    console.log('All projections:', JSON.stringify(projections, null, 2))
    
    // Find the projection for Dec 28
    const dec28Projection = projections.find((p: any) => p.date === '2025-12-28')
    
    expect(dec28Projection).toBeDefined()
    console.log('Dec 28 projection:', dec28Projection)
    
    // THIS IS THE KEY ASSERTION - This should be 85, but the bug makes it 100 (or possibly 115)
    // The test should FAIL here, demonstrating the bug
    // Expected: 85 (100 - 15)
    // Bug might show: 100 (transaction not applied) or 115 (transaction added instead of subtracted)
    expect(dec28Projection.balance).toBe(85) // Expected: 85, but bug shows: 100 or 115
    
    // Additional verification: Check balance on Dec 15 (transaction date)
    const dec15Projection = projections.find((p: any) => p.date === '2025-12-15')
    expect(dec15Projection).toBeDefined()
    console.log('Dec 15 projection:', dec15Projection)
    expect(dec15Projection.balance).toBe(85) // Should be 85 on the transaction date
    
    // Verify balance before transaction is still 100
    const dec14Projection = projections.find((p: any) => p.date === '2025-12-14')
    expect(dec14Projection).toBeDefined()
    console.log('Dec 14 projection:', dec14Projection)
    expect(dec14Projection.balance).toBe(100) // Should still be 100 before transaction
  })
})

