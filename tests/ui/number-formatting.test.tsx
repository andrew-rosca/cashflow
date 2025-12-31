import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/app/page'

// @vitest-environment jsdom

// Mock fetch
global.fetch = vi.fn()

describe('Number Formatting Setting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    let formatNumbersWithoutDecimals = false
    
    // Mock successful API responses
    ;(global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'acc1', name: 'Test Account', initialBalance: 1234.56, balanceAsOf: '2025-01-15' }
          ]
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
          json: async () => [
            {
              accountId: 'acc1',
              date: '2025-01-20',
              balance: 1234.56,
              previousBalance: 1500.00
            }
          ]
        })
      }
      if (url.includes('/api/user/settings')) {
        if (options?.method === 'PUT') {
          // Update the setting
          const body = JSON.parse(options.body)
          formatNumbersWithoutDecimals = body.formatNumbersWithoutDecimals
          return Promise.resolve({
            ok: true,
            json: async () => ({
              formatNumbersWithoutDecimals
            })
          })
        } else {
          // GET request - return current setting
          return Promise.resolve({
            ok: true,
            json: async () => ({
              formatNumbersWithoutDecimals
            })
          })
        }
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`))
    })
  })

  it('should load and display current formatting preference', async () => {
    render(<Home />)

    // Wait for settings to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/user/settings'))
    })

    // Open settings dialog
    const settingsButton = screen.getByTitle('Settings')
    const user = userEvent.setup()
    await user.click(settingsButton)

    // Wait for settings dialog to open
    await waitFor(() => {
      expect(screen.getByText(/format numbers without decimals/i)).toBeInTheDocument()
    })

    // The toggle should be off by default (formatNumbersWithoutDecimals: false)
    // Find toggle by role (it doesn't have an accessible name)
    const toggles = screen.getAllByRole('switch')
    const toggle = toggles.find(t => t.getAttribute('aria-checked') === 'false')
    expect(toggle).toBeDefined()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('should toggle formatting preference and save to API', async () => {
    render(<Home />)

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/user/settings'))
    })

    // Open settings dialog
    const settingsButton = screen.getByTitle('Settings')
    const user = userEvent.setup()
    await user.click(settingsButton)

    // Wait for settings dialog
    await waitFor(() => {
      expect(screen.getByText(/format numbers without decimals/i)).toBeInTheDocument()
    })

    // Find and click the toggle (find by role, not by name)
    const toggles = screen.getAllByRole('switch')
    const toggle = toggles.find(t => t.getAttribute('aria-checked') === 'false')
    expect(toggle).toBeDefined()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    
    await user.click(toggle!)

    // Wait for the PUT request to be made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/user/settings'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"formatNumbersWithoutDecimals":true')
        })
      )
    })

    // Verify the toggle is now on
    await waitFor(() => {
      const updatedToggles = screen.getAllByRole('switch')
      const updatedToggle = updatedToggles.find(t => t.getAttribute('aria-checked') === 'true')
      expect(updatedToggle).toBeDefined()
    })
  })

  it('should load setting from API on page load', async () => {
    render(<Home />)

    // Wait for settings API to be called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/user/settings'))
    })

    // Verify the API was called with GET method (default)
    const settingsCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
      call[0]?.includes('/api/user/settings') && (!call[1] || call[1].method !== 'PUT')
    )
    expect(settingsCalls.length).toBeGreaterThan(0)
  })

  it('should persist setting when toggled off', async () => {
    render(<Home />)

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/user/settings'))
    })

    // Open settings dialog
    const settingsButton = screen.getByTitle('Settings')
    const user = userEvent.setup()
    await user.click(settingsButton)

    // Wait for settings dialog and find toggle
    await waitFor(() => {
      expect(screen.getByText(/format numbers without decimals/i)).toBeInTheDocument()
    })
    
    // Find toggle by its role and aria-checked attribute
    const toggles = screen.getAllByRole('switch')
    const toggle = toggles.find(t => t.getAttribute('aria-checked') === 'false')
    expect(toggle).toBeDefined()
    
    // Toggle on
    await user.click(toggle!)

    // Wait for PUT request with true
    await waitFor(() => {
      const putCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
        call[0]?.includes('/api/user/settings') && call[1]?.method === 'PUT'
      )
      return putCalls.length > 0 && JSON.parse(putCalls[putCalls.length - 1][1].body).formatNumbersWithoutDecimals === true
    })

    // Find toggle again and verify it's now checked
    await waitFor(() => {
      const updatedToggles = screen.getAllByRole('switch')
      const updatedToggle = updatedToggles.find(t => t.getAttribute('aria-checked') === 'true')
      expect(updatedToggle).toBeDefined()
    })

    // Toggle off
    const toggleOff = screen.getAllByRole('switch').find(t => t.getAttribute('aria-checked') === 'true')
    expect(toggleOff).toBeDefined()
    await user.click(toggleOff!)

    // Wait for PUT request with false
    await waitFor(() => {
      const putCalls = (global.fetch as any).mock.calls.filter((call: any[]) => 
        call[0]?.includes('/api/user/settings') && call[1]?.method === 'PUT'
      )
      return putCalls.length >= 2 && JSON.parse(putCalls[putCalls.length - 1][1].body).formatNumbersWithoutDecimals === false
    })
  })
})

