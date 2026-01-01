import { test, expect } from '../fixtures/test-fixtures'

/**
 * Transaction Hover Highlight
 *
 * Verifies that hovering a transaction in an expanded projection row
 * highlights the matching transaction in the Upcoming Transactions pane.
 */
test.describe('Transaction Hover Highlight', () => {
  test('highlights matching transaction in upcoming pane on hover', async ({ page, testServer }) => {
    test.setTimeout(60000)

    // Fix the calendar date so our future transaction is within the loaded window
    const calendarDate = '2026-02-01'
    const fixedTimestamp = Date.UTC(2026, 1, 1, 0, 0, 0, 0) // Feb 1, 2026
    await page.clock.install({ now: fixedTimestamp })

    // Create primary account
    const createAccountResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hover Account',
        initialBalance: 1000,
        balanceAsOf: calendarDate,
      }),
    })
    if (!createAccountResponse.ok) {
      const errorText = await createAccountResponse.text()
      throw new Error(`Failed to create account: ${createAccountResponse.status} - ${errorText}`)
    }
    const account = await createAccountResponse.json()

    // Create a counterparty account
    const createCounterResponse = await fetch(`${testServer.baseUrl}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hover Counterparty',
        initialBalance: 0,
        balanceAsOf: calendarDate,
      }),
    })
    if (!createCounterResponse.ok) {
      const errorText = await createCounterResponse.text()
      throw new Error(`Failed to create counterparty: ${createCounterResponse.status} - ${errorText}`)
    }
    const counterparty = await createCounterResponse.json()

    // Create a one-time future transaction on Feb 15, 2026
    const txDate = '2026-02-15'
    const createTxResponse = await fetch(`${testServer.baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccountId: account.id,
        toAccountId: counterparty.id,
        amount: -123.45,
        date: txDate,
        description: 'Hover Highlight Tx',
      }),
    })
    if (!createTxResponse.ok) {
      const errorText = await createTxResponse.text()
      throw new Error(`Failed to create transaction: ${createTxResponse.status} - ${errorText}`)
    }

    // Load the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')

    // Wait for projection table and the target date row
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 15000 })
    const dateRow = table.locator('tbody tr').filter({ hasText: 'Feb 15' }).first()
    await expect(dateRow).toBeVisible({ timeout: 15000 })

    // Expand the row
    await dateRow.click()
    await page.waitForSelector('tbody tr[data-expanded-row="true"]', { timeout: 15000 })
    const expandedRow = page.locator('tbody tr[data-expanded-row="true"]').filter({ hasText: 'Hover Highlight Tx' }).first()
    await expect(expandedRow).toBeVisible({ timeout: 15000 })

    // Locate the matching transaction in the Upcoming Transactions pane
    // Find the matching transaction text outside the projection table
    const candidates = page.locator('text=Hover Highlight Tx')
    const candidateCount = await candidates.count()
    let upcomingIndex: number | null = null
    for (let i = 0; i < candidateCount; i++) {
      const handle = await candidates.nth(i).elementHandle()
      if (!handle) continue
      const inTable = await handle.evaluate(el => el.closest('table') !== null)
      if (!inTable) {
        upcomingIndex = i
        break
      }
    }
    expect(upcomingIndex).not.toBeNull()
    const upcomingTx = page.locator('text=Hover Highlight Tx').nth(upcomingIndex ?? 0).locator('..')
    await expect(upcomingTx).toBeVisible({ timeout: 15000 })

    // Capture initial class (no highlight)
    const initialClass = await upcomingTx.getAttribute('class')
    expect(initialClass || '').not.toContain('bg-blue-100')

    // Hover the expanded row transaction
    await expandedRow.hover()

    // Wait for highlight to apply
    await expect(async () => {
      const cls = await upcomingTx.getAttribute('class')
      expect(cls || '').toContain('bg-blue-100')
    }).toPass({ timeout: 3000 })

    // Move mouse away to clear hover
    await page.mouse.move(0, 0)

    // Wait for highlight to clear
    await expect(async () => {
      const cls = await upcomingTx.getAttribute('class')
      expect(cls || '').not.toContain('bg-blue-100')
    }).toPass({ timeout: 3000 })
  })
})

