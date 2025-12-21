import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/app/page'

// @vitest-environment jsdom

// Mock fetch
global.fetch = vi.fn()

describe('Transaction Amount Input', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API responses
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'acc1', name: 'Test Account', initialBalance: 1000, balanceAsOf: new Date().toISOString() }
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
            date: new Date().toISOString(),
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

    // Find and click the add transaction button
    const addButton = screen.getByRole('button', { name: /add|new|transaction/i }) || 
                     screen.getByText(/\+/) ||
                     document.querySelector('button[aria-label*="transaction"]')
    
    if (addButton) {
      await user.click(addButton)
    } else {
      // Try to find the transaction dialog trigger
      const transactionTriggers = screen.queryAllByText(/transaction/i)
      if (transactionTriggers.length > 0) {
        await user.click(transactionTriggers[0])
      }
    }

    // Wait for dialog to open
    await waitFor(() => {
      const amountInput = screen.queryByLabelText(/amount/i) || 
                         screen.queryByPlaceholderText(/amount/i) ||
                         document.querySelector('input[name="amount"]')
      expect(amountInput).toBeInTheDocument()
    })

    // Find the amount input
    const amountInput = screen.getByLabelText(/amount/i) || 
                       screen.getByPlaceholderText(/amount/i) ||
                       document.querySelector('input[name="amount"]') as HTMLInputElement

    // Enter a negative amount
    await user.clear(amountInput)
    await user.type(amountInput, '-100')

    // Find and submit the form
    const submitButton = screen.getByRole('button', { name: /save|submit|create|add transaction/i })
    await user.click(submitButton)

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

