/**
 * E2E Test Helpers
 * 
 * Utility functions for common E2E test operations.
 */

import { Page } from '@playwright/test'

/**
 * Wait for an element to be visible and stable
 */
export async function waitForStable(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector)
  await element.waitFor({ state: 'visible', timeout })
  // Wait a bit more for any animations or state updates
  await page.waitForTimeout(100)
  return element
}

/**
 * Fill a form field and wait for it to be updated
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string,
  options?: { clear?: boolean }
) {
  const field = await waitForStable(page, selector)
  if (options?.clear) {
    await field.clear()
  }
  await field.fill(value)
  // Wait for any debounced updates
  await page.waitForTimeout(200)
}

/**
 * Click and wait for navigation or state update
 */
export async function clickAndWait(
  page: Page,
  selector: string,
  options?: { waitForNavigation?: boolean }
) {
  const element = await waitForStable(page, selector)
  
  if (options?.waitForNavigation) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      element.click(),
    ])
  } else {
    await element.click()
    // Wait for any state updates
    await page.waitForTimeout(200)
  }
}

/**
 * Get text content of an element
 */
export async function getText(page: Page, selector: string): Promise<string> {
  const element = await waitForStable(page, selector)
  return (await element.textContent()) || ''
}

/**
 * Check if an element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector)
    await element.waitFor({ state: 'visible', timeout: 1000 })
    return await element.isVisible()
  } catch {
    return false
  }
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 5000
) {
  return await page.waitForResponse(
    (response) => {
      const url = response.url()
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern)
      }
      return urlPattern.test(url)
    },
    { timeout }
  )
}

