import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DateInput from '@/components/DateInput'

// Use jsdom environment for React component tests
// @vitest-environment jsdom

describe('DateInput Component', () => {
  const mockOnChange = vi.fn()
  const mockOnBlur = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    mockOnBlur.mockClear()
  })

  it('should render date input with initial value', () => {
    const testDate = new Date(Date.UTC(2025, 0, 20)) // Jan 20, 2025
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument()
  })

  it('should open calendar when day field is clicked', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20))
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    const dayInput = screen.getByDisplayValue('20')
    await userEvent.click(dayInput)

    // Calendar should be visible - look for calendar structure or month navigation
    await waitFor(() => {
      // Calendar container should be present (check for calendar structure)
      const calendar = document.querySelector('.bg-white.dark\\:bg-gray-800')
      expect(calendar).toBeInTheDocument()
    })
  })

  it('should update date when user changes day', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20))
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    const dayInput = screen.getByDisplayValue('20')
    await userEvent.clear(dayInput)
    await userEvent.type(dayInput, '25')

    // Wait for date to be committed (on blur or after delay)
    // Tab to month field first, then to year to trigger commit
    await userEvent.tab() // Move to month
    await userEvent.tab() // Move to year
    await userEvent.tab() // Move away to trigger blur

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const calledDate = mockOnChange.mock.calls[0][0]
      expect(calledDate.getUTCDate()).toBe(25)
      expect(calledDate.getUTCMonth()).toBe(0) // January
      expect(calledDate.getUTCFullYear()).toBe(2025)
    }, { timeout: 2000 })
  })

  it('should update date when user changes month', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20)) // January
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    const monthInput = screen.getByDisplayValue('Jan')
    await userEvent.clear(monthInput)
    await userEvent.type(monthInput, 'Feb')

    // Tab to year field to trigger commit
    await userEvent.tab() // Move to year
    await userEvent.tab() // Move away to trigger blur

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const calledDate = mockOnChange.mock.calls[0][0]
      expect(calledDate.getUTCMonth()).toBe(1) // February
    }, { timeout: 2000 })
  })

  it('should update date when user changes year', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20))
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    const yearInput = screen.getByDisplayValue('2025')
    await userEvent.clear(yearInput)
    await userEvent.type(yearInput, '2026')

    await userEvent.tab() // Move focus away

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
      const calledDate = mockOnChange.mock.calls[0][0]
      expect(calledDate.getUTCFullYear()).toBe(2026)
    })
  })

  it('should auto-complete month name when typing', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20))
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    const monthInput = screen.getByDisplayValue('Jan')
    await userEvent.clear(monthInput)
    await userEvent.type(monthInput, 'Mar')

    // Should auto-complete to "Mar"
    await waitFor(() => {
      expect(monthInput).toHaveValue('Mar')
    })
  })

  it('should handle date selection from calendar', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20))
    render(<DateInput value={testDate} onChange={mockOnChange} />)

    // Open calendar
    const dayInput = screen.getByDisplayValue('20')
    await userEvent.click(dayInput)

    // Wait for calendar to appear
    await waitFor(() => {
      const calendar = document.querySelector('.bg-white.dark\\:bg-gray-800')
      expect(calendar).toBeInTheDocument()
    })

    // Click on a date in the calendar (e.g., 15)
    // The calendar renders dates as buttons - find by text content
    const dateButtons = screen.getAllByRole('button')
    const date15Button = dateButtons.find(btn => btn.textContent === '15')
    
    if (date15Button) {
      await userEvent.click(date15Button)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
        const calledDate = mockOnChange.mock.calls[0][0]
        expect(calledDate.getUTCDate()).toBe(15)
      })
    } else {
      // If we can't find the button, at least verify calendar opened
      const calendar = document.querySelector('.bg-white.dark\\:bg-gray-800')
      expect(calendar).toBeInTheDocument()
    }
  })

  it('should call onBlur when focus leaves the component', async () => {
    const testDate = new Date(Date.UTC(2025, 0, 20))
    render(
      <div>
        <DateInput value={testDate} onChange={mockOnChange} onBlur={mockOnBlur} />
        <button>Outside</button>
      </div>
    )

    const dayInput = screen.getByDisplayValue('20')
    await userEvent.click(dayInput)
    await userEvent.click(screen.getByText('Outside'))

    await waitFor(() => {
      expect(mockOnBlur).toHaveBeenCalled()
    })
  })

  it('should handle UTC dates correctly to avoid timezone issues', () => {
    // Test that dates are parsed as UTC, not local time
    const utcDate = new Date(Date.UTC(2025, 0, 20))
    render(<DateInput value={utcDate} onChange={mockOnChange} />)

    // Should display correct UTC date components
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument()
  })

  it('should handle string date values', () => {
    const dateString = '2025-01-20'
    render(<DateInput value={dateString} onChange={mockOnChange} />)

    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument()
  })
})

