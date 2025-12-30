import { test, expect } from '../fixtures/test-fixtures'
import { LogicalDate } from '@/lib/logical-date'

/**
 * Projection Row Expand Test
 * 
 * Tests the expand functionality for projection table rows.
 * When clicking on a row, it should expand to show the transactions
 * causing the balance change on that date.
 * 
 * Includes:
 * - One-time transaction
 * - Recurring transaction
 */
test.describe('Projection Row Expand', () => {
  test('should expand row to show transactions affecting balance', async ({ page, testServer }) => {
    test.setTimeout(60000)
    
    // Mock the clock to use a fixed calendar date: Dec 1, 2025
    const calendarDate = '2025-12-01'
    const fixedTimestamp = Date.UTC(2025, 11, 1, 0, 0, 0, 0) // Dec 1, 2025 at UTC midnight
    await page.clock.install({ now: fixedTimestamp })
    
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Step 1: Create tracked account with $100 balance on Dec 1
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Account',
        initialBalance: 100,
        balanceAsOf: '2025-12-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    
    const testAccount = await createAccountResponse.json()
    
    // Step 2: Create an external account for expenses
    const createExpenseAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Expense Account',
        initialBalance: 0,
        balanceAsOf: '2025-12-01',
      }),
    })
    
    if (!createExpenseAccountResponse.ok) {
      const errorText = await createExpenseAccountResponse.text()
      throw new Error(`Failed to create expense account: ${createExpenseAccountResponse.status} - ${errorText}`)
    }
    
    const expenseAccount = await createExpenseAccountResponse.json()
    
    // Step 3: Create a one-time transaction on Dec 15
    // Use same account for both to ensure it shows up in projections
    const oneTimeTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id, // Same account so it shows up
        amount: -25,
        date: '2025-12-15',
        description: 'One-time expense',
      }),
    })
    
    if (!oneTimeTransactionResponse.ok) {
      const errorText = await oneTimeTransactionResponse.text()
      throw new Error(`Failed to create one-time transaction: ${oneTimeTransactionResponse.status} - ${errorText}`)
    }
    
    const oneTimeTransaction = await oneTimeTransactionResponse.json()
    expect(oneTimeTransaction.amount).toBe(-25)
    expect(oneTimeTransaction.date).toBe('2025-12-15')
    expect(oneTimeTransaction.description).toBe('One-time expense')
    
    // Step 4: Create a recurring monthly transaction starting Jan 12
    const recurringTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id, // Same account (self-transfer/expense)
        amount: -10,
        date: '2026-01-12',
        description: 'Monthly recurring',
        recurrence: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: 12,
        },
      }),
    })
    
    if (!recurringTransactionResponse.ok) {
      const errorText = await recurringTransactionResponse.text()
      throw new Error(`Failed to create recurring transaction: ${recurringTransactionResponse.status} - ${errorText}`)
    }
    
    const recurringTransaction = await recurringTransactionResponse.json()
    expect(recurringTransaction.amount).toBe(-10)
    expect(recurringTransaction.date).toBe('2026-01-12')
    expect(recurringTransaction.description).toBe('Monthly recurring')
    expect(recurringTransaction.recurrence).toBeDefined()
    
    // Reload the page to show the new transactions and projections
    await page.reload()
    
    // Wait for both transactions and projections API calls to complete
    await page.waitForResponse(response => 
      response.url().includes('/api/transactions') && response.status() === 200
    )
    await page.waitForResponse(response => 
      response.url().includes('/api/projections') && response.status() === 200
    )
    
    await page.waitForLoadState('networkidle')
    
    // Wait for projections table to be visible and data to load
    const table = page.locator('table')
    await expect(table).toBeVisible()
    
    // Wait for at least one projection row to appear
    await page.waitForSelector('tbody tr', { timeout: 10000 })
    
    // Step 5: Find and click on the Dec 15 row (one-time transaction)
    // The row should show balance of 75 (100 - 25)
    const dec15Row = table.locator('tbody tr').filter({ hasText: 'Dec 15' }).first()
    await expect(dec15Row).toBeVisible()
    
    // Verify the balance is correct before expanding
    await expect(dec15Row.locator('td').nth(1)).toContainText('75.00')
    
    // Click to expand - click on the row itself
    await dec15Row.click()
    
    // Wait for the expanded row to appear - use data attribute for reliable selection
    await page.waitForSelector('tbody tr[data-expanded-row="true"]', { timeout: 5000 })
    
    // Now look for the expanded row with the transaction description
    const expandedRowWithText = page.locator('tbody tr').filter({ hasText: 'One-time expense' })
    await expect(expandedRowWithText.first()).toBeVisible({ timeout: 5000 })
    
    // Verify expanded row shows the one-time transaction
    // Look for the row that contains "One-time expense"
    const expandedRow = table.locator('tbody tr').filter({ hasText: 'One-time expense' }).first()
    await expect(expandedRow).toBeVisible()
    
    // Check that the expanded row shows the transaction description
    await expect(expandedRow).toContainText('One-time expense')
    
    // Check that it shows the amount (-25.00)
    await expect(expandedRow).toContainText('-25.00')
    
    // Check that it shows the document icon (one-time transaction icon)
    const documentIcon = expandedRow.locator('svg').first()
    await expect(documentIcon).toBeVisible()
    
    // Step 6: Click on the row again to collapse
    await dec15Row.click()
    await page.waitForTimeout(500)
    
    // Verify expanded row is no longer visible
    await expect(expandedRow).not.toBeVisible()
    
    // Step 7: Find and click on the Jan 12 row (recurring transaction)
    const jan12Row = table.locator('tbody tr').filter({ hasText: 'Jan 12' }).first()
    await expect(jan12Row).toBeVisible()
    
    // Click to expand
    await jan12Row.click()
    
    // Wait for expanded row to appear - wait for the description text
    await page.waitForSelector('text=Monthly recurring', { timeout: 5000 })
    
    // Verify expanded row shows the recurring transaction
    // Look for the row that contains "Monthly recurring"
    const jan12ExpandedRow = table.locator('tbody tr').filter({ hasText: 'Monthly recurring' }).first()
    await expect(jan12ExpandedRow).toBeVisible()
    
    // Check that the expanded row shows the transaction description
    await expect(jan12ExpandedRow).toContainText('Monthly recurring')
    
    // Check that it shows the amount (-10.00)
    await expect(jan12ExpandedRow).toContainText('-10.00')
    
    // Check that it shows the recurring icon (refresh/sync icon)
    const recurringIcon = jan12ExpandedRow.locator('svg').first()
    await expect(recurringIcon).toBeVisible()
    
    // Verify the icon is the recurring icon (has the specific path for recurring transactions)
    const recurringIconPath = recurringIcon.locator('path[d*="M4 4v5h.582"]')
    await expect(recurringIconPath).toBeVisible()
    
    // Step 8: Verify expanded rows are marked with the data attribute
    // This is more reliable than checking background color
    const hasDataAttribute = await jan12ExpandedRow.evaluate((el) => el.hasAttribute('data-expanded-row'))
    expect(hasDataAttribute).toBe(true)
  })
})

