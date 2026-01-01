import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/app/page'

// @vitest-environment jsdom

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock fetch
global.fetch = vi.fn()

describe('Transaction Amount Input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockImplementation(() => {})
    localStorageMock.removeItem.mockImplementation(() => {})
    localStorageMock.clear.mockImplementation(() => {})
    // Mock successful API responses
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'acc1', name: 'Test Account', initialBalance: 1000, balanceAsOf: '2025-01-15' }
          ]
        })
      }
      if (url.includes('/api/transactions') && url.includes('POST')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'tx1',
            fromAccountId: 'acc1',
            toAccountId: 'acc1',
            amount: -100, // This should be negative if user entered -100
            date: '2025-01-15',
            description: 'Test transaction'
          })
        })
      }
      if (url.includes('/api/transactions')) {
        return Promise.resolve({
          ok: true,
          json: async () => []
        })
      }
      if (url.includes('/api/projections')) {
        return Promise.resolve({
          ok: true,
          json: async () => []
        })
      }
      if (url.includes('/api/user/settings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            formatNumbersWithoutDecimals: false
          })
        })
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`))
    })
  })

  it('should save negative amount as negative when user enters negative value', async () => {
    const user = userEvent.setup()
    render(<Home />)

    // Wait for accounts to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/accounts'))
    })

    // Find and click the "+" button to add transaction (it's in the Upcoming Transactions section)
    // There might be multiple "+" buttons, so find the one in the Upcoming Transactions section
    await waitFor(() => {
      const upcomingSection = screen.getByText('Upcoming Transactions')
      expect(upcomingSection).toBeInTheDocument()
    })
    
    // Find the "+" button that's a sibling or near the "Upcoming Transactions" heading
    const upcomingHeading = screen.getByText('Upcoming Transactions')
    const parent = upcomingHeading.parentElement
    const addButton = parent?.querySelector('button') || screen.getAllByText('+')[0]
    await user.click(addButton)

    // Wait for dialog to open and find the amount input
    await waitFor(() => {
      const amountInput = document.querySelector('input[name="amount"]')
      expect(amountInput).toBeInTheDocument()
    })

    // Find the amount input
    const amountInput = document.querySelector('input[name="amount"]') as HTMLInputElement

    // Enter a negative amount
    await user.clear(amountInput)
    await user.type(amountInput, '-100')

    // Find and submit the form - the button text is "Add" for new transactions or "Save" for edits
    // The button is outside the form with form="transaction-form" attribute
    await waitFor(() => {
      const submitButton = screen.queryByRole('button', { name: /^(Add|Save)$/i }) ||
                          document.querySelector('button[type="submit"][form="transaction-form"]') ||
                          document.querySelector('button[type="submit"]')
      expect(submitButton).toBeInTheDocument()
    })
    const submitButton = screen.queryByRole('button', { name: /^(Add|Save)$/i }) ||
                        document.querySelector('button[type="submit"][form="transaction-form"]') as HTMLButtonElement ||
                        document.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitButton).toBeTruthy()
    await user.click(submitButton!)

    // Wait for the POST request
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/transactions'),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    // Get the call arguments
    const postCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
      call[0]?.includes('/api/transactions') && call[1]?.method === 'POST'
    )

    expect(postCalls.length).toBeGreaterThan(0)
    const lastCall = postCalls[postCalls.length - 1]
    const requestBody = JSON.parse(lastCall[1].body)

    // The amount should be negative
    expect(requestBody.amount).toBe(-100)
  })
})

