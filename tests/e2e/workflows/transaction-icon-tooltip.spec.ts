import { test, expect } from '../fixtures/test-fixtures'
import { LogicalDate } from '@/lib/logical-date'

/**
 * Transaction Icon Tooltip Test
 * 
 * Tests that transaction icons show tooltips with account name and transaction type/pattern
 */
test.describe('Transaction Icon Tooltip', () => {
  test('should show tooltip for one-time transaction icon', async ({ page, testServer, prisma }) => {
    test.setTimeout(60000)
    
    // Mock the clock to use a fixed calendar date: Dec 1, 2025
    const calendarDate = '2025-12-01'
    const fixedTimestamp = Date.UTC(2025, 11, 1, 0, 0, 0, 0)
    await page.clock.install({ now: fixedTimestamp })
    
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Step 1: Create a test account
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
      throw new Error(`Failed to create account: ${createAccountResponse.status}`)
    }
    
    const testAccount = await createAccountResponse.json()
    
    // Step 2: Create a one-time transaction
    const oneTimeTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id,
        amount: -25,
        date: '2025-12-15',
        description: 'One-time expense',
      }),
    })
    
    if (!oneTimeTransactionResponse.ok) {
      const errorText = await oneTimeTransactionResponse.text()
      throw new Error(`Failed to create transaction: ${oneTimeTransactionResponse.status} - ${errorText}`)
    }
    
    // Step 3: Reload the page to show the transaction
    await page.reload()
    
    // Wait for both accounts and transactions to load
    await page.waitForResponse(response => 
      response.url().includes('/api/accounts') && response.status() === 200
    )
    await page.waitForResponse(response => 
      response.url().includes('/api/transactions') && response.status() === 200
    )
    await page.waitForLoadState('networkidle')
    
    // Step 4: Find the one-time transaction icon in the "Upcoming Transactions" section
    const upcomingSection = page.locator('text=UPCOMING TRANSACTIONS').locator('..').locator('..')
    await expect(upcomingSection).toBeVisible()
    
    // Find the transaction row that contains "One-time expense"
    const transactionRow = upcomingSection.locator('div').filter({ hasText: 'One-time expense' }).first()
    await expect(transactionRow).toBeVisible()
    
    // Find the SVG icon (document icon) within this row
    const icon = transactionRow.locator('svg').first()
    await expect(icon).toBeVisible()
    
    // Step 5: Hover over the icon and verify custom tooltip appears
    await icon.hover()
    await page.waitForTimeout(500) // Give tooltip time to appear and calculate position
    
    // Check for the custom tooltip element
    const tooltip = page.locator('[data-tooltip-content]').filter({ hasText: 'Test Account' })
    await expect(tooltip).toBeVisible({ timeout: 2000 })
    
    // Verify tooltip content
    const tooltipContent = await tooltip.getAttribute('data-tooltip-content')
    expect(tooltipContent).toContain('Test Account')
    expect(tooltipContent).toContain('one-time')
  })
  
  test('should show tooltip for recurring transaction icon', async ({ page, testServer, prisma }) => {
    test.setTimeout(60000)
    
    // Mock the clock to use a fixed calendar date: Dec 1, 2025
    const calendarDate = '2025-12-01'
    const fixedTimestamp = Date.UTC(2025, 11, 1, 0, 0, 0, 0)
    await page.clock.install({ now: fixedTimestamp })
    
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Step 1: Create a test account
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Main Checking',
        initialBalance: 100,
        balanceAsOf: '2025-12-01',
      }),
    })
    
    if (!createAccountResponse.ok) {
      throw new Error(`Failed to create account: ${createAccountResponse.status}`)
    }
    
    const testAccount = await createAccountResponse.json()
    
    // Step 2: Create a recurring monthly transaction
    const recurringTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id,
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
    
    // Step 3: Reload the page to show the transaction
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Wait a bit for React to render with accounts loaded
    await page.waitForTimeout(500)
    
    // Step 4: Find the recurring transaction icon in the "Upcoming Transactions" section
    const upcomingSection = page.locator('text=UPCOMING TRANSACTIONS').locator('..').locator('..')
    await expect(upcomingSection).toBeVisible()
    
    // Find the transaction row that contains "Monthly recurring"
    const transactionRow = upcomingSection.locator('div').filter({ hasText: 'Monthly recurring' }).first()
    await expect(transactionRow).toBeVisible()
    
    // Find the SVG icon (recurring icon) within this row
    const icon = transactionRow.locator('svg').first()
    await expect(icon).toBeVisible()
    
    // Step 5: Hover over the icon and verify custom tooltip appears
    await icon.hover()
    await page.waitForTimeout(300) // Give tooltip time to appear
    
    // Check for the custom tooltip element
    const tooltip = page.locator('[data-tooltip-content]').filter({ hasText: 'Main Checking' })
    await expect(tooltip).toBeVisible({ timeout: 1000 })
    
    // Verify tooltip content
    const tooltipContent = await tooltip.getAttribute('data-tooltip-content')
    expect(tooltipContent).toContain('Main Checking')
    expect(tooltipContent).toContain('monthly')
    expect(tooltipContent).toContain('day 12')
  })
  
  test('should show tooltip for transaction icon in expanded projection row', async ({ page, testServer, prisma }) => {
    test.setTimeout(60000)
    
    // Mock the clock to use a fixed calendar date: Dec 1, 2025
    const calendarDate = '2025-12-01'
    const fixedTimestamp = Date.UTC(2025, 11, 1, 0, 0, 0, 0)
    await page.clock.install({ now: fixedTimestamp })
    
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Step 1: Create a test account
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
      throw new Error(`Failed to create account: ${createAccountResponse.status}`)
    }
    
    const testAccount = await createAccountResponse.json()
    
    // Step 2: Create a one-time transaction on Dec 15
    const oneTimeTransactionResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: testAccount.id,
        toAccountId: testAccount.id,
        amount: -25,
        date: '2025-12-15',
        description: 'One-time expense',
      }),
    })
    
    if (!oneTimeTransactionResponse.ok) {
      const errorText = await oneTimeTransactionResponse.text()
      throw new Error(`Failed to create transaction: ${oneTimeTransactionResponse.status} - ${errorText}`)
    }
    
    // Step 3: Reload the page and wait for projections to load
    await page.reload()
    await page.waitForResponse(response => 
      response.url().includes('/api/transactions') && response.status() === 200
    )
    await page.waitForResponse(response => 
      response.url().includes('/api/projections') && response.status() === 200
    )
    await page.waitForLoadState('networkidle')
    
    // Step 4: Find and click on the Dec 15 row to expand it
    const table = page.locator('table')
    await expect(table).toBeVisible()
    await page.waitForSelector('tbody tr', { timeout: 10000 })
    
    const dec15Row = table.locator('tbody tr').filter({ hasText: 'Dec 15' }).first()
    await expect(dec15Row).toBeVisible()
    await dec15Row.click()
    
    // Wait for expanded row to appear
    await page.waitForSelector('tbody tr[data-expanded-row="true"]', { timeout: 5000 })
    
    // Step 5: Find the transaction icon in the expanded row
    const expandedRow = table.locator('tbody tr[data-expanded-row="true"]').filter({ hasText: 'One-time expense' }).first()
    await expect(expandedRow).toBeVisible()
    
    // Find the SVG icon within the expanded row
    const icon = expandedRow.locator('svg').first()
    await expect(icon).toBeVisible()
    
    // Step 6: Hover over the icon in the expanded row and verify custom tooltip appears
    await icon.hover()
    await page.waitForTimeout(300) // Give tooltip time to appear
    
    // Check for the custom tooltip element
    const tooltip = page.locator('[data-tooltip-content]').filter({ hasText: 'Test Account' })
    await expect(tooltip).toBeVisible({ timeout: 1000 })
    
    // Verify tooltip content
    const tooltipContent = await tooltip.getAttribute('data-tooltip-content')
    expect(tooltipContent).toContain('Test Account')
    expect(tooltipContent).toContain('one-time')
  })
})

