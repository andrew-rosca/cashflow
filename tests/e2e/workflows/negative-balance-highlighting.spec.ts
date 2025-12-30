import { test, expect } from '../fixtures/test-fixtures'
import { LogicalDate } from '@/lib/logical-date'

test.describe('Negative Balance Highlighting', () => {
  test('should highlight rows where account balance goes negative', async ({ page, testServer, prisma }) => {
    test.setTimeout(60000)

    // Mock the clock to use a fixed calendar date: Jan 1, 2025
    const fixedTimestamp = Date.UTC(2025, 0, 1, 0, 0, 0, 0) // Jan 1, 2025 at UTC midnight
    await page.clock.install({ now: fixedTimestamp })

    // Navigate to the page first
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')

    // Create a test account via API (so UI knows about it)
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Account',
        initialBalance: 100,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    
    const account = await createAccountResponse.json()

    // Create an external account for expenses
    const createExpenseResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Expenses',
        initialBalance: 0,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createExpenseResponse.ok) {
      const errorText = await createExpenseResponse.text()
      throw new Error(`Failed to create expense account: ${createExpenseResponse.status} - ${errorText}`)
    }
    
    const expenseAccount = await createExpenseResponse.json()

    // Create a transaction that will cause the balance to go negative
    // Initial balance: 100 on Jan 1
    // Transaction: -150 on Jan 5 (will make balance -50)
    const createTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: account.id,
        toAccountId: expenseAccount.id,
        amount: -150,
        date: '2025-01-05',
        description: 'Large expense',
      }),
    })
    
    if (!createTransactionResponse.ok) {
      const errorText = await createTransactionResponse.text()
      throw new Error(`Failed to create transaction: ${createTransactionResponse.status} - ${errorText}`)
    }

    // Reload to ensure accounts and transactions are loaded
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for the account to appear
    await page.waitForSelector('text=Test Account', { timeout: 10000 })

    // Wait for the projection table to load and show data
    // The table should appear once accounts are loaded
    await page.waitForSelector('table', { timeout: 15000 })
    await page.waitForSelector('table tbody tr', { timeout: 15000 })
    
    // Wait a bit more for projections to fully load
    await page.waitForTimeout(3000)

    // The projection table only shows dates where balance changes
    // So we should see:
    // - Jan 1 (initial balance: 100)
    // - Jan 5 (balance changes to -50)
    
    // Find the row for Jan 1 (initial balance, positive)
    const jan1Row = page.locator('tbody tr').filter({ hasText: 'Jan 1' }).first()
    await expect(jan1Row).toBeVisible({ timeout: 10000 })
    const jan1Classes = await jan1Row.getAttribute('class')
    // Jan 1 should NOT have the orange background (balance is positive)
    expect(jan1Classes).not.toContain('bg-orange-100/60')

    // Find the row for Jan 5 (the date when balance goes negative)
    // Date format is "Jan 5" (not "Jan 05")
    const jan5Row = page.locator('tbody tr').filter({ hasText: 'Jan 5' }).first()
    await expect(jan5Row).toBeVisible({ timeout: 10000 })

    // Check that the row has the orange background for negative balance
    // The class should be bg-orange-100/60 or dark:bg-orange-900/30
    const jan5Classes = await jan5Row.getAttribute('class')
    expect(jan5Classes).toContain('bg-orange-100/60')
    expect(jan5Classes).toContain('dark:bg-orange-900/30')

    // Verify the balance on Jan 5 is negative
    const jan5Balance = jan5Row.locator('td').nth(1) // Second column is the balance
    await expect(jan5Balance).toContainText('-50.00')
  })

  test('should highlight multiple rows when balance stays negative', async ({ page, testServer, prisma }) => {
    test.setTimeout(60000)

    // Mock the clock to use a fixed calendar date: Jan 1, 2025
    const fixedTimestamp = Date.UTC(2025, 0, 1, 0, 0, 0, 0) // Jan 1, 2025 at UTC midnight
    await page.clock.install({ now: fixedTimestamp })

    // Navigate to the page first
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')

    // Create a test account via API
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Account',
        initialBalance: 50,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    
    const account = await createAccountResponse.json()

    // Create an external account for expenses
    const createExpenseResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Expenses',
        initialBalance: 0,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createExpenseResponse.ok) {
      const errorText = await createExpenseResponse.text()
      throw new Error(`Failed to create expense account: ${createExpenseResponse.status} - ${errorText}`)
    }
    
    const expenseAccount = await createExpenseResponse.json()

    // Create a transaction that will cause the balance to go negative
    // Initial balance: 50 on Jan 1
    // Transaction: -100 on Jan 3 (will make balance -50)
    const createTransaction1Response = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: account.id,
        toAccountId: expenseAccount.id,
        amount: -100,
        date: '2025-01-03',
        description: 'Large expense',
      }),
    })
    
    if (!createTransaction1Response.ok) {
      const errorText = await createTransaction1Response.text()
      throw new Error(`Failed to create transaction: ${createTransaction1Response.status} - ${errorText}`)
    }

    // Create another transaction on Jan 10 (balance still negative)
    const createTransaction2Response = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: account.id,
        toAccountId: expenseAccount.id,
        amount: -20,
        date: '2025-01-10',
        description: 'Another expense',
      }),
    })
    
    if (!createTransaction2Response.ok) {
      const errorText = await createTransaction2Response.text()
      throw new Error(`Failed to create transaction: ${createTransaction2Response.status} - ${errorText}`)
    }

    // Reload to ensure accounts and transactions are loaded
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for the account to appear
    await page.waitForSelector('text=Test Account', { timeout: 10000 })

    // Wait for the projection table to load and show data
    // The table should appear once accounts are loaded
    await page.waitForSelector('table', { timeout: 15000 })
    await page.waitForSelector('table tbody tr', { timeout: 15000 })
    
    // Wait a bit more for projections to fully load
    await page.waitForTimeout(3000)

    // The projection table only shows dates where balance changes
    // So we should see:
    // - Jan 1 (initial balance: 50)
    // - Jan 3 (balance changes to -50)
    // - Jan 10 (balance changes to -70)
    
    // Verify Jan 1 (initial balance, positive) is NOT highlighted
    const jan1Row = page.locator('tbody tr').filter({ hasText: 'Jan 1' }).first()
    await expect(jan1Row).toBeVisible()
    const jan1Classes = await jan1Row.getAttribute('class')
    expect(jan1Classes).not.toContain('bg-orange-100/60')

    // Verify Jan 3 (first negative balance) is highlighted
    const jan3Row = page.locator('tbody tr').filter({ hasText: 'Jan 3' }).first()
    await expect(jan3Row).toBeVisible()
    const jan3Classes = await jan3Row.getAttribute('class')
    expect(jan3Classes).toContain('bg-orange-100/60')

    // Verify Jan 10 (still negative after another expense) is highlighted
    const jan10Row = page.locator('tbody tr').filter({ hasText: 'Jan 10' }).first()
    await expect(jan10Row).toBeVisible()
    const jan10Classes = await jan10Row.getAttribute('class')
    expect(jan10Classes).toContain('bg-orange-100/60')
  })

  test('should not highlight rows when balance recovers to positive', async ({ page, testServer, prisma }) => {
    test.setTimeout(60000)

    // Mock the clock to use a fixed calendar date: Jan 1, 2025
    const fixedTimestamp = Date.UTC(2025, 0, 1, 0, 0, 0, 0) // Jan 1, 2025 at UTC midnight
    await page.clock.install({ now: fixedTimestamp })

    // Navigate to the page first
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')

    // Create a test account via API
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Account',
        initialBalance: 50,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    
    const account = await createAccountResponse.json()

    // Create an external account for expenses
    const createExpenseResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Expenses',
        initialBalance: 0,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createExpenseResponse.ok) {
      const errorText = await createExpenseResponse.text()
      throw new Error(`Failed to create expense account: ${createExpenseResponse.status} - ${errorText}`)
    }
    
    const expenseAccount = await createExpenseResponse.json()

    // Create an income account
    const createIncomeResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Income',
        initialBalance: 0,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createIncomeResponse.ok) {
      const errorText = await createIncomeResponse.text()
      throw new Error(`Failed to create income account: ${createIncomeResponse.status} - ${errorText}`)
    }
    
    const incomeAccount = await createIncomeResponse.json()

    // Create a transaction that will cause the balance to go negative
    // Initial balance: 50 on Jan 1
    // Transaction: -100 on Jan 3 (will make balance -50)
    const createTransaction1Response = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: account.id,
        toAccountId: expenseAccount.id,
        amount: -100,
        date: '2025-01-03',
        description: 'Large expense',
      }),
    })
    
    if (!createTransaction1Response.ok) {
      const errorText = await createTransaction1Response.text()
      throw new Error(`Failed to create transaction: ${createTransaction1Response.status} - ${errorText}`)
    }

    // Create an income transaction that brings balance back to positive
    // Balance on Jan 5: -50
    // Transaction: +200 on Jan 5 (will make balance +150)
    const createTransaction2Response = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: incomeAccount.id,
        toAccountId: account.id,
        amount: 200,
        date: '2025-01-05',
        description: 'Income',
      }),
    })
    
    if (!createTransaction2Response.ok) {
      const errorText = await createTransaction2Response.text()
      throw new Error(`Failed to create transaction: ${createTransaction2Response.status} - ${errorText}`)
    }

    // Reload to ensure accounts and transactions are loaded
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Wait for the account to appear
    await page.waitForSelector('text=Test Account', { timeout: 10000 })

    // Wait for the projection table to load and show data
    // The table should appear once accounts are loaded
    await page.waitForSelector('table', { timeout: 15000 })
    await page.waitForSelector('table tbody tr', { timeout: 15000 })
    
    // Wait a bit more for projections to fully load
    await page.waitForTimeout(3000)

    // The projection table only shows dates where balance changes
    // So we should see:
    // - Jan 1 (initial balance: 50)
    // - Jan 3 (balance changes to -50)
    // - Jan 5 (balance changes to +150)
    
    // Verify Jan 1 (initial balance, positive) is NOT highlighted
    const jan1Row = page.locator('tbody tr').filter({ hasText: 'Jan 1' }).first()
    await expect(jan1Row).toBeVisible()
    const jan1Classes = await jan1Row.getAttribute('class')
    expect(jan1Classes).not.toContain('bg-orange-100/60')

    // Verify Jan 3 (negative balance) is highlighted
    const jan3Row = page.locator('tbody tr').filter({ hasText: 'Jan 3' }).first()
    await expect(jan3Row).toBeVisible()
    const jan3Classes = await jan3Row.getAttribute('class')
    expect(jan3Classes).toContain('bg-orange-100/60')

    // Verify Jan 5 (balance recovers to positive) is NOT highlighted
    const jan5Row = page.locator('tbody tr').filter({ hasText: 'Jan 5' }).first()
    await expect(jan5Row).toBeVisible()
    const jan5Classes = await jan5Row.getAttribute('class')
    expect(jan5Classes).not.toContain('bg-orange-100/60')
  })
})

