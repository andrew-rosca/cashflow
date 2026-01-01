import { test, expect } from '../fixtures/test-fixtures'

/**
 * E2E Test: Multiple Days of Month Recurrence
 * 
 * Tests the full UI flow of creating a recurring transaction with multiple days of the month:
 * 1. Create account
 * 2. Open transaction dialog
 * 3. Enable recurring transaction
 * 4. Select multiple days (1st and 15th)
 * 5. Submit and verify transaction is created correctly
 * 6. Verify projections show transactions on both days
 */
test.describe('Multiple Days of Month Recurrence', () => {
  test('should create recurring transaction with multiple days through UI', async ({ page, testServer }) => {
    test.setTimeout(60000)
    
    // Mock the clock to use a fixed calendar date: Jan 1, 2025
    const calendarDate = '2025-01-01'
    const fixedTimestamp = Date.UTC(2025, 0, 1, 0, 0, 0, 0)
    await page.clock.install({ now: fixedTimestamp })
    
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Step 1: Create a test account via API
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Account',
        initialBalance: 1000,
        balanceAsOf: '2025-01-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    
    const testAccount = await createAccountResponse.json()
    
    // Reload the page to show the new account
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Verify the account appears in the UI
    await page.waitForSelector('text=Test Account', { timeout: 5000 })
    
    // Step 2: Open transaction dialog
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    
    // Click the "+" button in the Upcoming Transactions section
    const upcomingTransactionsSection = page.locator('text=Upcoming Transactions').locator('..')
    const addTransactionButton = upcomingTransactionsSection.locator('button').filter({ hasText: '+' }).first()
    
    await addTransactionButton.waitFor({ state: 'visible', timeout: 10000 })
    await addTransactionButton.click({ force: true, timeout: 5000 })
    
    // Wait for transaction dialog to appear
    await page.waitForSelector('form', { timeout: 5000 })
    await page.waitForSelector('input[name="amount"]', { timeout: 3000 })
    
    // Step 3: Select the account
    const accountButton = page.locator('button').filter({ hasText: 'Test Account' }).first()
    await accountButton.waitFor({ state: 'visible', timeout: 3000 })
    await accountButton.click()
    await page.waitForTimeout(300)
    
    // Step 4: Fill in amount and description
    const amountInput = page.locator('input[name="amount"]')
    await amountInput.fill('-50')
    
    const descriptionInput = page.locator('input[name="description"]')
    await descriptionInput.fill('Bi-monthly payment')
    
    // Step 4.5: Set transaction date to Jan 1, 2025 (same as account balanceAsOf)
    // This ensures the transaction applies on the first day
    await page.waitForSelector('input[placeholder="dd"]', { timeout: 5000 })
    const allDayInputs = page.locator('input[placeholder="dd"]')
    const dayInputCount = await allDayInputs.count()
    const txDayInput = allDayInputs.nth(dayInputCount - 1)
    
    await txDayInput.click()
    await txDayInput.clear()
    await txDayInput.fill('1')
    await page.waitForTimeout(200)
    
    const allMonthInputs = page.locator('input[placeholder="MMM"]')
    const monthInputCount = await allMonthInputs.count()
    const txMonthInput = allMonthInputs.nth(monthInputCount - 1)
    await txMonthInput.click()
    await txMonthInput.clear()
    await txMonthInput.fill('Jan')
    await page.waitForTimeout(500)
    
    const allYearInputs = page.locator('input[placeholder="YYYY"]')
    const yearInputCount = await allYearInputs.count()
    const txYearInput = allYearInputs.nth(yearInputCount - 1)
    await txYearInput.click()
    await txYearInput.clear()
    await txYearInput.fill('2025')
    await page.waitForTimeout(300)
    await txYearInput.press('Tab')
    await page.waitForTimeout(500)
    
    // Step 5: Enable recurring transaction
    const recurringCheckbox = page.locator('input[type="checkbox"][name="isRecurring"]')
    await recurringCheckbox.waitFor({ state: 'visible', timeout: 3000 })
    await recurringCheckbox.check()
    await page.waitForTimeout(500) // Wait for recurrence control to appear
    
    // Step 6: Verify RecurrenceControl is visible
    await page.waitForSelector('text=Frequency', { timeout: 5000 })
    await page.waitForSelector('text=Day of Month', { timeout: 5000 })
    
    // Step 7: Select multiple days of month (1st and 15th)
    // Wait for day buttons to be visible - they're rendered as buttons with numbers 1-31
    await page.waitForSelector('button:has-text("1")', { timeout: 5000 })
    
    // Find day 1 button - use getByRole for reliable selection
    const day1Button = page.getByRole('button', { name: '1', exact: true }).first()
    await day1Button.waitFor({ state: 'visible', timeout: 5000 })
    await day1Button.click()
    await page.waitForTimeout(500)
    
    // Click on day 15
    const day15Button = page.getByRole('button', { name: '15', exact: true }).first()
    await day15Button.waitFor({ state: 'visible', timeout: 5000 })
    await day15Button.click()
    await page.waitForTimeout(500)
    
    // Verify both buttons are selected (they should have the selected class)
    await expect(day1Button).toHaveClass(/bg-blue-600/)
    await expect(day15Button).toHaveClass(/bg-blue-600/)
    
    // Step 8: Submit the form
    const submitButton = page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /^(Add|Save)$/i })).first()
    await submitButton.waitFor({ state: 'visible', timeout: 3000 })
    await submitButton.click()
    
    // Step 9: Wait for the transaction to be created
    await page.waitForTimeout(1000)
    
    // Step 10: Verify the transaction was created via API
    const transactionsResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      headers: { 'Content-Type': 'application/json' },
    })
    
    expect(transactionsResponse.ok).toBe(true)
    const transactions = await transactionsResponse.json()
    
    // Find our transaction
    const createdTransaction = transactions.find((tx: any) => 
      tx.description === 'Bi-monthly payment' && tx.recurrence
    )
    
    expect(createdTransaction).toBeDefined()
    expect(createdTransaction.recurrence).toBeDefined()
    expect(createdTransaction.recurrence.frequency).toBe('monthly')
    
    // Verify dayOfMonth is an array with both 1 and 15
    const dayOfMonth = createdTransaction.recurrence.dayOfMonth
    expect(Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth]).toContain(1)
    expect(Array.isArray(dayOfMonth) ? dayOfMonth : [dayOfMonth]).toContain(15)
    
    // Step 11: Verify projections show transactions on both days
    const projectionsResponse = await fetch(
      `${testServer.baseUrl}/api/projections?accountId=${testAccount.id}&startDate=2025-01-01&endDate=2025-02-28`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
    
    expect(projectionsResponse.ok).toBe(true)
    const projections = await projectionsResponse.json()
    
    // Find projections for Jan 1, Jan 15, Feb 1, Feb 15
    const jan1 = projections.find((p: any) => p.date === '2025-01-01')
    const jan15 = projections.find((p: any) => p.date === '2025-01-15')
    const feb1 = projections.find((p: any) => p.date === '2025-02-01')
    const feb15 = projections.find((p: any) => p.date === '2025-02-15')
    
    // Verify transactions occur on both days
    // Note: The transaction date is Jan 1, so the first occurrence is on Jan 1
    // Jan 1 should have the transaction (balance should be 1000 - 50 = 950)
    expect(jan1).toBeDefined()
    // The balance on Jan 1 depends on whether the transaction applies on that day
    // Since balanceAsOf is Jan 1 and transaction is on Jan 1, it should apply
    expect(jan1.balance).toBe(950)
    
    // Jan 15 should have the transaction (balance should be 950 - 50 = 900)
    expect(jan15).toBeDefined()
    expect(jan15.balance).toBe(900)
    
    // Feb 1 should have the transaction (balance should be 900 - 50 = 850)
    expect(feb1).toBeDefined()
    expect(feb1.balance).toBe(850)
    
    // Feb 15 should have the transaction (balance should be 850 - 50 = 800)
    expect(feb15).toBeDefined()
    expect(feb15.balance).toBe(800)
  })
})

