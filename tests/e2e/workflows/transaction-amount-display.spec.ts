import { test, expect } from '../fixtures/test-fixtures'

/**
 * Transaction Amount Display Test
 * 
 * Tests that transaction amounts are displayed exactly as entered:
 * 1. Create a transaction with a positive amount and verify it displays correctly
 * 2. Create a transaction with a negative amount and verify it displays correctly
 */
test.describe('Transaction Amount Display', () => {
  test('should display positive amount correctly', async ({ page, testServer }) => {
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Calculate transaction date: today + 5 days (to ensure it's in the future)
    const today = new Date()
    const futureDate = new Date(today)
    futureDate.setDate(today.getDate() + 5)
    const transactionDay = futureDate.getDate()
    const transactionMonth = futureDate.toLocaleString('en-US', { month: 'short' })
    const transactionYear = futureDate.getFullYear()
    
    // Step 1: Create a new account
    const currentBalancesSection = page.locator('text=Current Balances').locator('..')
    const addAccountButton = currentBalancesSection.locator('button').filter({ hasText: '+' }).first()
    await addAccountButton.click()
    
    // Wait for the account to appear
    await page.waitForSelector('text=New Account', { timeout: 5000 })
    
    // Step 2: Create a transaction with a random positive amount
    const positiveAmount = Math.floor(Math.random() * 1000) + 1 // Random amount between 1 and 1000
    const description = `Test Positive ${positiveAmount}`
    
    // Click the "+" button in the Upcoming Transactions section
    const upcomingTransactionsSection = page.locator('text=Upcoming Transactions').locator('..')
    const addTransactionButton = upcomingTransactionsSection.locator('button').filter({ hasText: '+' }).first()
    await addTransactionButton.waitFor({ state: 'visible', timeout: 10000 })
    await addTransactionButton.click({ force: true, timeout: 5000 })
    
    // Wait for transaction dialog to appear
    await page.waitForSelector('form', { timeout: 5000 })
    await page.waitForSelector('input[name="amount"]', { timeout: 3000 })
    
    // Select the account
    const accountButton = page.locator('button').filter({ hasText: 'New Account' }).first()
    await accountButton.waitFor({ state: 'visible', timeout: 3000 })
    await accountButton.click()
    await page.waitForTimeout(300)
    
    // Fill in the date (use the calculated future date)
    await page.waitForSelector('input[placeholder="dd"]', { timeout: 5000 })
    const allDayInputs = page.locator('input[placeholder="dd"]')
    const dayInputCount = await allDayInputs.count()
    const txDayInput = allDayInputs.nth(dayInputCount - 1)
    
    await txDayInput.click()
    await txDayInput.clear()
    await txDayInput.fill(transactionDay.toString())
    await page.waitForTimeout(200)
    
    const allMonthInputs = page.locator('input[placeholder="MMM"]')
    const monthInputCount = await allMonthInputs.count()
    const txMonthInput = allMonthInputs.nth(monthInputCount - 1)
    await txMonthInput.click()
    await txMonthInput.clear()
    await txMonthInput.fill(transactionMonth)
    await page.waitForTimeout(500)
    
    const allYearInputs = page.locator('input[placeholder="YYYY"]')
    const yearInputCount = await allYearInputs.count()
    const txYearInput = allYearInputs.nth(yearInputCount - 1)
    await txYearInput.click()
    await txYearInput.clear()
    await txYearInput.fill(transactionYear.toString())
    await page.waitForTimeout(300)
    await txYearInput.press('Tab')
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    // Fill in positive amount
    const amountInput = page.locator('input[name="amount"]')
    await amountInput.fill(positiveAmount.toString())
    
    // Fill description
    const descriptionInput = page.locator('input[name="description"]')
    if (await descriptionInput.count() > 0) {
      await descriptionInput.fill(description)
    }
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: 'Add' })
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    
    // Set up response listeners BEFORE clicking submit
    const postResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/transactions') && response.request().method() === 'POST'
    )
    const getResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/transactions') && 
      response.request().method() === 'GET' &&
      response.url().includes('startDate')
    )
    
    // Click submit
    await submitButton.click()
    
    // Wait for both the POST and GET responses
    const [postResponse, getResponse] = await Promise.all([postResponsePromise, getResponsePromise])
    
    // Verify the POST response
    expect(postResponse.ok()).toBe(true)
    const transactionData = await postResponse.json()
    console.log('Transaction created:', transactionData)
    console.log('Transaction date:', transactionData.date)
    expect(transactionData.amount).toBe(positiveAmount)
    
    // Wait for dialog to close
    await page.waitForSelector('form', { state: 'hidden', timeout: 5000 }).catch(() => {})
    
    // Step 3: Verify the transaction appears in the UI
    // Wait for the GET request that happens after transaction creation
    const getResponseAfterCreate = await getResponsePromise
    const returnedTransactions = await getResponseAfterCreate.json()
    console.log('GET /api/transactions returned:', returnedTransactions.length, 'transactions')
    const foundInResponse = returnedTransactions.find((tx: any) => tx.description === description)
    expect(foundInResponse).toBeDefined()
    expect(foundInResponse.amount).toBe(positiveAmount)
    
    // Step 4: Use expect.poll() to wait for React to render the transaction in the DOM
    // This handles React 18+ async rendering and state batching
    // Simply verify that the description appears on the page
    await expect.poll(async () => {
      const textContent = await page.textContent('body')
      return textContent?.includes(description) ?? false
    }, {
      message: `Expected to find description "${description}" in page`,
      timeout: 15000,
      intervals: [100, 250, 500, 1000],
    }).toBe(true)
    
    // Once we know the description is there, find the amount
    let displayedAmount: number | null = null
    await expect.poll(async () => {
      // Find all font-mono elements (used for amounts)
      const amountElements = page.locator('span.font-mono')
      const count = await amountElements.count()
      for (let i = 0; i < count; i++) {
        const amountText = await amountElements.nth(i).textContent()
        if (amountText) {
          const amountValue = parseFloat(amountText.replace(/,/g, ''))
          if (Math.abs(amountValue - positiveAmount) < 0.01) {  // Allow for floating point errors
            displayedAmount = amountValue
            return amountValue
          }
        }
      }
      return null
    }, {
      message: `Expected to find transaction with amount ${positiveAmount} in UI`,
      timeout: 15000,
      intervals: [100, 250, 500, 1000],
    }).not.toBeNull()
    
    // Verify the displayed amount matches what we entered
    expect(displayedAmount).toBe(positiveAmount)
  })

  test('should display negative amount correctly', async ({ page, testServer }) => {
    // Navigate to the app
    await page.goto(testServer.baseUrl)
    await page.waitForLoadState('networkidle')
    
    // Calculate transaction date: today + 5 days (to ensure it's in the future)
    const today = new Date()
    const futureDate = new Date(today)
    futureDate.setDate(today.getDate() + 5)
    const transactionDay = futureDate.getDate()
    const transactionMonth = futureDate.toLocaleString('en-US', { month: 'short' })
    const transactionYear = futureDate.getFullYear()
    
    // Step 1: Create a new account
    const currentBalancesSection = page.locator('text=Current Balances').locator('..')
    const addAccountButton = currentBalancesSection.locator('button').filter({ hasText: '+' }).first()
    await addAccountButton.click()
    
    // Wait for the account to appear
    await page.waitForSelector('text=New Account', { timeout: 5000 })
    
    // Step 2: Create a transaction with a random negative amount
    const negativeAmount = -(Math.floor(Math.random() * 1000) + 1) // Random amount between -1 and -1000
    const description = `Test Negative ${Math.abs(negativeAmount)}`
    
    // Click the "+" button in the Upcoming Transactions section
    const upcomingTransactionsSection = page.locator('text=Upcoming Transactions').locator('..')
    const addTransactionButton = upcomingTransactionsSection.locator('button').filter({ hasText: '+' }).first()
    await addTransactionButton.waitFor({ state: 'visible', timeout: 10000 })
    await addTransactionButton.click({ force: true, timeout: 5000 })
    
    // Wait for transaction dialog to appear
    await page.waitForSelector('form', { timeout: 5000 })
    await page.waitForSelector('input[name="amount"]', { timeout: 3000 })
    
    // Select the account
    const accountButton = page.locator('button').filter({ hasText: 'New Account' }).first()
    await accountButton.waitFor({ state: 'visible', timeout: 3000 })
    await accountButton.click()
    await page.waitForTimeout(300)
    
    // Fill in the date (use the calculated future date)
    await page.waitForSelector('input[placeholder="dd"]', { timeout: 5000 })
    const allDayInputs2 = page.locator('input[placeholder="dd"]')
    const dayInputCount2 = await allDayInputs2.count()
    const txDayInput2 = allDayInputs2.nth(dayInputCount2 - 1)
    
    await txDayInput2.click()
    await txDayInput2.clear()
    await txDayInput2.fill(transactionDay.toString())
    await page.waitForTimeout(200)
    
    const allMonthInputs2 = page.locator('input[placeholder="MMM"]')
    const monthInputCount2 = await allMonthInputs2.count()
    const txMonthInput2 = allMonthInputs2.nth(monthInputCount2 - 1)
    await txMonthInput2.click()
    await txMonthInput2.clear()
    await txMonthInput2.fill(transactionMonth)
    await page.waitForTimeout(500)
    
    const allYearInputs2 = page.locator('input[placeholder="YYYY"]')
    const yearInputCount2 = await allYearInputs2.count()
    const txYearInput2 = allYearInputs2.nth(yearInputCount2 - 1)
    await txYearInput2.click()
    await txYearInput2.clear()
    await txYearInput2.fill(transactionYear.toString())
    await page.waitForTimeout(300)
    await txYearInput2.press('Tab')
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    
    // Fill in negative amount
    const amountInput = page.locator('input[name="amount"]')
    await amountInput.fill(negativeAmount.toString())
    
    // Fill description
    const descriptionInput = page.locator('input[name="description"]')
    if (await descriptionInput.count() > 0) {
      await descriptionInput.fill(description)
    }
    
    // Submit the form
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: 'Add' })
    await submitButton.waitFor({ state: 'visible', timeout: 5000 })
    
    // Set up response listeners BEFORE clicking submit
    const postResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/transactions') && response.request().method() === 'POST'
    )
    const getResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/transactions') && 
      response.request().method() === 'GET' &&
      response.url().includes('startDate')
    )
    
    // Click submit
    await submitButton.click()
    
    // Wait for both the POST and GET responses
    const [postResponse, getResponse] = await Promise.all([postResponsePromise, getResponsePromise])
    
    // Verify the POST response
    expect(postResponse.ok()).toBe(true)
    const transactionData = await postResponse.json()
    expect(transactionData.amount).toBe(negativeAmount)
    
    // Wait for dialog to close
    await page.waitForSelector('form', { state: 'hidden', timeout: 5000 }).catch(() => {})
    
    // Step 3: Verify the transaction appears in the UI
    // Check what transactions were returned
    const returnedTransactions = await getResponse.json()
    const foundInResponse = returnedTransactions.find((tx: any) => tx.description === description)
    
    // Verify the transaction is in the API response
    expect(foundInResponse).toBeDefined()
    expect(foundInResponse.amount).toBe(negativeAmount)
    
    // Step 4: Use expect.poll() to wait for React to render the transaction in the DOM
    // This handles React 18+ async rendering and state batching
    // Simply verify that the description appears on the page
    await expect.poll(async () => {
      const textContent = await page.textContent('body')
      return textContent?.includes(description) ?? false
    }, {
      message: `Expected to find description "${description}" in page`,
      timeout: 15000,
      intervals: [100, 250, 500, 1000],
    }).toBe(true)
    
    // Once we know the description is there, find the amount
    let displayedAmount: number | null = null
    await expect.poll(async () => {
      // Find all font-mono elements (used for amounts)
      const amountElements = page.locator('span.font-mono')
      const count = await amountElements.count()
      for (let i = 0; i < count; i++) {
        const amountText = await amountElements.nth(i).textContent()
        if (amountText) {
          const amountValue = parseFloat(amountText.replace(/,/g, ''))
          if (Math.abs(amountValue - negativeAmount) < 0.01) {  // Allow for floating point errors
            displayedAmount = amountValue
            return amountValue
          }
        }
      }
      return null
    }, {
      message: `Expected to find transaction with amount ${negativeAmount} in UI`,
      timeout: 15000,
      intervals: [100, 250, 500, 1000],
    }).not.toBeNull()
    
    // Verify the displayed amount matches what we entered
    expect(displayedAmount).toBe(negativeAmount)
  })
})

