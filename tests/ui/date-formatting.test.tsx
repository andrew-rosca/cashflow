import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Home from '@/app/page'
import { LogicalDate } from '@/lib/logical-date'

// @vitest-environment jsdom

// Mock fetch
global.fetch = vi.fn()

describe('Date Formatting in Projection Table', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API responses
    ;(global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('/api/accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'acc1', name: 'Test Account', initialBalance: 1000, balanceAsOf: '2025-01-01' }
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
        // Return projections for various dates to test day of week formatting
        // Use different balances so all rows appear (only rows with balance changes are shown)
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              accountId: 'acc1',
              date: '2025-01-09', // Thursday
              balance: 900,
              previousBalance: 1000
            },
            {
              accountId: 'acc1',
              date: '2025-01-10', // Friday
              balance: 800,
              previousBalance: 900
            },
            {
              accountId: 'acc1',
              date: '2025-01-11', // Saturday
              balance: 700,
              previousBalance: 800
            },
            {
              accountId: 'acc1',
              date: '2025-01-12', // Sunday
              balance: 600,
              previousBalance: 700
            },
            {
              accountId: 'acc1',
              date: '2025-01-13', // Monday
              balance: 500,
              previousBalance: 600
            }
          ]
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

  it('should display dates with day of week in projection table', async () => {
    render(<Home />)

    // Wait for table to render with projection data
    await waitFor(() => {
      expect(screen.getByText('Thu Jan 9')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify dates are displayed with day of week
    // Jan 9, 2025 is a Thursday
    expect(screen.getByText('Thu Jan 9')).toBeInTheDocument()
    
    // Jan 10, 2025 is a Friday
    expect(screen.getByText('Fri Jan 10')).toBeInTheDocument()
    
    // Jan 11, 2025 is a Saturday
    expect(screen.getByText('Sat Jan 11')).toBeInTheDocument()
    
    // Jan 12, 2025 is a Sunday
    expect(screen.getByText('Sun Jan 12')).toBeInTheDocument()
    
    // Jan 13, 2025 is a Monday
    expect(screen.getByText('Mon Jan 13')).toBeInTheDocument()
  })

  it('should format dates correctly for all days of the week', async () => {
    // Test with dates that cover all days of the week
    const testDates = [
      { date: '2025-01-06', expected: 'Mon Jan 6' },   // Monday
      { date: '2025-01-07', expected: 'Tue Jan 7' },   // Tuesday
      { date: '2025-01-08', expected: 'Wed Jan 8' },   // Wednesday
      { date: '2025-01-09', expected: 'Thu Jan 9' },  // Thursday
      { date: '2025-01-10', expected: 'Fri Jan 10' },  // Friday
      { date: '2025-01-11', expected: 'Sat Jan 11' },  // Saturday
      { date: '2025-01-12', expected: 'Sun Jan 12' },  // Sunday
    ]

    // Mock projections with test dates
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 'acc1', name: 'Test Account', initialBalance: 1000, balanceAsOf: '2025-01-01' }
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
        // Use different balances so all rows appear (only rows with balance changes are shown)
        return Promise.resolve({
          ok: true,
          json: async () => testDates.map(({ date }, index) => ({
            accountId: 'acc1',
            date,
            balance: 1000 - (index * 100),
            previousBalance: 1000 - ((index - 1) * 100)
          }))
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

    render(<Home />)

    // Wait for table to render with projection data
    await waitFor(() => {
      expect(screen.getByText('Mon Jan 6')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify all dates are formatted correctly
    for (const { expected } of testDates) {
      expect(screen.getByText(expected)).toBeInTheDocument()
    }
  })

  it('should verify day of week calculation is correct', () => {
    // Test that LogicalDate.dayOfWeek returns correct values
    // This is a sanity check for the underlying date library
    const dates = [
      { date: LogicalDate.from(2025, 1, 6), expectedDayOfWeek: 1, dayName: 'Mon' },   // Monday
      { date: LogicalDate.from(2025, 1, 7), expectedDayOfWeek: 2, dayName: 'Tue' },   // Tuesday
      { date: LogicalDate.from(2025, 1, 8), expectedDayOfWeek: 3, dayName: 'Wed' },   // Wednesday
      { date: LogicalDate.from(2025, 1, 9), expectedDayOfWeek: 4, dayName: 'Thu' },   // Thursday
      { date: LogicalDate.from(2025, 1, 10), expectedDayOfWeek: 5, dayName: 'Fri' },  // Friday
      { date: LogicalDate.from(2025, 1, 11), expectedDayOfWeek: 6, dayName: 'Sat' },  // Saturday
      { date: LogicalDate.from(2025, 1, 12), expectedDayOfWeek: 7, dayName: 'Sun' },  // Sunday
    ]

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    for (const { date, expectedDayOfWeek, dayName } of dates) {
      expect(date.dayOfWeek).toBe(expectedDayOfWeek)
      expect(dayNames[date.dayOfWeek - 1]).toBe(dayName)
    }
  })
})

